-- Allows school games to be saved and posted before their start time is announced.
alter table public.games alter column start_time drop not null;

-- A game with no announced time must stay unmatched; report the missing time without exposing opponent data.
create or replace function public.game_link_status(school text)
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
      coalesce(c.start_time = o.start_time, false)::int + (c.location = o.location)::int
        + (c.home_away <> o.home_away)::int as same_fields,
      coalesce(c.start_time = o.start_time, false) as same_time,
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
