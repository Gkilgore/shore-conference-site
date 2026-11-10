-- Uses an explicit UTC calendar instant for the repeated Eastern hour, matching schedule checks.
create or replace function shore_private.tournament_game(doc jsonb,m jsonb,tournament_id uuid)
returns jsonb language sql immutable set search_path='' as $$
  select jsonb_build_object('id','tournament-'||tournament_id::text||'-'||(m->>'id'),
    'tournament_id',tournament_id,'tournament_name',doc->>'name','match_id',m->>'id','match_label',m->>'label',
    'round',m->'round','season_year',doc->'season_year','game_date',m->'game_date','start_time',m->'start_time','location',m->>'venue',
    'ics_start_utc',case when to_char((starts_at-interval '1 hour') at time zone 'America/New_York','YYYY-MM-DD HH24:MI')
      =m->>'game_date'||' '||(m->>'start_time') then to_char(starts_at at time zone 'UTC','YYYYMMDD"T"HH24MISS"Z"') end,
    'status',m->>'status','home_side',m->>'home_side','duration_minutes',doc->'duration_minutes',
    'revision',m->'revision','updated_at',m->'updated_at',
    'a',coalesce((select jsonb_build_object('id',p->>'id','name',p->>'name','school_id',p->>'school_id')
      from jsonb_array_elements(doc->'participants') p where p->>'id'=m->>'resolved_a'),
      jsonb_build_object('id',null,'school_id',null,'name','Winner of '||coalesce((select s->>'label' from jsonb_array_elements(doc->'matches') s where s->>'id'=m->'a'->>'winner_of'),m->'a'->>'winner_of'))),
    'b',coalesce((select jsonb_build_object('id',p->>'id','name',p->>'name','school_id',p->>'school_id')
      from jsonb_array_elements(doc->'participants') p where p->>'id'=m->>'resolved_b'),
      jsonb_build_object('id',null,'school_id',null,'name','Winner of '||coalesce((select s->>'label' from jsonb_array_elements(doc->'matches') s where s->>'id'=m->'b'->>'winner_of'),m->'b'->>'winner_of'))),
    'teams',jsonb_build_object('sport',doc->>'sport','gender',doc->>'gender','level',doc->>'level','season',doc->>'season'))
  from (select ((m->>'game_date')::date+(m->>'start_time')::time) at time zone 'America/New_York' starts_at) timing;
$$;
