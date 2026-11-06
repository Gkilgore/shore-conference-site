-- Stores one private transportation coordinator email per school.
create table public.school_transportation_contacts (
  school_id text primary key references public.schools(slug),
  email text not null check (char_length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')
);
alter table public.school_transportation_contacts enable row level security;
revoke all on public.school_transportation_contacts from public, anon, authenticated;
grant select, insert, update, delete on public.school_transportation_contacts to authenticated;

create policy own_school_transportation_contact on public.school_transportation_contacts
  for all to authenticated
  using (shore_private.can_manage_schedule(school_id))
  with check (shore_private.can_manage_schedule(school_id));
