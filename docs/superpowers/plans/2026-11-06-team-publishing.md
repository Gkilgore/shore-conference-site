# Team schedule publishing implementation plan

**Goal:** Save drafts, review by team and publish selected schedules or individual updates without changing posted schedules prematurely.

**Spec:** `docs/team-publishing.md`; approved in conversation. Plain HTML/CSS/JS, no packages, test Supabase project only.

- [x] Add default-private published snapshots and per-team/season publication records with RLS. Preserved Colts Neck's 11 already-published games with the same IDs and revisions.
- [x] Implement review tokens, atomic multi-team publishing and single-game update publishing; rollback SQL tests pass for fresh/stale batches, same-team single-game isolation, moved games, republishing revisions, own/cross-school permissions and anonymous denial.
- [x] Read only approved snapshots in public JSON/ICS feeds using one consistent database projection. Deployed test endpoint verified; Colts Neck remains visible, Marlboro remains private, and private transport fields stay excluded.
- [x] Add Schedule publication controls, before/after review dialog, pending labels and editor Save draft / Save and review actions. Controller regressions cover stale-review recovery and late responses after school reset.
- [x] Support multiple CSV files with combined preview, source row context and duplicate checks; imports remain drafts.
- [x] Run 24 Node tests, both SQL test scripts, all browser JavaScript syntax checks, admin markup checks, diff checks and independent review. Applied only test-project migrations and Edge Function version 3. No Important review findings remain.
- [ ] Manual follow-up: 390px/desktop checks of the authenticated workflow, multi-file chooser, and real Apple/Google/Outlook refresh checks. Browser automation was unavailable; no visual or actual-app success is claimed.
