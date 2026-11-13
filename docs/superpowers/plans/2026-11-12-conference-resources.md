# Conference resource hubs implementation plan

> For agentic workers: use superpowers:executing-plans to implement this approved phase.

**Goal:** Add public Divisions, Tournaments and Inside the Conference hubs without changing schedule behavior.

**Architecture:** Plain HTML pages share the existing styles and sourced division data. Small browser scripts filter resource lists and enhance a usable HTML navigation. Official documents remain external links.

**Tech stack:** HTML, CSS, JavaScript; existing Node test runner. No new dependencies.

**Spec:** The review and phase-one proposal approved in this conversation, with the user's following permission decisions.

## Approved decisions

- Conference admins and site admins may manage and approve conference content themselves in the later editing phase.
- AD content controls are limited to their own school's social media; do not add general AD news, gallery or document submissions.
- Prefer attributed links and school-approved sources. Do not copy publisher images, scrape accounts or enable automatic social feeds. Rights, removal ownership and procedures must be settled before hosted galleries or connected feeds.
- Implement this public foundation first. Database editing, logins, storage, news and photo administration remain subsequent phases; only Greg handles production.
- Keep school posting on save/import, exact matching, bus visibility, subscriptions and the restricted tournament upload workflow unchanged.

## Global constraints

- Plain HTML, CSS and JavaScript; no frameworks, npm packages or build tools.
- Relative internal links; retain the reusable school template and existing URLs.
- Square corners, full frames, existing colors and spacing. Phone-first layout.
- Source dates and incomplete coverage must be visible. No inferred assignments or tournament dates.

## Review focus

1. A school missing from the copied divisions is unknown, not unassigned.
2. Partial division memberships must not look complete.
3. Invalid or unavailable query filters must not silently broaden results.
4. Mobile menu must remain usable by keyboard and without JavaScript.
5. Tournament resources must not create calendar events or reactivate hidden tools.

## Tasks

- [x] Add tests for division filtering, missing-school coverage and season-year distinctions.
- [x] Build Divisions from the existing source data, with shareable filters and source-only fallbacks.
- [x] Add a reviewed, dated public resource catalog and filtered Tournaments/Inside pages. Keep sports competitions distinct and show source limitations.
- [x] Update shared navigation on every root page; add Home, school and calendar resource links. Hide no destinations when JavaScript is unavailable.
- [x] Run existing/new tests, keyboard and 390px/desktop browser checks, and accessibility specialist reviews. Fix material findings.

## Execution record

- Started from clean `enable/school-venues` checkout on `feature/conference-resource-hubs`.
- No database or hosting changes are part of this phase.
- Completed November 13: 181 Node tests pass. Headless Chrome checks passed at 320, 390 and 1280px, including keyboard menu activation/Escape, focus across breakpoints, filters/reset, unknown selections, shareable URLs, 200% text and no-JavaScript navigation/source fallbacks.
- Specialist heading/contrast and keyboard/ARIA reviews completed. Fixed the reported resize focus issue and added a regression test. The forms/live-region specialist hit a usage limit; native labels, status counts, retained control focus and form behavior were checked directly. No screen-reader session was run.
- Final static review found no additional material functional or safety issues. Existing schedules and school pages were included in phone-width smoke checks, with no observed browser errors.

## Navigation revision (November 13)
- Restored the original single-row desktop layout: Home, Schools, Calendar, About, Resources dropdown, Staff sign-in.
- Resources holds Divisions, Tournaments and Documents; Documents retains the existing inside.html URL.
- Phones use one Menu button, then native Resources expansion. Keyboard, Escape, focus across breakpoints, no-JavaScript use and 320/390/768px layouts passed in Chrome; all 181 tests pass.


## Stand-alone revision (November 13)
- The old conference site will go away, so nothing on this site links to it. Lists and documents open saved copies: PDFs in `assets/documents/`, web pages in `data/archived-resources.js` shown by `archive.html?page=…`. `docs/source-archive/manifest.json` records each copy's source, checksum and capture date.
- Removed the "Stories and photos" card (Documents) and the news link (About); that content only exists on the old site.
- Tournament rules links may now be a saved file in `assets/documents/`. Draft migration `20261128000100_saved_rules_links.sql` makes the database accept them; not yet run in the test project.
- Removed the Resources dropdown. The header is back to Home, Schools, Calendar, About and Staff sign-in, with Sign out in its old place. Divisions, Tournaments and Documents are a Resources section on About; those pages highlight the About tab.
- 180 Node tests pass. Headless Chrome checks at 375 and 1280px.
