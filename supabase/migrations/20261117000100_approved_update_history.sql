-- Freezes approved team labels and publication epochs so draft labels and withdrawn history cannot leak.
alter table public.team_publications add column approved_team jsonb, add column publication_epoch uuid not null default gen_random_uuid();
alter table public.publication_updates add column publication_epoch uuid;

update public.team_publications p set approved_team=coalesce(
  (select g.payload->'teams' from public.published_games g where g.school_id=p.school_id
    and g.team_id=p.team_id and g.season_year=p.season_year order by g.updated_at desc,g.id limit 1),
  (select jsonb_build_object('sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season) from public.teams t where t.id=p.team_id));
alter table public.team_publications alter column approved_team set not null;
alter table public.team_publications add constraint approved_team_fields check(jsonb_typeof(approved_team)='object'
  and approved_team ?& array['sport','gender','level','season']);

-- Assign existing visible history to the current posting only after its last withdrawal.
update public.publication_updates u set publication_epoch=p.publication_epoch
from public.team_publications p where p.school_id=u.school_id and p.team_id=u.team_id and p.season_year=u.season_year
and u.id>coalesce((select max(w.id) from public.publication_updates w where w.school_id=u.school_id
  and w.team_id=u.team_id and w.season_year=u.season_year and w.kind='team_unpublished'),0);

create function shore_private.approve_publication_team()
returns trigger language plpgsql set search_path = '' as $$
begin
  select jsonb_build_object('sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season)
  into new.approved_team from public.teams t where t.id=new.team_id;
  if tg_op='UPDATE' then new.publication_epoch:=old.publication_epoch; end if;
  return new;
end;
$$;
revoke all on function shore_private.approve_publication_team() from public,anon,authenticated;
create trigger approve_team_publication before insert or update on public.team_publications
for each row execute function shore_private.approve_publication_team();
create or replace function public.review_schedule_publication(p_school text)
returns jsonb language plpgsql stable set search_path = '' as $$
declare result jsonb;
begin
  if not shore_private.can_publish_school(p_school) then
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
    'token',md5(jsonb_build_object('games',coalesce(g.games,'[]'::jsonb),'published_at',p.published_at,
      'team',jsonb_build_object('sport',t.sport,'gender',t.gender,'level',t.level,'season',t.season))::text)
  ) order by k.season_year desc,t.season,t.sport,t.gender,t.level),'[]'::jsonb) into result
  from keys k join public.teams t on t.id=k.team_id
  left join grouped g on g.team_id=k.team_id and g.season_year=k.season_year
  left join public.team_publications p on p.school_id=p_school and p.team_id=k.team_id and p.season_year=k.season_year;
  return result;
end;
$$;
revoke all on function public.review_schedule_publication(text) from public, anon;
grant execute on function public.review_schedule_publication(text) to authenticated;


create or replace function shore_private.log_published_game_update()
returns trigger language plpgsql set search_path = '' as $$
declare saved public.published_games; old_value jsonb; new_value jsonb; kind text; epoch uuid;
begin
  if tg_op='DELETE' then saved:=old; else saved:=new; end if;
  -- First publication gets one team notice rather than dozens of individual initial-game notices.
  if not exists(select 1 from public.team_publications p where p.school_id=saved.school_id
    and p.team_id=saved.team_id and p.season_year=saved.season_year) then return null; end if;
  select p.publication_epoch into epoch from public.team_publications p where p.school_id=saved.school_id and p.team_id=saved.team_id and p.season_year=saved.season_year;
  if tg_op<>'INSERT' then old_value:=shore_private.public_update_game(old.payload); end if;
  if tg_op<>'DELETE' then new_value:=shore_private.public_update_game(new.payload); end if;
  if tg_op='UPDATE' and old.payload is not distinct from new.payload then return null; end if;
  kind:=case when tg_op='DELETE' then 'game_removed' when tg_op='INSERT' then 'game_added'
    when new.payload->>'status'='Canceled' and old.payload->>'status' is distinct from 'Canceled' then 'game_canceled'
    when new.payload->>'status'='Postponed' and old.payload->>'status' is distinct from 'Postponed' then 'game_postponed'
    else 'game_changed' end;
  insert into public.publication_updates(school_id,team_id,season,season_year,sport,gender,level,game_id,kind,before_game,after_game,publication_epoch)
  values(saved.school_id,saved.team_id,saved.payload->'teams'->>'season',saved.season_year,
    saved.payload->'teams'->>'sport',saved.payload->'teams'->>'gender',saved.payload->'teams'->>'level',saved.id,kind,old_value,new_value,epoch);
  return null;
end;
$$;
revoke all on function shore_private.log_published_game_update() from public,anon,authenticated;

create or replace function shore_private.log_team_publication()
returns trigger language plpgsql set search_path = '' as $$
declare saved public.team_publications;
begin
  if tg_op='DELETE' then saved:=old; else saved:=new; end if;
  insert into public.publication_updates(school_id,team_id,season,season_year,sport,gender,level,kind,publication_epoch)
  values(saved.school_id,saved.team_id,saved.approved_team->>'season',saved.season_year,
    saved.approved_team->>'sport',saved.approved_team->>'gender',saved.approved_team->>'level',
    case when tg_op='DELETE' then 'team_unpublished' else 'team_posted' end,saved.publication_epoch);
  return null;
end;
$$;
revoke all on function shore_private.log_team_publication() from public,anon,authenticated;
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
      from (select p.approved_team->>'season' as season,p.season_year,min(p.published_at) as published_at,
        jsonb_agg(jsonb_build_object('team_id',p.team_id,'sport',p.approved_team->>'sport','gender',p.approved_team->>'gender','level',p.approved_team->>'level',
          'published_at',p.published_at) order by p.approved_team->>'sport',p.approved_team->>'gender',p.approved_team->>'level') as teams
        from public.team_publications p
        where p.school_id=p_school group by p.approved_team->>'season',p.season_year) x),
    'updates',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'kind',x.kind,'season',x.season,
      'season_year',x.season_year,'sport',x.sport,'gender',x.gender,'level',x.level,'occurred_at',x.occurred_at,
      'game_id',x.game_id,'before',x.before_game,'after',x.after_game) order by x.occurred_at desc,x.id desc),'[]'::jsonb)
      from (select u.* from public.publication_updates u where u.school_id=p_school and
        (u.kind='team_unpublished' or exists(select 1 from public.team_publications p
          where p.school_id=u.school_id and p.team_id=u.team_id and p.season_year=u.season_year and p.publication_epoch=u.publication_epoch))
        order by u.occurred_at desc,u.id desc limit 20) x)
  );
$$;
revoke all on function public.read_published_schedule(text) from public,anon,authenticated;
grant execute on function public.read_published_schedule(text) to service_role;
