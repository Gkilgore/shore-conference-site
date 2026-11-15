# Automatic Instagram gallery: working design

Greg approved exploring a Meta-connected automatic gallery and temporary post metadata on November 15, 2026. This design is for the test project. The existing live prototype stays available while the new connection is developed.

## Experience

- Home shows individual recent posts from connected school and team accounts, newest first. Each card identifies its school and team and links to the original post. School pages show only their school's accounts. Videos and albums need a clear link or supported preview; do not imply an unavailable image is a post.
- ADs can manage multiple team accounts for their own school; conference and site admins can manage any school's accounts. An account owner connects each account through Meta. Show connection, last successful refresh, reconnect and disconnect states; removing access must remove the account's posts from public results.
- Keep Facebook and X as links until a separate integration is approved. Remove the current detached “View on the platform” presentation when the gallery replaces it.

## Staff help copy (draft; confirm against the actual Meta flow)

### Connect a team Instagram account

1. Choose your school and enter the team name, such as Boys Soccer or Football.
2. The person who manages the team's Instagram account should check that it is a public **professional** account (Business or Creator). Personal accounts cannot use this connection.
3. Choose **Connect Instagram**. Sign in to the team's account and follow Instagram's prompts to allow the conference site to read its profile and posts. Never send your Instagram password to the conference or enter it on this site.
4. Return here and check that the account and team name are correct. Once connected, new posts can appear automatically on your school page and Around the Shore.
5. Add another team the same way. If the screen says **Reconnect**, ask the account manager to connect again. Choose **Disconnect** to remove an account from the gallery.

The exact prompts and supported account types must be tested with a real Meta test app before this guide is presented as finished. Some team accounts may require a manager other than the AD to complete Instagram's sign-in.

## Implementation and verification

- Register and configure a Meta test app under the appropriate conference-owned Meta account. Verify the current Instagram Login permissions, callback and refresh flows, app-review requirements and Meta's display, retention and deletion rules before implementing storage. An account owner must authorize their own account. Production access may require Meta approval. Do not claim that a profile URL alone connects an account.
- Use server-side functions for the authorization exchange and scheduled synchronization. Protect tokens in server-only storage; never put them in browser code, logs or the repository. Bind authorization state to the signed-in staff member and authorized school, expire it, and prevent replay and cross-school attachment. Recheck access at callback and disconnect.
- Store the minimum permitted post identifiers, timestamps, links and display metadata for a limited period determined after reviewing Meta's rules. Never expose tokens. Purge disconnected, deleted or inaccessible content; avoid stale results and surface refresh failures to staff. Limit public data to posts deliberately connected for display.
- Preserve existing social links during migration. Enable row-level security on every new table. Use the test project only. Test anonymous read-only access, cross-school denials, admin access, connection ownership, expired/replayed state, token secrecy, refresh failures, disconnect and deletion. Run the existing Node suite and test public gallery ordering, school filtering and accessibility using fictional data.
- Before rollout, name the conference removal-request contact, confirm school permission and the removal process, complete actual AD and conference-admin sign-in tests, and have Greg handle the live Supabase project.

References: [Meta's Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api), [Instagram media reference](https://developers.facebook.com/documentation/instagram-platform/reference/instagram-media), [Meta app review](https://developers.facebook.com/docs/resp-plat-initiatives/app-review/introduction).
