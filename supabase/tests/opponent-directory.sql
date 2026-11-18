-- Test project only: rolls back fixtures after checking private saved schools and permissions.
begin;
do $$
declare a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); admin uuid := gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values
    (a,'opponent-a@example.org',now()),(b,'opponent-b@example.org',now()),
    (admin,'opponent-admin@example.org',now());
  insert into public.users(email,name,role,school_id) values
    ('opponent-a@example.org','Test AD A','ad','marlboro'),
    ('opponent-b@example.org','Test AD B','ad','colts-neck'),
    ('opponent-admin@example.org','Test admin','site_admin',null);
  perform set_config('shore.opponent_a',a::text,true);
  perform set_config('shore.opponent_b',b::text,true);
  perform set_config('shore.opponent_admin',admin::text,true);
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.opponent_a'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare one jsonb; rejected boolean := false;
begin
  if not exists(select 1 from public.opponent_directory where slug='marlboro' and source='conference')
    or not exists(select 1 from public.opponent_directory where source='njsiaa') then
    raise exception 'AD cannot read conference and NJSIAA schools';
  end if;
  one := public.save_custom_opponent('marlboro','Harbor Test School','1 Main Street');
  if one->>'source' <> 'custom' or one->>'added_by_school' <> 'marlboro' then
    raise exception 'Saved school owner is wrong';
  end if;
  perform set_config('shore.opponent_a_slug',one->>'slug',true);
  if (public.save_custom_opponent('marlboro',' harbor test school ',null)->>'slug') <> one->>'slug' then
    raise exception 'Own duplicate was not reused';
  end if;
  if (public.save_custom_opponent('marlboro','Abraham Clark High School',null)->>'source') <> 'njsiaa'
    or (public.save_custom_opponent('marlboro','Colts Neck',null)->>'source') <> 'conference' then
    raise exception 'Listed school was duplicated';
  end if;
  rejected := false;
  begin perform public.save_custom_opponent('marlboro','Marlboro High School',null);
  exception when invalid_parameter_value then rejected := true; end;
  if not rejected then raise exception 'AD saved own school under a longer name'; end if;
  begin perform public.save_custom_opponent('colts-neck','Wrong school',null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD A saved for school B'; end if;
  rejected := false;
  begin perform public.rename_custom_opponent('marlboro','Wrong name',null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD renamed conference school'; end if;
  rejected := false;
  begin perform public.delete_custom_opponent('abraham-clark-high-school');
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD deleted NJSIAA school'; end if;
  rejected := false;
  begin perform public.import_opponent_directory('[]'::jsonb);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD ran site-admin import'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.opponent_b'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare two jsonb; rejected boolean := false;
begin
  if exists(select 1 from public.opponent_directory
    where slug=current_setting('shore.opponent_a_slug')) then
    raise exception 'AD B read AD A saved school';
  end if;
  two := public.save_custom_opponent('colts-neck','Harbor Test School',null);
  if two->>'slug' = current_setting('shore.opponent_a_slug') then
    raise exception 'Two schools reused one saved row';
  end if;
  if exists(select 1 from public.opponent_directory where source='custom'
    and added_by_school='marlboro') then
    raise exception 'AD B search can see AD A school';
  end if;
  begin perform public.rename_custom_opponent(current_setting('shore.opponent_a_slug'),'Changed',null);
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD B renamed AD A school'; end if;
  rejected := false;
  begin perform public.delete_custom_opponent(current_setting('shore.opponent_a_slug'));
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'AD B deleted AD A school'; end if;
end;
$$;
reset role;

set local role anon;
do $$
begin
  if exists(select 1 from public.opponent_directory where source='custom') then
    raise exception 'Anonymous caller read a saved school';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.opponent_admin'),'role','authenticated')::text,true);
set local role authenticated;
do $$
declare result jsonb;
begin
  result := public.import_opponent_directory('[{"slug":"marlboro","name":"Marlboro","address":"Wrong"}]'::jsonb);
  if (result->>'imported')::int <> 0
    or (select address from public.opponent_directory where slug='marlboro') = 'Wrong' then
    raise exception 'Import changed conference school';
  end if;
  result := public.import_opponent_directory(
    '[{"slug":"marlboro-high-school","name":"Marlboro High School","address":"Wrong"}]'::jsonb);
  if (result->>'imported')::int <> 0
    or exists(select 1 from public.opponent_directory where slug='marlboro-high-school') then
    raise exception 'Import duplicated a conference school';
  end if;
  begin
    perform public.import_opponent_directory(
      jsonb_build_array(jsonb_build_object('slug',current_setting('shore.opponent_a_slug'),
        'name','Harbor Test School','address','Wrong')));
    raise exception 'Import accepted a custom school slug';
  exception when invalid_parameter_value then null; end;
  if (select address from public.opponent_directory
      where slug=current_setting('shore.opponent_a_slug')) = 'Wrong' then
    raise exception 'Import changed custom school';
  end if;
  result := public.import_opponent_directory(
    '[{"slug":"new-njsiaa-test-school","name":"New NJSIAA Test School","address":"2 Main Street"}]'::jsonb);
  if (result->>'imported')::int <> 1 then raise exception 'Admin import failed'; end if;
end;
$$;
reset role;

do $$
declare team uuid := gen_random_uuid(); game uuid := gen_random_uuid();
begin
  insert into public.teams(id,school_id,sport,gender,level,season)
    values(team,'marlboro','Opponent Test','Girls','Varsity','Spring');
  insert into public.games(id,school_id,team_id,game_date,start_time,
    opponent_directory_slug,opponent_name,home_away,location)
    values(game,'marlboro',team,'2039-04-01','15:00',
      current_setting('shore.opponent_a_slug'),'Harbor Test School','Away','Test field');
  perform set_config('shore.opponent_game',game::text,true);
end;
$$;
select set_config('request.jwt.claims',
  jsonb_build_object('sub',current_setting('shore.opponent_a'),'role','authenticated')::text,true);
set local role authenticated;
select public.delete_custom_opponent(current_setting('shore.opponent_a_slug'));
reset role;
do $$
begin
  if not exists(select 1 from public.games where id=current_setting('shore.opponent_game')::uuid
    and opponent_directory_slug is null and opponent_name='Harbor Test School') then
    raise exception 'Saved game lost opponent name after deletion';
  end if;
end;
$$;
select 'PASS: private saved schools, listed search, role checks, import protection, saved games' as verification;
rollback;
