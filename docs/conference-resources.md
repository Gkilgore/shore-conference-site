# Conference resources

## Public resource hubs (November 13, 2026)

The approved first expansion adds [Divisions](../divisions.html), [Tournaments](../tournaments.html) and [Inside the Conference](../inside.html). They read the existing alignment data and the `shorePublicResources` index in [conference-resources.js](../data/conference-resources.js). The index links to copies saved on this site. Nothing syncs automatically.

- A division's `complete` flag describes the membership copied for that division, not coverage of every conference division. Missing schools get an unknown-assignment message and the link to the saved list. Partial memberships are not presented as complete lists.
- Public document records carry their edition label, review date, format and limitations. Past-season leadership remains labeled as such. Link summaries are not full accessible transcriptions of original files.
- Tournament source records do not create games. The existing conference-office upload and publish workflow stays unchanged; generator and bracket-discovery tools remain hidden.
- Resource filters use query parameters so selections can be shared. Navigation and saved-file links work without JavaScript.

### Approved next-phase permissions

Conference admins and site admins may manage and approve conference content themselves. AD content controls are limited to their own school's social media; general school news, photo or document submissions are not approved. This first phase does not implement or grant new database permissions.

Use attributed links to approved sources first. Hosted photos or connected social feeds require recorded permission, a named conference contact for removal requests, and a removal/disconnection procedure before rollout. Do not copy publisher text/images or scrape school accounts. These measures reduce exposure but do not establish that content has been licensed or eliminate risk.

Administrator editing, version storage, uploads, news archives and social-account controls remain later phases. Development uses the test Supabase project; Greg handles production.

Facts this site copies from the conference's own files. The old conference site will go away, so **nothing on this site links to it**. Every list and document links to a copy saved here:

- PDFs are saved in `assets/documents/` under their original file names.
- Web pages (division lists and the tournament director list) are saved in `data/archived-resources.js` and shown by [archive.html](../archive.html) (`archive.html?page=MSOC_2026-divisions`).
- `docs/source-archive/manifest.json` records where each copy came from, its size, checksum and capture date.

In `data/conference-resources.js`, `list(...)` and `savedCopy(...)` take the old address and turn it into the saved copy's address. Save the file first, then add the entry. A tournament's rules link may be a saved file (`assets/documents/…pdf`) or an https link.

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
2. Copy each division that includes Colts Neck, Marlboro or Shore Regional, with every school in it. If you copy only some schools, set `complete` to `false`; the site then shows the division without a member list.
3. Write schools as directory slugs (`middletown-south`). If a name could mean more than one school ("Brick", "Middletown"), keep it as printed.
4. For a list you have not read, pass `null` for the divisions. The site links to the saved copy and names no division.
5. Run `node --test tests/*.test.mjs`. The tests catch a misspelled slug, a school in two divisions and a missing source.

Years: fall and winter use the year the season starts (winter 2026–27 is `2026`); spring uses the year it is played.

For a school link, open it. If it shows that school's athletics, use `ok(url)`. Otherwise use `check(url, 'what is wrong')`. Only `ok` links are shown.

## What "verified" means

- **Division list:** read on the review date, by eye for PDFs. The official lists do not name a level. This site records them as varsity and never shows a division for JV or freshman teams.
- **School link:** listed in the conference's member menu and loaded a page naming the school or its athletics on the review date.
- **Tournament date:** every posted source gives the same date. Any disagreement stays "Needs date confirmation" until a conference admin settles it.

## Open questions, November 10, 2026

1. **Soccer tournament dates.** The [regulations](https://theshoreconference.com/documents/2026/9/24/2026_SCT_Soccer_Rules_and_Regulations.pdf) give the cutoff as October 10 and the [quick chart](https://theshoreconference.com/documents/2026/9/24/Shore_Conference_Quick_Chart_2025_2028_Fall.pdf) gives October 11. For quarterfinals and semifinals the regulations' main list, their "Changes" section and the quick chart give up to three different dates. The regulations also still name the earlier semifinal dates in their field-sites section. Needed: the conference office or the tournament director says which list governs.
2. **Tournament directors.** The posted [director list](https://theshoreconference.com/sports/2025/8/1/GEN_sct-directors-26.aspx) is for 2025–26. The 2026 soccer regulations name Josh Mehl and Ted Gillen for both tournaments; the older list names Will Sundermann for girls' soccer. Only the 2026 regulations are used. Needed: the 2026–27 list.
3. **Level.** Needed: confirmation that the division lists are varsity alignments.
4. **Jackson.** The conference menu still lists Jackson Liberty and Jackson Memorial, and both links fail. Its division lists say "Jackson" or "Jackson Township". This site keeps one school, `jackson-township`, and shows no athletics link for it yet.
5. **Member count.** The conference menu has 48 names, two of them the former Jackson schools, and does not list Ocean Academy. Its 2026 cross country list shows Ocean Academy in parentheses. This site's directory has 48 schools.
6. **Fourteen school links** need a person to find the right page: Barnegat, Donovan Catholic, Holmdel, Jackson Township, Keansburg, Keyport, Lacey Township, Lakewood, Manasquan, Matawan Regional, Ocean Township, Rumson-Fair Haven Regional, Saint Rose and Wall Township. Ocean Academy has no listing. Each entry's note says what went wrong.
