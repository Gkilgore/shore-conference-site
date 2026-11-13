-- Applied and permission-tested in test project jrtcyihpdrcnhxgproyw on November 12, 2026.
-- Each school's list of venues, picked from a dropdown in the game editor.
-- Venue names are public (they already appear on public calendars), so anyone can read every school's
-- list. That lets an AD pick from the home school's list for an away game. Only the school's AD and
-- site admins can change a list.
--
-- Games still store the venue name as text in games.location, which the match check compares.
-- Picking from the home school's list keeps both schools' entries spelled the same.
-- Renaming a venue does not change games already saved under the old name.
create table public.school_venues (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  address text check (address is null or char_length(address) <= 200)
);
create unique index school_venues_name_idx on public.school_venues(school_id, lower(btrim(name)));

alter table public.school_venues enable row level security;
revoke all on public.school_venues from public, anon, authenticated;
grant select on public.school_venues to anon, authenticated;
grant insert, update, delete on public.school_venues to authenticated;

create policy "Read every school's venues" on public.school_venues
  for select to anon, authenticated using (true);
create policy "Add own school venues" on public.school_venues
  for insert to authenticated with check (shore_private.can_manage_schedule(school_id));
create policy "Edit own school venues" on public.school_venues
  for update to authenticated
  using (shore_private.can_manage_schedule(school_id))
  with check (shore_private.can_manage_schedule(school_id));
create policy "Remove own school venues" on public.school_venues
  for delete to authenticated using (shore_private.can_manage_schedule(school_id));

insert into public.school_venues (school_id, name) values
  ('marlboro', 'Marlboro Gym'), ('marlboro', 'Marlboro Turf Field'),
  ('colts-neck', 'Colts Neck Courts'), ('colts-neck', 'Colts Neck Field 2'), ('colts-neck', 'Colts Neck Gym'),
  ('shore-regional', 'Shore Regional East Field'), ('shore-regional', 'Shore Regional Gym'),
  ('shore-regional', 'Shore Regional Turf Field');
