-- Test project only: verifies administrator boundaries, multiple invitations and immediate revocation; rolls back all fixtures.
begin;
do $$
declare site uuid:=gen_random_uuid(); office uuid:=gen_random_uuid(); peer uuid:=gen_random_uuid();
  ad uuid:=gen_random_uuid(); target uuid:=gen_random_uuid(); unconfirmed uuid:=gen_random_uuid();
  marlboro_team uuid:=gen_random_uuid(); colts_team uuid:=gen_random_uuid();
  marlboro_game uuid:=gen_random_uuid(); colts_game uuid:=gen_random_uuid();
begin
  if to_regprocedure('public.list_staff_access()') is null then raise exception 'Staff access tools are not installed'; end if;
  insert into auth.users(id,email,email_confirmed_at) values
    (site,'directory-test-site@example.org',now()),(office,'directory-test-office@example.org',now()),
    (peer,'directory-test-peer@example.org',now()),(ad,'directory-test-ad@example.org',now()),
    (target,'directory-test-target@example.org',now());
  insert into auth.users(id,email) values(unconfirmed,'directory-test-unconfirmed@example.org');
  insert into public.users(email,name,role,school_id) values
    ('directory-test-site@example.org','Test site admin','site_admin',null),
    ('directory-test-office@example.org','Test conference admin','conference_office',null),
    ('directory-test-peer@example.org','Another conference admin','conference_office',null),
    ('directory-test-ad@example.org','Test AD','ad','marlboro');
  insert into public.users(email,name,role) values('directory-test-unconfirmed@example.org','Unconfirmed','site_admin');
  insert into public.teams(id,school_id,sport,gender,level,season) values
    (marlboro_team,'marlboro','Access Fixture','Girls','Varsity','Spring'),(colts_team,'colts-neck','Access Fixture','Girls','Varsity','Spring');
  insert into public.games(id,school_id,team_id,game_date,start_time,opponent_name,home_away,location) values
    (marlboro_game,'marlboro',marlboro_team,'2039-04-01','15:00','Test Visitor','Home','Access field'),
    (colts_game,'colts-neck',colts_team,'2039-04-01','15:00','Test Visitor','Home','Access field');
  perform set_config('shore.test_marlboro_game',marlboro_game::text,true); perform set_config('shore.test_colts_game',colts_game::text,true);
  perform set_config('shore.test_unconfirmed',unconfirmed::text,true);
  perform set_config('shore.test_site',site::text,true); perform set_config('shore.test_office',office::text,true);
  perform set_config('shore.test_ad',ad::text,true); perform set_config('shore.test_target',target::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',office,'role','authenticated')::text,true);
end;
$$;
set local role authenticated;
do $$
declare result jsonb; account jsonb; revised jsonb; rejected boolean; old_revision bigint; listing jsonb; changed integer;
begin
  update public.games set location='Conference overwrite' where id=current_setting('shore.test_marlboro_game')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Conference admin wrote school schedule'; end if;
  listing:=public.list_staff_access();
  if listing->>'actor_role'<>'conference_office' then raise exception 'Conference role was not verified'; end if;
  if exists(select 1 from jsonb_array_elements(listing->'accounts') a where a->>'role'='site_admin'
    or (a->>'role'='conference_office' and a->>'email'<>'directory-test-office@example.org')) then
    raise exception 'Conference list exposed accounts outside its management scope'; end if;
  result:=public.manage_staff_access('directory-test-target@example.org','New AD','ad','marlboro',null,false);
  perform public.manage_staff_access('directory-test-second@example.org','Second AD','ad','marlboro',null,false);
  listing:=public.list_staff_access();
  if (select count(*) from jsonb_array_elements(listing->'accounts') a where a->>'school_id'='marlboro'
    and a->>'email' in ('directory-test-target@example.org','directory-test-second@example.org'))<>2 then
    raise exception 'Multiple AD invitations per school failed'; end if;
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-target@example.org','Overwrite','ad','colts-neck',null,false);
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'Adding an existing email overwrote its assignment'; end if;
  old_revision:=(result->>'access_revision')::bigint;
  revised:=public.manage_staff_access('directory-test-target@example.org','Transferred AD','ad','colts-neck',old_revision,false);
  if revised->>'school_id'<>'colts-neck' or (revised->>'access_revision')::bigint<=old_revision then
    raise exception 'Assignment revision did not advance'; end if;
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-target@example.org','Old screen','ad','marlboro',old_revision,false);
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'Stale assignment overwrite allowed'; end if;
  perform set_config('shore.test_target_revision',revised->>'access_revision',true);
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-elevated@example.org','Peer','conference_office',null,null,false);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Conference admin could appoint a peer'; end if;
  select value into account from jsonb_array_elements(public.list_staff_access()->'accounts') where value->>'email'='directory-test-ad@example.org';
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-ad@example.org','Promoted','conference_office',null,(account->>'access_revision')::bigint,false);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Conference admin could promote an AD'; end if;
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-peer@example.org','Peer','ad','marlboro',1,true);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Conference admin could revoke a peer'; end if;
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-site@example.org','Site','ad','marlboro',1,true);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Conference admin could revoke a site admin'; end if;
end;
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_target'),'role','authenticated')::text,true);
do $$
declare rejected boolean:=false; changed integer;
begin
  if shore_private.can_manage_schedule('marlboro') or not shore_private.can_manage_schedule('colts-neck') then
    raise exception 'School reassignment did not immediately change permissions'; end if;
  begin perform public.list_staff_access(); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'AD could list staff access'; end if;
  update public.games set location='Transferred AD field' where id=current_setting('shore.test_colts_game')::uuid;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Transferred AD cannot update new school'; end if;
  update public.games set location='Wrong school' where id=current_setting('shore.test_marlboro_game')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Transferred AD updated former school'; end if;
  if exists(select 1 from public.games where id=current_setting('shore.test_marlboro_game')::uuid) then raise exception 'Transferred AD reads former school drafts'; end if;
end;
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_office'),'role','authenticated')::text,true);
select public.manage_staff_access('directory-test-target@example.org','Transferred AD','ad','colts-neck',current_setting('shore.test_target_revision')::bigint,true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_target'),'role','authenticated')::text,true);
do $$
declare rejected boolean:=false; changed integer;
begin
  if shore_private.can_manage_schedule('marlboro') or shore_private.can_manage_schedule('colts-neck') then
    raise exception 'Revoked invitation still permits schedule access'; end if;
  begin perform public.review_schedule_publication('colts-neck'); exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Revoked user could review private schedules with existing token'; end if;
  if exists(select 1 from public.games where id in(current_setting('shore.test_colts_game')::uuid,current_setting('shore.test_marlboro_game')::uuid)) then raise exception 'Revoked AD reads school drafts'; end if;
  update public.games set location='Revoked overwrite' where id=current_setting('shore.test_colts_game')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Revoked AD writes school drafts'; end if;
end;
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_office'),'role','authenticated')::text,true);
do $$
declare result jsonb; rejected boolean:=false;
begin
  result:=public.manage_staff_access('directory-test-target@example.org','Re-added AD','ad','marlboro',null,false);
  if (result->>'access_revision')::bigint<=current_setting('shore.test_target_revision')::bigint then raise exception 'Re-added invitation reused a revision'; end if;
  begin perform public.manage_staff_access('directory-test-target@example.org','Old removal','ad','marlboro',current_setting('shore.test_target_revision')::bigint,true);
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'Stale removal revoked a re-added invitation'; end if;
end;
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_site'),'role','authenticated')::text,true);
do $$
declare first jsonb; second jsonb; rejected boolean:=false;
begin
  first:=public.manage_staff_access('directory-test-conference-one@example.org','First admin','conference_office',null,null,false);
  second:=public.manage_staff_access('directory-test-conference-two@example.org','Second admin','conference_office',null,null,false);
  if (select count(*) from jsonb_array_elements(public.list_staff_access()->'accounts') a
    where a->>'email' in ('directory-test-conference-one@example.org','directory-test-conference-two@example.org'))<>2 then
    raise exception 'Multiple conference-admin invitations failed'; end if;
  perform public.manage_staff_access(first->>'email','First admin','conference_office',null,(first->>'access_revision')::bigint,true);
  if not exists(select 1 from jsonb_array_elements(public.list_staff_access()->'accounts') a where a->>'email'=second->>'email') then
    raise exception 'Removing one conference admin affected another'; end if;
  begin perform public.manage_staff_access('directory-test-new-site@example.org','Site','site_admin',null,null,false);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Site-admin escalation allowed through invitation tools'; end if;
  rejected:=false;
  begin perform public.manage_staff_access('directory-test-site@example.org','Self','conference_office',null,null,true);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Self-access removal allowed'; end if;
  rejected:=false;
  begin update public.users set name='Direct write' where email='directory-test-ad@example.org';
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Direct invitation writes bypassed review'; end if;
  rejected:=false;
  begin perform 1 from public.staff_access_audit; exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Raw access audit exposed'; end if;
end;
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_ad'),'role','authenticated','email','directory-test-site@example.org','user_metadata',jsonb_build_object('role','site_admin'))::text,true);
do $$ begin
  begin perform public.list_staff_access(); raise exception 'Forged JWT email or metadata elevated an AD'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_unconfirmed'),'role','authenticated')::text,true);
do $$ begin
  begin perform public.list_staff_access(); raise exception 'Unconfirmed identity gained staff management'; exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_site'),'role','authenticated')::text,true);
do $$ declare account jsonb; begin
  select value into account from jsonb_array_elements(public.list_staff_access()->'accounts') where value->>'email'='directory-test-office@example.org';
  perform public.manage_staff_access(account->>'email',account->>'name','conference_office',null,(account->>'access_revision')::bigint,true);
end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.test_office'),'role','authenticated')::text,true);
do $$ begin
  begin perform public.list_staff_access(); raise exception 'Revoked manager retained staff list'; exception when insufficient_privilege then null; end;
  begin perform public.manage_staff_access('directory-test-after-revoke@example.org','Denied','ad','marlboro',null,false); raise exception 'Revoked manager added an AD'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.list_staff_access(); raise exception 'Anonymous invitation list allowed';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: multiple ADs/conference admins; conference/site role boundaries; stale/re-added revision protection; reassignment and revocation apply immediately; direct writes/audit and anonymous reads denied' as verification;
rollback;
