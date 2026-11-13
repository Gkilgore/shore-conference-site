# Coach emails

> **Tabled on November 12, 2026.** The Coaches tab is hidden and coach emails are off. See `posting-on-save.md`.

ADs manage their coach list on the dashboard's **Coaches** tab. Each coach has an email, an optional name, and one or more teams (sport, gender, and level). A coach can be on several teams, and a team can have several coaches.

## What gets queued

The database queues an email in `coach_email_outbox` for every coach on the game's team when:

- a game is added (**New game**)
- the date, time, location, home or away, opponent, team, or status changes (**Changed**, **Postponed**, or **Canceled**)
- an AD invites a coach (**Invite**)

Games added in one CSV import share a batch, so each coach gets one **Import summary** instead of one email per game. Notes-only edits don't queue anything.

The queuing happens in a database trigger, so it works however a game is saved. ADs can see and preview the waiting emails in the outbox on the Coaches tab.

## ⚠ Come back to this when Resend is set up

**Nothing is sent yet.** Emails stay queued until sending is built. When Resend is connected for the transportation emails (`docs/transportation-email.md`), finish coach emails with the same setup:

1. Add a Supabase Edge Function that runs on a schedule (every few minutes). It reads queued outbox rows, groups rows that share a `batch_id` and coach into one summary, sends through Resend, and sets `status` to `sent` or `failed` with `sent_at`.
2. Move the email wording from `compose()` in `js/staff-coaches.js` into the function so the preview and the real email match.
3. Collapse several quick edits to the same game for the same coach into one email, using the latest game details.
4. Test with approved inboxes only. Check that a coach never receives another school's games and that a retry doesn't send twice.
5. Add an unsubscribe or contact line if the school asks for one.

## For Greg to review

`supabase/migrations/20261108000100_coach_emails.sql` is a draft.

- **Access:** the coach tables use `can_manage_schedule`, so only the school's AD and site admins can see coach emails. The conference office can't.
- **The queuing trigger:** it runs as the owner so it can write the outbox, and it only copies the game being saved.
- **ADs can queue invites only:** they can insert invite rows themselves, but not game emails.
- **`save_staff_game`** is redefined again to pass the import batch. It includes the bus-confirmed change from `20261107000100`, so apply both in order.
