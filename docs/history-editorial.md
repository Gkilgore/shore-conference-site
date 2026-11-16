# History feature

November 15, 2026. Implementation and editorial record for `resources.html#history`.

## What changed

The History tab now has the requested six sections: the 90-year introduction, a decade timeline, athlete profiles, defining moments, membership history and sources. It uses the existing Jost type, conference colors, framed panels and Information navigation. No framework, package, build system, database or login changes were introduced.

The first decade opens initially; visitors can select any decade or all years. Stories use native `details` controls. Athlete filters combine sport and school-era decade. Later-member alumni and profiles needing membership evidence are separate from confirmed conference competitors. Deep links reveal filtered entries and open their enclosing archive. Reduced-motion preferences are respected. The original article and its PDF remain available without JavaScript.

## Files

| File | Purpose |
| --- | --- |
| `resources.html` | Six sections, accessible headings, navigation and original-history fallback |
| `css/history.css` | Styles scoped to the History feature; shared styling left alone |
| `data/history.js` | 24 milestones, 14 profiles, 7 stories, 8 membership entries, sources and photo metadata |
| `js/history-data.js` | Combined athlete filtering |
| `js/history.js` | Rendering, decade controls, expandable stories, filters and deep links |
| `assets/history/christie-rampone.jpg` | Licensed photograph, stored locally |
| `tests/history.test.mjs` | Filter behavior, source/anchor integrity, athlete classification and photo metadata |
| `tests/history-browser-check.cjs` | Optional real-browser interaction, navigation and responsive checks |
| `tests/public-information-pages.test.mjs` | Renames the static-fallback image check to distinguish it from enhanced photography checks |
| `docs/source-archive/history-dossier-2026-11-15.md` | User-supplied dossier, preserved as received; research input, not an audited publication |
| `docs/conference-resources.md` | Updated History maintenance instructions |

The source dossier contains ChatGPT citation identifiers, not usable URLs. Those identifiers are not carried into public data. Public records reference named sources with real addresses. The source file has the reviewed wording and reference mapping; adding a claim requires adding its evidence there.

## Content rules

- `milestones`: stable `id`, numeric event `year`, readable `date`, `title`, `summary`, expanded `detail`, source IDs, optional PDF `locator` and `photo`, and `confidence`.
- `athletes`: name, historical school label, current school-page slug, school-era label and decade, sports, short and expanded biographies, sources, optional photo, membership category and explanatory note. Decades describe school years, not the dates of later professional achievements.
- `stories` and `membership`: stable IDs, dates, readable titles and summaries, references, confidence; stories also support expanded detail, featured presentation and an optional image.
- `sources`: title, publisher, URL, review date and any scope limitation. An old conference-site source must have a saved local copy before linking it publicly.
- `photos`: local path, dimensions, meaningful alt text, creator, source page, license name and URL, and changes made. The credit appears with the photo; the full reuse record appears in the source archive.
- `confidence` is `documented` or `research-ongoing`. Athlete `membership` is `conference`, `shore-area` or `research`. Never infer historical membership from a present-day school slug.
- Add only concise original copy. Historical records stay dated; do not silently turn a past record into a current all-time claim.

## Verification and editorial decisions

- Founding details and early milestones were checked against the local ten-page official history. Its 1940 roster is not labeled as the nine founding members. Tennis approval in May 1963 and approval of its schedule in February 1964 are distinguished.
- RBC's 1980 yearbook was retrieved and read at PDF page 135, printed page 131. It records 1978 admission and eligibility beginning the following school year. The source link opens that page.
- NJSIAA's Nancy Williams profile supports the 1970 program start, advocacy and field-hockey totals. These totals refer to her coaching career, not current school totals.
- The Coaster's September 2026 Asbury Park retrospective distinguishes the 1975 all-groups championship from the 1976 and 1977 Group III championships. The page keeps those distinctions.
- CBA's own account dates membership to 1982. Ranney's 2011 announcement establishes its fall 2012 transition. The 2019 final and scoring record are attributed to contemporary reporting.
- College, league and association biographies provide the athlete facts. Mabrey's Point Pleasant Beach season is retained; her 2019 WNBA draft selection is supported by Notre Dame's biography. No unverified 2026 All-Star assertion is included.
- The September 30, 2025 NJSIAA directory is a dated 47-school snapshot. It does not override the site's 48-school scheduling directory. Jackson's April 2025 agenda addendum documents the building names and grade assignments; the wording does not treat an agenda as a vote tally or infer the exact consolidation vote date.
- **Jenny Thompson is excluded.** [Team USA](https://www.teamusa.com/hall-of-fame/hall-of-fame-members/jenny-thompson) identifies Dover High School in New Hampshire. The brief named her only as a candidate; the dossier did not supply a Shore-school connection.
- Bob Verga belongs under Jersey Shore Greats. The preserved original article includes a note explaining why mentions in that record do not prove conference membership.
- Brad Brach's school and achievements are documented. His profile remains under membership research until a dated source explicitly connects his school-era participation to the conference.

## Photographs still needed

Rampone's 2015 photograph by Noah Salzman is included unaltered under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with visible attribution and a [source link](https://commons.wikimedia.org/wiki/File:Christie_Rampone.jpg). It is identified as a later-career image, not a high-school photograph. Other cards use existing school marks labeled as such; no invented portraits or historical scenes were generated.

Cleared candidates were located for [Marina Mabrey](https://commons.wikimedia.org/wiki/File:Marina_Mabrey_(cropped).jpg) (Lorie Shaull, CC BY-SA 4.0), [Todd Frazier](https://commons.wikimedia.org/wiki/File:Todd_Frazier_20130625.jpg) (NewJack984, CC BY-SA 3.0), and [Frankie Edgar](https://commons.wikimedia.org/wiki/File:Frankie_Edgar.jpg) (Jemaleddin Cole, CC BY-SA 2.0). The image host returned HTTP 429/403 for these downloads. They are **not** referenced by the public page and there are no broken-image placeholders. Fetch and verify them before adding local paths and complete credit metadata.

Still seek authorized school-era photographs for the founding meeting, Convention Hall tournament, Asbury Park girls in 1974–77, Nancy Williams and Shore field hockey, CBA's early conference teams, Ranney 2019, and the remaining athletes. Newspaper or school publication alone does not grant reuse permission. Record permission or a suitable license before including a file. The conference still needs to name its removal-request contact before rollout, as required in `conference-resources.md`.

## Research follow-up

These remain outside published factual claims unless the page explicitly describes the gap:

1. The exact nine founding members and the first 1936 track champion.
2. School-by-school accession dates, including St. Rose, St. John Vianney and Donovan Catholic/St. Joseph; RFH's return after its 1965 withdrawal; Holmdel's membership during Bob Roggy's career; and the separate Freehold Regional school identities.
3. A direct dated membership-era citation for Brach; additional profiles for Andrews, Jaeger, Rivera, Roggy, Nelson and Brown after the same school-era review.
4. First official girls tournaments and championships by sport; complete SCT, division, sectional and state title histories with the competitions kept distinct.
5. A fuller 1980s account, school closures and admission chronology for Mater Dei, New Egypt and Trinity Hall. No dates are invented to fill those gaps.
6. The dossier's 2026 girls wrestling results, four-time winners, flag-football participation count and Barnegat result. The statewide flag-football sanctioning decision is included; the other claims await their individual source records.
7. Trinity Hall's 2026 soccer title has an official conference report, but that disappearing-site report needs an approved saved source before adding it to the public data.
8. The dossier's Quenton Nelson trade and Marina Mabrey 2026 All-Star claims were not included. Confirm dated league records if they become relevant.
9. Complete Southern wrestling and girls basketball program chronologies, rivalries, national records and rankings. The feature includes selected documented stories, not complete databases.
10. Racial integration, pioneering Black coaches and athletes, disability access, and other inclusion histories require dedicated archives and oral histories; do not infer them from names or photographs.

## Validation

`node --test tests/*.test.mjs` passed all 261 tests. Syntax checks passed for the three new JavaScript files. There is no configured lint, TypeScript or build step in this plain-file project.

The browser check uses an already installed Puppeteer outside the repo, supplied through `SHORE_BROWSER_DRIVER`, plus an optional `SHORE_BROWSER_BINARY`. It does not install packages. Run `node tests/history-browser-check.cjs`; optionally set `SHORE_HISTORY_SCREENSHOTS` to an output directory. It starts and closes its own local server, including the GitHub Pages repository prefix.

Verified in Chromium: combined filters and empty results, reset, decade selection and arrow/Home keys, native keyboard expansion, source links opening their enclosing archive, filtered athlete deep links, original chapter addresses, Back navigation, Divisions and its dialog, all local images, no duplicate IDs or missing anchors, no horizontal overflow at 390/768/1440 pixels, no uncaught script errors, and the original article with JavaScript disabled. Phone and desktop screenshots were visually reviewed. Other browser engines and assistive-technology testing remain follow-up checks.
