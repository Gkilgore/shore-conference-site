-- Creates the test school directory and the invitation rules for staff sign-in.
create table public.schools (
  slug text primary key,
  name text not null,
  is_conference_member boolean not null default true
);

create table public.users (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  name text not null,
  role text not null check (role in ('ad', 'conference_office', 'site_admin')),
  school_id text references public.schools (slug),
  check ((role = 'ad') = (school_id is not null))
);

alter table public.schools enable row level security;
alter table public.users enable row level security;

revoke all on public.schools, public.users from public, anon, authenticated;
grant select on public.schools to anon, authenticated;
grant select on public.users to authenticated, supabase_auth_admin;

create policy "Read the school directory" on public.schools
  for select to anon, authenticated using (true);

-- Look up the current verified address in Auth, including after an email change.
create schema shore_private;
revoke all on schema shore_private from public;
grant usage on schema shore_private to authenticated;

create function shore_private.verified_staff_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(email)
  from auth.users
  where id = (select auth.uid())
    and email_confirmed_at is not null;
$$;

revoke all on function shore_private.verified_staff_email() from public, anon, authenticated;
grant execute on function shore_private.verified_staff_email() to authenticated;

create policy "Read own invitation" on public.users
  for select to authenticated
  using (email = (select shore_private.verified_staff_email()));

create policy "Auth checks invitations" on public.users
  for select to supabase_auth_admin using (true);

create function public.hook_require_staff_invitation(event jsonb)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select case when exists (
    select 1 from public.users
    where email = lower(btrim(event -> 'user' ->> 'email'))
  ) then '{}'::jsonb
  else jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Use the email address that was invited.'
  )) end;
$$;

revoke all on function public.hook_require_staff_invitation(jsonb)
  from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_require_staff_invitation(jsonb) to supabase_auth_admin;

insert into public.schools (slug, name) values
  ('colts-neck', 'Colts Neck'),
  ('marlboro', 'Marlboro'),
  ('shore-regional', 'Shore Regional');
