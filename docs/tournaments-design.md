# Conference tournaments

The approved tournament scope uses conference-owned draft documents, checked publication snapshots and school-owned transportation. A director imports a CSV or generates a seeded single-elimination bracket, schedules the matches, reviews changes and publishes. Public calendars consume one authoritative published match. Participants have tournament-local IDs and optional school/team links, allowing schools with incomplete AD setup and guest teams.

## Shared document contract

```json
{
  "name":"Spring Cup","sport":"Softball","gender":"Girls","level":"Varsity","season":"Spring","season_year":2027,
  "duration_minutes":90,"turnaround_minutes":15,"rest_minutes":60,
  "windows":[{"date":"2027-04-10","start":"09:00","end":"18:00","venue":"Main field"}],
  "participants":[{"id":"p1","name":"Marlboro","school_id":"marlboro","team_id":null,"seed":1},
    {"id":"p2","name":"Colts Neck","school_id":"colts-neck","team_id":null,"seed":2}],
  "matches":[{"id":"r1m1","round":1,"label":"Final",
    "a":{"participant_id":"p1"},"b":{"participant_id":"p2"},
    "game_date":null,"start_time":null,"venue":"","home_side":"neutral",
    "status":"Scheduled","winner_id":null,"score_a":null,"score_b":null}]
}
```

The example lists the document fields. A complete bracket needs valid starting slots and references. Each slot contains exactly one participant_id or winner_of. IDs use letters, numbers, underscores and hyphens, up to 60 characters. Match references must point to an earlier round. Seeds are unique positive integers. A participant enters one starting slot and a match advances into at most one later slot. Generator supports 2–128 participants and produces N−1 actual matches, with byes represented by direct advancement. Imports may describe a partial tournament tree. home_side is a, b or neutral. Status is Scheduled, Postponed, Canceled, Final or Forfeit. Completed matches require both opponents to be confirmed and an actual participant winner. All schedule times are Eastern local HH:mm. Metadata applies to the tournament; individual durations use duration_minutes.

## Browser engine API

`js/tournament-engine.js` defines global `TournamentEngine` with pure functions. It loads after `js/staff-import.js` to reuse the existing CSV parser where practical and before the controller.

- `participantsFromText(text, schools)` returns `{participants, errors}` using school objects with slug/name. Text supports one school/guest per line and an optional numeric seed prefix.
- `generateBracket(participants)` returns matches, preserving the participant IDs. Throws an understandable error for invalid participants/seeds.
- `validate(document, externalGames = [])` returns issue objects `{match_id, message, blocking}`. Includes structural, missing schedule, venue, team/potential-team, dependency/rest conflicts. External games use `{id, school_ids, game_date, start_time, duration_minutes, venue}`.
- `schedule(document, windows, externalGames = [])` returns `{document, issues}`, preserving match IDs and results. Produces a proposed schedule and leaves impossible matches unscheduled with reasons.
- `resolve(document)` returns a new document with `resolved_a`/`resolved_b` participant IDs or null on each match, validates winners and reports downstream-invalid results through validation.
- `parseCsv(text, mapping, schools)` returns `{document, errors}`. Mapping maps canonical CSV names to source headers. `csvHeaders` lists canonical columns. `exportCsv(document, tournamentId)` returns a safe, round-trippable master CSV. Export IDs, metadata, seeds, slots/results and scheduling constraints. Neutral/home sides and guest names round-trip. Preserve IDs on repeated import.

## Checked database API

All calls verify current verified-email invitation. Private definer helpers implement writes behind authenticated invoker wrappers. Raw tournament/history table writes are revoked. New tables have RLS enabled. Conf/site admins manage tournaments. ADs read published tournaments involving their school and manage their own bus rows.

- `list_tournaments()` returns `{actor_role, school_id, tournaments:[record], conflicts:[externalGame], transportation:[row]}`. A record is `{id,revision,published_revision,draft,published,issues}`. Only managers receive drafts. ADs receive published documents and own transportation.
- `save_tournament(p_id uuid, p_expected_revision bigint, p_document jsonb)` returns a record. New client-generated UUID uses expected revision 0. Safe identical retries return current state. Stale changes fail with 40001.
- `review_tournament(p_id uuid)` returns `{id,revision,token,draft,published,changes:[{id,before,after}],issues,affected_schools}`. token binds draft, approved state and scheduling-conflict state.
- `publish_tournament(p_id uuid,p_token text,p_match_ids text[] default null)` returns a record. Null publishes the full schedule; initial publication is full. Later selected-match publication preserves other approved matches. Global metadata/participant edits require full publication. Result changes require publishing all affected downstream matches. Server validates the candidate and locks writes for atomic publication. Match revision counters survive removals/republication.
- `save_tournament_transport(p_tournament uuid,p_match text,p_school text,p_expected_revision bigint,p_transport jsonb)` returns a transport row with revision. New row revision 0. Fields are bus_departure, pickup_location, return_time, notes, bus_confirmed. Current school ownership and confirmed published participation are mandatory.

## Calendar projection contract

The service-only `read_published_schedule(p_school)` retains the existing keys and adds tournament_games and tournaments.

Each tournament_game is `{id,tournament_id,tournament_name,match_id,match_label,round,game_date,start_time,location,status,home_side,duration_minutes,revision,updated_at,a,b,teams,transportation}`. id is `tournament-UUID-matchID`. a/b are `{id,name,school_id}`; unresolved slots have id/school_id null and a name such as Winner of Semifinal 1. teams is `{sport,gender,level,season}`. Only the school-specific response carries its permitted transportation fields. A school response selects games with that confirmed school in a/b. Publication authorizes tournament visibility independently of ordinary school schedules. `tournaments` is an array of `{id,document}` with approved documents for bracket views. Match publication snapshots include resolved_a/resolved_b, revision and updated_at. No actor details or drafts enter public responses.

Public history is added to the existing updates array with existing formatter kinds and school-oriented before/after summaries. Removed/changed participants update all affected projections together. Feeds retain stable IDs and increasing revisions. Public bracket views link from tournament calendar events.

## Implementation choices

Use compact JSON documents for bracket graphs, plus relational per-school transportation and publication history. Server validates every document and published candidate. Directors explicitly clear invalid downstream results after correcting a winner. Slot ancestry supplies potential-team conflicts even before winners are known. Existing ordinary games have no duration, so conflicts use the tournament's entered duration as a conservative estimate and identify that basis in the interface.

The proposal engine fills available minutes in round order. It leaves games unscheduled when it cannot find a slot. Tight constraints can require manual edits even when another arrangement could fit. Schedule checks refresh available school schedules and approved tournament games before proposing times and again during checked publication.

Rest and duration use elapsed Eastern time across daylight-saving changes. Nonexistent spring-forward tournament times are rejected. A repeated fall-back hour uses the later, standard-time occurrence consistently with PostgreSQL. The database supplies `ics_start_utc` for that hour so the subscription preserves the selected instant, since a timezone-labeled ICS value alone refers to the earlier occurrence. [iCalendar date-time rules](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.3.5)

## Staff workflow

1. Sign in and choose Tournaments. Conference admins and site admins create and publish tournaments. An AD sees their school's confirmed published games and transportation form.
2. Choose New tournament. Enter the tournament details, then select schools or paste seeded teams. Review the replacement bracket before applying it. Alternatively download the CSV template, map the uploaded columns and review additions and changes. Guest names are retained. Preserve tournament and match IDs from the master CSV when importing updates.
3. Enter playing windows, duration, turnaround and rest. Propose a schedule, review it and apply it to the draft. Edit dates, times and venues in Matches and results. Resolve reported issues before publication.
4. Save draft and Review publishing. Inspect changed fields and affected schools. The first publication covers the full tournament. Later reviews can publish selected changed matches together, including dependent changes, or the full tournament.
5. Enter a completed game's status and winner, save and review the resulting advancement. Correcting a result can invalidate later results. Clear or correct those results and publish the affected matches together.
6. Download master CSV to retain stable IDs for future imports. Public event details link to the approved bracket. Existing calendar subscription controls include published tournament games. A subscription receives changes when the calendar provider refreshes. A downloaded ICS is a one-time copy.

## Test deployment and verification

Development deployment is limited to `jrtcyihpdrcnhxgproyw`. Apply migrations `20261118000100` through `20261124000100` in order and deploy `public-calendar` with its existing public endpoint setting. The test deployment is version 6. Production setup is handled separately by Greg.

Run `node --test tests/*.test.mjs`. Run the two rollback suites in `supabase/tests/tournaments.sql` and `supabase/tests/tournament-validation.sql`, plus the five existing publication/access rollback suites. Test fixtures leave the saved schedules and invitations unchanged. A deployed feed smoke check also verifies conference/school filtering, bus isolation, identity retention and increasing sequence numbers through a published edit.

The final development check passed 128 automated tests and all seven database suites. Deployed JSON and ICS checks covered conference and participating-school feeds, including the repeated Eastern hour. Normal staff entry-point tests cover conference admins, site admins and ADs. The final test-project baseline has 48 schools, 33 working games, 24 approved games, two invitations and zero tournament fixtures.

Browser checks use fictional data through `tests/preview-server.mjs` and `tests/tournaments-preview.html`, the actual dashboard controller and a local feed fixture. They cover manager review/publication, winner display, scheduling proposals, AD bus saving and the public bracket at 390px and desktop widths. Database checks independently exercise current-role permissions and publication. Personal Google, Apple and Outlook subscription refresh behavior requires testing in those providers.

Existing project advisories include the platform-created `rls_auto_enable()` function and disabled leaked-password protection. The internal tournament tables intentionally expose checked functions with direct table grants revoked. Their RLS-without-policy informational notices follow that access design. [Public Security Definer functions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS enabled without policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

Performance advisories concern existing school-game foreign keys and overlapping school-schedule policies. The tournament tables introduce no new performance advisory. [Foreign-key indexes](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [multiple policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

## Rules and dates

A tournament document may carry an optional `info` object: `{rules_url, director, director_confirmed, reviewed_on, dates:[{label, date, confirmed, note}]}`. It holds the official regulations link, the director and key dates such as a qualification cutoff.

- Key dates live only in `info.dates`. They are never matches, so they cannot appear in `tournament_games`, on a calendar or in a feed.
- A date is either confirmed with a date, or marked "Needs date confirmation" with a note saying what is unsettled. A confirmed date with no date blocks publishing.
- The staff section offers "Fill from official sources" when `data/conference-resources.js` has a record for the tournament's sport, gender, season and year. Dates the official sources disagree on arrive unconfirmed.
- The public tournament page shows the rules link, a confirmed director and confirmed dates. Unconfirmed details and notes are not displayed there. They are still part of the published document, so keep private preparation notes out of them.
- `info` is tournament-wide, so changing it needs a full publication, like any other tournament detail.
- The database keeps `info` only after migration `20261126000100_tournament_info.sql`. That migration is a draft: not applied, not tested. Until it runs, saving reports "Rules and dates were not" saved and keeps the typed values on screen.
