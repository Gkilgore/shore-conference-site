-- DRAFT: not applied and not tested against a database. Greg runs it in the test project first,
-- after 20261127000100_post_on_save.sql.
-- The old conference site will go away, so its rules PDFs are now saved on this site in assets/documents/.
-- This lets a tournament's rules link point at one of those saved files as well as an https link.
-- Only the rules_url check changes; everything else matches 20261126000100_tournament_info.sql.

create or replace function shore_private.tournament_info(info jsonb)
returns jsonb language sql immutable set search_path='' as $$
  with clean as (
    select
      case when btrim(coalesce(info->>'rules_url','')) ~ '^(https://\S+|assets/documents/[A-Za-z0-9_.-]+\.pdf)$' then left(btrim(info->>'rules_url'),500) else '' end as rules_url,
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
