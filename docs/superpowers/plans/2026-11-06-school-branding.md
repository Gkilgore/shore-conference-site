# School logos and backgrounds implementation plan

> **For agentic workers:** Use superpowers:executing-plans to complete the shared integration; independent agents collect disjoint logo sets.

**Goal:** Apply authentic logos and matching colors to all 48 schools using the existing school header and repeated-logo background.

**Architecture:** Keep the shared school template and local asset catalog. Download original marks from official school/conference sources, retain provenance in three manifests, and use the same catalog in public pages, directory cards and staff fallback branding. Keep the existing staff rule that saved school branding wins over catalog defaults. No database writes are needed.

**Tech stack:** Plain HTML/CSS/JavaScript and local image assets; no added packages or build tools.

**Spec:** User requested all school logos and backgrounds; existing design guide defines the layout. Reuse the established repeated-logo treatment, readable text colors and three verified test-school marks.

## Review focus

- Confirm similarly named schools and the current consolidated Jackson Township mark.
- Ocean Academy may have a school mark rather than a sports mascot; use only a verified official asset.
- Preserve school-uploaded logos and customized colors.
- Avoid HTML downloads, broken paths, unsafe SVGs, huge files and white/white text.
- Public and staff school headers must use the same approved defaults and saved branding.

## Tasks

- [x] Collect and visually inspect all 48 marks; record image/page/color sources in `docs/school-branding/logos-{a,b,c}.json`.
- [x] Update `data/school-directory.js` and directory branding checks so every school has a real local logo and valid colors; preserve the existing three marks.
- [x] Verify public and staff headers and repeated-logo backgrounds consume the updated catalog; preserve existing saved staff-branding priority.
- [x] Keep database data, accounts and schedules unchanged. The test project's school records currently contain identity/publication fields only, so its staff header already uses catalog fallbacks.
- [x] Run tests, asset/contrast checks, syntax checks and independent review. Browser validation succeeded at both required widths.

Final integration follows verification: save, commit, push, merge and update the clean Desktop `main` checkout under the user's standing instruction. The merged pull request records that integration.
