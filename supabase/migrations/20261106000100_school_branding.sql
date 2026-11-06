-- Lets each AD set their own school's colors and logo. Site admins can set any school's.
alter table public.schools
  add column primary_color text check (primary_color ~ '^#[0-9a-f]{6}$'),
  add column accent_color text check (accent_color ~ '^#[0-9a-f]{6}$'),
  add column logo_path text check (
    logo_path is null or (logo_path like slug || '/%' and char_length(logo_path) <= 200)
  );

-- Only the branding columns can change. Name, slug and membership stay admin-only.
grant update (primary_color, accent_color, logo_path) on public.schools to authenticated;

create policy "Staff update own school branding" on public.schools
  for update to authenticated
  using (shore_private.can_manage_schedule(slug))
  with check (shore_private.can_manage_schedule(slug));

update public.schools set primary_color = '#183366', accent_color = '#ffcc00' where slug = 'marlboro';
update public.schools set primary_color = '#2f4a29', accent_color = '#dad8d9' where slug = 'colts-neck';
update public.schools set primary_color = '#004990', accent_color = '#d4e0ec' where slug = 'shore-regional';

-- Public logo files, stored in one folder per school (for example marlboro/logo-123.png).
-- SVG is not allowed because it can carry scripts.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-logos', 'school-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp']);

create policy "Staff read own school logo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'school-logos' and shore_private.can_manage_schedule((storage.foldername(name))[1]));

create policy "Staff upload own school logos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'school-logos' and shore_private.can_manage_schedule((storage.foldername(name))[1]));

create policy "Staff delete own school logos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'school-logos' and shore_private.can_manage_schedule((storage.foldername(name))[1]));
