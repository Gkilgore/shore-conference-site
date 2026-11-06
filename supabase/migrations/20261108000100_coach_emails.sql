-- DRAFT for Greg's review: school coach lists and the coach email outbox.
-- Emails are only queued here. Nothing is sent until Resend is set up (see docs/coach-emails.md).

-- 1. Coaches and the teams they coach. A coach can coach several teams (for example
--    Girls Varsity and JV Soccer), and a team can have several coaches.
create table public.coaches (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  name text check (name is null or char_length(btrim(name)) between 1 and 100),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  unique (school_id, email)
);

create table public.coach_teams (
  coach_id uuid not null references public.coaches(id) on delete cascade,
  sport text not null check (char_length(btrim(sport)) between 1 and 60),
  gender text not null check (gender in ('Boys', 'Girls', 'Coed')),
  level text not null check (level in ('Varsity', 'JV', 'Freshman')),
  primary key (coach_id, sport, gender, level)
);

-- 2. Outbox: one row per email that should go to a coach. The sender (later) reads queued rows,
--    groups rows that share a batch_id into one summary per coach, and marks them sent.
create table public.coach_email_outbox (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  coach_id uuid not null references public.coaches(id) on delete cascade,
  kind text not null check (kind in ('welcome', 'scheduled', 'changed', 'postponed', 'canceled')),
  game_id uuid references public.games(id) on delete cascade,
  batch_id uuid,
  previous jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  check ((kind = 'welcome') = (game_id is null))
);
create index coach_email_outbox_queue_idx on public.coach_email_outbox(school_id, status, created_at);

alter table public.coaches enable row level security;
alter table public.coach_teams enable row level security;
alter table public.coach_email_outbox enable row level security;
revoke all on public.coaches, public.coach_teams, public.coach_email_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.coaches, public.coach_teams to authenticated;
grant select, insert on public.coach_email_outbox to authenticated;

-- Coach emails are the school's private contacts: its AD and site admins only, not the conference office.
create policy own_school_coaches on public.coaches for all to authenticated
  using (shore_private.can_manage_schedule(school_id))
  with check (shore_private.can_manage_schedule(school_id));
create policy own_school_coach_teams on public.coach_teams for all to authenticated
  using (exists (select 1 from public.coaches c where c.id = coach_id and shore_private.can_manage_schedule(c.school_id)))
  with check (exists (select 1 from public.coaches c where c.id = coach_id and shore_private.can_manage_schedule(c.school_id)));
create policy read_own_school_outbox on public.coach_email_outbox for select to authenticated
  using (shore_private.can_manage_schedule(school_id));
-- ADs may queue only welcome (invite) emails themselves; game emails come from the trigger below.
create policy queue_own_coach_invite on public.coach_email_outbox for insert to authenticated
  with check (kind = 'welcome' and status = 'queued' and shore_private.can_manage_schedule(school_id)
    and exists (select 1 from public.coaches c where c.id = coach_id and c.school_id = coach_email_outbox.school_id));

-- 3. Save a coach and their whole team list at once, and optionally queue an invite.
create function public.save_coach(input jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  school text := input ->> 'school_id';
  saved uuid := (input ->> 'id')::uuid;
begin
  if not shore_private.can_manage_schedule(school) then
    raise exception 'This account cannot edit that school.' using errcode = '42501';
  end if;
  if saved is null then
    insert into public.coaches (school_id, name, email)
    values (school, nullif(btrim(input ->> 'name'), ''), lower(btrim(input ->> 'email')))
    returning id into saved;
  else
    update public.coaches set name = nullif(btrim(input ->> 'name'), ''), email = lower(btrim(input ->> 'email'))
    where id = saved and school_id = school returning id into saved;
    if saved is null then
      raise exception 'That coach is no longer on this school''s list.' using errcode = 'P0002';
    end if;
    delete from public.coach_teams where coach_id = saved;
  end if;
  insert into public.coach_teams (coach_id, sport, gender, level)
  select distinct saved, btrim(team ->> 'sport'), team ->> 'gender', team ->> 'level'
  from jsonb_array_elements(coalesce(input -> 'teams', '[]'::jsonb)) as team;
  if coalesce((input ->> 'invite')::boolean, false) then
    insert into public.coach_email_outbox (school_id, coach_id, kind) values (school, saved, 'welcome');
  end if;
  return saved;
end;
$$;
revoke all on function public.save_coach(jsonb) from public, anon, authenticated;
grant execute on function public.save_coach(jsonb) to authenticated;

-- 4. Queue coach emails whenever a game is added or its key details change, however it was saved.
--    Runs as the owner so it can write the outbox; it only copies details of the game being saved.
create function shore_private.queue_coach_emails()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  team public.teams;
  email_kind text;
  before jsonb;
  batch uuid := nullif(current_setting('shore.import_batch', true), '')::uuid;
begin
  select * into team from public.teams where id = new.team_id;
  if tg_op = 'INSERT' then
    email_kind := 'scheduled';
  else
    if (old.game_date, old.start_time, old.location, old.home_away, old.status,
        old.opponent_school_id, old.opponent_name, old.team_id)
       is not distinct from
       (new.game_date, new.start_time, new.location, new.home_away, new.status,
        new.opponent_school_id, new.opponent_name, new.team_id) then
      return new;
    end if;
    email_kind := case when new.status <> old.status and new.status in ('Postponed', 'Canceled')
      then lower(new.status) else 'changed' end;
    before := jsonb_build_object('game_date', old.game_date, 'start_time', old.start_time,
      'location', old.location, 'home_away', old.home_away, 'status', old.status);
    batch := null;
  end if;
  insert into public.coach_email_outbox (school_id, coach_id, kind, game_id, batch_id, previous)
  select distinct new.school_id, c.id, email_kind, new.id, batch, before
  from public.coaches c
  join public.coach_teams ct on ct.coach_id = c.id
  where c.school_id = new.school_id and lower(ct.sport) = lower(team.sport)
    and ct.gender = team.gender and ct.level = team.level;
  return new;
end;
$$;
revoke all on function shore_private.queue_coach_emails() from public, anon, authenticated;

create trigger games_queue_coach_emails after insert or update on public.games
  for each row execute function shore_private.queue_coach_emails();

-- 5. save_staff_game marks games saved by one CSV import with the same batch, so each coach gets
--    one summary email for the whole import. Otherwise unchanged from 20261107000100.
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

  insert into public.transportation (game_id, bus_departure, pickup_location, return_time, notes, bus_confirmed)
  values (saved_game, (input ->> 'bus_departure')::time, input ->> 'pickup_location',
    (input ->> 'return_time')::time, input ->> 'transport_notes', coalesce((input ->> 'bus_confirmed')::boolean, false))
  on conflict (game_id) do update set bus_departure = excluded.bus_departure,
    pickup_location = excluded.pickup_location, return_time = excluded.return_time, notes = excluded.notes,
    bus_confirmed = excluded.bus_confirmed;
  return saved_game;
end;
$$;
revoke all on function public.save_staff_game(jsonb) from public, anon, authenticated;
grant execute on function public.save_staff_game(jsonb) to authenticated;
