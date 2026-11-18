# Schedule tools

**Calendar** shows the school's games by date; clicking one shows its details, with **Edit game** for ADs, and clicking an empty day adds a game on that date. **Schedule** is where ADs pick a team, see its games in a table, and add, edit or import games; games that don't match the other school's entry are flagged on their row. The game editor opens as a pop-up over either tab. The game editor offers sports from the school's team list, then limits gender and level to listed teams; it fills in the team's season automatically. Start time can be marked **TBD** until it is announced. **Transportation** lists upcoming away games with a bus departure and lets an AD save the transportation contact. Saving a scheduled game with a bus departure sends the details to that contact and copies the AD. No transportation confirmation is required; bus confirmation does not determine the game's Scheduled, Postponed or Canceled status.

## Saved schools

The game editor searches Shore Conference schools, the current school's private saved schools, and NJSIAA schools. ADs can add a school while entering a game, or add, rename, and delete it in **Saved schools**. Another school's AD cannot see that saved school. Games already saved keep its name after deletion. See [opponent search and saved schools](opponents-njsiaa.md).

Schools outside the conference can use the platform after a site admin assigns their first AD from the directory in **Staff access**. Only schools with an AD invitation can match games. Nonconference matches stay on the participating schools' schedules; only matched member-school games appear on the conference calendar.

Applied `20261206000100_private_opponents.sql` to test project `jrtcyihpdrcnhxgproyw` on November 17, 2026. Its SQL permission test passed and rolled back. The migration loads 452 NJSIAA schools with addresses and gives each school its own saved rows. Greg handles the live project.

The earlier directory migration and public-calendar feed checks are documented in Git history.

## Saving and posting

Saving or importing a game posts it immediately when the team can be safely published; there is no draft or separate Publish step. Games from schedules that were previously taken down remain private until an AD posts that team again. Deleting a game removes its public copy. Calendar apps refresh updates on their own schedule.

## Link check

`game_link_status(school)` checks games against a school with active AD access and reports Linked or Not linked, with a reason such as "Time doesn't match" or "Colts Neck has no matching game on this date". It never returns the other school's values. A matched nonconference game is school-only; it does not enter the conference calendar. The function runs as the database owner so it can read both schools' games, so it checks the caller's invitation itself instead of using `can_manage_schedule`. That helper depends on row-level security, which an owner-run function skips.

Tests on the test project:

1. As a test AD, call `game_link_status` for your own school. It should return your games.
2. Call it for another school. It should return nothing.
3. Enter a game at both test schools with one field different. The reason should name that field.

## Postponed, canceled and deleted games

A matched game that either school publishes as Postponed or Canceled stays on the conference calendar with that status. Use **Delete game** in the editor only for a game entered by mistake. A deleted game that was already published stays public until the AD reviews and publishes that team; the school page then lists it under Schedule changes as "Game removed".

`supabase/migrations/20261125000100_delete_staff_game.sql` is a draft for Greg. It grants delete on `games` (still limited by the existing row-level security policy) and adds `delete_staff_game(id, revision)`. It has not been run. Check on the test project that a test AD can delete their own draft game, cannot delete another school's, and that a published copy remains until the removal is published. The draft link check (`game_link_status`) was not changed.

## CSV import

Use **Import games** on the Schedule tab, then **Download template**. The columns are:

`date, start_time, sport, gender, level, season, home_away, opponent, location, status, bus_departure, pickup_location, early_dismissal_time, return_time, transport_notes, notes`

Early Dismissal is optional, can be entered in the game editor or CSV, and appears in the AD's List and Day tables. When entered, it also appears on that school's public calendar and school-specific feed, but not on the conference calendar or another school's calendar. Return time remains available in the game editor and CSV.

Applied `20261130000100_early_dismissal.sql` to test project `jrtcyihpdrcnhxgproyw` on November 15, 2026 and confirmed the optional time field exists. Applied `20261113000100_game_time_tbd.sql` the same day and confirmed game start times can be left unknown. Greg handles the live project.

- **Required:** date, sport, gender, level, home or away, opponent, and location. Use `TBD` for a start time that has not been announced.
- **Dates:** 2026-11-09 or 11/9/2026.
- **Times:** 3:45 PM or 15:45; use `TBD` when the start time is unknown.
- **Season:** if blank, the season comes from the sport.
- **Opponent:** a name matching a school in the AD's list keeps that directory identity. A typed, unlisted name is saved as entered. A match requires active AD access for both schools; only conference-member matches can appear on the conference calendar.
- **Files:** choose up to 20 CSVs, up to 1 MB each and 500 games total. Each file may contain several teams.
- **Preview:** rows are grouped by team with the source file and row number. Missing columns and invalid rows are flagged. Games already saved, or repeated across selected files, are skipped. Saving a ready row posts it immediately.

## Venues

Each school keeps a venue list under **School settings**. In the game editor, Venue is a dropdown:

- **Home game:** the school's own venues.
- **Away game against a conference school:** that school's venues. The list switches when the opponent changes.
- **Away game against anyone else:** a typed venue.

"Other venue…" is always there for one-off locations. Picking from the home school's list keeps both schools' locations spelled the same, which the match check needs.

`supabase/migrations/20261109000100_school_venues.sql` was applied to test project `jrtcyihpdrcnhxgproyw` on November 12, 2026:

- **Who can read and change lists:** anyone can read every school's list (venue names are already public on the calendars). Only the school's AD and site admins can change it.
- **What games store:** games still store the venue name as text, so renaming or deleting a venue doesn't change saved games.
- **Venue management is enabled:** refresh the AD dashboard and open School settings, then Venues. ADs can add a name and optional address, edit either field and choose Save, or choose Delete and confirm. Eight initial venue entries were installed for the three pilot schools. The production database was not touched.
- **Verification:** `supabase/tests/school-venues.sql` returned PASS for own-school add/edit/delete, duplicate-name rejection, rejection of other-school insert/edit/delete/reassignment, read-only conference-office access, and public reading without anonymous writing. The test rolled back; a separate check confirmed no test accounts or venue fixtures remained. Database access rules are enabled. The authenticated browser journey has not been exercised with a real AD login.

## Sample games for testing

`data/sample-data.js` holds the prototype's public sample games: home or away, season, game notes, bus departure, pickup, and return time. It contains no early-dismissal times; those appear on public schedules only when an AD enters one. Dates count from today. The games cover:

- games that link to the conference calendar
- games that don't link: a different time, a different location, or the other school never entered it
- postponed and canceled games
- games against schools outside the conference
- scheduled buses and games with no bus entered
- a busy day, a past game, and a winter game

To give each test AD games to edit on the dashboard, load the same games into the **test** Supabase project:

1. Open the test project's SQL editor (never the live project).
2. Run `supabase/seed/sample-games.sql`. It deletes the three test schools' games and sample coaches, then loads the sample games, buses, coaches, and a few waiting coach emails.
3. Run it again whenever you want a fresh set. Dates move forward with the day you run it.

It works whether or not the newer draft migrations are applied. Coaches and the email outbox load only if their tables exist.

`supabase/migrations/20261126000100_tournament_info.sql` is also a draft for Greg. It lets a tournament keep its "Rules and dates" section (see `docs/tournaments-design.md`). Run it in the test project, then save a tournament with a rules link and one unconfirmed date, review it, publish it, and confirm the public tournament page shows the link and no unconfirmed date. Confirm a tournament saved before the migration does not show as changed.

Since November 12, saving or importing posts the game; see `posting-on-save.md`. Anything above that mentions drafts or publishing describes the earlier workflow.

**Database steps completed November 12 in test project `jrtcyihpdrcnhxgproyw`:** `20261125000100_delete_staff_game.sql`, then `20261127000100_post_on_save.sql`, then `supabase/tests/post-on-save.sql` (PASS, rolled back). See `posting-on-save.md` for compatibility changes and verification limits. Earlier draft instructions above describe the previous workflow.

## Moved games

When a game marked Postponed is later posted at a different date or time, the website leaves a white **Moved** note on the old date ("To Dec 3, 4:00 PM"); clicking it jumps to the new date. The game at its new date gets an asterisk after its time and an **Originally** line in its details. A date fixed without first marking the game Postponed leaves no note. Subscribed calendars do not get the note: their event simply moves, and its description says where it was. On the conference calendar the note appears once both schools have entered the new date.

`supabase/migrations/20261204000100_moved_game_notes.sql` adds the list of moved games to `read_published_schedule`, using only each team's current publication, so withdrawn schedules stay hidden. It has not been applied to any Supabase project. Apply it to the test project, then redeploy `public-calendar`; until then the site works as before, without notes.
