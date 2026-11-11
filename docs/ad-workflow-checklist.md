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
