# School social media

Added November 15, 2026. Visitors see what a school shares on its own accounts. The posts stay on the platform: this site saves only the link to each account and never downloads, stores or caches posts, photos or videos.

## What visitors see

- **School page:** a Social media section directly beneath Next games. It lists every named school or team account. One Instagram account may appear in Instagram's own embed; the section is hidden when the school has no accounts.
- **Home page:** an Around the Shore section directly beneath Upcoming conference games. It shows one school at a time, chosen from a School picker. The first school changes each day so every school with Instagram gets a turn. It is not a merged feed. The section is hidden until one school saves an account.
- Every embed is labeled with the platform and account name, and every button opens the account on its own platform in a new tab.

## What each platform allows

Checked against the platforms' documentation and tested live on November 15, 2026.

| Platform | What this site shows | Why |
| --- | --- | --- |
| Instagram | The account's latest posts, updated by Instagram | The profile embed works from the account link with Instagram's `embed.js`. No app, token or review. |
| Facebook | A link to the page | The Page Plugin showed only the page header to a visitor who was not signed in to Facebook, with no posts. |
| X | A link to the account | The embedded timeline did not render for a visitor who was not signed in to X. |

- A single stream that mixes posts from many schools by date needs Meta's oEmbed or Graph API: a Meta developer app, app review, business verification, and each school connecting its account. That is not built and needs Greg's approval first.
- The Instagram account must be public with embedding left on. Instagram does not embed private or age-restricted accounts.

Sources: [Instagram oEmbed](https://developers.facebook.com/docs/instagram-platform/oembed), [Instagram embed button](https://developers.facebook.com/docs/instagram-platform/embed-button), [Meta oEmbed Read](https://developers.facebook.com/docs/features-reference/meta-oembed-read), [Facebook Page Plugin](https://developers.facebook.com/docs/plugins/page-plugin/), [X embedded timelines](https://docs.x.com/x-for-websites/timelines/overview).

## Who can change the links

Social media is a section of the staff School settings tab. An AD manages their own school. Conference admins and site admins pick any school; conference admins see only this section there, not logo, colors or venues. Staff can name and save several accounts per platform, such as Football and Boys soccer on X. Saving posts the link straight away and Remove takes it off straight away.

Supabase enforces this in `school_social_accounts` with row-level security (`shore_private.can_manage_social`). The table accepts one exact link form per platform, so a saved link can only point at instagram.com, facebook.com or x.com. The multiple-account migration adds `account_name`, preserves existing links as School athletics, and prevents duplicate links for one school.

## Files

- `js/social-links.js` checks and tidies a link. The staff tab and the public pages share it.
- `js/social.js` draws the public sections. Instagram's script loads only when the section is about to scroll into view. If it does not load in 12 seconds the visitor gets a short message and the account link.
- `js/staff-social.js` runs the staff section.
- `supabase/migrations/20261202000100_school_social_accounts.sql` creates the table; `20261205000100_multiple_social_accounts.sql` adds named accounts. `supabase/tests/school-social-accounts.sql` tests the permissions.
- `tests/social.test.mjs` covers the link check, the school picker and the staff tab. `tests/preview-server.mjs` serves a few sample links that point at the platforms' own accounts.

## Before rollout

1. Migration applied and SQL permission test passed in test project `jrtcyihpdrcnhxgproyw` on November 15, 2026. The test's fictional X username was shortened to fit the existing 15-character limit; permission checks were unchanged. All fixtures rolled back. Signed-out API reading returned HTTP 200; insert, update and delete returned HTTP 401 (permission denied). All 247 local tests passed.
2. Browser checks on November 15, 2026 used Greg's real site-admin sign-in. In the Marlboro AD view, adding, editing and removing an Instagram link worked; the screen exposed only Marlboro. An unrelated-site link and a single-post link were refused with one-line messages. Signed-out school and home pages displayed the saved account and Instagram's profile embed, then hid the sections after removal. The conference-office view saved and removed a Colts Neck link. No test links remain. **Still required:** separate real AD and conference-admin sign-ins, including direct cross-school API insert/update attempts as the AD. The site-admin View as control changes the screen, not the database identity, so these browser checks do not prove restricted-account API permissions; the rolled-back SQL test covers those rules.
3. `docs/conference-resources.md` asks for a named conference contact for removal requests before connected social content goes live. That contact is not named yet.
4. The multiple-account migration and updated permission test passed in the test project on November 16, 2026. The public API returned Marlboro's five links. The local staff preview passed 63 checks, and the school and home pages displayed the named links in a browser. The live Supabase project was not changed.

## Marlboro accounts checked November 16, 2026

The [Marlboro boys soccer program page](https://sites.google.com/marlboro.k12.nj.us/marlboro-hs-boys-soccer/home) identifies its player-run [Instagram account](https://www.instagram.com/marlboroboysvs/) and [X account](https://x.com/MarlboroSoccer2). The school's [weekly update](https://storage.googleapis.com/pt05-1/messages/attachments/ce8cccca9f945744eac973124dadfb55/Mustang_Weekly_Updates_3.20.23.pdf) identifies [@MHSscoreupdates](https://x.com/MHSscoreupdates) as its general athletics account. The football program's [X account](https://x.com/mhsmustangsfb) is referenced by current players and team coverage; its existing [Instagram link](https://www.instagram.com/marlboromustangsfootball/) was retained and labeled Football, with the handle also listed by [NJ Record Book](https://njrecordbook.com/football/2016-2017/marlboro/). These are the accounts entered in the test project; accounts for other teams need confirmation before listing. This is Marlboro High School in New Jersey, not Marlboro Central High School in New York.
