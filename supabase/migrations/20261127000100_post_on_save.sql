-- DRAFT for Greg, November 12, 2026: not applied or run anywhere yet.
-- Run after 20261125000100_delete_staff_game.sql in the test project, then run supabase/tests/post-on-save.sql.
--
-- Saving or deleting a school game now posts the change in the same transaction, so a save can never
-- succeed while the public schedule stays behind. The dashboard keeps its own posting step as a fallback;
-- once this runs, that step finds nothing left to post.
--
-- Rules:
-- * The public copy is written from the saved game, with a higher revision, so calendar subscriptions keep
--   the same event and pick up the change.
-- * A team that was never posted becomes posted with just this game. Its other private games stay private.
-- * A team that was taken down is not brought back by a save, because its earlier public copies would
--   reappear. The game stays saved, and the dashboard shows it as not posted with Post schedule on Teams.
-- * Deleting a game removes its public copy.
-- * An account that may edit but not post the school saves as before, without posting.
-- * Coach email queueing is switched off (Greg, November 12: no coach alerts for now).

create function shore_private.post_saved_game(p_id uuid, p_school text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  saved public.games;
  team public.teams;
  year integer;
  posted boolean;
begin
  if not shore_private.can_publish_school(p_school) then return false; end if;
  select * into saved from public.games where id = p_id and school_id = p_school;
  if saved.id is null then
    delete from public.published_games where id = p_id and school_id = p_school;
    return true;
  end if;
  select * into team from public.teams where id = saved.team_id;
  year := shore_private.schedule_year(saved.game_date, team.season);
  posted := exists(select 1 from public.team_publications
    where school_id = p_school and team_id = saved.team_id and season_year = year);
  if not posted and exists(select 1 from public.published_games
      where school_id = p_school and team_id = saved.team_id and season_year = year and id <> saved.id) then
    return false;
  end if;
  -- The game is written before its team is marked posted, so a first posting logs one "team posted"
  -- notice rather than a separate "game added" notice (see log_published_game_update).
  insert into public.published_games(id, school_id, team_id, season_year, payload, revision)
  values (saved.id, p_school, saved.team_id, year, shore_private.public_game_payload(saved), saved.revision)
  on conflict (id) do update set team_id = excluded.team_id, season_year = excluded.season_year,
    payload = excluded.payload, revision = greatest(public.published_games.revision + 1, excluded.revision),
    updated_at = statement_timestamp()
  where public.published_games.payload is distinct from excluded.payload
    or public.published_games.team_id <> excluded.team_id
    or public.published_games.season_year <> excluded.season_year;
  if not posted then
    insert into public.team_publications(school_id, team_id, season_year) values (p_school, saved.team_id, year)
    on conflict (school_id, team_id, season_year) do nothing;
  end if;
  return true;
end;
$$;
revoke all on function shore_private.post_saved_game(uuid, text) from public, anon;
grant execute on function shore_private.post_saved_game(uuid, text) to authenticated;

-- Same as 20261108000100, plus the posting step before returning.
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
  perform shore_private.post_saved_game(saved_game, school);
  return saved_game;
end;
$$;
revoke all on function public.save_staff_game(jsonb) from public, anon, authenticated;
grant execute on function public.save_staff_game(jsonb) to authenticated;

-- Same as 20261125000100, plus removing the public copy.
create or replace function public.delete_staff_game(p_id uuid, p_revision integer)
returns void language plpgsql set search_path = '' as $$
declare
  school text;
  removed uuid;
begin
  select g.school_id into school from public.games g where g.id = p_id;
  if school is null or not shore_private.can_manage_schedule(school) then
    raise exception 'This account cannot delete that game.' using errcode = '42501';
  end if;
  delete from public.games g where g.id = p_id and g.revision = p_revision returning g.id into removed;
  if removed is null then
    raise exception 'The game changed. Reload the schedule and try again.' using errcode = '40001';
  end if;
  perform shore_private.post_saved_game(p_id, school);
end;
$$;
revoke all on function public.delete_staff_game(uuid, integer) from public, anon, authenticated;
grant execute on function public.delete_staff_game(uuid, integer) to authenticated;

-- No coach alerts for now. Re-enable with: alter table public.games enable trigger games_queue_coach_emails;
alter table public.games disable trigger games_queue_coach_emails;
