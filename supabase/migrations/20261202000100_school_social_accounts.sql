-- Applied and permission-tested in test project jrtcyihpdrcnhxgproyw on 2026-11-15.
-- Greg applies it to the live project.
-- School social media accounts: the link to each school's Instagram, Facebook and X account.
-- Only the link is saved. Posts, photos and videos stay on the platform and are never copied here.
-- The links are public (they show on school pages and the home page), so anyone can read them.
-- An AD can add, change and remove their own school's links. Conference admins and site admins can do so
-- for every school. A saved link shows on the public site straight away; there is no draft step.

create function shore_private.can_manage_social(school text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.email = shore_private.verified_staff_email()
      and (u.role in ('conference_office', 'site_admin') or (u.role = 'ad' and u.school_id = school)));
$$;
revoke all on function shore_private.can_manage_social(text) from public, anon, authenticated;
grant execute on function shore_private.can_manage_social(text) to authenticated;

create table public.school_social_accounts (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  platform text not null check (platform in ('instagram', 'facebook', 'x')),
  -- One standard form per platform, as written by js/social-links.js. Nothing else is accepted,
  -- so a saved link can only ever point at instagram.com, facebook.com or x.com.
  url text not null check (
    (platform = 'instagram' and url ~ '^https://www\.instagram\.com/[A-Za-z0-9._]{1,30}/$')
    or (platform = 'facebook' and url ~ '^https://www\.facebook\.com/([A-Za-z0-9.-]{1,80}|profile\.php\?id=[0-9]{5,20})$')
    or (platform = 'x' and url ~ '^https://x\.com/[A-Za-z0-9_]{1,15}$')),
  -- One account per platform for each school.
  unique (school_id, platform)
);

alter table public.school_social_accounts enable row level security;
revoke all on public.school_social_accounts from public, anon, authenticated;
grant select on public.school_social_accounts to anon, authenticated;
grant insert (school_id, platform, url) on public.school_social_accounts to authenticated;
-- Only the link can change. Moving an account to another school or platform means removing it and adding it again.
grant update (url) on public.school_social_accounts to authenticated;
grant delete on public.school_social_accounts to authenticated;

create policy "Anyone reads school social accounts" on public.school_social_accounts
  for select to anon, authenticated using (true);
create policy "Staff add school social accounts" on public.school_social_accounts
  for insert to authenticated with check (shore_private.can_manage_social(school_id));
create policy "Staff edit school social accounts" on public.school_social_accounts
  for update to authenticated
  using (shore_private.can_manage_social(school_id)) with check (shore_private.can_manage_social(school_id));
create policy "Staff remove school social accounts" on public.school_social_accounts
  for delete to authenticated using (shore_private.can_manage_social(school_id));
