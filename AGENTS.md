# Shore Conference agent instructions

Read [the rebuild plan](docs/rebuild-plan.md) before making changes. Greg and Alexa have agreed on its decisions. Ask Greg before changing them. Explain database and login work in plain language.

## Site and hosting

- Use plain HTML, CSS, and JavaScript. Load FullCalendar and, when needed, Supabase JS through script tags. Do not add React, frameworks, npm packages, or build tools.
- Start on GitHub Pages and move to Hostinger later. Use relative links so pages work under the GitHub repository path.
- Use one school template at `school.html?school=marlboro`. Keep a hostname check for school subdomains on the future custom domain. Do not create a separate HTML file for each school.
- Design for phones first. Keep layouts compact and reuse existing spacing and colors. Use short, practical copy. Keep files small and put a short purpose comment at the top of each site source file.
- Follow [the design guide](docs/design-guide.md) for every page, including staff pages: square corners, full frames, no partial borders or decorative shapes, full-color hovers, and color only where it means something.
- Use Colts Neck, Marlboro, and Shore Regional as test schools. Use fictional game data for the static prototype. The prototype comes before the production sequence in the rebuild plan.

## Schedules and access

- Supabase is the source for production schedule data and logins. Generate team, school, and conference `.ics` subscription feeds with a Supabase Edge Function.
- Use invite-only access with Google sign-in and the invited school email. Follow the plan for fallback sign-in and invite email. Enable row-level security (RLS), the database rules that control who can see or edit each record, on every table.
- Never put the Supabase `service_role` key in any file. Browser code may use the public publishable key. Enforce permissions in Supabase and verify that a test AD cannot edit another school's records.
- Each AD manages their own school's teams, games, transportation, logo, and colors. Show a branding preview and choose readable text colors. Saving or importing a school game posts it to the public schedule; there is no draft step (see [posting on save](docs/posting-on-save.md)). The public sees posted calendars and feeds. Conference office access is read-only for school schedules and includes the list of unmatched games. Greg and Alexa are site admins.
- A member-school game appears once on the conference calendar when two entries agree on sport, gender, level, date, start time, and location. Each school must list the other as opponent and their home/away choices must be opposite. Exclude transportation from matching. Recheck on save or import and remove the conference event if the entries stop matching. If either side postpones or cancels, keep the event and show that status.
- Show ADs why their own entry is unmatched without revealing the other school's entered values. Show school bus times only on the owning school's calendar and school-specific feeds. Preview CSV imports and flag problem rows before saving.
- Conference-owned tournament games are a later exception. Follow the plan for that phase.

## File layout

- `docs/` holds the rebuild plan and project documentation.
- `index.html` is Home, `schools.html` is the school directory, `calendar.html` is the conference calendar, and `resources.html` is Information (the file keeps its old name so links still work): About, History, Divisions, Tournaments and Documents, one left-hand tab each (`resources.html#divisions`). `about.html`, `divisions.html`, `tournaments.html` and `inside.html` only forward to it. `school.html` is the reusable school calendar. Keep the future admin page at `admin.html` with its script at `js/admin.js`.
- `css/site.css` holds shared styles. `js/site.js` builds the school directory and upcoming-game previews. `js/calendar.js` configures FullCalendar and its filters. `js/school.js` and `js/conference.js` prepare each page's games.
- `data/sample-data.js` holds fictional school and game data. `assets/logos/` holds the school marks.
- `data/conference-resources.js` holds facts copied from the official conference site: division lists, school athletics links and tournament sources. `js/team-info.js` shows them on school pages; `js/resources.js` and `js/resource-lists.js` show them on the Information page. Follow [conference resources](docs/conference-resources.md) when updating them. Division lists are checked against `docs/source-archive/division-transcriptions.json` through `division-name-map.json`. A short name that could mean several schools ("Brick") counts as all of them unless the list names one on its own; a combined entry ("RBR/RFH") names both schools.
- `document.html` shows a saved PDF with a download button; `js/document-links.js` sends PDF links there. `data/document-archive.js` lists files added with `tools/import-documents.mjs` from a filled `templates/documents.csv`, and `js/document-archive.js` sorts them into the Archive tab. Follow [documents](docs/documents.md) to add files. The scripts in `tools/` are run by hand and are not a build step.
- Never link to theshoreconference.com; it will go away. Link to saved copies: PDFs in `assets/documents/`, web pages in `data/archived-resources.js`, shown by `archive.html?page=…`.

## Working together

- Alexa and her agent make changes on a branch and open a pull request. Greg reviews and merges into `main`. Treat `main` as the publishing branch once hosting is configured.
- Alexa handles styling, layouts, the AD how-to page, and the CSV template. Greg handles security rules, matching, and calendar feeds.
- Use a separate test Supabase project for development and agents. Only Greg handles the live Supabase project.
- During setup, wait for Greg's explicit go-ahead before the first push. Pause at any review points Greg requests.
