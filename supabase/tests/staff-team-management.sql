-- Verifies school-owned team creation and removal stay within the signed-in AD's school.
begin;
do $$
declare account uuid:=gen_random_uuid();
  other uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at)
    values(account,'team-management-ad@example.org',now());
  insert into public.users(email,name,role,school_id)
    values('team-management-ad@example.org','Team management test','ad','marlboro');
  insert into public.teams(id,school_id,sport,gender,level,season)
    values(other,'colts-neck','Team management cross-school test','Girls','JV','Fall');
  perform set_config('shore.test_other_team',other::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',account,'role','authenticated')::text,true);
end;
$$;
set local role authenticated;
do $$
declare own uuid:=gen_random_uuid(); rejected boolean:=false; changed integer;
begin
  insert into public.teams(id,school_id,sport,gender,level,season)
    values(own,'marlboro','Team management test','Girls','JV','Fall');
  begin
    insert into public.teams(school_id,sport,gender,level,season)
      values('colts-neck','Team management test','Girls','JV','Fall');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'AD created a team at another school'; end if;
  delete from public.teams where id=current_setting('shore.test_other_team')::uuid;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'AD removed another school''s team'; end if;
  delete from public.teams where id=own and school_id='marlboro';
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'AD could not remove an unused team at their school'; end if;
end;
$$;
reset role;
do $$
begin
  if not exists(select 1 from public.teams where id=current_setting('shore.test_other_team')::uuid) then
    raise exception 'AD removed another school''s team';
  end if;
end;
$$;
rollback;
