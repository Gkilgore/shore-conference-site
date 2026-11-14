-- Applied and permission-tested in test project jrtcyihpdrcnhxgproyw on 2026-11-14. Greg applies it to the live project.
-- Conference documents: PDFs that conference admins and site admins upload from the staff Documents tab.
-- These are public files (alignments, tournament regulations, the constitution), so anyone can read the
-- list and open the files. Only conference admins and site admins can add, edit or remove them. ADs cannot.
-- A file posts to the public site when it is uploaded; there is no draft step.

create function shore_private.can_manage_documents()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.email = shore_private.verified_staff_email() and u.role in ('conference_office', 'site_admin'));
$$;
revoke all on function shore_private.can_manage_documents() from public, anon, authenticated;
grant execute on function shore_private.can_manage_documents() to authenticated;

create table public.conference_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 160),
  type text not null check (type in ('Alignment', 'Tournament regulations', 'Bracket', 'Entry form',
    'Governance', 'Leadership', 'Award', 'Other')),
  sport text not null default '' check (char_length(sport) <= 60),
  -- Like 2027-28. The second part must be the year after the first.
  school_year text not null check (school_year ~ '^\d{4}-\d{2}$'
    and right(school_year, 2)::int = (left(school_year, 4)::int + 1) % 100),
  -- Where the PDF sits in the conference-documents bucket: its school year folder, then the file name.
  file_path text not null unique check (file_path ~ '^\d{4}-\d{2}/[A-Za-z0-9._-]{1,120}\.pdf$'
    and left(file_path, 7) = school_year),
  description text not null check (char_length(btrim(description)) between 1 and 300),
  note text check (note is null or char_length(note) <= 300),
  added date not null default current_date,
  -- Kept for the site admins. The public cannot read this column.
  uploaded_by text not null default shore_private.verified_staff_email()
);

alter table public.conference_documents enable row level security;
revoke all on public.conference_documents from public, anon, authenticated;
grant select (id, title, type, sport, school_year, file_path, description, note, added)
  on public.conference_documents to anon, authenticated;
grant insert (title, type, sport, school_year, file_path, description, note)
  on public.conference_documents to authenticated;
grant update (title, type, sport, description, note) on public.conference_documents to authenticated;
grant delete on public.conference_documents to authenticated;

create policy "Anyone reads conference documents" on public.conference_documents
  for select to anon, authenticated using (true);
create policy "Conference staff add documents" on public.conference_documents
  for insert to authenticated with check (shore_private.can_manage_documents());
create policy "Conference staff edit documents" on public.conference_documents
  for update to authenticated
  using (shore_private.can_manage_documents()) with check (shore_private.can_manage_documents());
create policy "Conference staff remove documents" on public.conference_documents
  for delete to authenticated using (shore_private.can_manage_documents());

-- The files themselves. Public to read, PDF only, 10 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('conference-documents', 'conference-documents', true, 10485760, array['application/pdf']);

create policy "Conference staff read document files" on storage.objects
  for select to authenticated
  using (bucket_id = 'conference-documents' and shore_private.can_manage_documents());
create policy "Conference staff upload document files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'conference-documents' and shore_private.can_manage_documents()
    and name ~ '^\d{4}-\d{2}/[A-Za-z0-9._-]{1,120}\.pdf$');
create policy "Conference staff delete document files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'conference-documents' and shore_private.can_manage_documents());
