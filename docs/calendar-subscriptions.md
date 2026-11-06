# Calendar subscriptions

Families choose a school, a team (sport, gender and level), or the conference. “Subscribe for updates” opens an app chooser with Apple Calendar, Google Calendar, and a copyable URL for Outlook or other apps. A separate download is labeled as a one-time copy. Subscriptions include every date, not just the displayed month.

Each school must enable **Publish schedule** in School settings first. It is off by default. Once enabled, saved games and later AD edits are public. Turning it off returns an empty subscribed calendar; it cannot recall copies already downloaded. Conference games require both schools to be published and their active entries to match every field in the rebuild plan. Transportation appears only in the owning school's feeds. Coach information, contact emails, transportation notes and bus confirmation stay private.

## Implementation

- Plain HTML/CSS/JavaScript, no installed dependencies or build step.
- A public, read-only `public-calendar` Supabase Edge Function serves live JSON for the public pages and RFC 5545 `.ics` feeds for calendar apps. Calendar apps cannot supply staff login headers. This endpoint intentionally accepts unauthenticated GET requests; staff writes still require their existing login and database rules.
- Server credentials come only from Supabase's built-in environment. No credential values belong in files. Database tables keep their existing staff-only read rules; the endpoint selects and returns only approved public fields and checks publication on every request.
- Stable game UIDs and revision numbers preserve identity when date, time, opponent or status changes. Canceled school games use `STATUS:CANCELLED`; postponed games are labeled and tentative. Conference matching is rechecked on every read. Events removed from the returned conference calendar disappear when a subscriber refreshes the complete feed.
- Times use America/New_York with daylight-saving rules. End times are unspecified because ADs do not enter them. Text is escaped and folded by UTF-8 byte length.
- Updates arrive at the calendar provider's next refresh, not as immediate push notifications. Google requires adding a URL in its web calendar. Do not promise a refresh interval.

## Deployment and verification

Use only test project `jrtcyihpdrcnhxgproyw`. Apply the publication migration, verify an AD can change only their school's publication flag, deploy `public-calendar` with JWT verification off, then enable the three test schools through School settings to test. Do not enable schools in SQL by default. Never deploy to the live project from an agent session.

Run `node --test tests/*.test.mjs` locally. Test on the actual service before publishing the frontend: an unpublished school returns zero games; a published school's feed changes after editing a saved game without changing its UID; cancellation preserves UID; unpublishing empties the feed; conference responses contain no transportation. Add a test subscription in Apple, Google and Outlook and confirm the next refresh applies edits without duplicates. Phone (390px) and desktop visual checks are required.

Connector access is currently denied in this chat. Deployment, database permission checks and real calendar-app refresh checks remain pending until access is restored.

For a local fictional-data preview, run `node tests/preview-server.mjs` and open `http://127.0.0.1:8001/subscribe.html?school=marlboro`. This server never contacts Supabase and deliberately leaves Shore Regional unpublished to exercise the private-school state. Its localhost subscription links are for layout checks only; phone and Google servers cannot subscribe to localhost.

Sources: [iCalendar RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), [Google: add a public calendar from URL](https://support.google.com/calendar/answer/37100), [Supabase Edge Function authentication](https://supabase.com/docs/guides/functions/auth).
