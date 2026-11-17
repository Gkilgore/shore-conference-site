# Teams and yearly schedules

Teams are the school's reusable sport, gender, level and season entries. A Girls Varsity Soccer team is created once. Its games may be dated in Fall 2026, Fall 2027 and later years without making another team row.

The database already stores the schedule year on `team_publications` and `published_games` as `season_year`. It derives that year from each game's date and the team's season. Winter games in January through June belong to the school year that began the previous fall. The same team ID can therefore have separate yearly schedules. The unique rule on `teams` deliberately prevents a duplicate sport, gender, level and season for one school.

In the Teams tab, **Start next year's schedules** lists the teams already on file. Choose **Add game** for a team and enter a date in the new season. Saving the game creates its public schedule for that year under the existing posting-on-save rules. Use **Add a team** only for a sport, gender or level the school has not offered before. Games and imports for the new year must use the existing team ID.

No `school_year` column, team backfill or `copyTeamsForSeason()` insert is needed. Copying team rows would break the one-team identity and require changes to game, publication, import and subscription lookups. A future empty-schedule setup flow would need a separate design decision; this implementation starts a new year's schedule with its first saved game.

This change does not alter the production database or the schedule code being developed separately. It removes a placeholder button that claimed teams were copied without saving them.
