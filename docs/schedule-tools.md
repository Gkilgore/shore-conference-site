# Schedule tools

The staff dashboard opens its editing tools under **Calendar** and its review/import tools under **Schedule**. Schedule includes team publication status, CSV import, draft match checks and tournaments. Unconfirmed buses are under **Transportation**. The Season, Sport, Level and Gender filters also narrow the team schedules shown for publication.

## Save, review and publish

1. Add or edit games and choose **Save draft**, or import one or more CSV files as drafts.
2. Open **Schedule**, select the team schedules that are ready, and choose **Review selected schedules**.
3. Check the games and before/after changes. Choose **Publish selected schedules** to post them together.
4. For a later individual game update, choose **Save and review publishing** in the editor, check the changes, then **Publish this update**. The first publication must review the whole team.

Draft changes never alter a posted calendar. Each sport/gender/level and season year is separate. Moving a game between teams or seasons requires reviewing both schedules. Unpublishing keeps master games saved. Existing ICS links remain valid; apps refresh published updates on their own schedule.

## For Greg to review

`supabase/migrations/20261107000100_schedule_tools.sql` is a draft. Review it before applying it to the test project.

- **Bus confirmed:** adds `transportation.bus_confirmed`, and `save_staff_game` now saves it. For now the AD ticks the box. Letting the coordinator confirm from the transportation email is a later step.
- **Link check:** `game_link_status(school)` gives each game against a member school Linked or Not linked, with a reason such as "Time doesn't match" or "Colts Neck has no matching game on this date". It never returns the other school's values. It runs as the database owner so it can read both schools' games, so it checks the caller's invitation itself instead of using `can_manage_schedule`. That helper depends on row-level security, which an owner-run function skips.
- **Not done yet:** the link check doesn't build the conference calendar or the `conference_links` table. That's still the matching step.

Tests on the test project:

1. As a test AD, call `game_link_status` for your own school. It should return your games.
2. Call it for another school. It should return nothing.
3. Enter a game at both test schools with one field different. The reason should name that field.

## Postponed, canceled and deleted games

A matched game that either school publishes as Postponed or Canceled stays on the conference calendar with that status. Use **Delete game** in the editor only for a game entered by mistake. A deleted game that was already published stays public until the AD reviews and publishes that team; the school page then lists it under Schedule changes as "Game removed".

`supabase/migrations/20261125000100_delete_staff_game.sql` is a draft for Greg. It grants delete on `games` (still limited by the existing row-level security policy) and adds `delete_staff_game(id, revision)`. It has not been run. Check on the test project that a test AD can delete their own draft game, cannot delete another school's, and that a published copy remains until the removal is published. The draft link check (`game_link_status`) was not changed.

## CSV import

Use **Download template** on the Schedule tab. The columns are:

`date, start_time, sport, gender, level, season, home_away, opponent, location, status, bus_departure, pickup_location, return_time, transport_notes, notes`

- **Required:** date, start time, sport, gender, level, home or away, opponent, and location.
- **Dates:** 2026-11-09 or 11/9/2026.
- **Times:** 3:45 PM or 15:45.
- **Season:** if blank, the season comes from the sport.
- **Opponent:** an opponent that matches a conference school's name becomes a linked conference opponent. Any other name is saved as written.
- **Files:** choose up to 20 CSVs, up to 1 MB each and 500 games total. Each file may contain several teams.
- **Preview:** rows are grouped by team with the source file and row number. Missing columns and invalid rows are flagged. Games already saved, or repeated across selected files, are skipped. Ready rows save only as drafts; publication is a separate review step.

## Venues

Each school keeps a venue list under **School settings**. In the game editor, Venue is a dropdown:

- **Home game:** the school's own venues.
- **Away game against a conference school:** that school's venues. The list switches when the opponent changes.
- **Away game against anyone else:** a typed venue.

"Other venue…" is always there for one-off locations. Picking from the home school's list keeps both schools' locations spelled the same, which the match check needs.

`supabase/migrations/20261109000100_school_venues.sql` is a draft for Greg:

- **Who can read and change lists:** anyone can read every school's list (venue names are already public on the calendars). Only the school's AD and site admins can change it.
- **What games store:** games still store the venue name as text, so renaming or deleting a venue doesn't change saved games.
- **Before the migration is applied:** the dropdowns use the sample venues in `data/sample-data.js`.

## Sample games for testing

`data/sample-data.js` holds the prototype's sample games in the same shape an AD saves: home or away, season, game notes, bus departure, pickup, return time, and bus confirmed. Dates count from today. The games cover:

- games that link to the conference calendar
- games that don't link: a different time, a different location, or the other school never entered it
- postponed and canceled games
- games against schools outside the conference
- buses that are confirmed, not confirmed, or not entered
- a busy day, a past game, and a winter game

To give each test AD games to edit on the dashboard, load the same games into the **test** Supabase project:

1. Open the test project's SQL editor (never the live project).
2. Run `supabase/seed/sample-games.sql`. It deletes the three test schools' games and sample coaches, then loads the sample games, buses, coaches, and a few waiting coach emails.
3. Run it again whenever you want a fresh set. Dates move forward with the day you run it.

It works whether or not the newer draft migrations are applied. Bus confirmation, coaches, and the email outbox load only if their tables exist.
