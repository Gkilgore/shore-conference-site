# Calendar subscriptions implementation plan

**Goal:** Let families subscribe to published school, team and conference schedules and receive later AD edits when their calendar refreshes.

**Architecture:** A read-only Edge Function produces JSON and ICS from the same public projection. School settings controls a default-off publication flag under existing school ownership rules. Public pages and an app chooser share the endpoint.

**Spec:** `docs/calendar-subscriptions.md` and `docs/rebuild-plan.md`.

**Constraints:** Plain HTML/CSS/JS; no packages/build tools. Test project only. Preserve unrelated local changes in the original checkout. No secrets in source. No instant-update promise.

## Tasks

- [x] Write failing Node built-in tests for stable identity, revision changes, cancellation, DST, escaping, UTF-8 line folding, exact conference matching, school/team filters and publication/privacy boundaries.
- [x] Implement pure public projection and ICS serialization in `supabase/functions/public-calendar/calendar.mjs`; run tests.
- [x] Implement GET handler and paginated server-only REST reads, public JSON/ICS responses, input validation and safe errors; test with controlled data sources.
- [x] Add migration for school publication and game modification timestamps, preserving RLS and limiting staff writes to their own school; add transactional database verification script for later test-project execution.
- [x] Add the school publication form and subscription chooser. Load public pages from live endpoint; keep sample mode explicitly labeled and separate from subscriptions.
- [x] Run full local tests, syntax checks and diff checks; review the whole change. Fifteen tests pass. Independent reviewer found a duplicate conference entry issue; regression test and deterministic deduplication resolve it. Pagination also handles server row limits below 1000.
- [ ] Complete 390px phone and staff-publication visual checks. Desktop subscription page inspected with fictional fixture data; app links and one-time download distinction are visible.
- [ ] Deploy and verify database permissions, triggers, REST joins and calendar-app refresh behavior in test project. Connector metadata access denied; SQL tool additionally reports a missing connection argument. No remote database changes have run. Do not merge or publish frontend before these checks pass.

## Review focus

Unpublished schools must never leak games. Conference data must never include buses or unmatched games. A rescheduled event must retain UID. Empty and failed feed responses must be distinguishable. Saved filters must not change an already copied subscription URL.
