-- Tightens tournament graph, scheduling and partial-publication checks found during regression review.
create or replace function shore_private.tournament_conflicts(excluded uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(entry order by entry->>'id'),'[]'::jsonb) from (
    select jsonb_build_object('id',g.id,'school_ids',jsonb_build_array(g.school_id,g.opponent_school_id),
      'game_date',g.game_date,'start_time',to_char(g.start_time,'HH24:MI'),'duration_minutes',null,'venue',g.location) entry
      from public.games g where g.status not in ('Canceled','Postponed')
    union all
    select jsonb_build_object('id','tournament-'||t.id::text||'-'||(m->>'id'),
      'school_ids',(select coalesce(jsonb_agg(p->>'school_id'),'[]'::jsonb) from jsonb_array_elements(t.published->'participants') p
        where p->>'id'=any(shore_private.tournament_potential(t.published,m->'a')||shore_private.tournament_potential(t.published,m->'b')) and p->>'school_id' is not null),
      'game_date',m->'game_date','start_time',m->'start_time','duration_minutes',t.published->'duration_minutes','venue',m->>'venue')
      from public.tournaments t cross join lateral jsonb_array_elements(t.published->'matches') m
      where (excluded is null or t.id<>excluded) and m->>'status' not in ('Canceled','Postponed')
  ) entries;
$$;

create or replace function shore_private.tournament_validate(doc jsonb,check_schedule boolean default true,excluded uuid default null)
returns jsonb language plpgsql stable set search_path='' as $$
declare issues jsonb:='[]'; p jsonb; m jsonb; other jsonb; slot jsonb; source jsonb; w jsonb;
  key text; mid text; prepared jsonb; start_at timestamptz; end_at timestamptz; other_start timestamptz;
  duration integer; rest integer; turnaround integer; possible text[]; other_possible text[]; schools text[]; external jsonb;
begin
  if jsonb_typeof(doc)<>'object' or jsonb_typeof(doc->'participants') is distinct from 'array'
    or jsonb_typeof(doc->'matches') is distinct from 'array' or jsonb_typeof(doc->'windows') is distinct from 'array' then
    return shore_private.tournament_issue(null,'Supply a tournament with participant and match lists.',true);
  end if;
  if char_length(doc::text)>1048576 or jsonb_array_length(doc->'participants') not between 2 and 128
    or jsonb_array_length(doc->'matches') not between 1 and 127 then
    return shore_private.tournament_issue(null,'Use 2–128 participants and 1–127 matches within a 1 MB document.',true);
  end if;
  if coalesce(char_length(btrim(doc->>'name')),0) not between 1 and 120
    or coalesce(char_length(btrim(doc->>'sport')),0) not between 1 and 60
    or coalesce(doc->>'gender','') not in ('Boys','Girls','Coed') or coalesce(doc->>'level','') not in ('Varsity','JV','Freshman')
    or coalesce(doc->>'season','') not in ('Fall','Winter','Spring') or coalesce(doc->>'season_year','') !~ '^20[0-9]{2}$' then
    issues:=issues||shore_private.tournament_issue(null,'Enter the tournament name, sport, team, level, season and year.',true);
  end if;
  foreach key in array array['duration_minutes','turnaround_minutes','rest_minutes'] loop
    if coalesce(doc->>key,'') !~ '^[0-9]{1,4}$' then
      issues:=issues||shore_private.tournament_issue(null,'Enter whole minutes for game duration, turnaround and rest.',true);
    end if;
  end loop;
  if issues<>'[]'::jsonb then return issues; end if;
  duration:=(doc->>'duration_minutes')::integer; turnaround:=(doc->>'turnaround_minutes')::integer; rest:=(doc->>'rest_minutes')::integer;
  if duration not between 1 and 480 or turnaround not between 0 and 180 or rest not between 0 and 1440 then
    return shore_private.tournament_issue(null,'Use duration 1–480, turnaround 0–180 and rest 0–1440 minutes.',true);
  end if;
  for p in select value from jsonb_array_elements(doc->'participants') loop
    if coalesce(p->>'id','') !~ '^[A-Za-z0-9_-]{1,60}$' or coalesce(char_length(btrim(p->>'name')),0) not between 1 and 120
      or coalesce(p->>'seed','') !~ '^[0-9]{1,3}$' then
      issues:=issues||shore_private.tournament_issue(null,'Each participant needs a valid ID, name and positive seed.',true);
      continue;
    end if;
    if (p->>'seed')::integer not between 1 and 128 then issues:=issues||shore_private.tournament_issue(null,'Seeds must be between 1 and 128.',true); end if;
    if nullif(p->>'school_id','') is not null and not exists(select 1 from public.schools s where s.slug=p->>'school_id' and s.is_conference_member) then
      issues:=issues||shore_private.tournament_issue(null,'Choose a member school or label the participant as a guest.',true);
    end if;
    if nullif(p->>'team_id','') is not null then
      if p->>'team_id' !~ '^[0-9a-fA-F-]{36}$' or not exists(select 1 from public.teams t where t.id::text=p->>'team_id'
        and t.school_id=p->>'school_id' and t.sport=doc->>'sport' and t.gender=doc->>'gender' and t.level=doc->>'level' and t.season=doc->>'season') then
        issues:=issues||shore_private.tournament_issue(null,'A linked team must belong to that school and tournament category.',true);
      end if;
    end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(doc->'participants') entrant group by entrant->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(doc->'participants') entrant group by entrant->>'seed' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(doc->'participants') entrant group by coalesce(nullif(entrant->>'school_id',''),lower(btrim(entrant->>'name'))) having count(*)>1) then
    issues:=issues||shore_private.tournament_issue(null,'Participant IDs, schools/guest names and seeds must be unique.',true);
  end if;
  if exists(select 1 from jsonb_array_elements(doc->'matches') match_entry group by match_entry->>'id' having count(*)>1) then
    issues:=issues||shore_private.tournament_issue(null,'Match IDs must be unique.',true);
  end if;
  for m in select value from jsonb_array_elements(doc->'matches') loop
    mid:=m->>'id';
    if coalesce(mid,'') !~ '^[A-Za-z0-9_-]{1,60}$' or coalesce(m->>'round','') !~ '^([1-9]|1[0-6])$'
      or coalesce(char_length(m->>'label'),0) not between 1 and 120
      or coalesce(m->>'home_side','') not in ('a','b','neutral')
      or coalesce(m->>'status','') not in ('Scheduled','Postponed','Canceled','Final','Forfeit') then
      issues:=issues||shore_private.tournament_issue(mid,'Enter a valid match ID, round, label, home designation and status.',true); continue;
    end if;
    foreach key in array array['a','b'] loop
      slot:=m->key;
      if jsonb_typeof(slot) is distinct from 'object' or (slot ? 'participant_id')=(slot ? 'winner_of') then
        issues:=issues||shore_private.tournament_issue(mid,'Each slot must name one participant or one earlier winner.',true);
      elsif slot ? 'participant_id' then
        if not exists(select 1 from jsonb_array_elements(doc->'participants') entrant where entrant->>'id'=slot->>'participant_id') then
          issues:=issues||shore_private.tournament_issue(mid,'A slot refers to an unknown participant.',true);
        end if;
      else
        select value into source from jsonb_array_elements(doc->'matches') where value->>'id'=slot->>'winner_of';
        if source is null or coalesce(source->>'round','') !~ '^([1-9]|1[0-6])$' then
          issues:=issues||shore_private.tournament_issue(mid,'A winner slot refers to an unknown match.',true);
        elsif (source->>'round')::integer >= (m->>'round')::integer then
          issues:=issues||shore_private.tournament_issue(mid,'Winner references must point to an earlier round; cycles are invalid.',true);
        end if;
      end if;
    end loop;
    foreach key in array array['score_a','score_b'] loop
      if m->>key is not null and (m->>key !~ '^[0-9]{1,3}$') then issues:=issues||shore_private.tournament_issue(mid,'Scores must be whole numbers from 0 to 999.',true); end if;
    end loop;
  end loop;
  if exists(select 1 from jsonb_array_elements(doc->'matches') match_entry cross join lateral (values(match_entry->'a'),(match_entry->'b')) slots(slot_entry)
    group by coalesce('p:'||(slot_entry->>'participant_id'),'w:'||(slot_entry->>'winner_of')) having count(*)>1) then issues:=issues||shore_private.tournament_issue(null,'A participant or match winner can enter only one starting or advancement slot.',true); end if;
  if issues<>'[]'::jsonb then return issues; end if;
  prepared:=shore_private.tournament_prepare(doc);
  for m in select value from jsonb_array_elements(prepared->'matches') loop
    if (m->>'status' in ('Final','Forfeit') and (m->>'resolved_a' is null or m->>'resolved_b' is null or m->>'winner_id' is null or m->>'winner_id' not in (coalesce(m->>'resolved_a',''),coalesce(m->>'resolved_b',''))))
      or (m->>'status' not in ('Final','Forfeit') and m->>'winner_id' is not null) then
      issues:=issues||shore_private.tournament_issue(m->>'id','Confirm a resolved participant as winner, or clear the affected downstream result.',true);
    end if;
  end loop;
  if issues<>'[]'::jsonb or not check_schedule then return issues; end if;
  if jsonb_typeof(doc->'windows') is distinct from 'array' then return shore_private.tournament_issue(null,'Availability windows must be a list.',true); end if;
  for w in select value from jsonb_array_elements(doc->'windows') loop
    begin
      if coalesce(w->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(w->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(w->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(char_length(btrim(w->>'venue')),0) not between 1 and 200
        or (w->>'start')::time >= (w->>'end')::time then raise exception 'Invalid window'; end if;
      perform (w->>'date')::date;
    exception when others then issues:=issues||shore_private.tournament_issue(null,'Availability windows need a valid date, venue and increasing start/end times.',true); end;
  end loop;
  if issues<>'[]'::jsonb then return issues; end if;
  external:=shore_private.tournament_conflicts(excluded);
  for m in select value from jsonb_array_elements(prepared->'matches') loop
    mid:=m->>'id';
    if m->>'status' in ('Canceled','Postponed') then continue; end if;
    begin
      if coalesce(m->>'game_date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(m->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(char_length(btrim(m->>'venue')),0) not between 1 and 200 then raise exception 'Unscheduled'; end if;
      start_at:=((m->>'game_date')::date+(m->>'start_time')::time) at time zone 'America/New_York';
      if to_char(start_at at time zone 'America/New_York','YYYY-MM-DD HH24:MI') <> m->>'game_date'||' '||(m->>'start_time') then raise exception 'Invalid daylight-saving time'; end if;
    exception when others then issues:=issues||shore_private.tournament_issue(mid,'Enter a valid Eastern date, start time and venue before publishing.'); continue; end;
    end_at:=start_at+make_interval(mins=>duration);
    foreach key in array array['a','b'] loop
      if m->key ? 'winner_of' then
        select value into source from jsonb_array_elements(prepared->'matches') where value->>'id'=m->key->>'winner_of';
        begin other_start:=((source->>'game_date')::date+(source->>'start_time')::time) at time zone 'America/New_York';
        exception when others then other_start:=null; end;
        if other_start is null or source->>'status' in ('Canceled','Postponed') or other_start+make_interval(mins=>duration+rest)>start_at then
          issues:=issues||shore_private.tournament_issue(mid,'Schedule this round after its source match and required rest; resolve canceled or postponed sources first.');
        end if;
      end if;
    end loop;
    if jsonb_array_length(doc->'windows')>0 and not exists(select 1 from jsonb_array_elements(doc->'windows') availability
      where availability->>'date'=m->>'game_date' and lower(btrim(availability->>'venue'))=lower(btrim(m->>'venue'))
        and (availability->>'start')::time <= (m->>'start_time')::time and end_at <= (((availability->>'date')::date+(availability->>'end')::time) at time zone 'America/New_York')) then
      issues:=issues||shore_private.tournament_issue(mid,'The game falls outside the entered venue availability.');
    end if;
    possible:=shore_private.tournament_potential(doc,m->'a')||shore_private.tournament_potential(doc,m->'b');
    select array_agg(entrant->>'school_id') into schools from jsonb_array_elements(doc->'participants') entrant where entrant->>'id'=any(possible) and entrant->>'school_id' is not null;
    for other in select value from jsonb_array_elements(prepared->'matches') where value->>'id'<>mid and value->>'status' not in ('Canceled','Postponed') loop
      begin other_start:=((other->>'game_date')::date+(other->>'start_time')::time) at time zone 'America/New_York'; exception when others then continue; end;
      if other_start is null then continue; end if;
      if lower(btrim(other->>'venue'))=lower(btrim(m->>'venue')) and start_at<other_start+make_interval(mins=>duration+turnaround) and other_start<end_at+make_interval(mins=>turnaround) then
        issues:=issues||shore_private.tournament_issue(mid,'Venue overlap or turnaround conflict with '||(other->>'label')||'.');
      end if;
      other_possible:=shore_private.tournament_potential(doc,other->'a')||shore_private.tournament_potential(doc,other->'b');
      if possible && other_possible and start_at<other_start+make_interval(mins=>duration+rest) and other_start<end_at+make_interval(mins=>rest) then
        issues:=issues||shore_private.tournament_issue(mid,'Team conflict, round dependency or insufficient rest with '||(other->>'label')||'.');
      end if;
    end loop;
    for other in select value from jsonb_array_elements(external) loop
      other_start:=((other->>'game_date')::date+(other->>'start_time')::time) at time zone 'America/New_York';
      if other_start is null then continue; end if;
      if (lower(btrim(other->>'venue'))=lower(btrim(m->>'venue'))
        and start_at<other_start+make_interval(mins=>coalesce((other->>'duration_minutes')::integer,duration)+turnaround)
        and other_start<end_at+make_interval(mins=>turnaround))
        or (coalesce(schools,array[]::text[]) && array(select jsonb_array_elements_text(other->'school_ids'))
        and start_at<other_start+make_interval(mins=>coalesce((other->>'duration_minutes')::integer,duration)+rest)
        and other_start<end_at+make_interval(mins=>rest)) then
        issues:=issues||shore_private.tournament_issue(mid,'Conflict with an existing school or tournament game. School games use the entered duration as an estimate.');
      end if;
    end loop;
  end loop;
  return issues;
end;
$$;

create or replace function shore_private.tournament_publish(p_id uuid,p_token text,p_match_ids text[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.users; saved public.tournaments; review jsonb; prepared jsonb; candidate jsonb; issues jsonb;
  m jsonb; previous jsonb; changed jsonb; matches jsonb:='[]'; counters jsonb; counter bigint; chosen text; pubcount bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('shore.tournaments',0));
  actor:=shore_private.tournament_actor();
  if actor.role is null or actor.role not in ('conference_office','site_admin') then raise exception 'This account cannot publish tournaments.' using errcode='42501'; end if;
  lock table public.games,public.tournaments in share row exclusive mode;
  select * into saved from public.tournaments where id=p_id for update;
  review:=shore_private.tournament_review(p_id);
  if p_token is distinct from review->>'token' then raise exception 'The tournament or another schedule changed. Review it again.' using errcode='40001'; end if;
  prepared:=review->'draft';
  if p_match_ids is null then candidate:=prepared;
  else
    if saved.published is null then raise exception 'Publish the full tournament first.' using errcode='22023'; end if;
    if cardinality(p_match_ids) not between 1 and 127 or cardinality(p_match_ids)<>(select count(distinct x) from unnest(p_match_ids) x) then raise exception 'Choose distinct match IDs.' using errcode='22023'; end if;
    if (prepared-'matches') is distinct from (saved.published-'matches') then raise exception 'Tournament details or participants changed. Publish the full reviewed schedule.' using errcode='22023'; end if;
    foreach chosen in array p_match_ids loop
      if not exists(select 1 from jsonb_array_elements(prepared->'matches') item where item->>'id'=chosen)
        and not exists(select 1 from jsonb_array_elements(saved.published->'matches') item where item->>'id'=chosen) then raise exception 'A selected match is not in this tournament.' using errcode='22023'; end if;
    end loop;
    select coalesce(jsonb_agg(candidate_match order by (candidate_match->>'round')::integer,candidate_match->>'id'),'[]'::jsonb) into matches from (
      select value candidate_match from jsonb_array_elements(prepared->'matches') where value->>'id'=any(p_match_ids)
      union all select value-'revision'-'updated_at' from jsonb_array_elements(saved.published->'matches') where not(value->>'id'=any(p_match_ids))) entries;
    candidate:=shore_private.tournament_prepare(jsonb_set(prepared,'{matches}',matches));
    if exists(select 1 from jsonb_array_elements(saved.published->'matches') old_match
      join jsonb_array_elements(candidate->'matches') new_match on old_match->>'id'=new_match->>'id'
      where not(old_match->>'id'=any(p_match_ids)) and (old_match-'revision'-'updated_at') is distinct from new_match) then
      raise exception 'Include the downstream matches affected by this result change.' using errcode='22023';
    end if;
  end if;
  issues:=shore_private.tournament_validate(candidate,true,p_id);
  if issues<>'[]'::jsonb then raise exception '%',issues->0->>'message' using errcode='22023'; end if;
  matches:='[]'; counters:=saved.sequences; pubcount:=saved.published_revision;
  for m in select value from jsonb_array_elements(candidate->'matches') loop
    select value into previous from jsonb_array_elements(saved.published->'matches') where value->>'id'=m->>'id';
    if previous is null or (previous-'revision'-'updated_at') is distinct from m or (candidate-'matches') is distinct from (saved.published-'matches') then
      counter:=coalesce((counters->>(m->>'id'))::bigint,0)+1;
      counters:=counters||jsonb_build_object(m->>'id',counter);
      changed:=m||jsonb_build_object('revision',counter,'updated_at',statement_timestamp());
      insert into public.tournament_updates(tournament_id,match_id,before_game,after_game)
        values(p_id,m->>'id',case when previous is not null then shore_private.tournament_game(saved.published,previous,p_id) end,
          shore_private.tournament_game(candidate,changed,p_id));
      matches:=matches||jsonb_build_array(changed); pubcount:=saved.published_revision+1;
    else matches:=matches||jsonb_build_array(previous); end if;
  end loop;
  for previous in select old_entry from jsonb_array_elements(saved.published->'matches') old_entry where not exists(select 1 from jsonb_array_elements(candidate->'matches') new_entry where new_entry->>'id'=old_entry->>'id') loop
    insert into public.tournament_updates(tournament_id,match_id,before_game) values(p_id,previous->>'id',shore_private.tournament_game(saved.published,previous,p_id));
    pubcount:=saved.published_revision+1;
  end loop;
  update public.tournaments set published=jsonb_set(candidate,'{matches}',matches),published_revision=pubcount,
    sequences=counters,updated_at=statement_timestamp() where id=p_id returning * into saved;
  return shore_private.tournament_record(saved);
end;
$$;
