-- Adds an optional early-dismissal time that is public only on its owning school's schedule and feed.
-- Apply after 20261129000100_staff_team_removal.sql in the TEST project. Do not apply to the live project.
--
-- The conference projection intentionally omits this school-specific value.
alter table public.transportation add column early_dismissal_time time;

create or replace function shore_private.public_game_payload(g public.games)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',g.id,'school_id',g.school_id,'team_id',g.team_id,
    'game_date',g.game_date,'start_time',g.start_time,'home_away',g.home_away,
    'opponent_school_id',g.opponent_school_id,'opponent_name',g.opponent_name,
    'location',g.location,'status',g.status,'notes',g.notes,
    'teams',jsonb_build_object('sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season),
    'transportation',jsonb_build_object('bus_departure',tr.bus_departure,'pickup_location',tr.pickup_location,
      'return_time',tr.return_time) ||
      case when tr.early_dismissal_time is null then '{}'::jsonb
        else jsonb_build_object('early_dismissal_time',tr.early_dismissal_time) end)
  from public.teams t left join public.transportation tr on tr.game_id=g.id where t.id=g.team_id;
$$;

-- Keep the current save-on-save behavior while storing the new optional value atomically with the game.
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

  insert into public.transportation
    (game_id, bus_departure, pickup_location, return_time, early_dismissal_time, notes, bus_confirmed)
  values
    (saved_game, (input ->> 'bus_departure')::time, input ->> 'pickup_location',
      (input ->> 'return_time')::time, (input ->> 'early_dismissal_time')::time,
      input ->> 'transport_notes', coalesce((input ->> 'bus_confirmed')::boolean, false))
  on conflict (game_id) do update set bus_departure = excluded.bus_departure,
    pickup_location = excluded.pickup_location, return_time = excluded.return_time,
    early_dismissal_time = excluded.early_dismissal_time, notes = excluded.notes,
    bus_confirmed = excluded.bus_confirmed;
  perform shore_private.post_saved_game(saved_game, school);
  return saved_game;
end;
$$;
revoke all on function public.save_staff_game(jsonb) from public, anon, authenticated;
grant execute on function public.save_staff_game(jsonb) to authenticated;
