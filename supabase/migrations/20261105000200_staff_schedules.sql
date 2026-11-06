-- Adds school-owned teams, games, transportation and the atomic game editor.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  sport text not null check (char_length(btrim(sport)) between 1 and 60),
  gender text not null check (gender in ('Boys', 'Girls', 'Coed')),
  level text not null check (level in ('Varsity', 'JV', 'Freshman')),
  season text not null check (season in ('Fall', 'Winter', 'Spring')),
  unique (school_id, sport, gender, level, season),
  unique (school_id, id)
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  team_id uuid not null,
  game_date date not null,
  start_time time not null,
  opponent_school_id text references public.schools(slug),
  opponent_name text,
  home_away text not null check (home_away in ('Home', 'Away')),
  location text not null check (char_length(btrim(location)) between 1 and 160),
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Postponed', 'Canceled')),
  notes text check (char_length(notes) <= 1000),
  revision integer not null default 1,
  foreign key (school_id, team_id) references public.teams(school_id, id),
  check (opponent_school_id is distinct from school_id),
  check ((opponent_school_id is null) <> (opponent_name is null)),
  check (opponent_name is null or char_length(btrim(opponent_name)) between 1 and 100)
);

create index games_school_date_idx on public.games(school_id, game_date, start_time);

create table public.transportation (
  game_id uuid primary key references public.games(id) on delete cascade,
  bus_departure time,
  pickup_location text check (char_length(pickup_location) <= 160),
  return_time time,
  notes text check (char_length(notes) <= 1000)
);

alter table public.teams enable row level security;
alter table public.games enable row level security;
alter table public.transportation enable row level security;
revoke all on public.teams, public.games, public.transportation from public, anon, authenticated;
grant select, insert, update on public.teams, public.games, public.transportation to authenticated;

-- This lookup sees only the signed-in account's verified invitation.
create function shore_private.can_manage_schedule(school text, include_office boolean default false)
returns boolean language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.users
    where role = 'site_admin' or (role = 'ad' and school_id = school)
      or (include_office and role = 'conference_office')
  );
$$;
revoke all on function shore_private.can_manage_schedule(text, boolean) from public, anon, authenticated;
grant execute on function shore_private.can_manage_schedule(text, boolean) to authenticated;

create policy teams_read on public.teams for select to authenticated
  using (shore_private.can_manage_schedule(school_id, true));
create policy teams_write on public.teams for all to authenticated
  using (shore_private.can_manage_schedule(school_id))
  with check (shore_private.can_manage_schedule(school_id));
create policy games_read on public.games for select to authenticated
  using (shore_private.can_manage_schedule(school_id, true));
create policy games_write on public.games for all to authenticated
  using (shore_private.can_manage_schedule(school_id))
  with check (shore_private.can_manage_schedule(school_id));
create policy transportation_access on public.transportation for all to authenticated
  using (exists (select 1 from public.games g where g.id = game_id and shore_private.can_manage_schedule(g.school_id)))
  with check (exists (select 1 from public.games g where g.id = game_id and shore_private.can_manage_schedule(g.school_id)));

-- The caller's database permissions apply to every write in this transaction.
create function public.save_staff_game(input jsonb)
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
  if target_game is null then
    insert into public.games (school_id, team_id, game_date, start_time, opponent_school_id,
      opponent_name, home_away, location, status, notes)
    values (school, selected_team, game.game_date, game.start_time, game.opponent_school_id,
      game.opponent_name, game.home_away, btrim(game.location), game.status, game.notes)
    returning id into saved_game;
  else
    update public.games g set team_id = selected_team, game_date = game.game_date,
      start_time = game.start_time, opponent_school_id = game.opponent_school_id,
      opponent_name = game.opponent_name, home_away = game.home_away, location = btrim(game.location),
      status = game.status, notes = game.notes, revision = g.revision + 1
    where g.id = target_game and g.school_id = school and g.revision = game.revision
    returning g.id into saved_game;
    if saved_game is null then
      raise exception 'The game changed or is no longer accessible. Reload the schedule and try again.' using errcode = '40001';
    end if;
  end if;

  insert into public.transportation (game_id, bus_departure, pickup_location, return_time, notes)
  values (saved_game, (input ->> 'bus_departure')::time, input ->> 'pickup_location',
    (input ->> 'return_time')::time, input ->> 'transport_notes')
  on conflict (game_id) do update set bus_departure = excluded.bus_departure,
    pickup_location = excluded.pickup_location, return_time = excluded.return_time, notes = excluded.notes;
  return saved_game;
end;
$$;
revoke all on function public.save_staff_game(jsonb) from public, anon, authenticated;
grant execute on function public.save_staff_game(jsonb) to authenticated;
