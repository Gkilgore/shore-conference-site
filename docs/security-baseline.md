# Security baseline

Checked November 16, 2026 against the **test** Supabase project `jrtcyihpdrcnhxgproyw` and the repository's `origin/main` at `c848b8e`. The published site remains connected to this project, and school bus details remain public by Greg's decision. No live Supabase project was accessed.

## Verified controls

- All 18 `public` tables have row-level security (RLS) enabled. The browser carries a publishable key, never a service-role key. Direct table access is still governed by grants and RLS.
- `public-calendar` is active at version 8 with JWT verification off for public subscriptions. It uses the service-role key only inside the Edge Function to read the approved public projection. A caller still supplies the public API key. A valid school request returned HTTP 200; duplicate, unknown, and oversized query options each returned HTTP 400.
- `transportation-email` is active at version 1 with JWT verification on. An unsigned POST returned HTTP 401. Its application handler also checks a verified staff identity and the game's school.
- The rollback SQL permission suites in `supabase/tests/` ran against the test project without leaving fixtures. They covered anonymous denial, own/cross-school writes, invitation revocation, publication, venues, social accounts, opponents, documents, and tournaments. `conference-documents.sql` and `staff-team-management.sql` have no PASS line but completed without SQL error.
- `node --test tests/*.test.mjs` passed 270 tests on this hardening branch, including the new CDN integrity check.
- The `conference-documents` Storage bucket exists, is public for reading, allows PDF MIME type only, and limits files to 10 MB. Upload/delete RLS policies require conference staff access. The social account table restricts saved URLs to Instagram, Facebook, and X account forms; browser code rechecks them before display.
- The public page code inserts dynamic labels with `textContent` or DOM nodes. The `innerHTML` uses found in site JavaScript are fixed markup, not database strings. The calendar feed has an iCalendar escaping test, and social link tests reject `javascript:` URLs.

## Security Advisor findings

- [Five RLS tables have no direct policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). These are internal publication, audit, and tournament tables deliberately accessed through checked functions; direct client grants are restricted. Keep them in the permission tests.
- [The platform-created `public.rls_auto_enable()` event-trigger function is marked executable by anonymous and signed-in roles](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). A direct anonymous RPC returned HTTP 400 with `cannot display a value of type event_trigger`; this is not evidence of a table-write path. Review its grant with Supabase before changing a platform event trigger.
- [Four signed-in security-definer RPCs are flagged](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): opponent add/import, game link status, and the event trigger. The application RPCs intentionally check staff access. Re-run their permission suites after edits.
- [Leaked-password protection is disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Enable it when password fallback and the required plan are in place.

## Gaps and settings not yet verified

- The test project was missing the repository's `staff_team_removal` migration. Its SQL grants `DELETE` on `teams` to authenticated staff, still bounded by RLS and foreign keys. Applied it to the test project during this audit; `staff-team-management.sql` then completed without error. This did not touch a live project.
- The test project currently has no `school-logos` Storage bucket, logo policies, or branding columns in `schools`, although `20261106000100_school_branding.sql` is in the repository. Logo uploads and saved colors need a separate feature check before relying on them. Do not apply that migration blindly; compare existing school data and code first.
- The connected GitHub tool can read this public repository and reports administrator access, but it cannot inspect or change rulesets. The GitHub CLI has no authenticated session, the API returned HTTP 401 for branch protection, and the browser control host was unavailable. Branch rules, GitHub/Supabase MFA, collaborator access, and GitHub Pages source remain unverified.
- The Supabase connector does not expose Auth redirect URLs, recovery-link expiry, organization MFA, or alert settings. Greg should check these in the respective dashboards; do not put recovery information in the repository.
- A real signed-in AD email delivery test has not been run. The function's provider secrets and sender-domain status could not be inspected through the connected tools.

## Traffic and response checks

The last 24 hours of test-project function request logs showed 241 HTTP 200 responses for `public-calendar` and one HTTP 401 for `transportation-email` (our unsigned smoke test). The maximum recorded calendar execution time was 4,117 ms. There was no evidence in this window to justify a new application rate limit, which could break calendar subscriptions. Review request counts and errors weekly, and revisit limits if traffic or costs rise unexpectedly. Do not log JWTs, email contents, or transportation details.

## Actions that require Greg's account access

1. Enable MFA for GitHub and Supabase administrative accounts, and ask schools to protect their staff sign-in accounts. Confirm recovery methods privately.
2. Set a `main` ruleset after the new GitHub Actions test check first runs: block force pushes/deletion, require the `Node tests` check and a reviewed PR. Arrange an independent reviewer for Greg's own changes.
3. Review GitHub collaborators, Supabase organization members, and site-admin invitations. Remove stale access and test revocation.
4. Check Supabase Auth redirect URLs, email confirmation, recovery-link lifetime, and leaked-password protection when available.
5. Configure alerts for Edge Function errors, Auth abuse, and unexpected usage/cost. The connector used for this audit does not expose alert configuration.

## If an account or deployment is compromised

1. Remove or disable the affected invitation or collaborator access, then revoke sessions where supported.
2. Rotate only the affected credentials, such as the email-provider secret or a leaked Supabase key; never paste replacement secrets into Git or chat.
3. Restore the last reviewed `main` commit or Edge Function version. Verify the deployed site points to the intended test project.
4. Review GitHub, Supabase Auth, database, and function logs for the affected period; preserve an audit record without copying private student or staff data into the repository.
5. Re-run the permission suites, public calendar smoke checks, and staff sign-in before reopening edits.
