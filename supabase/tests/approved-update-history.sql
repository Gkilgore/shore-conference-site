-- Test project only: approved labels, notes-only updates and reposted-history privacy; fixtures roll back.
begin;
do $$ declare actor uuid:=gen_random_uuid(); team uuid:=gen_random_uuid(); game uuid:=gen_random_uuid(); begin
  insert into auth.users(id,email,email_confirmed_at) values(actor,'approved-history-test@example.org',now());
  insert into public.users(email,name,role,school_id) values('approved-history-test@example.org','History test','ad','marlboro');
  insert into public.teams(id,school_id,sport,gender,level,season) values(team,'marlboro','Approved History Test','Girls','Varsity','Spring');
  insert into public.games(id,school_id,team_id,game_date,start_time,opponent_name,home_away,location)
    values(game,'marlboro',team,'2038-04-01','15:00','History Visitor','Home','History field');
  perform set_config('shore.history_team',team::text,true); perform set_config('shore.history_game',game::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
end; $$;
set local role authenticated;
do $$ declare g jsonb; begin
  select value into g from jsonb_array_elements(public.review_schedule_publication('marlboro')) where value->>'team_id'=current_setting('shore.history_team');
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',g->>'team_id','season_year',2038,'token',g->>'token')));
end; $$;
update public.teams set sport='UNAPPROVED LABEL' where id=current_setting('shore.history_team')::uuid;
reset role;
do $$ begin
  if public.read_published_schedule('marlboro')::text like '%UNAPPROVED LABEL%' then raise exception 'Draft team label leaked into public metadata'; end if;
end; $$;
set local role authenticated;
update public.teams set sport='Approved History Test' where id=current_setting('shore.history_team')::uuid;
update public.games set notes='Published note edit',revision=revision+1 where id=current_setting('shore.history_game')::uuid;
do $$ declare g jsonb; begin
  select value into g from jsonb_array_elements(public.review_schedule_publication('marlboro')) where value->>'team_id'=current_setting('shore.history_team');
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',g->>'team_id','season_year',2038,'token',g->>'token')));
end; $$;
reset role;
do $$ declare history jsonb; begin
  select value into history from jsonb_array_elements(public.read_published_schedule('marlboro')->'updates') where value->>'game_id'=current_setting('shore.history_game');
  if history is null or history->>'kind'<>'game_changed' then raise exception 'Published notes-only edit missing from history'; end if;
  if history::text like '%Published note edit%' then raise exception 'Notes copied into public history summary'; end if;
end; $$;
set local role authenticated;
update public.teams set sport='UNAPPROVED LABEL' where id=current_setting('shore.history_team')::uuid;
do $$ declare g jsonb; begin
  select value into g from jsonb_array_elements(public.review_schedule_publication('marlboro')) where value->>'team_id'=current_setting('shore.history_team');
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',g->>'team_id','season_year',2038,'token',g->>'token')),true);
end; $$;
reset role;
do $$ begin
  if public.read_published_schedule('marlboro')::text like '%UNAPPROVED LABEL%' then raise exception 'Withdrawal notice used draft labels'; end if;
end; $$;
set local role authenticated;
update public.teams set sport='Approved History Test' where id=current_setting('shore.history_team')::uuid;
reset role;
-- Administrative removal fixture: ADs cancel games and have no raw DELETE permission.
delete from public.games where id=current_setting('shore.history_game')::uuid;
set local role authenticated;
do $$ declare g jsonb; begin
  select value into g from jsonb_array_elements(public.review_schedule_publication('marlboro')) where value->>'team_id'=current_setting('shore.history_team');
  perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',g->>'team_id','season_year',2038,'token',g->>'token')));
end; $$;
reset role;
do $$ begin
  if exists(select 1 from jsonb_array_elements(public.read_published_schedule('marlboro')->'updates') u where u->>'game_id'=current_setting('shore.history_game')) then
    raise exception 'Reposting resurfaced withdrawn game history'; end if;
end; $$;
set local role authenticated;
do $$ declare g jsonb; rejected boolean:=false; begin
  select value into g from jsonb_array_elements(public.review_schedule_publication('marlboro')) where value->>'team_id'=current_setting('shore.history_team');
  update public.teams set sport='Empty draft changed after review' where id=current_setting('shore.history_team')::uuid;
  begin
    perform public.publish_schedule_changes('marlboro',jsonb_build_array(jsonb_build_object('team_id',g->>'team_id','season_year',2038,'token',g->>'token')));
  exception when serialization_failure then rejected:=true; end;
  if not rejected then raise exception 'Empty schedule accepted stale team labels'; end if;
end; $$;
reset role;
select 'PASS: approved team metadata; published notes-only notices; approved withdrawal labels; withdrawn history stays private after reposting' as verification;
rollback;
