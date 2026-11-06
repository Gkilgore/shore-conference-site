-- Test project only: exercises draft isolation, review concurrency, team selection and permissions; rolls back all fixtures.
begin;
do $$
declare v uuid := gen_random_uuid(); j uuid := gen_random_uuid(); g1 uuid := gen_random_uuid();
  g2 uuid := gen_random_uuid(); g3 uuid := gen_random_uuid(); later uuid := gen_random_uuid(); actor uuid := gen_random_uuid();
begin
  if to_regclass('public.published_games') is null then raise exception 'Publication snapshots are not installed'; end if;
  insert into auth.users(id,email,email_confirmed_at) values(actor,'team-publish-test@example.org',now());
  insert into public.users(email,name,role,school_id) values('team-publish-test@example.org','Publication test AD','ad','marlboro');
  insert into public.teams(id,school_id,sport,gender,level,season) values
    (v,'marlboro','Publication Test Soccer','Girls','Varsity','Fall'),
    (j,'marlboro','Publication Test Soccer','Girls','JV','Fall');
  insert into public.games(id,school_id,team_id,game_date,start_time,opponent_name,home_away,location) values
    (g1,'marlboro',v,'2031-09-01','15:00','Test Visitor','Home','Test field'),
    (g2,'marlboro',j,'2031-09-01','15:00','Test Visitor','Home','Test field'),
    (g3,'marlboro',v,'2031-09-02','15:00','Test Visitor','Home','Test field'),
    (later,'marlboro',v,'2032-09-01','15:00','Test Visitor','Home','Test field');
  perform set_config('shore.test_v',v::text,true); perform set_config('shore.test_j',j::text,true);
  perform set_config('shore.test_g1',g1::text,true); perform set_config('shore.test_g2',g2::text,true);
  perform set_config('shore.test_g3',g3::text,true);
  perform set_config('shore.test_later',later::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
end;
$$;
set local role authenticated;
do $$
declare v text := current_setting('shore.test_v'); j text := current_setting('shore.test_j');
  g1 uuid := current_setting('shore.test_g1')::uuid; g2 uuid := current_setting('shore.test_g2')::uuid;
  groups jsonb; selected jsonb; stale jsonb; item jsonb; rejected boolean; changed integer; before_revision integer;
begin
  if shore_private.schedule_year('2032-01-04','Winter') <> 2031 or
     shore_private.schedule_year('2031-12-04','Winter') <> 2031 or
     shore_private.schedule_year('2032-04-04','Spring') <> 2032 then raise exception 'Wrong season year'; end if;
  groups := public.review_schedule_publication('marlboro');
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=v and value->>'season_year'='2031';
  if item->>'status' <> 'Not published' then raise exception 'New team must be a draft'; end if;
  rejected := false;
  begin
    perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object(
      'team_id',v,'season_year',2031,'token',item->>'token','game_ids',jsonb_build_array(g1))));
  exception when invalid_parameter_value then rejected:=true;
  end;
  if not rejected then raise exception 'First publication must require whole team review'; end if;
  select jsonb_agg(jsonb_build_object('team_id',value->>'team_id','season_year',2031,'token',value->>'token'))
  into selected from jsonb_array_elements(groups) where value->>'team_id' in (v,j) and value->>'season_year'='2031';
  perform public.publish_schedule_changes('marlboro',selected);
  if (select count(*) from public.published_games where id in (g1,g2)) <> 2 then raise exception 'Multi-team publish failed'; end if;
  if exists(select 1 from public.published_games where id=current_setting('shore.test_later')::uuid) then raise exception 'Another season was published'; end if;
  groups := public.review_schedule_publication('marlboro');
  select jsonb_agg(jsonb_build_object('team_id',value->>'team_id','season_year',2031,'token',value->>'token'))
  into stale from jsonb_array_elements(groups) where value->>'team_id' in (v,j) and value->>'season_year'='2031';
  select revision into before_revision from public.published_games where id=g1;
  update public.games set start_time='18:00',revision=revision+1 where id=g1;
  update public.games set start_time='19:00',status='Canceled',revision=revision+1 where id=g2;
  update public.games set location='Draft only field',revision=revision+1 where id=current_setting('shore.test_g3')::uuid;
  if (select payload->>'start_time' from public.published_games where id=g1) <> '15:00:00' then raise exception 'Draft edit leaked'; end if;
  if (select payload->>'status' from public.published_games where id=g2) <> 'Scheduled' then raise exception 'Draft cancellation leaked'; end if;
  rejected := false;
  begin perform public.publish_schedule_changes('marlboro',stale);
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'Stale review was accepted'; end if;
  if (select revision from public.published_games where id=g1) <> before_revision then raise exception 'Failed batch partially published'; end if;
  groups := public.review_schedule_publication('marlboro');
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=v and value->>'season_year'='2031';
  select jsonb_build_array(jsonb_build_object('team_id',v,'season_year',2031,'token',item->>'token'),value)
  into selected from jsonb_array_elements(stale) where value->>'team_id'=j;
  rejected := false;
  begin perform public.publish_schedule_changes('marlboro',selected);
  exception when serialization_failure then rejected:=true; end;
  if not rejected or (select revision from public.published_games where id=g1) <> before_revision then
    raise exception 'A valid first team partially published before a stale second team failed';
  end if;
  if item->>'status' <> 'Unpublished changes' then raise exception 'Pending changes not identified'; end if;
  selected := jsonb_build_array(jsonb_build_object('team_id',v,'season_year',2031,'token',item->>'token','game_ids',jsonb_build_array(g1)));
  perform public.publish_schedule_changes('marlboro',selected);
  if (select payload->>'start_time' from public.published_games where id=g1) <> '18:00:00' then raise exception 'Single update failed'; end if;
  if (select payload->>'status' from public.published_games where id=g2) <> 'Scheduled' then raise exception 'Single update published another team'; end if;
  if (select payload->>'location' from public.published_games where id=current_setting('shore.test_g3')::uuid) <> 'Test field' then
    raise exception 'Single update published another game on the same team'; end if;
  if (select revision from public.published_games where id=g1) <= before_revision then raise exception 'Feed revision did not advance'; end if;
  rejected := false;
  begin update public.published_games set revision=revision+1 where id=g1;
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Direct own-school snapshot writes bypass reviewed publication'; end if;
  rejected := false;
  begin delete from public.team_publications where team_id=v::uuid;
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Direct publication-marker writes bypass reviewed publication'; end if;
  rejected := false;
  begin perform public.read_published_schedule('marlboro');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Staff can bypass the Edge Function public read boundary'; end if;
  rejected := false;
  begin perform public.review_schedule_publication('colts-neck');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Cross-school review allowed'; end if;
  rejected := false;
  begin perform public.publish_schedule_changes('colts-neck',selected);
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Cross-school publish allowed'; end if;
  rejected := false;
  begin update public.published_games set revision=revision+1 where school_id='colts-neck';
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'Direct snapshot write allowed'; end if;
  groups := public.review_schedule_publication('marlboro');
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=v and value->>'season_year'='2031';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',v,'season_year',2031,'token',item->>'token')),true);
  if exists(select 1 from public.team_publications where team_id=v::uuid and season_year=2031) then raise exception 'Unpublish failed'; end if;
  if not exists(select 1 from public.games where id=g1) then raise exception 'Unpublish deleted the master game'; end if;
  if not exists(select 1 from public.published_games where id=g2) then raise exception 'Unpublish affected another team'; end if;
  select revision into before_revision from public.published_games where id=g1;
  groups := public.review_schedule_publication('marlboro');
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=v and value->>'season_year'='2031';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',v,'season_year',2031,'token',item->>'token')));
  if (select revision from public.published_games where id=g1) <= before_revision then raise exception 'Republishing reset the calendar revision'; end if;
  select revision into before_revision from public.published_games where id=g1;
  update public.games set team_id=j::uuid,revision=revision+1 where id=g1;
  groups := public.review_schedule_publication('marlboro');
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=j and value->>'season_year'='2031';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',j,'season_year',2031,
    'token',item->>'token','game_ids',jsonb_build_array(g2))));
  if (select team_id from public.published_games where id=g1) <> v::uuid then raise exception 'Unrelated update published a pending move'; end if;
  if (select payload->>'status' from public.published_games where id=g2) <> 'Canceled' then raise exception 'Unrelated single-game update was blocked by pending move'; end if;
  groups := public.review_schedule_publication('marlboro');
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=v and value->>'season_year'='2031';
  rejected := false;
  begin perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',v,'season_year',2031,'token',item->>'token')));
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Moving a game published only the source removal'; end if;
  select value into item from jsonb_array_elements(groups) where value->>'team_id'=j and value->>'season_year'='2031';
  rejected := false;
  begin perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',j,'season_year',2031,'token',item->>'token','game_ids',jsonb_build_array(g1))));
  exception when invalid_parameter_value then rejected:=true; end;
  if not rejected then raise exception 'Moving a game bypassed team review through a single-game update'; end if;
  select jsonb_agg(jsonb_build_object('team_id',value->>'team_id','season_year',2031,'token',value->>'token'))
  into selected from jsonb_array_elements(groups) where value->>'team_id' in (v,j) and value->>'season_year'='2031';
  perform public.publish_schedule_changes('marlboro',selected);
  if (select team_id from public.published_games where id=g1) <> j::uuid then raise exception 'Reviewed team move failed'; end if;
  if (select revision from public.published_games where id=g1) <= before_revision then raise exception 'Team move reset the calendar revision'; end if;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin perform 1 from public.published_games; raise exception 'Anonymous direct snapshot read allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.review_schedule_publication('marlboro'); raise exception 'Anonymous review allowed';
  exception when insufficient_privilege then null; end;
  begin perform public.read_published_schedule('marlboro'); raise exception 'Anonymous database projection allowed';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select 'PASS: team/year separation; atomic multi-team publish; first-publish review; draft isolation; stale review rejection; single-game update; cross-school and anonymous denial; unpublish preserves drafts' as verification;
rollback;
