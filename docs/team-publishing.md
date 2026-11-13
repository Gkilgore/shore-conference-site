# Team schedule publishing

> **Superseded on November 12, 2026 for the AD workflow.** Saving now posts. The tables and checked functions described here are unchanged and still do the work; `posting-on-save.md` describes how the dashboard uses them.

Agreed workflow: each sport/gender/level schedule is published separately; ADs may select several schedules to review and publish together. CSV files may contain several teams, and several CSV files may be previewed together. Manual saves and imports are drafts. The existing public version stays in place until the AD reviews and publishes changes. Later updates can be published one game at a time or by selected teams.

Schedules are grouped by team and season year. Winter uses the year in which the season starts (December 2026 and January 2027 both belong to Winter 2026–27). Other seasons use the game date's year. This prevents publishing next year's drafts over this year's schedule.

## Data and permissions

`games` and `transportation` remain the AD's working master schedule. `published_games` stores the last approved public values, with the same game IDs; `team_publications` tracks published team/season groups. Both new tables use RLS. Staff cannot write approved copies directly: a checked publishing operation verifies the caller's invitation, school ownership and reviewed state before making changes. Conference-office access remains read-only. The feed service reads a consistent database snapshot of approved data in one request. Private bus confirmation and transportation notes are never copied.

Review returns before/after game details and a token representing the reviewed state. Publishing checks the token and publishes selected teams atomically. If a draft changes during review, publishing fails and a fresh review reloads the latest data. The first publication includes the entire team schedule; later publications may contain one game. Moving a game to another team/year requires reviewing both affected schedules together. Unpublishing hides the approved copies but retains them privately so republishing never resets calendar revisions. Existing school-level publications are copied during migration to preserve what is already public.

The public school calendar, conference matching and ICS feeds read the same approved values. A draft cancellation does not silently change the posted game: the editor explains that it still needs publication. ICS UIDs stay stable. Apps receive published changes on their next refresh.

## Implementation and checks

1. Add snapshot tables, review/publish/withdraw RPCs, publication ownership policies and transactional SQL tests.
2. Change the Edge Function to read snapshots and test that a draft edit cannot change a public response.
3. Replace the school settings switch with team selection/review on Schedule; add Save draft and Save and review publishing in the game editor.
4. Allow multiple CSVs in one preview, preserve file/row context and duplicate checking, and save imported games only as drafts.
5. Verify stale review rejection, cross-school denial, multi-team atomicity, single-game isolation, season-year separation, draft isolation, stable ICS identity and migration preservation in test project `jrtcyihpdrcnhxgproyw`. Keep the live project untouched.

Coach email delivery is not connected. Existing draft coach-email queues must not be treated as approval to send notifications; the separate email feature needs a publication-aware sending step before delivery is enabled.

## Verified in the test project

All 24 Node tests pass. SQL tests verify atomic batches (including a valid first team followed by a stale second team), same-team individual-game isolation, direct snapshot-write denial, cross-school denial, first-publication scope, season years, moving games between teams, unrelated updates while a move is pending, and increasing revisions after withdrawal/republishing. Fixtures roll back. The live project was not accessed.

The deployed test feed preserves Colts Neck's 11 already-published games; Marlboro and Shore Regional remain private. Manual phone/desktop workflow and real calendar-app refresh checks remain follow-up items.
