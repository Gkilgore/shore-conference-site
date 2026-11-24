-- Adds "on_platform" to each school in the public schedule: true when the school has an AD account, the same
-- test matching already uses. The calendar function lists a member school's posted game on the conference
-- calendar by itself when its opponent is a conference member that isn't on the platform.
-- Read-only: no table changes. Apply to the test project first; never to the live project without Greg.
alter function public.read_published_schedule(text) rename to read_schedule_without_platform;
alter function public.read_schedule_without_platform(text) set schema shore_private;
revoke all on function shore_private.read_schedule_without_platform(text) from public, anon, authenticated;
grant execute on function shore_private.read_schedule_without_platform(text) to service_role;

create function public.read_published_schedule(p_school text default null)
returns jsonb language sql stable set search_path = '' as $$
  select base || jsonb_build_object('schools', (
    select coalesce(jsonb_agg(school || jsonb_build_object('on_platform', exists(
      select 1 from public.users u where u.role = 'ad' and u.school_id = school->>'slug'))
      order by school->>'slug'), '[]'::jsonb)
    from jsonb_array_elements(base->'schools') school))
  from (select shore_private.read_schedule_without_platform(p_school) base) schedule;
$$;
revoke all on function public.read_published_schedule(text) from public, anon, authenticated;
grant execute on function public.read_published_schedule(text) to service_role;
