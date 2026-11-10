-- Test-project regression suite for tournament publication, authority and calendar projection; all fixtures roll back.
begin;
do $$ declare office uuid:=gen_random_uuid(); ad uuid:=gen_random_uuid(); site uuid:=gen_random_uuid(); tid uuid:=gen_random_uuid(); begin
  if to_regprocedure('public.save_tournament(uuid,bigint,jsonb)') is null then raise exception 'Tournament operations are not installed'; end if;
  insert into auth.users(id,email,email_confirmed_at) values(office,'tournament-office-test@example.org',now()),(ad,'tournament-ad-test@example.org',now()),(site,'tournament-site-test@example.org',now());
  insert into public.users(email,name,role,school_id) values('tournament-office-test@example.org','Tournament office','conference_office',null),
    ('tournament-ad-test@example.org','Tournament AD','ad','colts-neck'),('tournament-site-test@example.org','Tournament site','site_admin',null);
  perform set_config('shore.tournament_office',office::text,true); perform set_config('shore.tournament_ad',ad::text,true);perform set_config('shore.tournament_site',site::text,true);perform set_config('shore.tournament_id',tid::text,true);
  perform set_config('shore.tournament_doc','{"name":"Test Spring Cup","sport":"Softball","gender":"Girls","level":"Varsity","season":"Spring","season_year":2037,"duration_minutes":90,"turnaround_minutes":15,"rest_minutes":60,"windows":[],"participants":[{"id":"p1","name":"Colts Neck","school_id":"colts-neck","seed":1},{"id":"p2","name":"Marlboro","school_id":"marlboro","seed":2},{"id":"p3","name":"Shore Regional","school_id":"shore-regional","seed":3},{"id":"p4","name":"Guest","school_id":null,"seed":4}],"matches":[{"id":"sf1","round":1,"label":"Semifinal 1","a":{"participant_id":"p1"},"b":{"participant_id":"p4"},"game_date":"2037-04-01","start_time":"09:00","venue":"Test field","home_side":"neutral","status":"Scheduled","winner_id":null},{"id":"sf2","round":1,"label":"Semifinal 2","a":{"participant_id":"p2"},"b":{"participant_id":"p3"},"game_date":"2037-04-01","start_time":"11:00","venue":"Test field","home_side":"a","status":"Scheduled","winner_id":null},{"id":"final","round":2,"label":"Final","a":{"winner_of":"sf1"},"b":{"winner_of":"sf2"},"game_date":"2037-04-02","start_time":"12:00","venue":"Test field","home_side":"neutral","status":"Scheduled","winner_id":null}]}',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',office,'role','authenticated')::text,true);
end; $$;
set local role authenticated;
do $$ declare saved jsonb; bad jsonb; begin
  saved:=public.save_tournament(current_setting('shore.tournament_id')::uuid,0,current_setting('shore.tournament_doc')::jsonb);
  if saved->>'revision'<>'1' or saved->'issues'<>'[]'::jsonb then raise exception 'Valid draft failed to save: %',saved; end if;
  saved:=public.save_tournament(current_setting('shore.tournament_id')::uuid,0,current_setting('shore.tournament_doc')::jsonb);
  if saved->>'revision'<>'1' then raise exception 'Identical save retry advanced revision'; end if;
  bad:=jsonb_set(current_setting('shore.tournament_doc')::jsonb,'{participants,1,seed}','1');
  begin perform public.save_tournament(gen_random_uuid(),0,bad);raise exception 'Duplicate seed accepted';exception when invalid_parameter_value then null;end;
  bad:=jsonb_set(current_setting('shore.tournament_doc')::jsonb,'{matches,0,a}','{"winner_of":"final"}');
  begin perform public.save_tournament(gen_random_uuid(),0,bad);raise exception 'Cyclic advancement accepted';exception when invalid_parameter_value then null;end;
  begin perform 1 from public.tournaments;raise exception 'Raw tournament drafts accessible';exception when insufficient_privilege then null;end;
end; $$;
reset role;
do $$ begin
  if exists(select 1 from jsonb_array_elements(public.read_published_schedule(null)->'tournament_games') g where g->>'tournament_id'=current_setting('shore.tournament_id')) then raise exception 'Draft leaked to public calendar';end if;
end; $$;
set local role authenticated;
do $$ declare reviewed jsonb; begin
  reviewed:=public.review_tournament(current_setting('shore.tournament_id')::uuid);
  perform public.publish_tournament(current_setting('shore.tournament_id')::uuid,reviewed->>'token');
end; $$;
reset role;
do $$ declare data jsonb; begin
  data:=public.read_published_schedule(null);
  if (select count(*) from jsonb_array_elements(data->'tournament_games') g where g->>'tournament_id'=current_setting('shore.tournament_id'))<>3 then raise exception 'Conference tournament projection count incorrect'; end if;
  data:=public.read_published_schedule('colts-neck');
  if (select count(*) from jsonb_array_elements(data->'tournament_games') g where g->>'tournament_id'=current_setting('shore.tournament_id'))<>1 then raise exception 'Unconfirmed future round leaked to school'; end if;
end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.tournament_ad'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare bus jsonb; begin
  if public.list_tournaments()->>'actor_role'<>'ad' then raise exception 'AD identity incorrect'; end if;
  begin perform public.save_tournament(current_setting('shore.tournament_id')::uuid,1,current_setting('shore.tournament_doc')::jsonb);raise exception 'AD edited tournament';exception when insufficient_privilege then null;end;
  begin perform public.review_tournament(current_setting('shore.tournament_id')::uuid);raise exception 'AD reviewed tournament drafts';exception when insufficient_privilege then null;end;
  bus:=public.save_tournament_transport(current_setting('shore.tournament_id')::uuid,'sf1','colts-neck',0,'{"bus_departure":"08:00","pickup_location":"Gym","notes":"PRIVATE BUS NOTE","bus_confirmed":true}');
  if bus->>'revision'<>'1' then raise exception 'Own-school bus save failed'; end if;
  begin perform public.save_tournament_transport(current_setting('shore.tournament_id')::uuid,'sf2','marlboro',0,'{}');raise exception 'Cross-school bus write allowed';exception when insufficient_privilege then null;end;
end; $$;
reset role;
do $$ declare data jsonb; begin
  data:=public.read_published_schedule('colts-neck');
  if not exists(select 1 from jsonb_array_elements(data->'tournament_games') g where g->>'match_id'='sf1' and g->'transportation'->>'pickup_location'='Gym') then raise exception 'Own published bus missing'; end if;
  if data::text like '%PRIVATE BUS NOTE%' or data::text like '%bus_confirmed%' then raise exception 'Private bus fields leaked'; end if;
  if exists(select 1 from jsonb_array_elements(public.read_published_schedule(null)->'tournament_games') g where g->'transportation' is distinct from 'null'::jsonb) then raise exception 'Bus leaked to conference'; end if;
end; $$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('shore.tournament_office'),'role','authenticated')::text,true);
set local role authenticated;
do $$ declare doc jsonb; review jsonb; saved jsonb; begin
  begin perform public.save_tournament_transport(current_setting('shore.tournament_id')::uuid,'sf1','colts-neck',1,'{}');raise exception 'Conference admin wrote school bus';exception when insufficient_privilege then null;end;
  doc:=current_setting('shore.tournament_doc')::jsonb;
  doc:=jsonb_set(jsonb_set(doc,'{matches,0,status}','"Final"'),'{matches,0,winner_id}','"p1"');
  saved:=public.save_tournament(current_setting('shore.tournament_id')::uuid,1,doc);
  review:=public.review_tournament(current_setting('shore.tournament_id')::uuid);
  begin perform public.publish_tournament(current_setting('shore.tournament_id')::uuid,review->>'token',array['sf1']);raise exception 'Result published without affected final';exception when invalid_parameter_value then null;end;
  perform public.publish_tournament(current_setting('shore.tournament_id')::uuid,review->>'token',array['sf1','final']);
  perform set_config('shore.tournament_doc',doc::text,true);
  begin perform public.save_tournament(current_setting('shore.tournament_id')::uuid,1,jsonb_set(doc,'{name}','"Stale overwrite"'));raise exception 'Stale save allowed';exception when serialization_failure then null;end;
end; $$;
reset role;
do $$ begin
  if (select count(*) from jsonb_array_elements(public.read_published_schedule('colts-neck')->'tournament_games') g where g->>'tournament_id'=current_setting('shore.tournament_id'))<>2 then raise exception 'Winner did not advance into school calendar'; end if;
  if not exists(select 1 from jsonb_array_elements(public.read_published_schedule('colts-neck')->'updates') u
    where u->>'game_id'='tournament-'||current_setting('shore.tournament_id')||'-final' and u->>'kind'='game_added'
      and u->'before'='null'::jsonb and u->'after' is distinct from 'null'::jsonb) then raise exception 'Advancing school received an incorrect tournament update'; end if;
end; $$;
set local role authenticated;
do $$ declare doc jsonb; review jsonb; begin
  doc:=jsonb_set(current_setting('shore.tournament_doc')::jsonb,'{matches,0,winner_id}','"p4"');
  perform public.save_tournament(current_setting('shore.tournament_id')::uuid,2,doc);
  review:=public.review_tournament(current_setting('shore.tournament_id')::uuid);
  perform public.publish_tournament(current_setting('shore.tournament_id')::uuid,review->>'token');
  perform set_config('shore.tournament_doc',doc::text,true);
  review:=public.review_tournament(current_setting('shore.tournament_id')::uuid);
  perform set_config('shore.tournament_review',review->>'token',true);
end; $$;
reset role;
do $$ begin
  if (select count(*) from jsonb_array_elements(public.read_published_schedule('colts-neck')->'tournament_games') g where g->>'tournament_id'=current_setting('shore.tournament_id'))<>1 then raise exception 'Corrected winner left wrong school in final'; end if;
  if not exists(select 1 from jsonb_array_elements(public.read_published_schedule('colts-neck')->'updates') u
    where u->>'game_id'='tournament-'||current_setting('shore.tournament_id')||'-final' and u->>'kind'='game_removed'
      and u->'before' is distinct from 'null'::jsonb and u->'after'='null'::jsonb) then raise exception 'Departing school received an incorrect tournament update'; end if;
  if not exists(select 1 from jsonb_array_elements(public.read_published_schedule(null)->'tournament_games') g where g->>'match_id'='sf1' and (g->>'revision')::bigint>=3 and g->>'id'='tournament-'||current_setting('shore.tournament_id')||'-sf1') then raise exception 'Published identity or increasing revision failed'; end if;
end; $$;
update public.games set location=location||' [transactional tournament test]' where id=(select id from public.games order by id limit 1);
set local role authenticated;
do $$ begin
  begin perform public.publish_tournament(current_setting('shore.tournament_id')::uuid,current_setting('shore.tournament_review'));raise exception 'Changed school schedule accepted old review';exception when serialization_failure then null;end;
end; $$;
reset role;
delete from public.users where email='tournament-office-test@example.org';
set local role authenticated;
do $$ begin
  begin perform public.list_tournaments();raise exception 'Revoked director retained access';exception when insufficient_privilege then null;end;
  begin perform public.save_tournament(current_setting('shore.tournament_id')::uuid,3,current_setting('shore.tournament_doc')::jsonb);raise exception 'Revoked director wrote tournament';exception when insufficient_privilege then null;end;
end; $$;
reset role;
set local role anon;
do $$ begin
  begin perform public.list_tournaments();raise exception 'Anonymous tournament management allowed';exception when insufficient_privilege then null;end;
end; $$;
reset role;
select 'PASS: draft privacy, publication counts, current-role authority, school bus isolation, safe retries, duplicate/cyclic rejection, atomic advancement/correction, stale review/save protection, stable increasing revisions and revoked access' verification;
rollback;
