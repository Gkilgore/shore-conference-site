# Posting on save

Greg's November 12 decision: for school schedules, saving a game or completing an import posts it to the public schedule. There is no Publish tab and no draft step. This replaces "Review before publishing" in the rebuild plan for AD-managed games. Tournament games keep their own review and publish steps.

Status: built on branch `feature/post-on-save`, checked with fictional data only. Not merged, not run against the Supabase project.

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

## Still to decide

1. **Make it one step on the server.** A database change could post inside `save_staff_game` itself, so a save can never succeed without posting and a first-time team would not need the holding rule. It needs a migration, written and tested in the test project. Until then the browser does it in two requests.
2. **Run `20261125000100_delete_staff_game.sql`.** Deleting still depends on it.
3. **Coach emails.** The email queue was built around drafts. Sending is not connected; when it is, it should send on posting.
4. **Recent changes on school pages.** Every save now creates a public change entry. A typo fix will show as a schedule change.
