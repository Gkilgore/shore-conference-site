-- DRAFT for Greg's review: bus confirmation and the conference link check used by the Schedule tab.

-- 1. Bus confirmation. For now the AD ticks this once transportation confirms the bus.
--    A later step may let the coordinator confirm from the transportation email instead.
alter table public.transportation add column bus_confirmed boolean not null default false;

-- save_staff_game now also saves bus_confirmed. Everything else is unchanged from 20261105000200.
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

-- 2. Conference link check (plan section 3). For each of one school's games against a member
--    school, says whether the other school has entered the same game and, if not, which field
--    differs. It never returns the other school's values.
--
--    It must read the other school's games, so it runs as the owner (security definer) and checks
--    the caller itself. Do NOT call shore_private.can_manage_schedule here: that helper relies on
--    row-level security to see only the caller's invitation, and an owner-run function skips it.
create function public.game_link_status(school text)
returns table (game_id uuid, linked boolean, reason text)
language sql stable security definer set search_path = '' as $$
  with caller as (
    select 1 from public.users u
    where u.email = shore_private.verified_staff_email()
      and (u.role in ('site_admin', 'conference_office') or (u.role = 'ad' and u.school_id = school))
  ),
  own as (
    select g.id, g.game_date, g.start_time, g.location, g.home_away, g.status, g.opponent_school_id,
      t.sport, t.gender, t.level, s.name as opponent
    from public.games g
    join public.teams t on t.id = g.team_id
    join public.schools s on s.slug = g.opponent_school_id and s.is_conference_member
    where g.school_id = school and exists (select 1 from caller)
  ),
  candidates as (
    select o.id,
      (c.start_time = o.start_time)::int + (c.location = o.location)::int
        + (c.home_away <> o.home_away)::int as same_fields,
      c.start_time = o.start_time as same_time,
      c.location = o.location as same_location,
      c.home_away <> o.home_away as mirrored
    from own o
    join public.games c on c.school_id = o.opponent_school_id and c.opponent_school_id = school
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
      when b.same_fields = 3 then 'On the conference calendar'
      else concat_ws(', ',
        case when not b.same_time then 'Time' end,
        case when not b.same_location then 'Location' end,
        case when not b.mirrored then 'Home/away' end) || ' doesn''t match'
    end
  from own o left join best b on b.id = o.id;
$$;
revoke all on function public.game_link_status(text) from public, anon, authenticated;
grant execute on function public.game_link_status(text) to authenticated;
