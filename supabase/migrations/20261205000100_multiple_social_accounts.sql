-- Allow several named school or team accounts on the same social platform.
-- Existing links keep their URL and receive the School athletics label.
alter table public.school_social_accounts
  add column account_name text not null default 'School athletics'
  check (length(btrim(account_name)) between 1 and 60);

alter table public.school_social_accounts
  drop constraint school_social_accounts_school_id_platform_key;

alter table public.school_social_accounts
  add constraint school_social_accounts_school_platform_url_key unique (school_id, platform, url);

grant insert (account_name) on public.school_social_accounts to authenticated;
grant update (account_name) on public.school_social_accounts to authenticated;
