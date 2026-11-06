# School logos and page colors

The directory, shared school page and staff header use the 48 school entries in `data/school-directory.js`. Each entry points to a local logo under `assets/logos/` and provides the main/accent colors used by the existing header, calendar and repeated-logo backdrop. Directory logos load as needed on long phone pages.

Sources and verification notes are recorded by school in [logos-a.json](logos-a.json), [logos-b.json](logos-b.json) and [logos-c.json](logos-c.json). The marks come from official school/district pages, the [Shore Conference](https://theshoreconference.com/standings.aspx?path=football), or the conference directory on an [official school athletics site](https://matawanhuskyathletics.digitalsports.com/). Provider-sized image renditions are downloaded locally; visitors do not fetch school images from those external hosts.

The existing Colts Neck, Marlboro and Shore Regional marks and palettes are preserved. When a school publishes a color specification, the manifest cites it. Other display palettes are selected from the authentic mark and identified as sampled colors rather than an official brand specification. Contrast checks keep page text readable.

Original image backgrounds remain intact. Ocean Academy and Southern Regional provide white-backed marks; these are authentic school images, not generated replacements. Saved staff branding keeps its existing priority over catalog defaults. No school schedules, invitations or database records are changed by this asset update.

Backdrop marks get a faint outline when their color matches the school background. The two white-backed originals use a CSS blend only in the repeated backdrop so rectangular image fields do not tile across the header; the main logos remain unchanged. Text uses black or white, including true black where bright reds require it for contrast.

Verified November 6, 2026: 57 Node checks passed, all 48 images decoded, all main/accent palettes met 3:1 large-heading contrast and at least 4.5:1 normal/button text contrast, and all 48 public school pages passed browser checks at both 390px and 1440px. Screenshots were visually reviewed; no missing marks, horizontal overflow or browser script exceptions were found. Existing test-school image files remained unchanged. The selected 48 marks total about 3.67 MiB, and directory logos load lazily.
