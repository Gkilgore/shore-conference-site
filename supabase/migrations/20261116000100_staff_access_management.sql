-- Lets conference admins manage AD invitations and site admins manage conference admins, with reviewed versions and audit.
create sequence shore_private.staff_access_revision_seq;
revoke all on sequence shore_private.staff_access_revision_seq from public,anon,authenticated;
alter table public.users add column access_revision bigint not null default nextval('shore_private.staff_access_revision_seq');

create table public.staff_access_audit (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default statement_timestamp(),
  actor_email text not null,
  target_email text not null,
  action text not null check(action in ('added','updated','revoked')),
  before_access jsonb,
  after_access jsonb
);
alter table public.staff_access_audit enable row level security;
revoke all on public.staff_access_audit from public,anon,authenticated;

create function shore_private.list_staff_access()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare actor public.users; accounts jsonb;
begin
  select * into actor from public.users where email=shore_private.verified_staff_email();
  if actor.role is null or actor.role not in ('site_admin','conference_office') then
    raise exception 'This account cannot manage staff access.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('email',u.email,'name',u.name,'role',u.role,
    'school_id',u.school_id,'access_revision',u.access_revision) order by u.role,u.school_id,u.email),'[]'::jsonb)
  into accounts from public.users u
  where actor.role='site_admin' or u.role='ad' or u.email=actor.email;
  return jsonb_build_object('actor_role',actor.role,'accounts',accounts);
end;
$$;
revoke all on function shore_private.list_staff_access() from public,anon;
grant execute on function shore_private.list_staff_access() to authenticated;

create function public.list_staff_access()
returns jsonb language sql set search_path = '' as $$ select shore_private.list_staff_access(); $$;
revoke all on function public.list_staff_access() from public,anon;
grant execute on function public.list_staff_access() to authenticated;

create function shore_private.manage_staff_access(p_email text,p_name text,p_role text,p_school text,
  p_expected_revision bigint default null,p_remove boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.users; previous public.users; saved public.users;
  target_address text := lower(btrim(p_email)); target_name text := coalesce(nullif(btrim(p_name),''),lower(btrim(p_email)));
begin
  -- All changes use this short lock; look up the actor after acquiring it so revocation takes effect while waiting too.
  perform pg_advisory_xact_lock(hashtextextended('shore.staff_access',0));
  select * into actor from public.users where public.users.email=shore_private.verified_staff_email();
  if actor.role is null or actor.role not in ('site_admin','conference_office') then
    raise exception 'This account cannot manage staff access.' using errcode='42501';
  end if;
  if target_address is null or char_length(target_address)>254 or target_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or char_length(target_name)>100 then
    raise exception 'Enter a valid invited email and a name of up to 100 characters.' using errcode='22023';
  end if;
  if target_address=actor.email then raise exception 'You cannot change your own access here.' using errcode='42501'; end if;
  select * into previous from public.users u where u.email=target_address for update;
  if previous.role='site_admin' or p_role is null or p_role not in ('ad','conference_office')
    or (actor.role='conference_office' and (p_role<>'ad' or coalesce(previous.role,'ad')<>'ad')) then
    raise exception 'This account cannot manage that kind of access.' using errcode='42501';
  end if;
  if previous.email is null then
    if p_remove or p_expected_revision is not null then
      raise exception 'This account changed. Reload access and review it again.' using errcode='40001';
    end if;
  elsif p_expected_revision is null or previous.access_revision<>p_expected_revision then
    raise exception 'This account changed. Reload access and review it again.' using errcode='40001';
  end if;
  if p_remove then
    delete from public.users u where u.email=target_address;
    insert into public.staff_access_audit(actor_email,target_email,action,before_access)
    values(actor.email,target_address,'revoked',to_jsonb(previous));
    return jsonb_build_object('removed',true,'email',target_address);
  end if;
  if p_role='ad' and (p_school is null or not exists(select 1 from public.schools s where s.slug=p_school and s.is_conference_member)) then
    raise exception 'Choose a member school for AD access.' using errcode='22023';
  elsif p_role<>'ad' and p_school is not null then
    raise exception 'Conference admins do not have an assigned school.' using errcode='22023';
  end if;
  if previous.email is null then
    insert into public.users(email,name,role,school_id) values(target_address,target_name,p_role,p_school) returning * into saved;
  else
    update public.users u set name=target_name,role=p_role,school_id=p_school,
      access_revision=nextval('shore_private.staff_access_revision_seq')
    where u.email=target_address returning * into saved;
  end if;
  insert into public.staff_access_audit(actor_email,target_email,action,before_access,after_access)
  values(actor.email,target_address,case when previous.email is null then 'added' else 'updated' end,
    case when previous.email is null then null else to_jsonb(previous) end,to_jsonb(saved));
  return jsonb_build_object('email',saved.email,'name',saved.name,'role',saved.role,
    'school_id',saved.school_id,'access_revision',saved.access_revision);
end;
$$;
revoke all on function shore_private.manage_staff_access(text,text,text,text,bigint,boolean) from public,anon;
grant execute on function shore_private.manage_staff_access(text,text,text,text,bigint,boolean) to authenticated;

create function public.manage_staff_access(p_email text,p_name text,p_role text,p_school text,
  p_expected_revision bigint default null,p_remove boolean default false)
returns jsonb language sql set search_path = '' as $$
  select shore_private.manage_staff_access(p_email,p_name,p_role,p_school,p_expected_revision,p_remove);
$$;
revoke all on function public.manage_staff_access(text,text,text,text,bigint,boolean) from public,anon;
grant execute on function public.manage_staff_access(text,text,text,text,bigint,boolean) to authenticated;
