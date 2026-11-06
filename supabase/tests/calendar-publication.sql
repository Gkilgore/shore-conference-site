-- Test project only: verifies publication ownership in one transaction and rolls back every fixture.
begin;

insert into auth.users (id, email, email_confirmed_at)
values ('fc6b419a-8476-40fd-a995-b7431eb50b71', 'calendar-test-ad@example.org', now());
insert into public.users (email, name, role, school_id)
values ('calendar-test-ad@example.org', 'Calendar test AD', 'ad', 'marlboro');

select set_config('request.jwt.claims', '{"sub":"fc6b419a-8476-40fd-a995-b7431eb50b71","role":"authenticated"}', true);
set local role authenticated;

do $$
declare changed integer; target uuid; before_revision integer; after_revision integer;
begin
  update public.schools set schedule_published = true where slug = 'marlboro';
  get diagnostics changed = row_count;
  if changed <> 1 then raise exception 'FAIL: AD cannot publish their own school'; end if;
  update public.schools set schedule_published = true where slug = 'colts-neck';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: AD can publish another school'; end if;
  update public.games set notes = 'Cross-school write must fail' where school_id = 'colts-neck';
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'FAIL: AD can edit another school game'; end if;
  select g.id, g.revision into target, before_revision
  from public.games g join public.transportation t on t.game_id=g.id
  where g.school_id='marlboro' limit 1;
  if target is null then raise exception 'FAIL: no transportation fixture for timestamp verification'; end if;
  update public.transportation set pickup_location=pickup_location where game_id=target;
  select revision into after_revision from public.games where id=target;
  if after_revision <> before_revision+1 then raise exception 'FAIL: bus edit did not advance feed revision'; end if;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    update public.schools set schedule_published = true where slug = 'marlboro';
    raise exception 'FAIL: anonymous publication update allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.games limit 1;
    raise exception 'FAIL: anonymous direct games access allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select 'PASS: own-school publication allowed; cross-school publication and game edits denied; bus edits advance feed revision; anonymous writes denied; direct games remain private' as verification;
rollback;
