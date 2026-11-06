-- Records only approved changes and exposes season/year postings plus a safe school-specific update history.
create table public.publication_updates (
  id bigint generated always as identity primary key,
  school_id text not null references public.schools(slug),
  team_id uuid not null references public.teams(id),
  season text not null,
  season_year integer not null,
  sport text not null,
  gender text not null,
  level text not null,
  game_id uuid,
  kind text not null check(kind in ('team_posted','team_unpublished','game_added','game_changed','game_removed','game_canceled','game_postponed')),
  occurred_at timestamptz not null default statement_timestamp(),
  before_game jsonb,
  after_game jsonb
);
create index publication_updates_school_recent on public.publication_updates(school_id,occurred_at desc,id desc);
alter table public.publication_updates enable row level security;
revoke all on public.publication_updates from public,anon,authenticated;

create function shore_private.public_update_game(payload jsonb)
returns jsonb language sql immutable strict set search_path = '' as $$
  select jsonb_build_object('game_date',payload->'game_date','start_time',payload->'start_time',
    'location',payload->'location','status',payload->'status','home_away',payload->'home_away',
    'opponent_school_id',payload->'opponent_school_id','opponent_name',payload->'opponent_name',
    'teams',payload->'teams','transportation',payload->'transportation');
$$;
revoke all on function shore_private.public_update_game(jsonb) from public,anon,authenticated;

create function shore_private.log_published_game_update()
returns trigger language plpgsql set search_path = '' as $$
declare saved public.published_games; old_value jsonb; new_value jsonb; kind text;
begin
  if tg_op='DELETE' then saved:=old; else saved:=new; end if;
  -- First publication gets one team notice rather than dozens of individual initial-game notices.
  if not exists(select 1 from public.team_publications p where p.school_id=saved.school_id
    and p.team_id=saved.team_id and p.season_year=saved.season_year) then return null; end if;
  if tg_op<>'INSERT' then old_value:=shore_private.public_update_game(old.payload); end if;
  if tg_op<>'DELETE' then new_value:=shore_private.public_update_game(new.payload); end if;
  if tg_op='UPDATE' and old_value is not distinct from new_value then return null; end if;
  kind:=case when tg_op='DELETE' then 'game_removed' when tg_op='INSERT' then 'game_added'
    when new.payload->>'status'='Canceled' and old.payload->>'status' is distinct from 'Canceled' then 'game_canceled'
    when new.payload->>'status'='Postponed' and old.payload->>'status' is distinct from 'Postponed' then 'game_postponed'
    else 'game_changed' end;
  insert into public.publication_updates(school_id,team_id,season,season_year,sport,gender,level,game_id,kind,before_game,after_game)
  values(saved.school_id,saved.team_id,saved.payload->'teams'->>'season',saved.season_year,
    saved.payload->'teams'->>'sport',saved.payload->'teams'->>'gender',saved.payload->'teams'->>'level',saved.id,kind,old_value,new_value);
  return null;
end;
$$;
revoke all on function shore_private.log_published_game_update() from public,anon,authenticated;
create trigger published_game_history after insert or update or delete on public.published_games
for each row execute function shore_private.log_published_game_update();

create function shore_private.log_team_publication()
returns trigger language plpgsql set search_path = '' as $$
declare saved public.team_publications; team public.teams;
begin
  if tg_op='DELETE' then saved:=old; else saved:=new; end if;
  select * into team from public.teams where id=saved.team_id;
  insert into public.publication_updates(school_id,team_id,season,season_year,sport,gender,level,kind)
  values(saved.school_id,saved.team_id,team.season,saved.season_year,team.sport,team.gender,team.level,
    case when tg_op='DELETE' then 'team_unpublished' else 'team_posted' end);
  return null;
end;
$$;
revoke all on function shore_private.log_team_publication() from public,anon,authenticated;
create trigger team_publication_history after insert or delete on public.team_publications
for each row execute function shore_private.log_team_publication();

create or replace function public.read_published_schedule(p_school text default null)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'schools',(select coalesce(jsonb_agg(jsonb_build_object('slug',s.slug,'name',s.name,
      'is_conference_member',s.is_conference_member,'schedule_published',
      exists(select 1 from public.team_publications p where p.school_id=s.slug)) order by s.slug),'[]'::jsonb)
      from public.schools s),
    'games',(select coalesce(jsonb_agg(g.payload || jsonb_build_object('revision',g.revision,'updated_at',g.updated_at)
      order by g.id),'[]'::jsonb)
      from public.published_games g join public.team_publications p
        on p.school_id=g.school_id and p.team_id=g.team_id and p.season_year=g.season_year
      where p_school is null or g.school_id=p_school),
    'seasons',(select coalesce(jsonb_agg(jsonb_build_object('season',x.season,'season_year',x.season_year,
      'published_at',x.published_at,'teams',x.teams) order by x.season_year desc,x.season),'[]'::jsonb)
      from (select t.season,p.season_year,min(p.published_at) as published_at,
        jsonb_agg(jsonb_build_object('team_id',t.id,'sport',t.sport,'gender',t.gender,'level',t.level,
          'published_at',p.published_at) order by t.sport,t.gender,t.level) as teams
        from public.team_publications p join public.teams t on t.id=p.team_id
        where p.school_id=p_school group by t.season,p.season_year) x),
    'updates',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'season',x.season,
      'season_year',x.season_year,'sport',x.sport,'gender',x.gender,'level',x.level,'occurred_at',x.occurred_at,
      'game_id',x.game_id,'before',x.before_game,'after',x.after_game) order by x.occurred_at desc,x.id desc),'[]'::jsonb)
      from (select u.* from public.publication_updates u where u.school_id=p_school and
        (u.kind='team_unpublished' or exists(select 1 from public.team_publications p
          where p.school_id=u.school_id and p.team_id=u.team_id and p.season_year=u.season_year))
        order by u.occurred_at desc,u.id desc limit 20) x)
  );
$$;
revoke all on function public.read_published_schedule(text) from public,anon,authenticated;
grant execute on function public.read_published_schedule(text) to service_role;
