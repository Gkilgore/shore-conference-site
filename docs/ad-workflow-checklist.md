# AD workflow checklist

Tracks the staff findings from the November 9 design review and the November 10 AD workflow pass. Checked with fictional games and a fake in-memory database in headless Chrome at 1280×900 and 375×812, as a test Marlboro AD and as a conference admin. Not yet checked with a real sign-in, the Supabase project, or a real AD.

## Fixed and verified (branch `design/ad-workflow`)

| Finding | Before | Now |
| --- | --- | --- |
| AD cannot tell which edits are public | A draft looked identical to a published game | Games that are not public are outlined on the calendar and tagged Draft or Changed in the list. A yellow bar counts them and opens Publish. The Publish tab shows the same count. |
| Editing and publishing sat under two synonyms | Tabs "Calendar" and "Schedule" | Tabs "Games" and "Publish". Conference admins, who cannot publish, see "Match checks". |
| No way to see the public page | No link in the workspace | "View public page" in the heading, and again beside the confirmation after publishing. |
| Heading named the software, not the school | "Staff dashboard / Athletic Director workspace" | Role, then the school name. The one-school picker is hidden for ADs. The masthead says "Staff dashboard" once signed in. |
| Editor did not say which game or whether it was public | "Edit game" only | "Marlboro · Girls Varsity Soccer vs. Colts Neck · Fri, Nov 13 · Published". The cursor starts on Date when editing. The Games tab stays highlighted. |
| Save buttons were easy to confuse | "Save draft" (main) and "Save and review publishing", warning after the buttons | "Save as draft" and "Save and publish…", warning above them. Publishing is the main button for a game families already see. |
| Unsaved edits were dropped silently | Leaving the editor lost changes | "Leave without saving?" with Discard changes or Keep editing, from Cancel or any sidebar tab. |
| Postponing was unexplained | Status list only | Choosing Postponed or Canceled shows what to do with the date and what families will see. |
| Confirmation appeared under an 11-row list | Status line below the team list | Status sits above the list. Publishing from the editor also confirms on the Games tab. |
| Publish list wording | "Published · 1 draft game", "Select or clear all shown", "Review schedules to unpublish" | "Published · 1 game · up to date", "Published · 1 change not public yet", "Select all", "Unpublish…". Teams with changes sort first. |
| Review dialog | ISO dates, jargon summary | "Fri, Nov 20, 2026", "Check what families will see. Times are Eastern." |
| Import sat below Publish | Step one under step two, on the wrong tab | "Import games" beside "Add game"; the import section is on the Games tab and ends by pointing to Publish. |
| Two words for one idea | "linked", "matching", "match checks" | "Matched with opponent", "Not matched". |
| Duplicate pointer | A "Tournaments" section that only named the Tournaments tab | Removed. |
| Phone: games far down the page | Calendar started about 894px down | About 683px. Filters fold behind one "Filters" button; Add game and Import games share a row. |
| Checkbox touched its label | No gap | Fixed. |

## Still open

1. **Run the Supabase steps.** Delete game and the postponed/canceled conference rule stay off until then (see `docs/schedule-tools.md`).
2. **Results and scores.** Regular games have no score fields, so entering results is only possible for tournaments.
3. **Heading levels.** Workspace panels still jump from h1 to h3.
4. **Required fields.** The editor says what is optional; individual fields are not marked, and a failed save still shows one general message.
5. **Coaches, Transportation, School settings, Tournaments, Staff access tabs.** Opened and checked for errors only; not reorganized.
6. **Public copy edits, masthead logo, logo tiles.** From the November 9 review; not part of this pass.

## Needs a real AD

- Do "Draft", "Changed" and "outlined" read as "families cannot see this yet" without explanation?
- Is "Save and publish…" or "Save as draft" the button they reach for first when adding many games?
- Do they find Import games, and is the CSV template enough on its own?
- Is the postponement guidance (keep the date, change it later) how they actually work?

## Official-site findings (November 10, branch `feature/official-site-findings`)

Compared with theshoreconference.com and rechecked that day. Checked with fictional games in headless Chrome at 1280px and 375px, and at 375px with doubled text. Nothing here was run against the Supabase test project.

| Finding | Now |
| --- | --- |
| About page said six divisions, football aside | Says divisions are set per sport each season, with the 2026 boys' soccer and 2027 boys' golf lists linked. The member count is worded as what this site lists. |
| No division beside a team | The school page and the staff Games tab show one line under the filters, for example "A North · Fall 2026 · Varsity", with "Official division list" and the schools in that division. It names a division only for a varsity team whose sport and team are chosen. JV and freshman get "None listed". All sports, or a sport with separate boys' and girls' lists, gets links and no division. Another school year shows that year's record or says none is on file. On the staff tab the line stays hidden until a sport is chosen. |
| Tournaments had no rules or key dates | "Rules and dates" in the tournament workspace: rules link, director, date of last source check and key dates. Each date is confirmed or marked "Needs date confirmation". "Fill from official sources" copies what the conference posted. The public tournament page shows the rules link, a confirmed director and confirmed dates only. |
| A school page with no schedule was a dead end | "School athletics website" in the school band, and beside "No upcoming games are listed." Shown for the 34 schools whose link was checked. |

### Still open from this pass

1. **Run migration `20261126000100_tournament_info.sql`** in the test project. Until then the database drops "Rules and dates" on save, and the staff page says so.
2. **Source questions for the conference office.** Soccer tournament dates, the 2026–27 director list, whether division lists are varsity only, the Jackson listing and the member count. `docs/conference-resources.md` lists each one with its sources.
3. **Fourteen school links** need a person to find the right page. Same document.
4. **Tournament workspace on a real sign-in.** Saving, reviewing and publishing "Rules and dates" were checked with the real page code and fictional responses only.
5. **Later, not in this pass:** regular-game scores, standings, streaming links, news.

### Keeping it current

`docs/conference-resources.md` has the steps. In short: each summer add the new division lists to `data/conference-resources.js` and keep the old ones; recheck school links once a year; a conference admin confirms tournament dates in the tournament itself.

### Tournament tools switched off (November 10, later)

Greg asked for everything tournament-related to be hidden except a conference admin uploading a finished schedule.

- Conference and site admins still see the Tournaments tab, with "Upload a tournament schedule" and "Save and publish". Tournament details, Rules and dates, the bracket and the matches table are hidden.
- Athletic directors no longer see the Tournaments tab, so tournament bus details are off too.
- Public game details no longer link to the bracket page. Published tournament games still show on calendars and feeds.
- Nothing was deleted. Each hidden piece of `admin.html` carries `hidden data-generator`; the tab rule is in `js/staff-schedule.js` and the bracket link in `js/calendar.js`.
- A game can now be corrected only by uploading the schedule again, since the matches table is hidden.
- Later the same day: the Tournaments tab shows only in the conference admin view. A site admin sees it by choosing "Conference office" in the view picker, not while looking at a school.

## Teams tab and navigation (November 11)

Checked with fictional games and a fake sign-in at 1280px and 375px. Not run against the Supabase project.

- **Tabs for an AD:** Schedule (was Games), Teams, Publish, Transportation, Coaches, School settings. There is no separate Games area: Schedule finds any game across teams and Teams finds a team's games, so a third list would repeat them.
- **Teams:** a list of teams with game count, next game, publish status and a "not matched" flag. Opening a team shows its status, Add game, Review and publish, Unpublish, games that are not matched with the other school and why, the full schedule with Draft and Changed tags, and its coaches. Edit on a game opens the usual editor and returns to the team. Coach Edit and Add a coach open the Coaches tab with that coach or team filled in.
- **Publishing:** stays in three places, all using the same review step. A team from Teams; one game from the editor ("Save and publish…"); several teams, or unpublishing several, from Publish. The Publish tab stays because it is the only place to publish many teams at once and to see every unmatched game.
- **Fixed on the way:** unpublishing used to confirm with "Published."

### Gaps

1. **Scheduling conflicts.** The only check that exists for school games is matching with the opponent. Nothing flags two games for one team at the same time, a shared venue, or a bus clash. The Teams tab shows unmatched games only, and labels them as that. A conflict rule needs a decision first.
2. **Team details.** A team is its sport, gender, level and season, taken from its games. There is no team record to edit (no nickname, roster or home venue).
3. **A team with no games** does not appear until its first game is added.
4. **Public check.** Publishing was confirmed inside the dashboard with fictional responses. That the change then shows on the public school page was not checked against the real project.
