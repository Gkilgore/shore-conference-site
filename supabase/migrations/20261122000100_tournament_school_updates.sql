-- Keeps tournament update history aligned with each school's confirmed participation.
create or replace function shore_private.tournament_summary(game jsonb,school text)
returns jsonb language sql immutable set search_path='' as $$
  select case when game is null or not coalesce(school in (game->'a'->>'school_id',game->'b'->>'school_id'),false) then null else jsonb_build_object(
    'game_date',game->'game_date','start_time',game->'start_time','location',game->'location','status',game->'status','teams',game->'teams',
    'opponent_school_id',case when game->'a'->>'school_id'=school then game->'b'->>'school_id' else game->'a'->>'school_id' end,
    'opponent_name',case when game->'a'->>'school_id'=school then game->'b'->>'name' else game->'a'->>'name' end,
    'home_away',case when game->>'home_side'='neutral' then 'Neutral' when (game->>'home_side'='a')=(game->'a'->>'school_id'=school) then 'Home' else 'Away' end) end;
$$;

create or replace function public.read_published_schedule(p_school text default null)
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
          'kind',case when not coalesce(p_school in (u.after_game->'a'->>'school_id',u.after_game->'b'->>'school_id'),false) then 'game_removed'
            when not coalesce(p_school in (u.before_game->'a'->>'school_id',u.before_game->'b'->>'school_id'),false) then 'game_added'
            when u.after_game->>'status'='Canceled' then 'game_canceled' when u.after_game->>'status'='Postponed' then 'game_postponed' else 'game_changed' end,
          'occurred_at',u.occurred_at,'season',coalesce(u.after_game,u.before_game)->'teams'->>'season',
          'season_year',coalesce(u.after_game,u.before_game)->'season_year','sport',coalesce(u.after_game,u.before_game)->'teams'->>'sport',
          'gender',coalesce(u.after_game,u.before_game)->'teams'->>'gender','level',coalesce(u.after_game,u.before_game)->'teams'->>'level',
          'before',shore_private.tournament_summary(u.before_game,p_school),'after',shore_private.tournament_summary(u.after_game,p_school))
        from public.tournament_updates u join public.tournaments t on t.id=u.tournament_id
        where p_school is not null and t.published is not null and p_school in
          (u.before_game->'a'->>'school_id',u.before_game->'b'->>'school_id',u.after_game->'a'->>'school_id',u.after_game->'b'->>'school_id')
      ) entries order by entry->>'occurred_at' desc,entry->>'id' desc limit 20
    ) recent)
  ) from (select shore_private.read_school_published_schedule(p_school) base) regular;
$$;
