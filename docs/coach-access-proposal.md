# Proposal: coach logins, game notes, and scores

**Status:** idea for later. Not built, and not part of the agreed rebuild plan yet. Greg and Alexa need to agree before work starts, because it adds a new kind of login.

## The idea

Coaches already on a school's coach list (see `docs/coach-emails.md`) could sign in and:

- **Update game notes** for their own teams' games, such as "Wear white" or "Bus leaves from the gym lot".
- **Enter scores** after a game: final score, and a win, loss, or tie for their team.

Everything else about a game would stay AD-only: date, time, location, opponent, status, and transportation.

## How it could work

- **Sign-in:** the coach's invite email becomes a real invitation. Coaches sign in the same way staff do (Google or an email link) and see only their own teams' games.
- **New role:** add `coach` to the `users` roles, linked to the `coaches` row by email. Row-level security lets a coach update only the notes and score fields, and only on games for teams they're assigned to.
- **Scores:** add `home_score`, `away_score`, and `score_entered_by` to `games`, or keep them in a separate `game_results` table so the schedule rows stay clean. Show scores on the public school calendar once entered.
- **Matched games:** both schools' coaches could enter a score. The site shows it once both agree, the same idea as game matching, or flags it for the ADs when they disagree.
- **Coach emails:** scores and notes would not trigger the "Changed" coach emails.

## Questions to settle first

1. Should scores appear on public calendars right away, or only after the AD approves them?
2. Can assistant coaches enter scores, or only head coaches?
3. Do conference office reports need scores (standings, for example)?
4. How long do coach accounts stay active between seasons?
