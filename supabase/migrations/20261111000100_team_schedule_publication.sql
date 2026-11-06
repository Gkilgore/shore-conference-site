-- Separates working schedules from reviewed public copies, with team/season publication and ownership rules.
create table public.team_publications (
  id uuid primary key default gen_random_uuid(),
  school_id text not null references public.schools(slug),
  team_id uuid not null,
  season_year integer not null check (season_year between 2000 and 2200),
  published_at timestamptz not null default statement_timestamp(),
  foreign key (school_id, team_id) references public.teams(school_id, id),
  unique (school_id, team_id, season_year)
);

create table public.published_games (
  id uuid primary key,
  school_id text not null references public.schools(slug),
  team_id uuid not null,
  season_year integer not null check (season_year between 2000 and 2200),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default statement_timestamp(),
  foreign key (school_id, team_id) references public.teams(school_id, id),
  check (payload ?& array['id','school_id','team_id'] and payload->>'id' = id::text
    and payload->>'school_id' = school_id and payload->>'team_id' = team_id::text)
);
create index published_games_school_team_year on public.published_games(school_id, team_id, season_year);

alter table public.team_publications enable row level security;
alter table public.published_games enable row level security;
revoke all on public.team_publications, public.published_games from public, anon, authenticated;
grant select, insert, update, delete on public.team_publications, public.published_games to authenticated;
create policy publication_read on public.team_publications for select to authenticated
  using (shore_private.can_manage_schedule(school_id, true));
create policy publication_write on public.team_publications for all to authenticated
  using (shore_private.can_manage_schedule(school_id)) with check (shore_private.can_manage_schedule(school_id));
create policy published_games_read on public.published_games for select to authenticated
  using (shore_private.can_manage_schedule(school_id, true));
create policy published_games_write on public.published_games for all to authenticated
  using (shore_private.can_manage_schedule(school_id)) with check (shore_private.can_manage_schedule(school_id));

create function shore_private.schedule_year(game_date date, season text)
returns integer language sql immutable set search_path = '' as $$
  select extract(year from game_date)::integer -
    case when season = 'Winter' and extract(month from game_date) < 7 then 1 else 0 end;
$$;
revoke all on function shore_private.schedule_year(date,text) from public, anon;
grant execute on function shore_private.schedule_year(date,text) to authenticated;

create function shore_private.public_game_payload(g public.games)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id',g.id,'school_id',g.school_id,'team_id',g.team_id,
    'game_date',g.game_date,'start_time',g.start_time,'home_away',g.home_away,
    'opponent_school_id',g.opponent_school_id,'opponent_name',g.opponent_name,
    'location',g.location,'status',g.status,'notes',g.notes,
    'teams',jsonb_build_object('sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season),
    'transportation',jsonb_build_object('bus_departure',tr.bus_departure,'pickup_location',tr.pickup_location,'return_time',tr.return_time))
  from public.teams t left join public.transportation tr on tr.game_id=g.id where t.id=g.team_id;
$$;
revoke all on function shore_private.public_game_payload(public.games) from public, anon;
grant execute on function shore_private.public_game_payload(public.games) to authenticated;

create function public.review_schedule_publication(p_school text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  if not shore_private.can_manage_schedule(p_school) then
    raise exception 'This account cannot publish that school.' using errcode='42501';
  end if;
  with drafts as (
    select g.id,g.team_id,shore_private.schedule_year(g.game_date,t.season) as season_year,
      shore_private.public_game_payload(g) as payload,g.revision
    from public.games g join public.teams t on t.id=g.team_id where g.school_id=p_school
  ), posted as (
    select * from public.published_games where school_id=p_school
  ), entries as (
    select coalesce(d.team_id,p.team_id) as team_id,coalesce(d.season_year,p.season_year) as season_year,
      coalesce(d.id,p.id) as game_id,
      jsonb_build_object('id',coalesce(d.id,p.id),'draft',d.payload,'published',p.payload,
        'draft_revision',d.revision,'published_revision',p.revision,
        'changed',d.payload is distinct from p.payload) as game
    from drafts d full join posted p on d.id=p.id and d.team_id=p.team_id and d.season_year=p.season_year
  ), grouped as (
    select team_id,season_year,jsonb_agg(game order by game_id) as games,
      count(*) filter (where (game->>'changed')::boolean)::integer as pending_count
    from entries group by team_id,season_year
  ), keys as (
    select team_id,season_year from grouped union
    select team_id,season_year from public.team_publications where school_id=p_school
  )
  select coalesce(jsonb_agg(jsonb_build_object('team_id',k.team_id,'season_year',k.season_year,
    'sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season,'published_at',p.published_at,
    'games',coalesce(g.games,'[]'::jsonb),'pending_count',coalesce(g.pending_count,0),
    'status',case when p.id is null then 'Not published' when coalesce(g.pending_count,0)>0 then 'Unpublished changes' else 'Published' end,
    'token',md5(jsonb_build_object('games',coalesce(g.games,'[]'::jsonb),'published_at',p.published_at)::text)
  ) order by k.season_year desc,t.season,t.sport,t.gender,t.level),'[]'::jsonb) into result
  from keys k join public.teams t on t.id=k.team_id
  left join grouped g on g.team_id=k.team_id and g.season_year=k.season_year
  left join public.team_publications p on p.school_id=p_school and p.team_id=k.team_id and p.season_year=k.season_year;
  return result;
end;
$$;
revoke all on function public.review_schedule_publication(text) from public, anon;
grant execute on function public.review_schedule_publication(text) to authenticated;

create function public.publish_schedule_changes(p_school text, selections jsonb, withdraw boolean default false)
returns integer language plpgsql set search_path = '' as $$
declare reviews jsonb; chosen jsonb; review jsonb; entry jsonb; draft jsonb; work jsonb := '[]'; part jsonb;
  current_row public.published_games; target uuid; changed_count integer := 0;
begin
  if not shore_private.can_manage_schedule(p_school) then
    raise exception 'This account cannot publish that school.' using errcode='42501';
  end if;
  if jsonb_typeof(selections) is distinct from 'array' or jsonb_array_length(selections) not between 1 and 100 then
    raise exception 'Select between 1 and 100 team schedules.' using errcode='22023';
  end if;
  if (select count(*) from jsonb_array_elements(selections)) <>
     (select count(distinct (x->>'team_id',x->>'season_year')) from jsonb_array_elements(selections) x) then
    raise exception 'A team schedule was selected twice.' using errcode='22023';
  end if;
  -- Short locks prevent a save/import or another publication from changing a reviewed group mid-publish.
  lock table public.teams, public.games, public.transportation in share mode;
  lock table public.team_publications, public.published_games in share row exclusive mode;
  reviews := public.review_schedule_publication(p_school);
  for chosen in select value from jsonb_array_elements(selections) loop
    select value into review from jsonb_array_elements(reviews)
    where value->>'team_id'=chosen->>'team_id' and value->>'season_year'=chosen->>'season_year';
    if review is null or review->>'token' is distinct from chosen->>'token' then
      raise exception 'The schedule changed after review. Review it again before publishing.' using errcode='40001';
    end if;
    if chosen ? 'game_ids' then
      if withdraw or review->>'published_at' is null or jsonb_typeof(chosen->'game_ids') <> 'array'
         or jsonb_array_length(chosen->'game_ids') <> 1 then
        raise exception 'Publish the whole team schedule before publishing individual updates.' using errcode='22023';
      end if;
      if not exists (select 1 from jsonb_array_elements(review->'games') e
        where e->>'id'=chosen->'game_ids'->>0) then
        raise exception 'That game is not in the reviewed team schedule.' using errcode='22023';
      end if;
      if exists (select 1 from public.games g join public.teams t on t.id=g.team_id
        where g.id=(chosen->'game_ids'->>0)::uuid and (g.team_id<>(chosen->>'team_id')::uuid
          or shore_private.schedule_year(g.game_date,t.season)<>(chosen->>'season_year')::integer)) then
        raise exception 'This game moved teams or seasons. Review the affected team schedules.' using errcode='22023';
      end if;
    end if;
    work := work || jsonb_build_array(jsonb_build_object('selection',chosen,'review',review));
  end loop;
  -- Delete withdrawn/removed copies first so a move between two selected teams can be published atomically.
  for part in select value from jsonb_array_elements(work) loop
    chosen := part->'selection'; review := part->'review';
    if withdraw then
      delete from public.published_games where school_id=p_school and team_id=(chosen->>'team_id')::uuid
        and season_year=(chosen->>'season_year')::integer;
      delete from public.team_publications where school_id=p_school and team_id=(chosen->>'team_id')::uuid
        and season_year=(chosen->>'season_year')::integer;
    else
      for entry in select value from jsonb_array_elements(review->'games') loop
        if chosen ? 'game_ids' and entry->>'id' <> chosen->'game_ids'->>0 then continue; end if;
        if entry->'draft' = 'null'::jsonb then
          delete from public.published_games where school_id=p_school and id=(entry->>'id')::uuid;
        end if;
      end loop;
    end if;
  end loop;
  if withdraw then return jsonb_array_length(work); end if;
  for part in select value from jsonb_array_elements(work) loop
    chosen := part->'selection'; review := part->'review';
    for entry in select value from jsonb_array_elements(review->'games') loop
      if chosen ? 'game_ids' and entry->>'id' <> chosen->'game_ids'->>0 then continue; end if;
      draft := entry->'draft';
      if draft = 'null'::jsonb then continue; end if;
      target := (entry->>'id')::uuid;
      select * into current_row from public.published_games where id=target;
      if current_row.id is not null and (current_row.team_id <> (chosen->>'team_id')::uuid or
          current_row.season_year <> (chosen->>'season_year')::integer) then
        raise exception 'This game moved teams or seasons. Review and publish both affected schedules together.' using errcode='22023';
      end if;
      insert into public.published_games(id,school_id,team_id,season_year,payload,revision)
      values(target,p_school,(chosen->>'team_id')::uuid,(chosen->>'season_year')::integer,draft,
        greatest(coalesce((entry->>'published_revision')::integer,0)+1,(entry->>'draft_revision')::integer))
      on conflict(id) do update set payload=excluded.payload,revision=greatest(public.published_games.revision+1,excluded.revision),
        updated_at=statement_timestamp()
      where public.published_games.payload is distinct from excluded.payload;
      changed_count := changed_count + 1;
    end loop;
    insert into public.team_publications(school_id,team_id,season_year) values
      (p_school,(chosen->>'team_id')::uuid,(chosen->>'season_year')::integer)
    on conflict(school_id,team_id,season_year) do update set published_at=statement_timestamp();
  end loop;
  return changed_count;
end;
$$;
revoke all on function public.publish_schedule_changes(text,jsonb,boolean) from public, anon;
grant execute on function public.publish_schedule_changes(text,jsonb,boolean) to authenticated;

-- Keep previously opted-in schedules visible, without publishing any private school drafts.
insert into public.team_publications(school_id,team_id,season_year)
select distinct g.school_id,g.team_id,shore_private.schedule_year(g.game_date,t.season)
from public.games g join public.teams t on t.id=g.team_id join public.schools s on s.slug=g.school_id
where s.schedule_published;
insert into public.published_games(id,school_id,team_id,season_year,payload,revision,updated_at)
select g.id,g.school_id,g.team_id,shore_private.schedule_year(g.game_date,t.season),
  shore_private.public_game_payload(g),g.revision,g.updated_at
from public.games g join public.teams t on t.id=g.team_id join public.schools s on s.slug=g.school_id
where s.schedule_published;

-- Old cached pages cannot turn draft auto-publication back on.
revoke update(schedule_published) on public.schools from authenticated;
