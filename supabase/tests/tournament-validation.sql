-- Test-project graph and scheduling boundary regressions; all rows roll back.
begin;
select set_config('shore.validation_doc',$document${"name":"Test Spring Cup","sport":"Softball","gender":"Girls","level":"Varsity","season":"Spring","season_year":2037,"duration_minutes":90,"turnaround_minutes":15,"rest_minutes":60,"windows":[],"participants":[{"id":"p1","name":"Colts Neck","school_id":"colts-neck","seed":1},{"id":"p2","name":"Marlboro","school_id":"marlboro","seed":2},{"id":"p3","name":"Shore Regional","school_id":"shore-regional","seed":3},{"id":"p4","name":"Guest","school_id":null,"seed":4}],"matches":[{"id":"sf1","round":1,"label":"Semifinal 1","a":{"participant_id":"p1"},"b":{"participant_id":"p4"},"game_date":"2037-04-01","start_time":"09:00","venue":"Test field","home_side":"neutral","status":"Scheduled","winner_id":null},{"id":"sf2","round":1,"label":"Semifinal 2","a":{"participant_id":"p2"},"b":{"participant_id":"p3"},"game_date":"2037-04-01","start_time":"11:00","venue":"Test field","home_side":"a","status":"Scheduled","winner_id":null},{"id":"final","round":2,"label":"Final","a":{"winner_of":"sf1"},"b":{"winner_of":"sf2"},"game_date":"2037-04-02","start_time":"12:00","venue":"Test field","home_side":"neutral","status":"Scheduled","winner_id":null}]}$document$,true);
do $$ declare doc jsonb:=current_setting('shore.validation_doc')::jsonb; changed jsonb; issues jsonb; peer uuid:=gen_random_uuid(); team uuid:=gen_random_uuid(); begin
  changed:=jsonb_set(doc,'{matches,2,game_date}','"2037-03-31"');
  issues:=shore_private.tournament_validate(changed,true);
  if not exists(select 1 from jsonb_array_elements(issues) i where i->>'match_id'='final' and i->>'message' like '%source match%') then raise exception 'A final before its source was accepted'; end if;
  changed:=jsonb_set(doc,'{matches}',jsonb_build_array(doc->'matches'->0,
    (doc->'matches'->2)||'{"a":{"participant_id":"p2"},"b":{"winner_of":"sf1"},"status":"Final","winner_id":"p2"}'::jsonb));
  if shore_private.tournament_validate(changed,false)='[]'::jsonb then raise exception 'Completed result accepted an unresolved opponent'; end if;
  changed:=jsonb_set(doc,'{matches}',jsonb_build_array((doc->'matches'->0)||'{"status":"Postponed","game_date":null,"start_time":null,"venue":""}'::jsonb,doc->'matches'->1));
  if shore_private.tournament_validate(changed,true)<>'[]'::jsonb then raise exception 'Inactive postponed match reserved an obsolete schedule'; end if;
  changed:=jsonb_set(changed,'{matches,0,game_date}','"bad"');
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'Malformed inactive date reached publication'; end if;
  insert into public.tournaments(id,draft,published) values(peer,doc,shore_private.tournament_prepare(doc));
  if not exists(select 1 from jsonb_array_elements(shore_private.tournament_conflicts()) g
    where g->>'id'='tournament-'||peer::text||'-final' and g->'school_ids' @> '["colts-neck","marlboro","shore-regional"]'::jsonb) then raise exception 'An unresolved final omitted possible schools'; end if;
  changed:=jsonb_set(doc,'{participants}',jsonb_build_array(doc->'participants'->0,doc->'participants'->3));
  changed:=jsonb_set(changed,'{matches}',jsonb_build_array((doc->'matches'->0)||'{"game_date":"2037-04-02","start_time":"12:00","venue":"Different field"}'::jsonb));
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'A different tournament ignored a potential finalist school'; end if;
  insert into public.teams(id,school_id,sport,gender,level,season) values(team,'shore-regional','Tournament conflict fixture','Girls','Varsity','Spring');
  insert into public.games(school_id,team_id,game_date,start_time,opponent_name,home_away,location) values('shore-regional',team,'2037-04-05','09:00','Fixture visitor','Home','Shared fixture venue');
  changed:=jsonb_set(changed,'{matches,0}',(changed->'matches'->0)||'{"game_date":"2037-04-05","start_time":"10:45","venue":"Shared fixture venue"}'::jsonb);
  issues:=shore_private.tournament_validate(changed,true);
  if issues<>'[]'::jsonb then raise exception 'Venue turnaround incorrectly used team rest: %',issues; end if;
  changed:=jsonb_set(changed,'{matches,0,start_time}','"10:40"');
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'Insufficient external venue turnaround accepted'; end if;
  changed:=jsonb_set(changed,'{participants,0}',(changed->'participants'->0)||'{"name":"Shore Regional","school_id":"shore-regional"}'::jsonb);
  changed:=jsonb_set(changed,'{matches,0}',(changed->'matches'->0)||'{"start_time":"10:45","venue":"Different venue"}'::jsonb);
  changed:=changed||'{"turnaround_minutes":60,"rest_minutes":15}'::jsonb;
  issues:=shore_private.tournament_validate(changed,true);
  if issues<>'[]'::jsonb then raise exception 'Team rest incorrectly used venue turnaround: %',issues; end if;
  changed:=jsonb_set(changed,'{matches,0,start_time}','"10:44"');
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'Insufficient external team rest accepted'; end if;
end; $$;
do $$ declare doc jsonb:=current_setting('shore.validation_doc')::jsonb; changed jsonb; begin
  changed:=jsonb_set(doc,'{matches}',jsonb_build_array((doc->'matches'->0)||'{"game_date":"2027-03-14","start_time":"03:00","venue":"DST fixture"}'::jsonb));
  changed:=changed||'{"duration_minutes":60,"windows":[{"date":"2027-03-14","start":"02:30","end":"04:30","venue":"DST fixture"}]}'::jsonb;
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'Nonexistent Eastern availability time was accepted'; end if;
  changed:=jsonb_set(changed,'{windows}','[]');
  changed:=jsonb_set(changed,'{matches,0,start_time}','"02:30"');
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'Nonexistent Eastern match time was accepted'; end if;
  changed:=doc||'{"duration_minutes":60,"rest_minutes":180}'::jsonb;
  changed:=jsonb_set(changed,'{matches,0}',(changed->'matches'->0)||'{"game_date":"2027-03-13","start_time":"23:00","venue":"DST fixture A"}'::jsonb);
  changed:=jsonb_set(changed,'{matches,1}',(changed->'matches'->1)||'{"game_date":"2027-03-13","start_time":"23:00","venue":"DST fixture B"}'::jsonb);
  changed:=jsonb_set(changed,'{matches,2}',(changed->'matches'->2)||'{"game_date":"2027-03-14","start_time":"03:30","venue":"DST fixture final"}'::jsonb);
  if shore_private.tournament_validate(changed,true)='[]'::jsonb then raise exception 'Spring-forward rest used wall-clock hours'; end if;
  changed:=jsonb_set(changed,'{matches,2,start_time}','"04:00"');
  if shore_private.tournament_validate(changed,true)<>'[]'::jsonb then raise exception 'Valid elapsed spring-forward rest rejected'; end if;
  changed:=jsonb_set(changed,'{matches,0,game_date}','"2027-11-06"');
  changed:=jsonb_set(changed,'{matches,1,game_date}','"2027-11-06"');
  changed:=jsonb_set(changed,'{matches,2}',(changed->'matches'->2)||'{"game_date":"2027-11-07","start_time":"02:00"}'::jsonb);
  if shore_private.tournament_validate(changed,true)<>'[]'::jsonb then raise exception 'Valid elapsed fall-back rest rejected'; end if;
  changed:=jsonb_set(changed,'{matches,2,start_time}','"01:30"');
  if shore_private.tournament_game(changed,changed->'matches'->2,gen_random_uuid())->>'ics_start_utc' is distinct from '20271107T063000Z' then
    raise exception 'Repeated Eastern hour lacks a consistent calendar instant'; end if;
end; $$;
select 'PASS: round ordering, resolved results, inactive schedules, possible-school conflicts, independent venue/team boundaries and Eastern daylight-saving validation' verification;
rollback;
