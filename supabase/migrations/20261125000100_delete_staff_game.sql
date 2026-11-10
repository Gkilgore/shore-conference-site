-- DRAFT for Greg: not yet applied or tested on the test project.
-- Lets an AD delete a game entered by mistake. Row-level security (games_write) already limits
-- changes to the AD's own school and site admins; this adds the missing delete permission.
-- The approved public copy in published_games is untouched: it stays posted until the AD reviews
-- and publishes the team, which removes it. Transportation and queued coach emails cascade.
grant delete on public.games to authenticated;

create function public.delete_staff_game(p_id uuid, p_revision integer)
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
end;
$$;
revoke all on function public.delete_staff_game(uuid, integer) from public, anon, authenticated;
grant execute on function public.delete_staff_game(uuid, integer) to authenticated;
