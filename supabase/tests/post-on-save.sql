-- Test project only: saving and deleting post straight away, older private games stay private,
-- a taken-down team is not brought back, other schools are refused, no coach emails queue. Rolls back.
-- Run after 20261130000100_early_dismissal.sql.
begin;
do $$
declare actor uuid := gen_random_uuid(); held uuid := gen_random_uuid(); down uuid := gen_random_uuid();
  old_private uuid := gen_random_uuid(); down_game uuid := gen_random_uuid();
begin
  if to_regprocedure('shore_private.post_saved_game(uuid,text)') is null then raise exception 'Posting on save is not installed'; end if;
  insert into auth.users(id,email,email_confirmed_at) values(actor,'post-on-save-test@example.org',now());
  insert into public.users(email,name,role,school_id) values('post-on-save-test@example.org','Post on save test AD','ad','marlboro');
  insert into public.teams(id,school_id,sport,gender,level,season) values
    (held,'marlboro','Post Test Lacrosse','Girls','JV','Spring'),
    (down,'marlboro','Post Test Lacrosse','Girls','Freshman','Spring');
  -- A private game from before the change, in a team that was never posted.
  insert into public.games(id,school_id,team_id,game_date,start_time,opponent_name,home_away,location) values
    (old_private,'marlboro',held,'2031-04-01','15:00','Old Visitor','Home','Old field'),
    (down_game,'marlboro',down,'2031-04-02','15:00','Old Visitor','Home','Old field');
  -- A team that was posted, then taken down: its public copy is kept privately, with no team_publications row.
  insert into public.published_games(id,school_id,team_id,season_year,payload,revision)
  select g.id,g.school_id,g.team_id,2031,shore_private.public_game_payload(g),1 from public.games g where g.id=down_game;
  perform set_config('shore.t_held',held::text,true); perform set_config('shore.t_down',down::text,true);
  perform set_config('shore.t_old',old_private::text,true);
  if to_regclass('public.coach_email_outbox') is not null then
    perform set_config('shore.t_outbox',(select count(*) from public.coach_email_outbox)::text,true);
  end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
end;
$$;
set local role authenticated;
do $$
declare base jsonb := jsonb_build_object('school_id','marlboro','sport','Post Test Soccer','gender','Boys','level','Varsity',
    'season','Fall','game_date','2031-09-10','start_time','16:00','home_away','Home','opponent_name','Test Visitor',
    'location','Test field','status','Scheduled','early_dismissal_time','13:15');
  saved uuid; second uuid; third uuid; game_revision integer; public_revision integer; rejected boolean;
begin
  -- A new game is public as soon as it saves, and its new team is posted.
  saved := public.save_staff_game(base);
  if (select early_dismissal_time from public.transportation where game_id=saved) is distinct from '13:15'::time then
    raise exception 'Early dismissal was not saved'; end if;
  if (select payload->'transportation'->>'early_dismissal_time' from public.published_games where id=saved)
      is distinct from '13:15:00' then
    raise exception 'Early dismissal was not added to the owning school public schedule'; end if;
  if not exists(select 1 from public.published_games where id=saved and payload->>'start_time'='16:00:00') then
    raise exception 'A new game was not posted'; end if;
  if not exists(select 1 from public.team_publications p join public.games g on g.team_id=p.team_id
    where g.id=saved and p.season_year=2031) then raise exception 'The new team was not posted'; end if;
  select revision into public_revision from public.published_games where id=saved;

  -- An edit and a postponement reach the public copy with a higher revision.
  select revision into game_revision from public.games where id=saved;
  perform public.save_staff_game(base || jsonb_build_object('id',saved,'revision',game_revision,'start_time','17:30','status','Postponed'));
  if (select payload->>'start_time' from public.published_games where id=saved) <> '17:30:00'
    or (select payload->>'status' from public.published_games where id=saved) <> 'Postponed' then
    raise exception 'The edit did not reach the public copy'; end if;
  if (select revision from public.published_games where id=saved) <= public_revision then
    raise exception 'The public revision did not go up'; end if;

  -- A stale save is refused and changes nothing public.
  rejected := false;
  begin perform public.save_staff_game(base || jsonb_build_object('id',saved,'revision',game_revision,'location','Overwrite'));
  exception when serialization_failure then rejected := true; end;
  if not rejected then raise exception 'A stale save was accepted'; end if;
  if (select payload->>'location' from public.published_games where id=saved) = 'Overwrite' then
    raise exception 'A stale save reached the public copy'; end if;

  -- Saving into a never-posted team posts only that game.
  second := public.save_staff_game(base || jsonb_build_object('sport','Post Test Lacrosse','gender','Girls','level','JV',
    'season','Spring','game_date','2031-04-08','early_dismissal_time',null));
  if not exists(select 1 from public.published_games where id=second) then raise exception 'The game was not posted'; end if;
  if (select payload->'transportation' ? 'early_dismissal_time' from public.published_games where id=second) then
    raise exception 'An unset early dismissal appeared in the public schedule'; end if;
  if exists(select 1 from public.published_games where id=current_setting('shore.t_old')::uuid) then
    raise exception 'An older private game was exposed'; end if;

  -- Saving into a taken-down team does not bring it back.
  third := public.save_staff_game(base || jsonb_build_object('sport','Post Test Lacrosse','gender','Girls','level','Freshman',
    'season','Spring','game_date','2031-04-09'));
  if exists(select 1 from public.published_games where id=third) then raise exception 'A taken-down team was posted by a save'; end if;
  if exists(select 1 from public.team_publications where team_id=current_setting('shore.t_down')::uuid) then
    raise exception 'A taken-down team was brought back'; end if;

  -- Deleting removes the public copy.
  select revision into game_revision from public.games where id=saved;
  perform public.delete_staff_game(saved, game_revision);
  if exists(select 1 from public.published_games where id=saved) then raise exception 'A deleted game is still public'; end if;

  -- Another school's schedule is refused.
  rejected := false;
  begin perform public.save_staff_game(base || jsonb_build_object('school_id','colts-neck'));
  exception when insufficient_privilege then rejected := true; end;
  if not rejected then raise exception 'An AD saved another school'; end if;
  perform set_config('shore.t_saved',saved::text,true);
end;
$$;
reset role;
do $$
begin
  if not exists(select 1 from public.publication_updates where game_id=current_setting('shore.t_saved')::uuid and kind='game_postponed') then
    raise exception 'The postponement is missing from public changes'; end if;
  if not exists(select 1 from public.publication_updates where game_id=current_setting('shore.t_saved')::uuid and kind='game_removed') then
    raise exception 'The removal is missing from public changes'; end if;
  if to_regclass('public.coach_email_outbox') is not null then
    if (select count(*) from public.coach_email_outbox) <> current_setting('shore.t_outbox')::integer then
      raise exception 'A coach email was queued'; end if;
  end if;
end;
$$;
select 'PASS: posts on save and edit; higher revisions; stale save refused; older private games kept private; taken-down team not revived; delete removes the public copy; other school refused; no coach emails' as verification;
rollback;
