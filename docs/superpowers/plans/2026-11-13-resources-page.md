# Resources page implementation plan

**Goal:** Replace the About tab and its three buried hub pages with one Resources page that uses left-hand tabs, and show each sport's divisions in a pop-up. Give conference admins the Shore Conference header on every staff tab.

**Architecture:** `resources.html` holds five panels (About, History, Divisions, Tournaments, Documents). `js/resources.js` shows one panel at a time from the address hash and fills the three data-driven panels from `data/conference-resources.js`. Without JavaScript every static panel shows, stacked. `js/resource-lists.js` holds the pure grouping and labeling functions so they can be tested.

**Tech stack:** HTML, CSS, JavaScript; existing Node test runner. No new dependencies.

**Spec:** Greg's request and the design he approved in conversation on November 13, 2026.

## Approved decisions

- The main navigation says Resources, not About.
- Tabs sit on the left and swap the framed panel on the right, like the staff workspace. They become a row on phones.
- Divisions shows a compact list of teams by season. A team opens the standard `game-details` pop-up with that sport's divisions, schools and the saved official list.
- Old About, Divisions, Tournaments and Documents addresses forward to the matching tab.
- A conference admin sees the Shore Conference logo and logo-wall header on every staff tab, not the selected school's.

## Global constraints

- Follow `docs/design-guide.md`: square corners, full frames, existing color variables, full-color hovers. Reuse `.button`, `.eyebrow`, `.game-details`, `.about-*`.
- Relative links. Nothing links to theshoreconference.com.
- Partial division memberships must not look complete. A list with no copied divisions links to its saved copy only.

## Review focus

1. An unknown or missing hash opens About, not a blank panel.
2. A sport with more than one list (Soccer, Volleyball) names the team; a sport with one list does not.
3. Winter labels show both years (Winter 2026–27).
4. Tabs and the pop-up work by keyboard; the page reads without JavaScript.
5. A site admin viewing as an AD still sees that school's theme.

## Tasks

- [x] Test and write `divisionGroups`, `divisionTeamLabel` and `seasonLabel` in `js/resource-lists.js`.
- [x] Build `resources.html`, `js/resources.js` and the tab, panel and list styles in `css/site.css`; remove the one-off resource card styles.
- [x] Rename the nav item on every page, point old links at the new tabs, and turn the four old pages into forwards.
- [x] Conference admin view keeps the conference theme on Schedule and Games.
- [x] Update `AGENTS.md`, the design guide and `docs/conference-resources.md`. Check at 390px and desktop width.
