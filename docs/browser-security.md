# Browser script protections

The fixed scripts on `admin.html`, `calendar.html`, and `school.html` use SHA-384 Subresource Integrity (SRI) and anonymous CORS. The hashes were computed from the exact bytes served by jsDelivr for FullCalendar `6.1.22` and Supabase JS `2.119.0`. `tests/external-scripts.test.mjs` fails if a fixed CDN script loses its verified hash. Changing a version requires downloading the new file, checking its source/release, and updating the hash and test in one reviewed change.

Instagram's `embed.js` is loaded only when a visible school account needs it. Its URL is not versioned, so a durable SRI hash is not available. The fallback remains a plain profile link if the embed fails. Do not add an inline script or copy Instagram posts into this repository to work around that limitation.

## Content Security Policy rollout

Do not enforce an untested policy yet. The current static host cannot be assumed to send a report-only header, and the available browser-control session was unavailable during this branch's review. First record actual network origins on Home, a school page with an Instagram embed, the conference calendar, a document, the staff sign-in page, and a staff save on both phone and desktop. Then begin with a report-only HTTP header where hosting permits it. Fix violations before enforcement.

The initial policy should permit only:

- Scripts: this site, `cdn.jsdelivr.net` for the two SRI-pinned libraries, and `www.instagram.com` for the embed.
- Connections: this site and the configured Supabase project. Confirm whether Instagram requires additional connections before allowing them.
- Styles/fonts: this site and Google Fonts. Confirm whether FullCalendar or Instagram injects styles; avoid broad `unsafe-inline` if the tested pages do not need it.
- Images/frames: this site, the configured Supabase Storage host, and the observed Instagram image/frame hosts. Keep `object-src 'none'` and `base-uri 'self'` unless a tested flow proves otherwise.

On GitHub Pages, a meta policy can cover some directives, but it cannot replace every HTTP header directive. On Hostinger, use an HTTP header and a report-only phase before enforcing. The policy must not change `js/supabase-config.js` or redirect the public site away from the current test project.

## Browser checks before enforcement

1. Load Home, school, conference calendar, document, and staff pages with the CDN available. Confirm FullCalendar renders and staff sign-in does not report a script failure.
2. Block jsDelivr and confirm the calendar and sign-in pages show their existing connection/load messages rather than a blank page.
3. Load a school with Instagram; confirm an embed or its fallback profile link appears. Check console and network requests for violations without recording user tokens.
4. Verify saved game notes and social account names containing `<script>` display as text; invalid and `javascript:` social links must not render.
5. Only then enforce the policy and repeat the checks on phone and desktop widths.
