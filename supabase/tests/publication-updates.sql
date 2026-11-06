-- Test project only: publication notices/history never expose drafts or withdrawn game details; all fixtures roll back.
begin;
do $$
declare v uuid:=gen_random_uuid(); j uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); h uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid();
begin
  insert into auth.users(id,email,email_confirmed_at) values(actor,'season-update-test@example.org',now());
  insert into public.users(email,name,role,school_id) values('season-update-test@example.org','Season test AD','ad','marlboro');
  insert into public.teams(id,school_id,sport,gender,level,season) values
    (v,'marlboro','Season Update Test','Girls','Varsity','Spring'),(j,'marlboro','Season Update Test','Girls','JV','Spring');
  insert into public.games(id,school_id,team_id,game_date,start_time,opponent_name,home_away,location) values
    (g,'marlboro',v,'2034-04-01','15:00','Visitor','Home','Test field'),(h,'marlboro',j,'2034-04-02','15:00','Visitor','Home','Test field');
  insert into public.transportation(game_id,bus_departure,pickup_location,notes) values(g,'14:00','Gym','PRIVATE-STAFF-TEST');
  perform set_config('shore.season_v',v::text,true); perform set_config('shore.season_j',j::text,true); perform set_config('shore.season_game',g::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
end; $$;
set local role authenticated;
do $$ declare group_data jsonb; begin
  select value into group_data from jsonb_array_elements(public.review_schedule_publication('marlboro'))
    where value->>'team_id'=current_setting('shore.season_v') and value->>'season_year'='2034';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',group_data->>'team_id','season_year',2034,'token',group_data->>'token')));
end; $$;
reset role;
do $$ declare data jsonb; season jsonb; begin
  data:=public.read_published_schedule('marlboro');
  select value into season from jsonb_array_elements(data->'seasons') where value->>'season'='Spring' and value->>'season_year'='2034';
  if jsonb_array_length(season->'teams')<>1 then raise exception 'Partial season publication was presented as more than one posted team'; end if;
  if (select count(*) from public.publication_updates where team_id=current_setting('shore.season_v')::uuid)<>1 then
    raise exception 'Initial publication should emit one team notice'; end if;
  if not exists(select 1 from public.publication_updates where team_id=current_setting('shore.season_v')::uuid and kind='team_posted') then
    raise exception 'Team publication notice missing'; end if;
  if data::text like '%PRIVATE-STAFF-TEST%' then raise exception 'Private transportation note leaked'; end if;
end; $$;
set local role authenticated;
update public.games set start_time='16:00',revision=revision+1 where id=current_setting('shore.season_game')::uuid;
reset role;
do $$ begin
  if (select count(*) from public.publication_updates where team_id=current_setting('shore.season_v')::uuid)<>1 then raise exception 'Draft save generated public history'; end if;
  if (select payload->>'start_time' from public.published_games where id=current_setting('shore.season_game')::uuid)<>'15:00:00' then raise exception 'Draft edit leaked to approved copy'; end if;
end; $$;
set local role authenticated;
do $$ declare group_data jsonb; begin
  select value into group_data from jsonb_array_elements(public.review_schedule_publication('marlboro'))
    where value->>'team_id'=current_setting('shore.season_v') and value->>'season_year'='2034';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',group_data->>'team_id','season_year',2034,
    'token',group_data->>'token','game_ids',jsonb_build_array(current_setting('shore.season_game')))));
end; $$;
reset role;
do $$ declare entry public.publication_updates; begin
  select * into entry from public.publication_updates where game_id=current_setting('shore.season_game')::uuid order by id desc limit 1;
  if entry.kind<>'game_changed' or entry.before_game->>'start_time'<>'15:00:00' or entry.after_game->>'start_time'<>'16:00:00' then
    raise exception 'Published change history is missing before/after values'; end if;
end; $$;
set local role authenticated;
update public.games set status='Canceled',revision=revision+1 where id=current_setting('shore.season_game')::uuid;
do $$ declare group_data jsonb; begin
  select value into group_data from jsonb_array_elements(public.review_schedule_publication('marlboro'))
    where value->>'team_id'=current_setting('shore.season_v') and value->>'season_year'='2034';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',group_data->>'team_id','season_year',2034,'token',group_data->>'token')));
  select value into group_data from jsonb_array_elements(public.review_schedule_publication('marlboro'))
    where value->>'team_id'=current_setting('shore.season_j') and value->>'season_year'='2034';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',group_data->>'team_id','season_year',2034,'token',group_data->>'token')));
end; $$;
reset role;
do $$ declare season jsonb; begin
  if not exists(select 1 from public.publication_updates where game_id=current_setting('shore.season_game')::uuid and kind='game_canceled') then raise exception 'Cancellation history missing'; end if;
  select value into season from jsonb_array_elements(public.read_published_schedule('marlboro')->'seasons') where value->>'season'='Spring' and value->>'season_year'='2034';
  if jsonb_array_length(season->'teams')<>2 then raise exception 'Second team publication did not update the season notice'; end if;
end; $$;
set local role authenticated;
do $$ declare group_data jsonb; begin
  select value into group_data from jsonb_array_elements(public.review_schedule_publication('marlboro'))
    where value->>'team_id'=current_setting('shore.season_v') and value->>'season_year'='2034';
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',group_data->>'team_id','season_year',2034,'token',group_data->>'token')),true);
  begin perform 1 from public.publication_updates; raise exception 'Raw publication audit accessible'; exception when insufficient_privilege then null; end;
end; $$;
reset role;
do $$ declare data jsonb; begin
  data:=public.read_published_schedule('marlboro');
  if exists(select 1 from jsonb_array_elements(data->'updates') u where u->>'game_id'=current_setting('shore.season_game')) then
    raise exception 'Withdrawn game details remain in public history'; end if;
  if not exists(select 1 from jsonb_array_elements(data->'updates') u where u->>'kind'='team_unpublished' and u->>'team_id'=current_setting('shore.season_v')) then
    -- team_id is intentionally not exposed; validate the safe notice by its unique test sport/level instead.
    if not exists(select 1 from jsonb_array_elements(data->'updates') u where u->>'kind'='team_unpublished' and u->>'sport'='Season Update Test' and u->>'level'='Varsity') then
      raise exception 'Safe team withdrawal notice missing'; end if;
  end if;
  data:=public.read_published_schedule(null);
  if jsonb_array_length(data->'updates')<>0 or jsonb_array_length(data->'seasons')<>0 then raise exception 'School update details leaked into conference projection'; end if;
end; $$;
select 'PASS: season/year team counts; publication-only notices; approved before/after changes; cancellation history; withdrawal privacy; no private transport notes; no school history in conference response' as verification;
rollback;
