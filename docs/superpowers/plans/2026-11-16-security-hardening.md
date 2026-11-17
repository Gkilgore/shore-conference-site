# Security Hardening Implementation Plan

> **For agentic workers:** Implement this plan task by task. Keep the confirmed public bus details and test-project connection. Use the test Supabase project for development; only Greg changes the live project.

**Goal:** Reduce the chance that an attacker or compromised account can alter schedules, publish malicious content, or disrupt the public site, while preserving the agreed pilot behavior.

**Architecture:** Keep the static HTML/CSS/JS site and Supabase access model. Add controls at the account, GitHub, browser, and Supabase boundaries. Prepare a separate production project only as a future cutover; the published site stays connected to the test project now.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node's built-in test runner, GitHub Pages, Supabase Auth/Database/Edge Functions/Storage. No npm packages or build step.

**Spec:** `docs/rebuild-plan.md` sections 2, 6, 7, and 9; `docs/transportation-email.md`; the November 16 security review with Greg.

## Global constraints

- RLS stays enabled on every table. No `service_role` key in browser code or the repository.
- Greg and Alexa review changes on a branch; `main` is the publishing branch.
- Greg confirmed that the published site stays on test project `jrtcyihpdrcnhxgproyw` for now. Do not redirect it as part of this plan.
- Greg confirmed that bus times and early dismissal stay public in school calendars and subscription feeds. Do not change their visibility as part of this plan.
- Use Colts Neck, Marlboro, and Shore Regional for access and display tests. Only Greg handles the live Supabase project.

## Review focus

- An anonymous visitor must not write a school record or invoke the staff email function successfully.
- A signed-in Marlboro AD must not read or change Colts Neck private data, including by calling the REST API directly.
- Revoking an invitation must block later database writes even if the old browser session still holds a token.
- A saved social URL or game note must not execute script on a public page.
- A failed CDN load, restrictive browser policy, or failed Supabase request must leave a usable page and clear error state.

---

### Task 1: Record a security baseline

**Owner:** Greg/Codex. **Files:** Create `docs/security-baseline.md`; reference the existing SQL permission tests in `supabase/tests/`.

- [ ] Inventory the project ID used by `js/supabase-config.js`, the deployed Edge Function versions and JWT settings, Auth redirect URLs, Storage bucket limits, and GitHub Pages source. Record no secrets or private account data.
- [ ] Run Supabase Security Advisor against the test project. Record each finding as actionable, intentional, or needing investigation. The five RLS-without-policy tables are intentionally accessed through checked functions; the platform `rls_auto_enable()` event trigger warning needs a targeted privilege review, not an assumption that it permits table edits.
- [ ] Run the existing rollback permission suites in `supabase/tests/` and the Node tests. Add a targeted permission test only for a gap found in this baseline.
- [ ] Verify that an anonymous request cannot write schedules and a test AD cannot write another school's data. Keep the test fixtures rolled back.
- [ ] Check GitHub branch rules and account MFA settings with Greg. Record enabled/disabled state without publishing recovery details.

**Done when:** The baseline says exactly which controls are active in the test project and repository, with dates and test results. No configuration changes in this task.

### Task 2: Protect accounts and the publishing branch

**Owner:** Greg for account settings and branch rules; Codex for CI. **Files:** Create `.github/workflows/tests.yml`; update `docs/security-baseline.md`.

- [ ] Add a GitHub Actions workflow that runs `node --test tests/*.test.mjs` on pull requests and pushes to `main`, without npm or a build step. Verify the workflow passes on a branch.
- [ ] Set a `main` ruleset to block force pushes and deletion and require the passing test check. Require pull-request review under an arrangement that lets Greg's own changes receive an independent review; document who reviews them.
- [ ] Enable MFA on the GitHub and Supabase accounts with publishing/administrative access, and on staff identity-provider accounts where the school supports it. Verify account recovery methods without storing them in the repo.
- [ ] Review who has GitHub write access, Supabase organization access, and site-admin invitations. Remove stale access with Greg's approval and verify a removed test invitation cannot write.
- [ ] For password fallback, confirm email verification and short-lived recovery links. If on Supabase Pro, enable leaked-password protection; otherwise record it as a rollout requirement.

**Done when:** A test PR cannot merge with failing checks or insufficient review, administrators have MFA, and stale staff access has been resolved.

### Task 3: Reduce browser script risk

**Owner:** Codex; Greg reviews. **Files:** `admin.html`, `calendar.html`, `school.html`, any other page loading jsDelivr; `js/social.js`; add a focused static check in `tests/`.

- [ ] Inventory every outside script and its required origins. Keep the existing pinned FullCalendar and Supabase JS versions; keep the Instagram embed behavior.
- [ ] Add SHA-384 Subresource Integrity and `crossorigin="anonymous"` to fixed jsDelivr script tags. Add a test that fails when a fixed outside script lacks integrity. Test that the pages still load when the CDN is available and fail visibly when it is blocked.
- [ ] Draft a Content Security Policy covering the actual Supabase, fonts, maps, and Instagram requests. Test it against Home, school, calendar, staff sign-in, document view, and the Instagram fallback at phone and desktop widths. On GitHub Pages, use a tested meta policy if headers are unavailable; on Hostinger, prefer an HTTP response header and report-only rollout before enforcement.
- [ ] Recheck that public database text uses `textContent` or equivalent safe DOM creation and that saved social URLs are restricted to approved HTTPS hosts. Add a regression test for a script-shaped name/note and an invalid URL if a gap is found.

**Done when:** Fixed CDN scripts are integrity checked, the tested policy does not break key flows, and malicious text stays text.

### Task 4: Keep the public schedule boundary clear

**Owner:** Codex; Greg reviews. **Files:** Public schedule tests, staff help copy, `docs/calendar-subscriptions.md` if clarification is needed.

- [ ] Verify with fictional data that anonymous school JSON and `.ics` responses include only the intended public bus departure, pickup, return, early dismissal, and game-note fields. Verify conference feeds do not include school bus details.
- [ ] Add concise staff guidance beside the notes and transportation fields: school calendar visitors and subscribers can see these details, so staff should enter only information suitable for public viewing.
- [ ] Run the public schedule and calendar subscription tests. Confirm existing calendar subscriptions still receive the same bus fields.

**Done when:** The public data boundary matches Greg's confirmed choice, staff understand it, and existing subscriptions are unchanged.

### Task 5: Control abuse and observe failures

**Owner:** Greg/Codex. **Files:** `supabase/functions/public-calendar/handler.mjs`, `supabase/functions/transportation-email/handler.mjs`, their tests, `docs/security-baseline.md` only where a measured gap requires changes.

- [ ] Review 24-hour and weekly request/error trends for the public calendar and transportation email function. Avoid logging JWTs, email contents, or transportation details.
- [ ] Test oversized, duplicated, malformed, and high-cardinality calendar parameters; confirm fast 400 responses and no private data. Confirm unauthenticated transportation requests get 401 and cross-school requests get 403.
- [ ] Decide a practical request limit from observed traffic, using hosting or edge controls if needed. Keep public subscriptions usable for calendar clients. For email, retain the existing idempotency key and add a per-account send cap only if testing or logs show a credible abuse path.
- [ ] Set alerts for function error spikes, Auth abuse, and unexpected database costs or request volume. Write a short incident checklist: disable a compromised invitation, rotate affected secrets, restore a known-good deployment, and check audit logs.

**Done when:** Greg can see abnormal traffic and the tested limits do not block ordinary calendar clients.

### Task 6: Prepare a later production cutover

**Owner:** Greg for any future live project and cutover; Codex may prepare a runbook in test. **Files:** `docs/security-baseline.md` and future deployment/cutover notes. Leave `js/supabase-config.js` unchanged now.

- [ ] Keep the published site's current test-project URL and publishable key unchanged throughout Tasks 1–5.
- [ ] When Greg later requests a separate production project, inventory every migration, Storage bucket, Auth provider/redirect setting, Edge Function, secret name, and public document. Prepare a reviewed production checklist with no secret values.
- [ ] At that later cutover, Greg configures the live project and applies reviewed migrations in order. Verify RLS, direct API denials, public calendars, school branding, documents, social links, and staff login using test accounts.
- [ ] Only during that later cutover, change the browser's public project URL and publishable key in a reviewed PR, verify the deployed target, and keep a tested rollback route. Never copy test secrets or real data into an agent workspace.

**Done for now when:** The current project connection has been verified and documented. The cutover steps remain deferred until Greg requests them.

## Order and review gates

1. Do Tasks 1 and 2 first. Task 3 can proceed after the baseline.
2. Task 4 verifies and explains Greg's choice to keep school bus details public.
3. Task 5 follows measured traffic and the Task 1 permission baseline.
4. Task 6 stops after documenting the current connection; a production cutover waits for Greg's later request and is Greg-only for live Supabase changes.
5. Before any merge, run `node --test tests/*.test.mjs`, the relevant rollback SQL tests, a test AD cross-school check, and a phone/desktop smoke check. Review the diff for secrets and unintended configuration changes.

## Execution status (November 16, 2026)

- **Task 1:** Recorded verified test-project RLS, functions, Storage, SQL permission checks, Security Advisor findings, and unresolved account settings in `docs/security-baseline.md`. Applied the already committed `staff_team_removal` grant missing from the test project; its rollback test then completed without error.
- **Task 2:** Added `.github/workflows/tests.yml` with read-only permissions and SHA-pinned GitHub actions. The job needs a pushed branch/PR before GitHub can run it. GitHub rulesets, account MFA, and collaborator review require authenticated account controls unavailable to this session.
- **Task 3:** Added and tested SRI for fixed CDN scripts. Drafted a CSP rollout and browser checks in `docs/browser-security.md`. Do not enforce CSP until the browser and Instagram flows can be inspected; the browser-control host was unavailable.
- **Task 4:** Verified existing feed and social-link tests; added clear public-data guidance to the staff game editor. Bus fields remain public and the browser still points to the test project.
- **Task 5:** Checked recent function request counts and live malformed-query responses. No new rate limit is warranted by this small sample. Added an incident checklist; alert settings remain for Greg's dashboard.
- **Task 6:** The current test-project connection is unchanged. Production cutover stays deferred by Greg's decision.
