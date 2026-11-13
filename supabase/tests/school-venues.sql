-- Test venue editing and school isolation with fictional identities; roll back every fixture.
begin;
do $$
declare actor uuid := gen_random_uuid(); other uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(actor,'venue-check@example.org',now());
  insert into public.users(email,name,role,school_id) values('venue-check@example.org','Venue test','ad','marlboro');
  insert into public.school_venues(id,school_id,name) values(other,'colts-neck','Venue permission fixture');
  perform set_config('shore.venue_other',other::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
end;
$$;
set local role authenticated;
do $$
declare own uuid; affected integer; rejected boolean;
begin
  insert into public.school_venues(school_id,name,address) values('marlboro','Venue edit fixture','Test address') returning id into own;
  update public.school_venues set name='Venue renamed fixture',address='Updated address' where id=own;
  if not exists(select 1 from public.school_venues where id=own and name='Venue renamed fixture' and address='Updated address') then
    raise exception 'Own-school edit failed'; end if;
  rejected := false;
  begin
    insert into public.school_venues(school_id,name) values('marlboro','  VENUE RENAMED FIXTURE  ');
  exception when unique_violation then rejected := true; end;
  if not rejected then raise exception 'Duplicate venue accepted'; end if;
  rejected := false;
  begin
    insert into public.school_venues(school_id,name) values('shore-regional','Unauthorized fixture');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Other-school insert allowed'; end if;
  update public.school_venues set name='Unauthorized fixture' where id=current_setting('shore.venue_other')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other-school edit allowed'; end if;
  delete from public.school_venues where id=current_setting('shore.venue_other')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other-school deletion allowed'; end if;
  rejected := false;
  begin
    update public.school_venues set school_id='colts-neck' where id=own;
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Venue reassignment allowed'; end if;
  delete from public.school_venues where id=own;
  if exists(select 1 from public.school_venues where id=own) then raise exception 'Own-school deletion failed'; end if;
end;
$$;
reset role;
update public.users set role='conference_office',school_id=null where email='venue-check@example.org';
set local role authenticated;
do $$
declare affected integer;
begin
  update public.school_venues set name='Office edit fixture' where id=current_setting('shore.venue_other')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Conference office edited venue'; end if;
end;
$$;
reset role;
set local role anon;
do $$
declare rejected boolean := false;
begin
  if not exists(select 1 from public.school_venues where id=current_setting('shore.venue_other')::uuid) then
    raise exception 'Public venue read failed'; end if;
  begin
    insert into public.school_venues(school_id,name) values('marlboro','Anonymous fixture');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'Anonymous write allowed'; end if;
end;
$$;
reset role;
select 'PASS: own-school venue add/edit/delete; duplicate rejection; cross-school insert/update/delete/reassignment blocked; office read-only; public read with no anonymous write' as verification;
rollback;
