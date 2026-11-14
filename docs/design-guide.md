# Design guide

The site uses a modern Bauhaus look in the spirit of Dieter Rams: functional, flat, and clear. Every new page, including the staff pages, follows these rules. Shared styles live in `css/site.css`; staff-only styles live in `css/staff.css`.

## Look

- No decorative shapes or abstract art. Logos and school colors carry the personality.
- Square corners everywhere. Do not use `border-radius`, except for the red "today" circle on calendars.
- No soft drop shadows.
- No partial borders. Do not add a colored stripe on one side of a box (`border-left`, `border-top`, or an inset underline). Use a full `var(--frame)` border (1px logo steel) or a solid color fill instead. Form fields and buttons use `var(--control-frame)`, a deeper steel that meets 3:1 contrast. Do not use black borders.
- Font: Jost, loaded in each page's `<head>` (copy the three font lines from `index.html`).

## Color

The conference palette comes from the Shore Conference logo: navy, maroon, steel and white. Use only the variables in `site.css`. Do not add new colors or use the old `--line`, `--radius-*`, or `--shadow-*` variables.

| Color | Variable | Meaning |
| --- | --- | --- |
| Navy | `--navy` | Current page, selected tab, page header bands |
| Maroon | `--red` | Main action button, today, canceled games; in articles, the years, dates and pull quotes |
| Steel | `--steel` | Frames and dividers; also `--hover`, the hover fill |
| Deep steel | `--steel-dark` | Edges of form fields and buttons |
| Yellow | `--yellow` | Off-logo on purpose: postponed games and warnings, including "you are previewing" |
| Ink | `--ink` | Same value as navy: text, calendar header row, footer |
| Paper | `--paper` | Page background, a pale tint of steel |
| School color | `--school-color` | Anything belonging to a school (dates, events, school header) |

Color must mean something. Do not use it only for decoration.

## Hovers

Hovers change the whole background to a different solid color, with no movement.

- Plain nav link or white button: turns steel.
- Navy (current) item: turns red.
- Red main button: turns navy.
- Clickable game in a calendar: turns navy with white text.

## Reuse these pieces

- Buttons: `.button` with `.primary` (red), `.secondary` (white), or `.dark` (navy).
- Page header: `.intro` (solid navy band). School pages use `.school-hero`.
- Small uppercase labels: `.eyebrow`, or the label style used by `.filters`.
- Form fields: plain `input`, `select`, and `textarea` are already styled. Wrap rows of fields in `.filters`.
- Game lists: `.game-list`.
- Pop-ups: `<dialog class="game-details">`.
- Public pages with sub-pages: `.side-layout` with `.side-tabs` on the left and one `.panel` per tab on the right (see `resources.html`). Lists of saved files use `.doc-list`.
- Long articles: `.article` in a panel, with `.chapter` bands, `.history-timeline` lists of dated items, `.stat-row` number tiles, `.pullquote`, and framed `.photo` figures with a caption (see the History tab).
- Staff pages: `.staff-panel` for framed sections and `.staff-tab` (with `aria-current`) for sidebar tabs. Game status colors are in `staff.css`.

## Every page

- A skip link, the shared masthead (brand, main nav, and the `.staff-link`), and the shared footer.
- Relative links only.
- Check the page at phone width (390px) and desktop width before calling it done.

## Sport icons

- The shared 24 × 24 outline icon sprite is `assets/icons/sports.svg`; `createSportIcon(sport)` in `js/site.js` maps common sport labels to an SVG `<use>` reference.
- Show sport icons only beside an existing sport or game label in public schedules. Do not replace school logos, headings, calendar status indicators, or accessible text with icons.
- Icons are monochrome and inherit text color. Unknown sports display without an icon; do not guess a sport or show a broken graphic.
