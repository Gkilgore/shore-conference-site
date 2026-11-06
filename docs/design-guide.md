# Design guide

The site uses a modern Bauhaus look in the spirit of Dieter Rams: functional, flat, and clear. Every new page, including the staff pages, follows these rules. Shared styles live in `css/site.css`; staff-only styles live in `css/staff.css`.

## Look

- No decorative shapes or abstract art. Logos and school colors carry the personality.
- Square corners everywhere. Do not use `border-radius`, except for the red "today" circle on calendars.
- No soft drop shadows.
- No partial borders. Do not add a colored stripe on one side of a box (`border-left`, `border-top`, or an inset underline). Use a full `var(--frame)` border (2px black) or a solid color fill instead.
- Font: Jost, loaded in each page's `<head>` (copy the three font lines from `index.html`).

## Color

Use only the variables in `site.css`. Do not add new colors or use the old `--line`, `--radius-*`, or `--shadow-*` variables.

| Color | Variable | Meaning |
| --- | --- | --- |
| Navy | `--navy` | Current page, selected tab, page header bands |
| Red | `--red` | Main action button, today, canceled games |
| Yellow | `--yellow` | Hover, "you are previewing", postponed games |
| Black | `--ink` | Text, frames, calendar header row, footer |
| Paper | `--paper` | Page background |
| School color | `--school-color` | Anything belonging to a school (dates, events, school header) |

Color must mean something. Do not use it only for decoration.

## Hovers

Hovers change the whole background to a different solid color, with no movement.

- Plain nav link or white button: turns yellow.
- Navy (current) item: turns red.
- Red main button: turns navy.
- Clickable game in a calendar: turns black with white text.

## Reuse these pieces

- Buttons: `.button` with `.primary` (red), `.secondary` (white), or `.dark` (navy).
- Page header: `.intro` (solid navy band). School pages use `.school-hero`.
- Small uppercase labels: `.eyebrow`, or the label style used by `.filters`.
- Form fields: plain `input`, `select`, and `textarea` are already styled. Wrap rows of fields in `.filters`.
- Game lists: `.game-list`.
- Pop-ups: `<dialog class="game-details">`.
- Staff pages: `.staff-panel` for framed sections and `.staff-tab` (with `aria-current`) for sidebar tabs. Game status colors are in `staff.css`.

## Every page

- A skip link, the shared masthead (brand, main nav, and the `.staff-link`), and the shared footer.
- Relative links only.
- Check the page at phone width (390px) and desktop width before calling it done.
