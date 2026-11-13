# Shore Conference Scheduling Site — Rebuild Plan

November 5, 2026 · Greg Kilgore and Alexa

## 1. How it works

- **One database of games.** Every calendar is built from it: each school's page, the conference calendar, and the subscribe links parents add to their phones. Nobody edits a calendar file by hand.
- **Each school owns its schedule.** Only that school's Athletic Director (AD) can add, import or edit its games. Nothing one school enters appears on another school's calendar.
- **Saving posts the game (Greg's November 12 update).** For school schedules, saving a game or completing an import posts it to the public schedule; there is no draft or Publish step. This replaces the November 6 "review before publishing" decision. Games that were private before the change stay private until an AD posts them. See `posting-on-save.md`.
- **The conference calendar is built by matching.** When two member schools publish the same game and the details agree, it appears on the conference calendar automatically.
- **Tournaments are the one exception** (Greg's November 9 update). Conference admins import or generate a bracket, schedule its games, review and publish. Conference publication places each game on the conference calendar and confirmed participating schools' calendars. ADs manage their own tournament transportation. See `tournaments-design.md` for the implemented workflow.

## 2. Who can do what

| Role              | Can see                                                                    | Can change                                                       |
|-------------------|----------------------------------------------------------------------------|------------------------------------------------------------------|
| Public            | School pages, conference calendar, subscribe links                         | Nothing                                                          |
| School AD         | Their school's full schedule, including transportation                     | Their own school's teams, games, transportation, logo and colors |
| Conference admin  | Every school calendar, the conference calendar, the list of unlinked games | AD invitations, school assignments and conference-owned tournaments; school schedules stay read-only |
| Site admin        | Everything (Greg and Alexa)                                                | Schools, AD accounts, conference-admin access, fixes               |

**Bus times and entered early-dismissal times** show on each game on the owning school's calendar and school-specific feeds, never on another school's calendar or the conference calendar. An early-dismissal time appears only when the AD enters one.

**Staff access (Greg's November 6 update):** Several invited AD/staff accounts may share a school, and several accounts may be conference admins. Conference admins can add, reassign or remove AD access. Site admins can also manage conference admins. These tools cannot grant site-admin access or change the signed-in administrator's own access. Every change checks current permissions and the reviewed account version. Removing an invitation blocks future school database access even with an existing login token.

**Public updates:** Each school page identifies the season, year and teams actually posted, followed by recent published game changes. A saved change is public straight away. Withdrawing a schedule hides its old game details from public history, including after reposting.

**School branding:** ADs upload their logo and pick two colors in the admin area. The site chooses black or white text automatically so it stays readable, and the AD previews the page before saving.

## 3. Matching rules

A game goes on the public conference calendar only when both schools have published it and all of these match: sport, gender and level; date; start time; location; home and away mirrored; each school lists the other as its opponent. Transportation is ignored for matching.

If a published update stops matching, the game comes off the conference calendar until both published entries agree again. A matched game that either school publishes as postponed or canceled stays on the conference calendar with that status, so visitors can see what changed (Greg's November 9 update). Saving or importing a game publishes it immediately; deleting a game removes its public copy immediately. Public matching is checked against the saved public copies on each calendar/feed read.

**AD status line.** Each game against a member school shows its status in the AD's admin screen:

- LinkedOn the conference calendar
- Not linkedColts Neck hasn't entered this game
- Not linkedTime doesn't match (or date, location, home/away)

It names the field that differs but never shows the other school's values.

**Conference office view:** the full conference calendar plus every unlinked conference game and the reason. View only. When a game should link and doesn't, the office contacts the two ADs.

## 4. Data tables

| Table            | What it holds                                                                                    |
|------------------|--------------------------------------------------------------------------------------------------|
| schools          | Name, short name, subdomain, logo, two colors, conference member yes/no                          |
| teams            | School, sport, gender, level (Varsity, JV, Freshman), season                                     |
| games            | Owning school, team, date, start time, opponent, home/away, location, status, notes              |
| transportation   | Game, bus departure, pickup location, return time, optional early dismissal, notes                |
| team_publications | Which team/season-year schedules have been published and when                                   |
| published_games  | Last approved public game values, kept separate from working drafts, with stable calendar IDs    |
| publication_updates | Approved season notices and recent public game changes; withdrawn game history stays private |
| staff_access_audit | Internal record of invited-access additions, changes and removals                            |
| users            | Name, email, role (AD, conference office, site admin), school                                    |
| conference_links | The two matched games and when they linked (created by the site)                                 |
| tournaments | Conference-owned bracket, participants, schedule and results, with private drafts and approved snapshots |
| tournament_transportation | Each participating school's own bus details for a published tournament match |
| tournament_updates | Approved tournament match changes used by public calendar history |

A game's opponent is either a member school picked from a list or a typed name for non-conference opponents. Only games with a picked member school can link.

## 5. Tools

| Piece            | Tool                         | What it does                                                                                                                                          |
|------------------|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| Pages            | Plain HTML, CSS, JS          | Three templates: school page, conference calendar, admin. The school page reads the address and loads that school from Supabase. No per-school files. |
| Code             | GitHub                       | Every version saved; any change can be undone                                                                                                         |
| Hosting          | GitHub Pages, then Hostinger | Serves the pages. Hostinger pulls from GitHub when changes are pushed.                                                                                |
| Data + logins    | Supabase                     | Tables, AD logins, and who-can-edit-what rules. Spreadsheet-style screen to see or fix any record.                                                    |
| Calendar feeds   | Supabase Edge Function       | Builds the .ics feed fresh each time a phone or Google Calendar checks it                                                                             |
| Calendar display | FullCalendar                 | Draws month, week and list views. Loaded with a script tag.                                                                                           |
| Email            | Resend (free)                | Sends AD invites and password resets                                                                                                                  |
| Domain           | To be decided                | SportsCal.com, or ShoreSportsCal.com as a fallback. One subdomain per school.                                                                         |

### Why plain HTML, CSS and JavaScript

- Greg already teaches it, so every file is readable.
- No build step or packages to keep updated.
- React's extra tools aren't needed for calendars and forms.
- No separate app at first. The site is mobile-first, and later can be installed on phones (a PWA).

### Calendar feeds and site behavior

- Feeds per team, per school, and for the conference.
- Phones check feeds on their own schedule (every few hours for Google), so edits arrive at the next check.
- Pages open to sports in season, with a filter for the rest.
- CSV import shows a preview and flags problem rows before saving.

## 6. Logins and security

- Supabase Auth stores passwords encrypted and handles password resets. No separate login service (like Clerk) is needed for about 50 accounts.
- **AD sign-up by invite:** Greg sends each AD an invite email from the admin area. ADs sign in with Google using their school email (Microsoft sign-in or an email link as a fallback). Only invited addresses get access; anyone else who signs in sees nothing.
- Connect Resend before launch; Supabase's built-in email is for testing only.

**Row Level Security (RLS) is on for every table, no exceptions.** The Supabase key in the pages is public by design. RLS rules are what stop anyone from editing another school's data. Before launch, test them with a fake AD account trying to edit another school's games. The **service_role** key never goes in the code or the repo.

## 7. Hosting and cost

### Build on GitHub Pages first

- No domain or paid hosting needed to build or pilot.
- School pages use `school.html?school=marlboro` until the real domain is ready; subdomains then work with no code change.
- Add the github.io address to Supabase's allowed redirect URLs.

### Then Hostinger and Supabase Pro

- Hostinger's Business plan supports a wildcard subdomain, so all 48 school addresses work at once. Confirm SSL covers every subdomain.
- Supabase's free plan covers building and the pilot, but pauses after a week idle and has no backups. Move to Pro (from \$25/month) before rollout.

## 8. Build order

1.  **Database and logins:** tables, three test schools (Colts Neck, Marlboro, Shore Regional), test AD accounts
2.  **AD admin area:** add, edit, postpone and cancel games; transportation; CSV import
3.  **Public school pages:** colors, logo, teams, calendar
4.  **Calendar feeds** per team, school and conference
5.  **Matching:** the match check, status line, conference calendar

&nbsp;

6.  **Conference office login:** view only, unlinked-games list
7.  **Spring pilot at Marlboro** with coaches Greg knows, using Colts Neck and Shore Regional to test matching
8.  **Roll out to all 48 schools**, using the current NJSIAA roster including Ocean Academy (approved November 6; see `school-directory-access.md`). School records and reusable page links are ready; invitations and actual schedules are assigned separately.
9.  **Tournament workflow implemented in the test project.** Import CSV or generate seeded single elimination with byes, build a master schedule, review and publish. Confirmed participants appear on school calendars and feeds. "Winner of Game 3" slots fill in through reviewed results. ADs manage their own transportation. Production rollout remains Greg's responsibility.
10. **Later: installable phone app** (PWA) using the same pages and data

## 9. Working together: Greg and Alexa

Once the basic site is built, Alexa works on it in VS Code with an AI coding agent.

- **Branches and pull requests:** Alexa and her agent work on a branch, never the live version. She opens a pull request, Greg reviews it, and merging puts it live.
- **Rules file for the agent** (`AGENTS.md` or `CLAUDE.md`): plain HTML, CSS and JS only; no frameworks, npm or build tools; where each file lives; never use the service_role key; use the site's existing colors and spacing.
- **Two Supabase projects:** a test project for building and the agent, and a live project only Greg handles.
- **Splitting the work:** Alexa takes styling, page layouts, the AD how-to page and the CSV template. Greg keeps security rules, matching and calendar feeds.

## 10. Upkeep

- **Adding a school** is one row in the schools table plus an AD account. No new code.
- **Each season:** teams carry over; old games stay stored but drop off the main views. Export the games table at the end of each season.
- **AD how-to:** one page covering login, adding a game, CSV import and the status line.
- **Early warning:** the unlinked-games list shows which ADs are entering games inconsistently.

**Still to decide:** site name and domain · sports, levels and season dates to load at launch · who pays for Supabase Pro
