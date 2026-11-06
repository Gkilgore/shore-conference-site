-- Allows an unrelated single-game update while another game has a pending move between teams.
create or replace function shore_private.publish_schedule_changes(p_school text, selections jsonb, withdraw boolean default false)
returns integer language plpgsql security definer set search_path = '' as $$
declare reviews jsonb; chosen jsonb; review jsonb; entry jsonb; draft jsonb; work jsonb := '[]'; part jsonb;
  current_row public.published_games; target uuid; changed_count integer := 0; previous jsonb;
begin
  if not shore_private.can_publish_school(p_school) then
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
  select coalesce(jsonb_object_agg(id::text,to_jsonb(p)),'{}'::jsonb) into previous
  from public.published_games p where school_id=p_school;
  if not withdraw and exists (
    select 1 from public.published_games p join public.games g on g.id=p.id
    join public.teams t on t.id=g.team_id
    where p.school_id=p_school and (p.team_id<>g.team_id or p.season_year<>shore_private.schedule_year(g.game_date,t.season))
      and exists(select 1 from jsonb_array_elements(selections) s where
        ((s->>'team_id'=p.team_id::text and s->>'season_year'=p.season_year::text)
        or (s->>'team_id'=g.team_id::text and (s->>'season_year')::integer=shore_private.schedule_year(g.game_date,t.season)))
        and (not (s ? 'game_ids') or (s->'game_ids') ? p.id::text))
      and (not exists(select 1 from jsonb_array_elements(selections) s
          where s->>'team_id'=p.team_id::text and s->>'season_year'=p.season_year::text and not s ? 'game_ids')
        or not exists(select 1 from jsonb_array_elements(selections) s
          where s->>'team_id'=g.team_id::text and (s->>'season_year')::integer=shore_private.schedule_year(g.game_date,t.season)
            and not s ? 'game_ids'))
  ) then
    raise exception 'This game moved teams or seasons. Review and publish both affected schedules together.' using errcode='22023';
  end if;
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
      -- Retain the approved copy privately so republishing keeps a monotonic calendar revision.
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
        greatest(coalesce((previous->target::text->>'revision')::integer,0)+1,(entry->>'draft_revision')::integer))
      on conflict(id) do update set payload=excluded.payload,revision=greatest(public.published_games.revision+1,excluded.revision),
        updated_at=statement_timestamp()
      where public.published_games.payload is distinct from excluded.payload or review->>'published_at' is null;
      changed_count := changed_count + 1;
    end loop;
    insert into public.team_publications(school_id,team_id,season_year) values
      (p_school,(chosen->>'team_id')::uuid,(chosen->>'season_year')::integer)
    on conflict(school_id,team_id,season_year) do update set published_at=statement_timestamp();
  end loop;
  return changed_count;
end;
$$;
revoke all on function shore_private.publish_schedule_changes(text,jsonb,boolean) from public, anon;
grant execute on function shore_private.publish_schedule_changes(text,jsonb,boolean) to authenticated;
