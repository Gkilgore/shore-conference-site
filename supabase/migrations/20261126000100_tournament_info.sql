-- DRAFT: not applied and not tested against a database. Greg runs it in the test project first.
-- Lets a tournament keep its "Rules and dates" section: the official regulations link, the
-- director, and key dates such as a qualification cutoff. The section rides inside the tournament
-- document, so the existing rules apply unchanged: only conference and site admins can save it,
-- it stays in the private draft until a reviewed publication, and a change to it needs a full publication.
-- Key dates are never matches, so they cannot reach read_published_schedule's games or any feed.

-- Returns the cleaned section, or null when it holds nothing. Anything unexpected is dropped:
-- a link that is not https, a malformed date, a date row with no name, rows past the twentieth.
create function shore_private.tournament_info(info jsonb)
returns jsonb language sql immutable set search_path='' as $$
  with clean as (
    select
      case when btrim(coalesce(info->>'rules_url','')) ~ '^https://\S+$' then left(btrim(info->>'rules_url'),500) else '' end as rules_url,
      left(btrim(coalesce(info->>'director','')),120) as director,
      coalesce(info->'director_confirmed'='true'::jsonb,false) as director_confirmed,
      case when coalesce(info->>'reviewed_on','') ~ '^\d{4}-\d{2}-\d{2}$' then info->>'reviewed_on' else '' end as reviewed_on,
      (select coalesce(jsonb_agg(jsonb_build_object(
          'label',left(btrim(d.value->>'label'),80),
          'date',case when coalesce(d.value->>'date','') ~ '^\d{4}-\d{2}-\d{2}$' then d.value->>'date' else '' end,
          'confirmed',coalesce(d.value->'confirmed'='true'::jsonb,false) and coalesce(d.value->>'date','') ~ '^\d{4}-\d{2}-\d{2}$',
          'note',left(btrim(coalesce(d.value->>'note','')),200)) order by d.ordinality),'[]'::jsonb)
        from jsonb_array_elements(case when jsonb_typeof(info->'dates')='array' then info->'dates' else '[]'::jsonb end)
          with ordinality d
        where d.ordinality<=20 and btrim(coalesce(d.value->>'label',''))<>'') as dates
  )
  select case when rules_url='' and director='' and reviewed_on='' and dates='[]'::jsonb then null
    else jsonb_build_object('rules_url',rules_url,'director',director,
      'director_confirmed',director_confirmed and director<>'','reviewed_on',reviewed_on,'dates',dates) end
  from clean;
$$;

-- Keep the existing cleaner as it is and add the section on top of it. A tournament without the
-- section cleans to exactly what it did before, so nothing already saved shows as changed.
alter function shore_private.tournament_clean(jsonb) rename to tournament_clean_core;

create function shore_private.tournament_clean(doc jsonb)
returns jsonb language sql immutable set search_path='' as $$
  select shore_private.tournament_clean_core(doc) ||
    case when shore_private.tournament_info(doc->'info') is null then '{}'::jsonb
      else jsonb_build_object('info',shore_private.tournament_info(doc->'info')) end;
$$;

revoke all on function shore_private.tournament_info(jsonb),shore_private.tournament_clean(jsonb),
  shore_private.tournament_clean_core(jsonb) from public,anon,authenticated;
grant execute on function shore_private.tournament_info(jsonb),shore_private.tournament_clean(jsonb),
  shore_private.tournament_clean_core(jsonb) to service_role;
