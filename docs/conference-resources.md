# Conference resources

## Information page (November 13, 2026)

[Information](../resources.html) replaces About in the main navigation. Its left-hand tabs are About, History, Divisions, Tournaments, Documents and Archive; the old page addresses forward to the matching tab. [Documents](documents.md) covers the PDF viewer, the Archive tab and adding new files. Divisions lists each team by season, and a team opens a pop-up with that list's whole alignment: every division and every school in it. The pop-up's **Saved list** button opens the saved copy: [document.html](../document.html) for a PDF, [archive.html](../archive.html) for a saved web page. The tabs read the existing alignment data and the `shorePublicResources` index in [conference-resources.js](../data/conference-resources.js). The index links to copies saved on this site. Nothing syncs automatically.

- `complete` means every division copied has all its members. `allDivisions` means every division on the saved list is copied. They are separate: complete divisions do not make a whole alignment. Since November 13 every list has both. The pop-up still says so plainly if a future list has only some divisions or only division names.
- Public document records carry their edition label, review date, format and limitations. Past-season leadership remains labeled as such. Link summaries are not full accessible transcriptions of original files.
- Tournament source records do not create games. The existing conference-office upload and publish workflow stays unchanged; generator and bracket-discovery tools remain hidden.
- The History tab is the conference's own history PDF laid out as an article, 1936 to 1969, with its officers in a table. The wording is tidied for reading; facts and spellings follow the PDF. Photo boxes are placeholders. To fill one, save the picture in `assets/history/`, replace the box's `photo-slot` div with an `<img>` that has `alt` text, and write the caption. Only use pictures the conference or a school has the right to publish.
- Each tab has its own address (`resources.html#divisions`). Navigation and the About and History text work without JavaScript.

### Approved next-phase permissions

Conference admins and site admins may manage and approve conference content themselves. AD content controls are limited to their own school's social media; general school news, photo or document submissions are not approved. This first phase does not implement or grant new database permissions.

Use attributed links to approved sources first. Hosted photos or connected social feeds require recorded permission, a named conference contact for removal requests, and a removal/disconnection procedure before rollout. Do not copy publisher text/images or scrape school accounts. These measures reduce exposure but do not establish that content has been licensed or eliminate risk.

Administrator editing, version storage, uploads, news archives and social-account controls remain later phases. Development uses the test Supabase project; Greg handles production.

Facts this site copies from the conference's own files. The old conference site will go away, so **nothing on this site links to it**. Every list and document links to a copy saved here:

- PDFs are saved in `assets/documents/` under their original file names.
- Web pages (division lists and the tournament director list) are saved in `data/archived-resources.js` and shown by [archive.html](../archive.html) (`archive.html?page=MSOC_2026-divisions`).
- `docs/source-archive/manifest.json` records where each copy came from, its size, checksum and capture date.

In `data/conference-resources.js`, `list(...)` and `savedCopy(...)` take the old address and turn it into the saved copy's address. Save the file first, then add the entry. A tournament's rules link may be a saved file (`assets/documents/…pdf`) or an https link.

## Full division breakdowns (November 13, 2026)

All 25 lists now carry every division and school. Boys' and girls' swimming are separate lists because their A North members differ (CBA for boys, Trinity Hall for girls).

Three files work together:

- `docs/source-archive/division-transcriptions.json` holds each list exactly as printed, one key per saved page or PDF (`swimming-boys` and `swimming-girls` for the two swimming pages).
- `docs/source-archive/division-name-map.json` turns printed names into directory slugs:
  - `slugs`: a name that can only mean one school, including source typos such as "Manlapan". The site shows the corrected name; `typos` lists which ones were misspelled.
  - Combined entries such as "RBR/RFH" are split at "/" and each part goes through `slugs`. The site shows one team line naming both schools, and each school's page gets the division.
  - `ambiguous`: a short name such as "Brick" counts as every school it could mean, minus any the same list names on its own, until the conference confirms (decided by Greg, November 13). Softball names Brick Memorial on its own, so its "Brick" is Brick Township; football names Red Bank Catholic on its own, so its "Red Bank" is Red Bank Regional. When more than one school remains, the pop-up adds a "To confirm" note.
  - `printed`: shown exactly as printed, without a link, with a "To confirm" note. Only "(Ocean Academy)" is left.
- Entries in `data/conference-resources.js` are slugs, or slugs joined by "/" for one entry naming several schools (`'brick-township/brick-memorial'`).
- `data/conference-resources.js` holds what the site shows. `tests/division-breakdowns.test.mjs` fails if it stops matching the transcription run through the name map.

How each list was checked on November 13:

- The nine saved web pages (both soccer lists, field hockey, girls' tennis, girls' volleyball, cross country, ice hockey and both wrestling lists) were compared cell by cell against the captured page tables in `data/archived-resources.js`. All matched.
- Football and swimming are image-only PDFs. Their pages were read by eye.
- Gymnastics, track, softball and both basketball lists have uneven column layouts, so their pages were read by eye as well.
- Baseball, both golf lists, both lacrosse lists, boys' tennis, boys' volleyball and flag football were checked against their PDFs' text in page layout.

## Where each fact lives

| Fact | Where | Who can change it |
| --- | --- | --- |
| Division lists and a team's division | `data/conference-resources.js`, `divisionLists` | Greg, by pull request |
| School athletics website links | `data/conference-resources.js`, `schoolSites` | Greg, by pull request |
| What the conference has posted for a tournament | `data/conference-resources.js`, `tournamentSources` | Greg, by pull request |
| A tournament's rules link, director and key dates | The tournament itself, "Rules and dates" on the staff Tournaments tab | Conference admins and site admins. Private until published. |

A file is enough for now: about 25 lists and 48 links that change once or twice a year. If ADs should set their own athletics link, add it to School settings beside logo and colors. That is a separate decision.

## Updating the file

Each summer the conference posts new division lists under "Alignments" on its home page.

1. Open the new list. Save a copy (a PDF goes in `assets/documents/`; a web page goes in `data/archived-resources.js`). Add a `list(...)` entry with the sport, the teams it covers, the season, the year and the list's old address; the site links to the saved copy. Keep last year's entry. The site picks the entry for the school year on screen, so older seasons keep their own divisions.
2. Type every division into `division-transcriptions.json` exactly as printed, in the list's order. For an image-only PDF, read the page itself.
3. Add any new printed name to `division-name-map.json`: under `slugs` when it can only mean one school, under `ambiguous` with every school it could mean, or under `printed` with a short reason when it names no school.
4. Copy the divisions into the `list(...)` entry as slugs, joining with "/" for a combined entry or a short name, and add a note for each assumption and each printed name. A list that is not fully copied must not use `list(...)`; set `complete` or `allDivisions` to `false` so the pop-up says what is missing.
5. Run `node --test tests/*.test.mjs`. The tests catch a misspelled slug, a school in two divisions, a list that no longer matches its transcription and any link to the old site.

Years: fall and winter use the year the season starts (winter 2026–27 is `2026`); spring uses the year it is played.

For a school link, open it. If it shows that school's athletics, use `ok(url)`. Otherwise use `check(url, 'what is wrong')`. Only `ok` links are shown.

## What "verified" means

- **Division list:** checked against its saved copy on the review date, as described under Full division breakdowns. The official lists do not name a level. This site records them as varsity and never shows a division for JV or freshman teams.
- **School link:** listed in the conference's member menu and loaded a page naming the school or its athletics on the review date.
- **Tournament date:** every posted source gives the same date. Any disagreement stays "Needs date confirmation" until a conference admin settles it.

## Open questions, November 10, 2026

1. **Soccer tournament dates.** The [regulations](../assets/documents/2026_SCT_Soccer_Rules_and_Regulations.pdf) give the cutoff as October 10 and the [quick chart](../assets/documents/Shore_Conference_Quick_Chart_2025_2028_Fall.pdf) gives October 11. For quarterfinals and semifinals the regulations' main list, their "Changes" section and the quick chart give up to three different dates. The regulations also still name the earlier semifinal dates in their field-sites section. Needed: the conference office or the tournament director says which list governs.
2. **Tournament directors.** The posted [director list](../archive.html?page=GEN_sct-directors-26) is for 2025–26. The 2026 soccer regulations name Josh Mehl and Ted Gillen for both tournaments; the older list names Will Sundermann for girls' soccer. Only the 2026 regulations are used. Needed: the 2026–27 list.
3. **Level.** Needed: confirmation that the division lists are varsity alignments.
4. **Jackson.** The conference menu still lists Jackson Liberty and Jackson Memorial, and both links fail. Its division lists say "Jackson" or "Jackson Township". This site keeps one school, `jackson-township`, and shows no athletics link for it yet.
5. **Member count.** The conference menu has 48 names, two of them the former Jackson schools, and does not list Ocean Academy. Its 2026 cross country list shows Ocean Academy in parentheses. This site's directory has 48 schools.
6. **Fourteen school links** need a person to find the right page: Barnegat, Donovan Catholic, Holmdel, Jackson Township, Keansburg, Keyport, Lacey Township, Lakewood, Manasquan, Matawan Regional, Ocean Township, Rumson-Fair Haven Regional, Saint Rose and Wall Township. Ocean Academy has no listing. Each entry's note says what went wrong.

## Open questions from the full division lists, November 13, 2026

Greg is getting these confirmed. The lists are as of fall 2026, and the conference may change them each year.

7. **Short names counted as several schools for now.** Ice hockey "Brick" is shown as Brick Township and Brick Memorial. Girls' wrestling "Brick", "Middletown" (North and South) and "Toms River" (East, North and South) are shown as every school they could mean. Each pop-up says so in a "To confirm" note.
8. **Short names resolved to one school.** Softball "Brick" is shown as Brick Township and football "Red Bank" as Red Bank Regional, because each list names the other school on its own. Ice hockey "Rumson" is shown as Rumson-Fair Haven Regional, the only school it can mean.
9. **Combined teams.** Gymnastics lists "Brick Mem./Brick Twp.", "Manchester/Jackson" and "RBR/RFH"; cross country lists "Henry Hudson/Keyport". Each is shown as one team naming both schools.
10. **Ocean Academy in cross country.** It appears in parentheses in B South. Its status is not stated, so it is shown as printed.
11. **Gymnastics season.** The list is titled "Gymnastics 2026 Divisions" and is filed as Fall 2026. Confirm the season it covers.
12. **Typos.** Shown corrected: "Manlapan" (gymnastics) as Manalapan and "TRINTIY HALL" (girls' volleyball) as Trinity Hall. The saved tournament director page shows "Boy's Lacrosse" as "Boys' Lacrosse" and "B/T Winter Track" as "B/G Winter Track", and two dashes are tidied. The fixes are listed in `js/archive.js`; the saved text and the original PDFs are unchanged.
