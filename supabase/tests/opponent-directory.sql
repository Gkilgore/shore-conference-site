-- Test project only: checks directory enrollment, school-owned lists and active-school matching.
-- Apply 20261203000100_opponent_directory.sql first. Rolls back all fixtures.
begin;
do $$
declare admin_id uuid:=gen_random_uuid(); member_id uuid:=gen_random_uuid(); outside_id uuid:=gen_random_uuid();
  member_team uuid:=gen_random_uuid();
begin
  if to_regprocedure('public.import_opponent_directory(jsonb)') is null then
    raise exception 'Opponent directory is not installed';
  end if;
  insert into auth.users(id,email,email_confirmed_at) values
    (admin_id,'opponent-test-admin@example.org',now()),
    (member_id,'opponent-test-member@example.org',now()),
    (outside_id,'opponent-test-outside@example.org',now());
  insert into public.users(email,name,role,school_id) values
    ('opponent-test-admin@example.org','Opponent test admin','site_admin',null),
    ('opponent-test-member@example.org','Member test AD','ad','marlboro');
  insert into public.teams(id,school_id,sport,gender,level,season)
    values(member_team,'marlboro','Opponent Directory Test','Girls','Varsity','Spring');
  perform set_config('shore.test_admin',admin_id::text,true);
  perform set_config('shore.test_member',member_id::text,true);
  perform set_config('shore.test_outside',outside_id::text,true);
  perform set_config('shore.test_member_team',member_team::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated')::text,true);
end;
$$;
set local role authenticated;
do $$
declare invited jsonb;
begin
  perform public.import_opponent_directory('[{"slug":"north-harbor","name":"North Harbor High School"}]'::jsonb);
  invited:=public.manage_staff_access('opponent-test-outside@example.org','Outside AD','ad','north-harbor',null,false);
  if not exists(select 1 from public.schools where slug='north-harbor' and not is_conference_member) then
    raise exception 'A directory school was not enrolled as a nonmember school';
  end if;
  if not exists(select 1 from public.school_opponents where school_id='north-harbor' and opponent_slug='marlboro') then
    raise exception 'New school did not start with the active member-school options';
  end if;
  perform set_config('shore.test_outside_revision',invited->>'access_revision',true);
end;
$$;
reset role;
do $$
declare outside_team uuid:=gen_random_uuid(); member_game uuid:=gen_random_uuid(); outside_game uuid:=gen_random_uuid();
begin
  insert into public.teams(id,school_id,sport,gender,level,season)
    values(outside_team,'north-harbor','Opponent Directory Test','Girls','Varsity','Spring');
  insert into public.games(id,school_id,team_id,game_date,start_time,opponent_school_id,
    opponent_directory_slug,opponent_name,home_away,location)
  values
    (member_game,'marlboro',current_setting('shore.test_member_team')::uuid,'2039-04-01','15:00',
      null,'north-harbor','North Harbor High School','Away','Shared field'),
    (outside_game,'north-harbor',outside_team,'2039-04-01','15:00',
      'marlboro','marlboro',null,'Home','Shared field');
  perform set_config('shore.test_member_game',member_game::text,true);
  perform set_config('shore.test_outside_game',outside_game::text,true);
end;
$$;
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.test_outside'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare linked boolean; reason text; rejected boolean:=false;
begin
  if not exists(select 1 from public.school_opponents where school_id='north-harbor' and opponent_slug='marlboro') then
    raise exception 'AD could not read its own opponent list';
  end if;
  insert into public.school_opponents(school_id,opponent_slug) values('north-harbor','colts-neck');
  begin insert into public.school_opponents(school_id,opponent_slug) values('marlboro','north-harbor');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'AD changed another school’s opponent list'; end if;
  select result.linked,result.reason into linked,reason
  from public.game_link_status('north-harbor') result
  where result.game_id=current_setting('shore.test_outside_game')::uuid;
  if linked is distinct from true or reason<>'Both schools entered the same game' then
    raise exception 'Matched active nonmember school was not reported correctly';
  end if;
end;
$$;
reset role;
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.test_member'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare linked boolean;
begin
  select result.linked into linked from public.game_link_status('marlboro') result
  where result.game_id=current_setting('shore.test_member_game')::uuid;
  if linked is distinct from true then raise exception 'Member school could not match an enrolled opponent'; end if;
end;
$$;
reset role;
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.test_admin'),'role','authenticated')::text,true);
set local role authenticated;
select public.manage_staff_access('opponent-test-outside@example.org','Outside AD','ad','north-harbor',
  current_setting('shore.test_outside_revision')::bigint,true);
reset role;
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.test_member'),'role','authenticated')::text,true);
set local role authenticated;
do $$
begin
  if exists(select 1 from public.game_link_status('marlboro')
    where game_id=current_setting('shore.test_member_game')::uuid) then
    raise exception 'A revoked school kept an active matching identity';
  end if;
end;
$$;
reset role;
select 'PASS: directory enrollment; initial active-school shortlist; school-owned RLS; two-sided active matching; revocation disables matching' as verification;
rollback;
