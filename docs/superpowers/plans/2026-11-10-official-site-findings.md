# Official Site Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the About page's division claim, show a team's division beside its schedule, add rules and confirmed dates to tournaments, and link each school page to the school's own athletics site.

**Architecture:** One curated data file holds everything copied from theshoreconference.com (division lists, school athletics links, tournament source notes), each entry with its URL, review status and review date. A small pure module answers "which division is this team in?" and renders one compact line; the school page and the staff Games tab both call it. Tournament rules and dates live inside the existing tournament document as `info`, so they follow the existing conference-admin permission and draft → review → publish steps.

**Tech Stack:** Plain HTML, CSS and JavaScript; `node --test`; Supabase SQL migration (drafted, not applied).

**Spec:** Greg's request of 2026-11-10 ("Implement the findings from our comparison of the official Shore Conference website with our scheduling site"). Source facts were rechecked that day; see `docs/conference-resources.md`.

## Global Constraints

- No frameworks, npm packages or build tools. Relative links. A purpose comment at the top of each source file.
- Design guide: square corners, full frames, no partial borders, color only where it means something.
- Copy: one plain sentence, concrete labels ("Official division list", "Tournament rules", "School athletics website", "Needs date confirmation").
- Never show a division unless school, sport, gender, level and season all identify one. The official lists do not name a level, so assignments are recorded and shown as Varsity only.
- A deadline or key date is never a match: it must not appear in `matches`, calendar events or feeds.
- No production or test-database changes from this session. The migration is a draft for Greg.
- A school link is shown only with `status: 'verified'`.

## Review Focus

- Sport named with its gender ("Girls Tennis") and gender filter left on "All teams": still resolves to the girls' list.
- A sport whose official list covers both genders (Cross Country): either gender resolves.
- Calendar moved to another school year: the line shows that year's record or says none is listed; it never reuses this year's.
- Tournament saved against a database without the `info` migration: the staff page says the section was not saved instead of silently dropping it.
- `info.rules_url` that is not `https://`: rejected by the engine check and never rendered as a link.

---

### Task 1: Curated source record

**Files:**
- Create: `data/conference-resources.js`, `docs/conference-resources.md`
- Test: `tests/conference-resources.test.mjs`

**Interfaces:**
- Produces: global `shoreConferenceResources = { divisionLists, schoolSites, tournamentSources }`.
  - `divisionLists[]`: `{ sport, genders: string[], level: 'Varsity', season, year, title, url, status, reviewed, complete: boolean, divisions: { [name]: string[] } | null }`. `year` is the fall calendar year for Fall and Winter, the spring calendar year for Spring. School entries are directory slugs; a name with no slug stays as printed.
  - `schoolSites`: `{ [slug]: { url, status: 'verified' | 'needs-review', reviewed, note? } }`.
  - `tournamentSources[]`: `{ sport, genders, season, year, rules_url, rules_title, chart_url, director, dates: { [gender]: [{ label, date, confirmed, note }] }, reviewed }`.

- [ ] Test: every `url` starts with `https://`; every entry has `status` and an ISO `reviewed`; every `schoolSites` key and every slug-shaped division member exists in `shoreSchools`; the three pilot schools have a verified site; Boys Soccer Fall 2026 puts Colts Neck and Marlboro in "A North" and Shore Regional in "A Central"; Boys Golf Spring 2027 uses "Mickelson", "Hogan", "Snead".
- [ ] Write the data file from the rechecked sources, and the maintenance doc (who updates, how, what "verified" means).
- [ ] Run `node --test tests/conference-resources.test.mjs`. Commit.

### Task 2: Team division line

**Files:**
- Create: `js/team-info.js`
- Modify: `school.html`, `js/calendar.js`, `js/school.js`, `admin.html`, `js/staff-schedule.js`, `css/site.css`
- Test: `tests/team-info.test.mjs`

**Interfaces:**
- Consumes: `shoreConferenceResources.divisionLists`, `shoreSchools`.
- Produces:
  - `seasonYear(season, isoDate) -> number` (school year starts July 1).
  - `seasonLabel(season, year) -> string` ("Fall 2026", "Winter 2026–27", "Spring 2027").
  - `teamDivision({ school, sport, gender, level, date }) -> { state, list?, lists?, division?, members?, label? }` where `state` is `'assigned' | 'list' | 'not-varsity' | 'choose-team' | 'none' | 'all'`.
  - `renderTeamInfo(target, selection)` draws one line; `target.hidden = true` for nothing to say.
  - `js/calendar.js` dispatches `shore:calendar-view` on `window` with `{ sport, gender, level, date }` (middle day of the visible range) whenever the view or filters change.

- [ ] Tests (names): `assigned for a varsity team`, `JV never inherits the varsity division`, `all sports makes no division claim`, `sport without gender offers lists, not a division`, `Girls Tennis resolves with gender unset`, `Cross Country resolves for either gender`, `next school year has no record`, `incomplete list shows no member list`, `winter label spans two years`.
- [ ] Implement, wire into the school page (between filters and count) and the staff Games tab (above the calendar), style as one framed line.
- [ ] Run tests. Commit.

### Task 3: School athletics website link

**Files:**
- Modify: `school.html`, `js/school.js`, `js/calendar.js`, `css/site.css`
- Test: `tests/team-info.test.mjs` (`schoolSite` cases)

**Interfaces:**
- Produces: `schoolSite(slug) -> { url } | null` (verified entries only). `renderCalendar(events, { emptyLink })` where `emptyLink` is `{ href, label }` shown in the "No games are posted yet." panel.

- [ ] Tests: verified school returns its URL; `needs-review` and unlisted schools return null.
- [ ] Add a secondary "School athletics website" link in the school band and in both empty states. Opens in a new tab with `rel="noopener"`.
- [ ] Run tests. Commit.

### Task 4: Tournament rules and dates

**Files:**
- Modify: `js/tournament-engine.js`, `js/staff-tournaments.js`, `admin.html`, `js/tournament-public.js`, `tournament.html`, `css/tournaments.css`, `css/tournament-public.css`, `tests/preview-server.mjs`, `docs/tournaments-design.md`
- Create: `supabase/migrations/20261126000100_tournament_info.sql` (draft, not applied)
- Test: `tests/tournament-engine.test.mjs`, `tests/tournament-controller.test.mjs`

**Interfaces:**
- Document gains optional `info: { rules_url, director, director_confirmed, reviewed_on, dates: [{ label, date, confirmed, note }] }`.
- `TournamentEngine.cleanInfo(info) -> info` (trims, drops empty rows, defaults). `validate` adds blocking issues for a non-https `rules_url`, an invalid `date`, a confirmed row with no date, a row with no label, more than 20 rows.
- `renderTournamentInfo(tournament, target)` in `js/tournament-public.js`: rules link, director if confirmed, confirmed dates only.

- [ ] Tests: `info dates never become matches` (resolve/schedule/exportCsv leave `matches` unchanged and CSV has no date labels); `validate rejects a non-https rules link`; `validate rejects a confirmed date with no date`; `cleanInfo drops empty rows`; controller: `rules and dates edit marks the draft unsaved` and `a save that comes back without info reports it`.
- [ ] Engine, staff section "Rules and dates" (with "Fill from official sources" when a source record matches), review summary rows, public rendering, migration draft, preview fixture.
- [ ] Run all tests. Commit.

### Task 5: About page, checklist, verification

**Files:**
- Modify: `about.html`, `docs/ad-workflow-checklist.md`, `tests/school-directory.test.mjs` if it pins About text

- [ ] Replace the six-division sentence and the "Divisions" fact with a sourced statement that divisions are set per sport each season. Recheck the member count.
- [ ] Browser checks with fictional data at 1280px and 375px: school page (all sports, varsity team, JV team, next year), a school with no schedule, staff Games tab, staff tournament section, public tournament page; keyboard focus order; 200% text.
- [ ] `node --test tests/*.test.mjs`. Update the checklist. Commit.
