# Posting on save

Greg's November 12 decision: for school schedules, saving a game or completing an import posts it to the public schedule. There is no Publish tab and no draft step. This replaces "Review before publishing" in the rebuild plan for AD-managed games. Tournament games keep their own review and publish steps.

Status: live on `main` since November 12 (dashboard side). The delete and posting-on-save migrations were applied to test project `jrtcyihpdrcnhxgproyw` on November 12, 2026. The database rollback test passed. The production database was not touched.

## What an AD sees

- **Save game** in the editor. After it: "Game posted."
- **Import and post N games** at the end of an import, after the same preview and row checks as before.
- **Delete game** also takes the game off the public schedule.
- Postponed and Canceled are saved the same way and show that status publicly.
- The old Publish tab is now **Match checks**: the totals and the list of games that don't match the other school's entry.
- Teams keeps two deliberate, reviewed actions: **Post schedule** (for a team that is held back, see below) and **Take down…**.

## How it works

The database is unchanged. It still keeps a working copy of each game (`games`) and a public copy (`published_games`), and the public pages, conference matching and calendar feeds still read only the public copy. What changed is the browser: right after `save_staff_game` or `delete_staff_game` succeeds, it calls the existing `review_schedule_publication` and `publish_schedule_changes` to copy that game across.

So every existing server rule still applies without change: an AD can post only their own school, the reviewed token stops one save overwriting another, game IDs and calendar subscription addresses stay the same, revisions only go up, and matching decides what reaches the conference calendar.

Posting is a second request after the save. If it fails, the game is saved but not public. The page says so ("Game saved, but it didn't post"), shows the game as Not posted, and Teams offers Post schedule to try again. Nothing is reported as posted until the server confirms it. If someone else saves in between, posting reads the schedule again and tries once more.

## Games that were private before this change

Before this change a school could hold private games: whole teams never published, and edits to published teams that were never published. Deploying this change does **not** make any of them public. They stay exactly as they are until an AD acts.

| Existing record | After deploying | What makes it public |
| --- | --- | --- |
| Published game, no pending edit | Still public, unchanged | Nothing needed |
| Published game with a private edit | Public still shows the old version | The AD saves that game again, or uses Post schedule on its team |
| Game in a team that was never published | Still private | Post schedule on that team, after reviewing the list |
| Deleted game whose removal was never published | Still public | Post schedule on that team |
| Team that was unpublished (taken down) | Still private | Post schedule on that team |

The dashboard counts these on Schedule and Games ("13 games aren't on the public schedule") and marks them Not posted in Teams.

**The holding rule.** When an AD saves a game in a team that still has other private games, the server can only post a first-time team as a whole. Posting it would expose the older private games, so the page saves the game, posts nothing for that team, and says: "Game saved, but not posted. [Team] has other games that aren't public. Open Teams and choose Post schedule to post them together." Post schedule shows every game that will become public before anything is posted. An import does the same per team: teams with nothing else private are posted, the others are held and named.

Once a team has been posted this way it has no private games left, and every later save posts on its own.

### Reconciliation before rollout

1. In the Supabase project, list what is private today: teams with no `team_publications` row, and games whose working copy differs from `published_games`. `review_schedule_publication` returns both per school (`published_at` null, or `pending_count` above zero).
2. Decide per school: have the AD post each held team from Teams, or delete what was only ever a test.
3. Only the three pilot schools have games, so this is a short list.

## Database step (Greg, with ChatGPT)

`supabase/migrations/20261127000100_post_on_save.sql` makes the database post inside `save_staff_game` and `delete_staff_game`. Eligible saves and deletes update the public copy in the same transaction; taken-down teams remain held. Applied to the test project in this order:

1. `20261125000100_delete_staff_game.sql` (delete was waiting on this already).
2. `20261127000100_post_on_save.sql`.
3. `supabase/tests/post-on-save.sql`. It should end with a PASS line and roll back.

What it changes once run:

- A save into a team that was never posted posts that team with just the saved game. Its other private games stay private, so the holding rule above mostly goes away.
- A save into a team that was taken down is still held: posting it would bring back the team's earlier public games.
- Deleting removes the public copy in the same step.
- The coach email queue is switched off (`games_queue_coach_emails` trigger disabled). The migration has the line to switch it back on.

The dashboard's own posting step stays as a fallback. After the migration it finds nothing left to post and sends nothing.

### Database verification, November 12

The test project did not have the older optional schedule-tools or coach-email setup. Before applying, the posting migration was adjusted to add the legacy `transportation.bus_confirmed` column if missing and disable the coach trigger only if installed. The legacy column is no longer used by the dashboard. The test checks the email outbox only when it exists. No coach tables or email features were installed.

`supabase/tests/post-on-save.sql` returned PASS for immediate posting and edits, increasing public revisions, stale-save rejection, private-game isolation, taken-down-team protection, deletion, and cross-school refusal. The transaction rolled back; a separate check found no fixture accounts or teams. All public tables retain row-level security.

The security advisor still reports the documented platform `rls_auto_enable` execution grants ([anonymous](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [signed-in](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)), [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), and informational notices for internal tables with RLS and no direct-access policies. No finding named the new posting helper.

This verifies the database operations, not the complete signed-in browser journey through the public school page, conference calendar, or a calendar subscription. Those end-to-end checks remain outstanding.

## Public "Schedule changes"

Every save now reaches the public change list. To keep a typo fix from showing as a second change, the school page merges changes to the same game made within 12 hours into one entry showing where it started and where it ended up. Changes that cancel out, and a game added and deleted again, are dropped. The stored history is unchanged; this is only how the page shows it.

## Coaches

Tabled for now (Greg, November 12). The Coaches tab and the Coaches section in Teams are hidden, nothing loads coach lists, and no coach is emailed. The coach code and tables are untouched.
