# Seasonal school pages and staff access

Greg approved these changes on November 6, 2026:

- Use the current NJSIAA 48-school Shore Conference roster, including Ocean Academy. Preserve the three test-school slugs, schedules, branding and existing invitations. All schools use the reusable `school.html?school=...` template; school subdomain handling remains.
- Show season/year publication notices and recent **published** changes on each school page. Identify posted teams so a partial season is not described as complete. Draft saves and private transportation fields never enter public notices. Valid empty calendars can be subscribed to ahead of publication.
- Conference admins (`conference_office` in the database) can add, reassign and revoke AD invitations for any school. They remain read-only for school schedules. Multiple AD accounts may be invited to each school.
- Site admins can also add or revoke multiple conference admins. These tools cannot create or change site admins, or change the signed-in administrator's own access.

## Security and audit

Invitation changes use checked database operations. They verify the signed-in person's current invitation and permissions on every call. Staff cannot write invitation rows directly. Changes require the account version that was reviewed, so an old screen cannot overwrite a newer assignment or revoke a re-added account. Revoking an invitation blocks future database reads/writes even if an older sign-in token has not expired. It does not delete an Auth identity, send an email or recall already viewed information.

An internal audit records access changes. Public updates contain only approved game/season details, never invitation emails or actor details. Update history is written in the same transaction as publication. Withdrawal hides previous game details from public update responses while retaining a safe notice that a team schedule was withdrawn.

School branding is preserved where verified. New schools initially use neutral conference branding; no school marks or colors are invented. The roster source is the [NJSIAA leagues and conferences list, updated July 23, 2026](https://www.njsiaa.org/sites/default/files/documents/2025-10/lc-schools-list-for-web.pdf), page 5.

## Verification

Use only test Supabase project `jrtcyihpdrcnhxgproyw`. Verify 48 unique directory records without duplicate schools; existing games remain unchanged. Test published-update logging, no draft leakage, withdrawn-team privacy, conference-admin AD management, peer/admin privilege restrictions, stale version rejection, revoke/re-add protection, multiple accounts and immediate loss of school permissions after revocation. Use Node built-in tests, rollback SQL fixtures and independent review. Keep the unrelated homepage/CSS edits in the original checkout untouched.

Verified November 6:

- 56 Node tests passed. All 23 browser scripts parsed; HTML IDs and local script paths passed checks.
- All five SQL suites passed on the test project, with fixtures rolled back. Checks include forged identity claims, unconfirmed email, actual game reads/writes after reassignment or revocation, revoked conference managers, approved labels, notes-only changes, stale empty-schedule review and withdrawal/reposting privacy.
- All 48 school JSON feed requests succeeded after deploying public-calendar version 4: two with posted games and 46 valid empty calendars. The database retained 33 working games, 24 approved game copies and two existing invitations.
- Independent security and UI reviews completed; identified issues were fixed and covered by regression tests.
- Phone/desktop visual checks and actual Apple/Google/Outlook subscription refreshes remain manual checks; no successful browser validation was available in this session.

The security advisor's no-policy notices for the two internal history tables are intentional: browsers have no table privileges, and only checked server operations access them. Existing project notices remain for the platform event-trigger function's [execution grants](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this change does not alter the project's Auth settings or platform hook.
