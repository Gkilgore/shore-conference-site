-- Matching no longer compares location: the home school's location is the one that counts, so the away
-- school's wording ("Main Gym" vs "Shore Regional Main Gym") never keeps two entries apart.
-- A game matches when the schools, home and away, date, start time, sport, gender and level agree.
create or replace function public.game_link_status(school text)
returns table (game_id uuid, linked boolean, reason text)
language sql stable security definer set search_path = '' as $$
  with caller as (
    select 1 from public.users u
    where u.email = shore_private.verified_staff_email()
      and (u.role in ('site_admin', 'conference_office') or (u.role = 'ad' and u.school_id = school))
  ),
  own as (
    select g.id, g.game_date, g.start_time, g.home_away, g.status,
      coalesce(g.opponent_school_id, g.opponent_directory_slug) as opponent_school_id,
      t.sport, t.gender, t.level, opponent.name as opponent,
      own_school.is_conference_member as own_is_member,
      opponent.is_conference_member as opponent_is_member
    from public.games g
    join public.teams t on t.id = g.team_id
    join public.schools own_school on own_school.slug = g.school_id
    join public.schools opponent on opponent.slug = coalesce(g.opponent_school_id, g.opponent_directory_slug)
    where g.school_id = school and exists (select 1 from caller)
      and exists (select 1 from public.users u where u.role = 'ad' and u.school_id = own_school.slug)
      and exists (select 1 from public.users u where u.role = 'ad' and u.school_id = opponent.slug)
  ),
  candidates as (
    select o.id,
      coalesce(c.start_time = o.start_time, false)::int + (c.home_away <> o.home_away)::int as same_fields,
      coalesce(c.start_time = o.start_time, false) as same_time,
      c.home_away <> o.home_away as mirrored
    from own o
    join public.games c on c.school_id = o.opponent_school_id
      and coalesce(c.opponent_school_id, c.opponent_directory_slug) = school
      and c.game_date = o.game_date and c.status = 'Scheduled'
      and exists (select 1 from public.users u where u.role = 'ad' and u.school_id = c.school_id)
    join public.teams ct on ct.id = c.team_id
      and ct.sport = o.sport and ct.gender = o.gender and ct.level = o.level
  ),
  best as (
    select distinct on (id) * from candidates order by id, same_fields desc
  )
  select o.id,
    o.status = 'Scheduled' and coalesce(b.same_fields = 2, false),
    case
      when o.status <> 'Scheduled' then 'This game is ' || lower(o.status)
      when b.id is null then o.opponent || ' has no matching game on this date'
      when b.same_fields = 2 and o.own_is_member and o.opponent_is_member then 'On the conference calendar'
      when b.same_fields = 2 then 'Both schools entered the same game'
      else concat_ws(', ',
        case when not b.same_time then 'Time' end,
        case when not b.mirrored then 'Home/away' end) || ' doesn''t match'
    end
  from own o left join best b on b.id = o.id;
$$;
revoke all on function public.game_link_status(text) from public, anon, authenticated;
grant execute on function public.game_link_status(text) to authenticated;
