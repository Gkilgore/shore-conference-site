-- Adds a statewide opponent catalog and school-owned shortlists. Directory entries are not
-- platform identities: only schools with a public.schools row can participate in matching.
create table public.opponent_directory (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  updated_at timestamptz not null default statement_timestamp()
);

alter table public.opponent_directory enable row level security;
revoke all on public.opponent_directory from public, anon, authenticated;
grant select on public.opponent_directory to anon, authenticated;
create policy "Read opponent directory" on public.opponent_directory
  for select to anon, authenticated using (true);

create table public.school_opponents (
  school_id text not null references public.schools(slug) on delete cascade,
  opponent_slug text not null references public.opponent_directory(slug) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key (school_id, opponent_slug),
  check (school_id <> opponent_slug)
);

alter table public.school_opponents enable row level security;
revoke all on public.school_opponents from public, anon, authenticated;
grant select, insert, delete on public.school_opponents to authenticated;
create policy "Read own opponent list" on public.school_opponents
  for select to authenticated using (shore_private.can_manage_schedule(school_id));
create policy "Add to own opponent list" on public.school_opponents
  for insert to authenticated with check (shore_private.can_manage_schedule(school_id));
create policy "Remove from own opponent list" on public.school_opponents
  for delete to authenticated using (shore_private.can_manage_schedule(school_id));

-- Existing conference schools keep their current options as a starting list.
insert into public.opponent_directory(slug, name)
select slug, name from public.schools
on conflict (slug) do update set name = excluded.name, updated_at = statement_timestamp();

insert into public.school_opponents(school_id, opponent_slug)
select own.slug, opponent.slug
from public.schools own
cross join public.schools opponent
where opponent.is_conference_member and own.slug <> opponent.slug
on conflict do nothing;

alter table public.games
  add column opponent_directory_slug text references public.opponent_directory(slug) on delete set null;

create function public.import_opponent_directory(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor_role text;
  imported integer;
begin
  select u.role into actor_role
  from public.users u where u.email = shore_private.verified_staff_email();
  if actor_role is distinct from 'site_admin' then
    raise exception 'Only a site admin can update the master opponent list.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 2000 then
    raise exception 'Upload up to 2,000 schools at a time.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_rows) item
    where jsonb_typeof(item) is distinct from 'object'
      or coalesce(item->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or char_length(coalesce(item->>'slug', '')) > 80
      or char_length(btrim(coalesce(item->>'name', ''))) not between 1 and 100
  ) or exists (
    select 1 from jsonb_array_elements(p_rows) item
    group by item->>'slug' having count(*) > 1
  ) then
    raise exception 'Each row needs a unique slug and a school name of up to 100 characters.' using errcode = '22023';
  end if;

  insert into public.opponent_directory(slug, name)
  select item->>'slug', btrim(item->>'name') from jsonb_array_elements(p_rows) item
  on conflict (slug) do update
    set name = excluded.name, updated_at = statement_timestamp();
  get diagnostics imported = row_count;
  return jsonb_build_object('imported', imported);
end;
$$;
revoke all on function public.import_opponent_directory(jsonb) from public, anon, authenticated;
grant execute on function public.import_opponent_directory(jsonb) to authenticated;

-- Preserve the catalog key on games so a listed non-platform opponent remains non-matchable,
-- then becomes resolvable if that school is later enrolled on the platform.
create or replace function shore_private.public_game_payload(g public.games)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',g.id,'school_id',g.school_id,'team_id',g.team_id,
    'game_date',g.game_date,'start_time',g.start_time,'home_away',g.home_away,
    'opponent_school_id',g.opponent_school_id,'opponent_directory_slug',g.opponent_directory_slug,
    'opponent_name',g.opponent_name,'location',g.location,'status',g.status,'notes',g.notes,
    'teams',jsonb_build_object('sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season),
    'transportation',jsonb_build_object('bus_departure',tr.bus_departure,'pickup_location',tr.pickup_location,
      'return_time',tr.return_time) ||
      case when tr.early_dismissal_time is null then '{}'::jsonb
        else jsonb_build_object('early_dismissal_time',tr.early_dismissal_time) end)
  from public.teams t left join public.transportation tr on tr.game_id=g.id where t.id=g.team_id;
$$;

create or replace function public.save_staff_game(input jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  school text := input ->> 'school_id';
  target_game uuid := (input ->> 'id')::uuid;
  saved_game uuid;
  selected_team uuid;
  game public.games;
begin
  if not shore_private.can_manage_schedule(school) then
    raise exception 'This account cannot edit that school.' using errcode = '42501';
  end if;
  perform set_config('shore.import_batch', coalesce(input ->> 'import_batch', ''), true);

  insert into public.teams (school_id, sport, gender, level, season)
  values (school, btrim(input ->> 'sport'), input ->> 'gender', input ->> 'level', input ->> 'season')
  on conflict (school_id, sport, gender, level, season) do nothing
  returning id into selected_team;

  if selected_team is null then
    select id into selected_team from public.teams
    where school_id = school and sport = btrim(input ->> 'sport')
      and gender = input ->> 'gender' and level = input ->> 'level' and season = input ->> 'season';
  end if;

  game := jsonb_populate_record(null::public.games, input - 'id' - 'team_id');
  if game.opponent_directory_slug is not null
    and game.opponent_school_id is not null
    and game.opponent_directory_slug <> game.opponent_school_id then
    raise exception 'The selected opponent does not match its directory entry.' using errcode = '22023';
  end if;
  if target_game is null then
    insert into public.games (school_id, team_id, game_date, start_time, opponent_school_id,
      opponent_directory_slug, opponent_name, home_away, location, status, notes)
    values (school, selected_team, game.game_date, game.start_time, game.opponent_school_id,
      game.opponent_directory_slug, game.opponent_name, game.home_away, btrim(game.location), game.status, game.notes)
    returning id into saved_game;
  else
    update public.games g set team_id = selected_team, game_date = game.game_date,
      start_time = game.start_time, opponent_school_id = game.opponent_school_id,
      opponent_directory_slug = game.opponent_directory_slug, opponent_name = game.opponent_name,
      home_away = game.home_away, location = btrim(game.location),
      status = game.status, notes = game.notes, revision = g.revision + 1
    where g.id = target_game and g.school_id = school and g.revision = game.revision
    returning g.id into saved_game;
    if saved_game is null then
      raise exception 'The game changed or is no longer accessible. Reload the schedule and try again.' using errcode = '40001';
    end if;
  end if;

  insert into public.transportation
    (game_id, bus_departure, pickup_location, return_time, early_dismissal_time, notes)
  values
    (saved_game, (input ->> 'bus_departure')::time, input ->> 'pickup_location',
      (input ->> 'return_time')::time, (input ->> 'early_dismissal_time')::time,
      input ->> 'transport_notes')
  on conflict (game_id) do update set bus_departure = excluded.bus_departure,
    pickup_location = excluded.pickup_location, return_time = excluded.return_time,
    early_dismissal_time = excluded.early_dismissal_time, notes = excluded.notes;
  perform shore_private.post_saved_game(saved_game, school);
  return saved_game;
end;
$$;
revoke all on function public.save_staff_game(jsonb) from public, anon, authenticated;
grant execute on function public.save_staff_game(jsonb) to authenticated;

-- Only an existing platform school can be matched; conference publication remains member-only.
create or replace function public.game_link_status(school text)
returns table (game_id uuid, linked boolean, reason text)
language sql stable security definer set search_path = '' as $$
  with caller as (
    select 1 from public.users u
    where u.email = shore_private.verified_staff_email()
      and (u.role in ('site_admin', 'conference_office') or (u.role = 'ad' and u.school_id = school))
  ),
  own as (
    select g.id, g.game_date, g.start_time, g.location, g.home_away, g.status,
      coalesce(g.opponent_school_id, g.opponent_directory_slug) as opponent_school_id,
      t.sport, t.gender, t.level, opponent.name as opponent,
      own_school.is_conference_member as own_is_member,
      opponent.is_conference_member as opponent_is_member
    from public.games g
    join public.teams t on t.id = g.team_id
    join public.schools own_school on own_school.slug = g.school_id
    join public.schools opponent on opponent.slug = coalesce(g.opponent_school_id, g.opponent_directory_slug)
    where g.school_id = school and exists (select 1 from caller)
  ),
  candidates as (
    select o.id,
      coalesce(c.start_time = o.start_time, false)::int + (c.location = o.location)::int
        + (c.home_away <> o.home_away)::int as same_fields,
      coalesce(c.start_time = o.start_time, false) as same_time,
      c.location = o.location as same_location,
      c.home_away <> o.home_away as mirrored
    from own o
    join public.games c on c.school_id = o.opponent_school_id
      and coalesce(c.opponent_school_id, c.opponent_directory_slug) = school
      and c.game_date = o.game_date and c.status = 'Scheduled'
    join public.teams ct on ct.id = c.team_id
      and ct.sport = o.sport and ct.gender = o.gender and ct.level = o.level
  ),
  best as (
    select distinct on (id) * from candidates order by id, same_fields desc
  )
  select o.id,
    o.status = 'Scheduled' and coalesce(b.same_fields = 3, false),
    case
      when o.status <> 'Scheduled' then 'This game is ' || lower(o.status)
      when b.id is null then o.opponent || ' has no matching game on this date'
      when b.same_fields = 3 and o.own_is_member and o.opponent_is_member then 'On the conference calendar'
      when b.same_fields = 3 then 'Both schools entered the same game'
      else concat_ws(', ',
        case when not b.same_time then 'Time' end,
        case when not b.same_location then 'Location' end,
        case when not b.mirrored then 'Home/away' end) || ' doesn''t match'
    end
  from own o left join best b on b.id = o.id;
$$;
revoke all on function public.game_link_status(text) from public, anon, authenticated;
grant execute on function public.game_link_status(text) to authenticated;
