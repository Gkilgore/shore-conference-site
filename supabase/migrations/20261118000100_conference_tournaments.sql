-- Stores conference-owned tournament drafts, reviewed public matches and school-owned transportation.
create table public.tournaments (
  id uuid primary key,
  draft jsonb not null,
  revision bigint not null default 1,
  published jsonb,
  published_revision bigint not null default 0,
  sequences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default statement_timestamp()
);
create table public.tournament_transportation (
  tournament_id uuid not null references public.tournaments(id),
  match_id text not null,
  school_id text not null references public.schools(slug),
  bus_departure time, pickup_location text, return_time time, notes text,
  bus_confirmed boolean not null default false,
  revision bigint not null default 1,
  updated_at timestamptz not null default statement_timestamp(),
  primary key(tournament_id,match_id,school_id)
);
create index tournament_transportation_school on public.tournament_transportation(school_id);
create table public.tournament_updates (
  id bigint generated always as identity primary key,
  tournament_id uuid not null references public.tournaments(id),
  match_id text not null,
  occurred_at timestamptz not null default statement_timestamp(),
  before_game jsonb, after_game jsonb
);
create index tournament_updates_recent on public.tournament_updates(tournament_id,occurred_at desc,id desc);
alter table public.tournaments enable row level security;
alter table public.tournament_transportation enable row level security;
alter table public.tournament_updates enable row level security;
revoke all on public.tournaments,public.tournament_transportation,public.tournament_updates from public,anon,authenticated;
grant select on public.tournaments,public.tournament_transportation,public.tournament_updates to service_role;

create function shore_private.tournament_actor()
returns public.users language sql stable security definer set search_path='' as $$
  select u from public.users u where u.email=shore_private.verified_staff_email();
$$;

create function shore_private.tournament_issue(match_id text,message text,structural boolean default false)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_array(jsonb_build_object('match_id',match_id,'message',message,'blocking',true,'structural',structural));
$$;

create function shore_private.tournament_clean(doc jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('name',btrim(doc->>'name'),'sport',btrim(doc->>'sport'),
    'gender',doc->>'gender','level',doc->>'level','season',doc->>'season','season_year',doc->'season_year',
    'duration_minutes',coalesce(doc->'duration_minutes','90'::jsonb),
    'turnaround_minutes',coalesce(doc->'turnaround_minutes','15'::jsonb),'rest_minutes',coalesce(doc->'rest_minutes','60'::jsonb),
    'windows',(select coalesce(jsonb_agg(jsonb_build_object('date',w->>'date','start',w->>'start','end',w->>'end','venue',btrim(w->>'venue'))),'[]'::jsonb) from jsonb_array_elements(doc->'windows') w),
    'participants',(select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','name',btrim(p->>'name'),
      'school_id',nullif(p->>'school_id',''),'team_id',nullif(p->>'team_id',''),'seed',p->'seed') order by p->>'id'),'[]'::jsonb)
      from jsonb_array_elements(doc->'participants') p),
    'matches',(select coalesce(jsonb_agg(jsonb_build_object('id',m->>'id','round',m->'round','label',btrim(m->>'label'),
      'a',case when m->'a' ? 'participant_id' then jsonb_build_object('participant_id',m->'a'->>'participant_id') else jsonb_build_object('winner_of',m->'a'->>'winner_of') end,
      'b',case when m->'b' ? 'participant_id' then jsonb_build_object('participant_id',m->'b'->>'participant_id') else jsonb_build_object('winner_of',m->'b'->>'winner_of') end,
      'game_date',nullif(m->>'game_date',''),'start_time',nullif(m->>'start_time',''),
      'venue',btrim(coalesce(m->>'venue','')),'home_side',coalesce(m->>'home_side','neutral'),
      'status',coalesce(m->>'status','Scheduled'),'winner_id',nullif(m->>'winner_id',''),
      'score_a',m->'score_a','score_b',m->'score_b') order by (m->>'round')::integer,m->>'id'),'[]'::jsonb)
      from jsonb_array_elements(doc->'matches') m));
$$;

create function shore_private.tournament_prepare(doc jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare m jsonb; result jsonb:='[]'; winners jsonb:='{}'; a text; b text;
begin
  for m in select value from jsonb_array_elements(doc->'matches') order by (value->>'round')::integer,value->>'id' loop
    a:=coalesce(m->'a'->>'participant_id',winners->>(m->'a'->>'winner_of'));
    b:=coalesce(m->'b'->>'participant_id',winners->>(m->'b'->>'winner_of'));
    result:=result||jsonb_build_array(m||jsonb_build_object('resolved_a',a,'resolved_b',b));
    if m->>'status' in ('Final','Forfeit') and m->>'winner_id' in (a,b) then
      winners:=winners||jsonb_build_object(m->>'id',m->>'winner_id');
    end if;
  end loop;
  return jsonb_set(doc,'{matches}',result);
end;
$$;

create function shore_private.tournament_record(t public.tournaments)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',t.id,'revision',t.revision,'published_revision',t.published_revision,
    'draft',t.draft,'published',t.published,'issues','[]'::jsonb);
$$;

create function shore_private.tournament_save(p_id uuid,p_expected_revision bigint,p_document jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.users; saved public.tournaments; doc jsonb; issues jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('shore.tournaments',0));
  actor:=shore_private.tournament_actor();
  if actor.role is null or actor.role not in ('conference_office','site_admin') then raise exception 'This account cannot manage tournaments.' using errcode='42501'; end if;
  doc:='{"duration_minutes":90,"turnaround_minutes":15,"rest_minutes":60,"windows":[]}'::jsonb||p_document;
  issues:=shore_private.tournament_validate(doc,false,p_id);
  if issues<>'[]'::jsonb then raise exception '%',issues->0->>'message' using errcode='22023'; end if;
  doc:=shore_private.tournament_clean(doc);
  select * into saved from public.tournaments where id=p_id for update;
  if saved.id is null then
    if p_expected_revision is distinct from 0::bigint or p_id is null then raise exception 'Reload and review this tournament before saving.' using errcode='40001'; end if;
    insert into public.tournaments(id,draft) values(p_id,doc) returning * into saved;
  elsif saved.draft is not distinct from doc then
    return shore_private.tournament_record(saved)||jsonb_build_object('issues',shore_private.tournament_validate(doc,true,p_id));
  elsif saved.revision is distinct from p_expected_revision then
    raise exception 'Another director changed this tournament. Reload and review it again.' using errcode='40001';
  else
    update public.tournaments set draft=doc,revision=revision+1,updated_at=statement_timestamp() where id=p_id returning * into saved;
  end if;
  return shore_private.tournament_record(saved)||jsonb_build_object('issues',shore_private.tournament_validate(doc,true,p_id));
end;
$$;

create function shore_private.tournament_review(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.users; saved public.tournaments; prepared jsonb; changes jsonb; schools jsonb; global_change boolean;
begin
  actor:=shore_private.tournament_actor();
  if actor.role is null or actor.role not in ('conference_office','site_admin') then raise exception 'This account cannot review tournaments.' using errcode='42501'; end if;
  select * into saved from public.tournaments where id=p_id;
  if saved.id is null then raise exception 'Tournament not found.' using errcode='22023'; end if;
  prepared:=shore_private.tournament_prepare(saved.draft);
  global_change:=saved.published is null or (prepared-'matches') is distinct from (saved.published-'matches');
  with drafts as(select value m from jsonb_array_elements(prepared->'matches')),
    posted as(select value m from jsonb_array_elements(saved.published->'matches'))
  select coalesce(jsonb_agg(jsonb_build_object('id',coalesce(d.m->>'id',p.m->>'id'),'before',p.m,'after',d.m) order by coalesce(d.m->>'id',p.m->>'id')),'[]'::jsonb)
  into changes from drafts d full join posted p on d.m->>'id'=p.m->>'id'
  where global_change or d.m is distinct from (p.m-'revision'-'updated_at');
  select coalesce(jsonb_agg(distinct school),'[]'::jsonb) into schools from (
    select p->>'school_id' school from jsonb_array_elements(prepared->'participants') p
    union select p->>'school_id' from jsonb_array_elements(saved.published->'participants') p) entries where school is not null;
  return jsonb_build_object('id',p_id,'revision',saved.revision,'draft',prepared,'published',saved.published,
    'changes',changes,'issues',shore_private.tournament_validate(prepared,true,p_id),'affected_schools',schools,
    'token',md5(saved.draft::text||saved.revision::text||saved.published_revision::text||shore_private.tournament_conflicts(p_id)::text));
end;
$$;

create function shore_private.tournament_publish(p_id uuid,p_token text,p_match_ids text[] default null)
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
      if not exists(select 1 from jsonb_array_elements(prepared->'matches') m where m->>'id'=chosen)
        and not exists(select 1 from jsonb_array_elements(saved.published->'matches') m where m->>'id'=chosen) then raise exception 'A selected match is not in this tournament.' using errcode='22023'; end if;
    end loop;
    select coalesce(jsonb_agg(m order by (m->>'round')::integer,m->>'id'),'[]'::jsonb) into matches from (
      select value m from jsonb_array_elements(prepared->'matches') where value->>'id'=any(p_match_ids)
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
  for previous in select value from jsonb_array_elements(saved.published->'matches') where not exists(select 1 from jsonb_array_elements(candidate->'matches') m where m->>'id'=value->>'id') loop
    insert into public.tournament_updates(tournament_id,match_id,before_game) values(p_id,previous->>'id',shore_private.tournament_game(saved.published,previous,p_id));
    pubcount:=saved.published_revision+1;
  end loop;
  update public.tournaments set published=jsonb_set(candidate,'{matches}',matches),published_revision=pubcount,
    sequences=counters,updated_at=statement_timestamp() where id=p_id returning * into saved;
  return shore_private.tournament_record(saved);
end;
$$;

create function shore_private.tournament_list()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor public.users; records jsonb; transport jsonb; manager boolean;
begin
  actor:=shore_private.tournament_actor();
  if actor.role is null then raise exception 'This account has no staff invitation.' using errcode='42501'; end if;
  manager:=actor.role in ('conference_office','site_admin');
  select coalesce(jsonb_agg(case when manager then shore_private.tournament_record(t)
    else jsonb_build_object('id',t.id,'revision',t.revision,'published_revision',t.published_revision,'draft',null,'published',t.published,'issues','[]'::jsonb) end order by t.updated_at desc),'[]'::jsonb)
    into records from public.tournaments t where manager or exists(
      select 1 from jsonb_array_elements(t.published->'matches') m join jsonb_array_elements(t.published->'participants') p
      on p->>'id' in (m->>'resolved_a',m->>'resolved_b') where p->>'school_id'=actor.school_id);
  select coalesce(jsonb_agg(to_jsonb(b)),'[]'::jsonb) into transport from public.tournament_transportation b
    where actor.role='site_admin' or (actor.role='ad' and b.school_id=actor.school_id);
  return jsonb_build_object('actor_role',actor.role,'school_id',actor.school_id,'tournaments',records,
    'conflicts',case when manager then shore_private.tournament_conflicts() else '[]'::jsonb end,'transportation',transport);
end;
$$;

create function shore_private.tournament_transport(p_tournament uuid,p_match text,p_school text,p_expected_revision bigint,p_transport jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.users; t public.tournaments; row public.tournament_transportation; payload jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('shore.tournaments',0));
  actor:=shore_private.tournament_actor();
  if actor.role is null or not(actor.role='site_admin' or (actor.role='ad' and actor.school_id=p_school)) then raise exception 'This account cannot manage that school transportation.' using errcode='42501'; end if;
  select * into t from public.tournaments where id=p_tournament for share;
  if not exists(select 1 from jsonb_array_elements(t.published->'matches') m join jsonb_array_elements(t.published->'participants') p
    on p->>'id' in (m->>'resolved_a',m->>'resolved_b') where m->>'id'=p_match and p->>'school_id'=p_school) then
    raise exception 'This school is not a confirmed participant in that published match.' using errcode='42501';
  end if;
  if (nullif(p_transport->>'bus_departure','') is not null and p_transport->>'bus_departure' !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$')
    or (nullif(p_transport->>'return_time','') is not null and p_transport->>'return_time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:00)?$')
    or coalesce(char_length(p_transport->>'pickup_location'),0)>200 or coalesce(char_length(p_transport->>'notes'),0)>2000 then
    raise exception 'Check bus times and text lengths.' using errcode='22023';
  end if;
  select * into row from public.tournament_transportation where tournament_id=p_tournament and match_id=p_match and school_id=p_school for update;
  if (row.tournament_id is null and p_expected_revision is distinct from 0::bigint) or (row.tournament_id is not null and row.revision is distinct from p_expected_revision) then
    raise exception 'Transportation changed. Reload before saving.' using errcode='40001';
  end if;
  insert into public.tournament_transportation(tournament_id,match_id,school_id,bus_departure,pickup_location,return_time,notes,bus_confirmed)
    values(p_tournament,p_match,p_school,nullif(p_transport->>'bus_departure','')::time,nullif(btrim(p_transport->>'pickup_location'),''),
      nullif(p_transport->>'return_time','')::time,nullif(p_transport->>'notes',''),coalesce((p_transport->>'bus_confirmed')::boolean,false))
    on conflict(tournament_id,match_id,school_id) do update set bus_departure=excluded.bus_departure,pickup_location=excluded.pickup_location,
      return_time=excluded.return_time,notes=excluded.notes,bus_confirmed=excluded.bus_confirmed,revision=public.tournament_transportation.revision+1,updated_at=statement_timestamp()
    returning * into row;
  return to_jsonb(row);
end;
$$;

create function shore_private.tournament_potential(doc jsonb,slot jsonb)
returns text[] language plpgsql immutable set search_path='' as $$
declare source jsonb;
begin
  if slot ? 'participant_id' then return array[slot->>'participant_id']; end if;
  select value into source from jsonb_array_elements(doc->'matches') where value->>'id'=slot->>'winner_of';
  if source is null then return array[]::text[]; end if;
  if source->>'status' in ('Final','Forfeit') and source->>'winner_id' is not null then return array[source->>'winner_id']; end if;
  return shore_private.tournament_potential(doc,source->'a')||shore_private.tournament_potential(doc,source->'b');
end;
$$;

create function shore_private.tournament_game(doc jsonb,m jsonb,tournament_id uuid)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id','tournament-'||tournament_id::text||'-'||(m->>'id'),
    'tournament_id',tournament_id,'tournament_name',doc->>'name','match_id',m->>'id','match_label',m->>'label',
    'round',m->'round','game_date',m->'game_date','start_time',m->'start_time','location',m->>'venue',
    'status',m->>'status','home_side',m->>'home_side','duration_minutes',doc->'duration_minutes',
    'revision',m->'revision','updated_at',m->'updated_at',
    'a',coalesce((select jsonb_build_object('id',p->>'id','name',p->>'name','school_id',p->>'school_id')
      from jsonb_array_elements(doc->'participants') p where p->>'id'=m->>'resolved_a'),
      jsonb_build_object('id',null,'school_id',null,'name','Winner of '||coalesce((select s->>'label' from jsonb_array_elements(doc->'matches') s where s->>'id'=m->'a'->>'winner_of'),m->'a'->>'winner_of'))),
    'b',coalesce((select jsonb_build_object('id',p->>'id','name',p->>'name','school_id',p->>'school_id')
      from jsonb_array_elements(doc->'participants') p where p->>'id'=m->>'resolved_b'),
      jsonb_build_object('id',null,'school_id',null,'name','Winner of '||coalesce((select s->>'label' from jsonb_array_elements(doc->'matches') s where s->>'id'=m->'b'->>'winner_of'),m->'b'->>'winner_of'))),
    'teams',jsonb_build_object('sport',doc->>'sport','gender',doc->>'gender','level',doc->>'level','season',doc->>'season'));
$$;

create function shore_private.tournament_conflicts(excluded uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select coalesce(jsonb_agg(entry order by entry->>'id'),'[]'::jsonb) from (
    select jsonb_build_object('id',g.id,'school_ids',jsonb_build_array(g.school_id,g.opponent_school_id),
      'game_date',g.game_date,'start_time',to_char(g.start_time,'HH24:MI'),'duration_minutes',null,'venue',g.location) entry
      from public.games g where g.status<>'Canceled'
    union all
    select jsonb_build_object('id','tournament-'||t.id::text||'-'||(m->>'id'),
      'school_ids',(select coalesce(jsonb_agg(p->>'school_id'),'[]'::jsonb) from jsonb_array_elements(t.published->'participants') p
        where p->>'id' in (m->>'resolved_a',m->>'resolved_b') and p->>'school_id' is not null),
      'game_date',m->'game_date','start_time',m->'start_time','duration_minutes',t.published->'duration_minutes','venue',m->>'venue')
      from public.tournaments t cross join lateral jsonb_array_elements(t.published->'matches') m
      where (excluded is null or t.id<>excluded) and m->>'status'<>'Canceled'
  ) entries;
$$;

create function shore_private.tournament_validate(doc jsonb,check_schedule boolean default true,excluded uuid default null)
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
  if exists(select 1 from jsonb_array_elements(doc->'participants') p group by p->>'id' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(doc->'participants') p group by p->>'seed' having count(*)>1)
    or exists(select 1 from jsonb_array_elements(doc->'participants') p group by coalesce(nullif(p->>'school_id',''),lower(btrim(p->>'name'))) having count(*)>1) then
    issues:=issues||shore_private.tournament_issue(null,'Participant IDs, schools/guest names and seeds must be unique.',true);
  end if;
  if exists(select 1 from jsonb_array_elements(doc->'matches') m group by m->>'id' having count(*)>1) then
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
        if not exists(select 1 from jsonb_array_elements(doc->'participants') p where p->>'id'=slot->>'participant_id') then
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
  if exists(select 1 from jsonb_array_elements(doc->'matches') m cross join lateral (values(m->'a'),(m->'b')) slots(slot)
    group by coalesce('p:'||(slot->>'participant_id'),'w:'||(slot->>'winner_of')) having count(*)>1) then issues:=issues||shore_private.tournament_issue(null,'A participant or match winner can enter only one starting or advancement slot.',true); end if;
  if issues<>'[]'::jsonb then return issues; end if;
  prepared:=shore_private.tournament_prepare(doc);
  for m in select value from jsonb_array_elements(prepared->'matches') loop
    if (m->>'status' in ('Final','Forfeit') and (m->>'winner_id' is null or m->>'winner_id' not in (coalesce(m->>'resolved_a',''),coalesce(m->>'resolved_b',''))))
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
    begin
      if coalesce(m->>'game_date','') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(m->>'start_time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        or coalesce(char_length(btrim(m->>'venue')),0) not between 1 and 200 then raise exception 'Unscheduled'; end if;
      start_at:=((m->>'game_date')::date+(m->>'start_time')::time) at time zone 'America/New_York';
      if to_char(start_at at time zone 'America/New_York','YYYY-MM-DD HH24:MI') <> m->>'game_date'||' '||(m->>'start_time') then raise exception 'Invalid daylight-saving time'; end if;
    exception when others then issues:=issues||shore_private.tournament_issue(mid,'Enter a valid Eastern date, start time and venue before publishing.'); continue; end;
    if m->>'status'='Canceled' then continue; end if;
    end_at:=start_at+make_interval(mins=>duration);
    if jsonb_array_length(doc->'windows')>0 and not exists(select 1 from jsonb_array_elements(doc->'windows') w
      where w->>'date'=m->>'game_date' and lower(btrim(w->>'venue'))=lower(btrim(m->>'venue'))
        and (w->>'start')::time <= (m->>'start_time')::time and end_at <= (((w->>'date')::date+(w->>'end')::time) at time zone 'America/New_York')) then
      issues:=issues||shore_private.tournament_issue(mid,'The game falls outside the entered venue availability.');
    end if;
    possible:=shore_private.tournament_potential(doc,m->'a')||shore_private.tournament_potential(doc,m->'b');
    select array_agg(p->>'school_id') into schools from jsonb_array_elements(doc->'participants') p where p->>'id'=any(possible) and p->>'school_id' is not null;
    for other in select value from jsonb_array_elements(prepared->'matches') where value->>'id'<>mid and value->>'status'<>'Canceled' loop
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
      if (lower(btrim(other->>'venue'))=lower(btrim(m->>'venue')) or coalesce(schools,array[]::text[]) && array(select jsonb_array_elements_text(other->'school_ids')))
        and start_at<other_start+make_interval(mins=>coalesce((other->>'duration_minutes')::integer,duration)+greatest(rest,turnaround))
        and other_start<end_at+make_interval(mins=>greatest(rest,turnaround)) then
        issues:=issues||shore_private.tournament_issue(mid,'Conflict with an existing school or tournament game. School games use the entered duration as an estimate.');
      end if;
    end loop;
  end loop;
  return issues;
end;
$$;

create function shore_private.tournament_summary(game jsonb,school text)
returns jsonb language sql immutable set search_path='' as $$
  select case when game is null then null else jsonb_build_object(
    'game_date',game->'game_date','start_time',game->'start_time','location',game->'location','status',game->'status','teams',game->'teams',
    'opponent_school_id',case when game->'a'->>'school_id'=school then game->'b'->>'school_id' else game->'a'->>'school_id' end,
    'opponent_name',case when game->'a'->>'school_id'=school then game->'b'->>'name' else game->'a'->>'name' end,
    'home_away',case when game->>'home_side'='neutral' then 'Neutral' when (game->>'home_side'='a')=(game->'a'->>'school_id'=school) then 'Home' else 'Away' end) end;
$$;

create function public.list_tournaments()
returns jsonb language sql set search_path='' as $$ select shore_private.tournament_list(); $$;
create function public.save_tournament(p_id uuid,p_expected_revision bigint,p_document jsonb)
returns jsonb language sql set search_path='' as $$ select shore_private.tournament_save(p_id,p_expected_revision,p_document); $$;
create function public.review_tournament(p_id uuid)
returns jsonb language sql set search_path='' as $$ select shore_private.tournament_review(p_id); $$;
create function public.publish_tournament(p_id uuid,p_token text,p_match_ids text[] default null)
returns jsonb language sql set search_path='' as $$ select shore_private.tournament_publish(p_id,p_token,p_match_ids); $$;
create function public.save_tournament_transport(p_tournament uuid,p_match text,p_school text,p_expected_revision bigint,p_transport jsonb)
returns jsonb language sql set search_path='' as $$ select shore_private.tournament_transport(p_tournament,p_match,p_school,p_expected_revision,p_transport); $$;

revoke all on function public.list_tournaments(),public.save_tournament(uuid,bigint,jsonb),public.review_tournament(uuid),
  public.publish_tournament(uuid,text,text[]),public.save_tournament_transport(uuid,text,text,bigint,jsonb) from public,anon;
grant execute on function public.list_tournaments(),public.save_tournament(uuid,bigint,jsonb),public.review_tournament(uuid),
  public.publish_tournament(uuid,text,text[]),public.save_tournament_transport(uuid,text,text,bigint,jsonb) to authenticated;

-- Keep the existing school projection intact behind the same service-only public entry point.
alter function public.read_published_schedule(text) set schema shore_private;
alter function shore_private.read_published_schedule(text) rename to read_school_published_schedule;
create function public.read_published_schedule(p_school text default null)
returns jsonb language sql stable set search_path='' as $$
  select base || jsonb_build_object(
    'tournament_games',(select coalesce(jsonb_agg(shore_private.tournament_game(t.published,m,t.id)||
      jsonb_build_object('revision',(m->>'revision')::bigint+coalesce(b.revision,0),'updated_at',greatest((m->>'updated_at')::timestamptz,b.updated_at),
        'transportation',case when p_school is not null and b.tournament_id is not null then
          jsonb_build_object('bus_departure',b.bus_departure,'pickup_location',b.pickup_location,'return_time',b.return_time) else null end)
      order by t.id,m->>'id'),'[]'::jsonb)
      from public.tournaments t cross join lateral jsonb_array_elements(t.published->'matches') m
      left join public.tournament_transportation b on b.tournament_id=t.id and b.match_id=m->>'id' and b.school_id=p_school
      where p_school is null or exists(select 1 from jsonb_array_elements(t.published->'participants') p
        where p->>'id' in (m->>'resolved_a',m->>'resolved_b') and p->>'school_id'=p_school)),
    'tournaments',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'document',t.published) order by t.id),'[]'::jsonb)
      from public.tournaments t where t.published is not null and (p_school is null or exists(
        select 1 from jsonb_array_elements(t.published->'matches') m join jsonb_array_elements(t.published->'participants') p
        on p->>'id' in (m->>'resolved_a',m->>'resolved_b') where p->>'school_id'=p_school))),
    'updates',(select coalesce(jsonb_agg(entry order by entry->>'occurred_at' desc,entry->>'id' desc),'[]'::jsonb) from (
      select entry from (
        select value entry from jsonb_array_elements(base->'updates')
        union all
        select jsonb_build_object('id','tournament-'||u.id::text,'game_id',coalesce(u.after_game,u.before_game)->>'id',
          'kind',case when u.after_game is null then 'game_removed' when u.before_game is null then 'game_added'
            when u.after_game->>'status'='Canceled' then 'game_canceled' when u.after_game->>'status'='Postponed' then 'game_postponed' else 'game_changed' end,
          'occurred_at',u.occurred_at,'season',coalesce(u.after_game,u.before_game)->'teams'->>'season',
          'season_year',coalesce(t.published,t.draft)->'season_year','sport',coalesce(u.after_game,u.before_game)->'teams'->>'sport',
          'gender',coalesce(u.after_game,u.before_game)->'teams'->>'gender','level',coalesce(u.after_game,u.before_game)->'teams'->>'level',
          'before',shore_private.tournament_summary(u.before_game,p_school),'after',shore_private.tournament_summary(u.after_game,p_school))
        from public.tournament_updates u join public.tournaments t on t.id=u.tournament_id
        where p_school is not null and t.published is not null and p_school in
          (u.before_game->'a'->>'school_id',u.before_game->'b'->>'school_id',u.after_game->'a'->>'school_id',u.after_game->'b'->>'school_id')
      ) entries order by entry->>'occurred_at' desc,entry->>'id' desc limit 20
    ) recent)
  ) from (select shore_private.read_school_published_schedule(p_school) base) regular;
$$;
revoke all on function public.read_published_schedule(text) from public,anon,authenticated;
grant execute on function public.read_published_schedule(text) to service_role;
grant usage on schema shore_private to service_role;

do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='shore_private' and p.proname like 'tournament_%' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end; $$;
grant execute on function shore_private.tournament_list(),shore_private.tournament_save(uuid,bigint,jsonb),
  shore_private.tournament_review(uuid),shore_private.tournament_publish(uuid,text,text[]),
  shore_private.tournament_transport(uuid,text,text,bigint,jsonb) to authenticated;
