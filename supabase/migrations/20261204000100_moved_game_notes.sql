-- Adds "moves" to the public schedule: games that were marked Postponed and later posted at a different
-- date or time. The website uses them to leave a "Moved to" note on the old date and to mark the new game.
-- Only the current publication of a team counts, so a withdrawn schedule's old details stay hidden.
-- Read-only: no table changes. Apply to the test project first; never to the live project without Greg.

alter function public.read_published_schedule(text) rename to read_schedule_without_moves;
alter function public.read_schedule_without_moves(text) set schema shore_private;
revoke all on function shore_private.read_schedule_without_moves(text) from public, anon, authenticated;

create function shore_private.published_game_moves(p_school text)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('game_id', m.game_id, 'from_date', m.from_date,
    'from_time', m.from_time) order by m.game_id), '[]'::jsonb)
  from (
    -- The slot a game had when it was last marked Postponed, within its team's current publication.
    select distinct on (u.game_id) u.game_id, g.payload,
      u.before_game->>'game_date' as from_date, u.before_game->>'start_time' as from_time
    from public.publication_updates u
    join public.published_games g on g.id = u.game_id
    join public.team_publications p on p.school_id = g.school_id and p.team_id = g.team_id
      and p.season_year = g.season_year and p.publication_epoch = u.publication_epoch
    where u.kind = 'game_postponed' and u.before_game is not null
      and (p_school is null or g.school_id = p_school)
    order by u.game_id, u.occurred_at desc, u.id desc
  ) m
  -- Only games now posted at a different date or time count as moved.
  where m.from_date is not null and (m.payload->>'game_date', coalesce(m.payload->>'start_time', ''))
    is distinct from (m.from_date, coalesce(m.from_time, ''));
$$;
revoke all on function shore_private.published_game_moves(text) from public, anon, authenticated;
-- The calendar function signs in as service_role, which calls both helpers through the public reader.
grant execute on function shore_private.read_schedule_without_moves(text) to service_role;
grant execute on function shore_private.published_game_moves(text) to service_role;

create function public.read_published_schedule(p_school text default null)
returns jsonb language sql stable set search_path = '' as $$
  select shore_private.read_schedule_without_moves(p_school)
    || jsonb_build_object('moves', shore_private.published_game_moves(p_school));
$$;
revoke all on function public.read_published_schedule(text) from public, anon, authenticated;
grant execute on function public.read_published_schedule(text) to service_role;
