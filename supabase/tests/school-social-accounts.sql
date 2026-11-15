-- Test who can add, change and remove school social media links, with fictional identities; roll back every fixture.
begin;
do $$
declare ad uuid := gen_random_uuid(); office uuid := gen_random_uuid(); other uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(ad,'social-ad@example.org',now()),(office,'social-office@example.org',now());
  insert into public.users(email,name,role,school_id) values('social-ad@example.org','Social AD','ad','marlboro'),
    ('social-office@example.org','Social office','conference_office',null);
  delete from public.school_social_accounts where school_id in ('marlboro','colts-neck','shore-regional');
  insert into public.school_social_accounts(id,school_id,platform,url) values(other,'colts-neck','instagram','https://www.instagram.com/fixture.coltsneck/');
  perform set_config('shore.social_other',other::text,true);
  perform set_config('shore.social_office',office::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',ad,'role','authenticated')::text,true);
end;
$$;

-- An AD adds, changes and removes their own school's links; bad links and other schools are refused.
set local role authenticated;
do $$
declare own uuid; affected integer; rejected boolean; bad text;
begin
  insert into public.school_social_accounts(school_id,platform,url) values('marlboro','instagram','https://www.instagram.com/fixture.marlboro/') returning id into own;
  insert into public.school_social_accounts(school_id,platform,url) values('marlboro','facebook','https://www.facebook.com/profile.php?id=1234567890');
  insert into public.school_social_accounts(school_id,platform,url) values('marlboro','x','https://x.com/test_marlboro');
  update public.school_social_accounts set url='https://www.instagram.com/fixture_renamed/' where id=own;
  if not exists(select 1 from public.school_social_accounts where id=own and url='https://www.instagram.com/fixture_renamed/') then
    raise exception 'Own-school edit failed'; end if;
  rejected := false;
  begin insert into public.school_social_accounts(school_id,platform,url) values('marlboro','instagram','https://www.instagram.com/second/');
  exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'Second account on one platform accepted'; end if;
  foreach bad in array array['http://www.instagram.com/fixture/','https://instagram.com.example.org/fixture/',
    'https://www.instagram.com/p/ABC123/extra/','https://www.instagram.com/fixture','https://example.org/','javascript:alert(1)',
    'https://www.facebook.com/fixture/'] loop
    rejected := false;
    begin update public.school_social_accounts set url=bad where id=own;
    exception when check_violation then rejected := true; end;
    if not rejected then raise exception 'Bad Instagram link accepted: %', bad; end if;
  end loop;
  rejected := false;
  begin insert into public.school_social_accounts(school_id,platform,url) values('shore-regional','tiktok','https://www.tiktok.com/@fixture');
  exception when check_violation or insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Unsupported platform accepted'; end if;
  rejected := false;
  begin insert into public.school_social_accounts(school_id,platform,url) values('shore-regional','x','https://x.com/fixture_other');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Other-school insert allowed'; end if;
  update public.school_social_accounts set url='https://www.instagram.com/taken.over/' where id=current_setting('shore.social_other')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other-school edit allowed'; end if;
  delete from public.school_social_accounts where id=current_setting('shore.social_other')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other-school removal allowed'; end if;
  rejected := false;
  begin update public.school_social_accounts set school_id='colts-neck' where id=own;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Account moved to another school'; end if;
  delete from public.school_social_accounts where id=own;
  if exists(select 1 from public.school_social_accounts where id=own) then raise exception 'Own-school removal failed'; end if;
end;
$$;

-- A conference admin manages every school's links.
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.social_office'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare added uuid; affected integer;
begin
  insert into public.school_social_accounts(school_id,platform,url) values('shore-regional','x','https://x.com/fixture_office') returning id into added;
  update public.school_social_accounts set url='https://www.instagram.com/fixture.office/' where id=current_setting('shore.social_other')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Conference admin edit failed'; end if;
  delete from public.school_social_accounts where id=added;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Conference admin removal failed'; end if;
end;
$$;

-- Someone who signs in without an invitation can read but not write.
reset role;
delete from public.users where email='social-office@example.org';
set local role authenticated;
do $$
declare rejected boolean := false;
begin
  begin insert into public.school_social_accounts(school_id,platform,url) values('marlboro','instagram','https://www.instagram.com/uninvited/');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Uninvited account added a link'; end if;
end;
$$;

-- The public reads the links and cannot write.
reset role;
set local role anon;
do $$
declare rejected boolean := false;
begin
  if not exists(select 1 from public.school_social_accounts where id=current_setting('shore.social_other')::uuid) then
    raise exception 'Public cannot read social links'; end if;
  begin insert into public.school_social_accounts(school_id,platform,url) values('marlboro','instagram','https://www.instagram.com/anonymous/');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous write allowed'; end if;
end;
$$;
reset role;
select 'PASS: own-school add/edit/remove; bad links, second account and unsupported platform rejected; cross-school insert/edit/removal/move blocked; conference admin manages every school; uninvited and public read-only' as verification;
rollback;
