// Selects matched games for the conference calendar and homepage preview.
function conferenceEvents(games) {
  // Same rules as the plan's match check: both schools entered it, scheduled, and every detail agrees.
  const scheduled = games.filter(game =>
    game.status === 'Scheduled' &&
    Object.hasOwn(sampleSchools, game.school) &&
    Object.hasOwn(sampleSchools, game.opponent_school_id ?? '') &&
    game.school !== game.opponent_school_id
  );

  return scheduled
    .filter(home => home.home_away === 'Home' && scheduled.some(away =>
      away.home_away === 'Away' && away.school === home.opponent_school_id &&
      away.opponent_school_id === home.school &&
      away.sport === home.sport && away.gender === home.gender && away.level === home.level &&
      away.game_date === home.game_date && away.start_time === home.start_time &&
      away.location === home.location
    ))
    .map(game => ({
      title: teamLabel(game) + ' · ' + sampleSchools[game.opponent_school_id].name +
        ' at ' + sampleSchools[game.school].name,
      start: game.game_date + 'T' + game.start_time,
      location: game.location,
      schools: [game.school, game.opponent_school_id],
      sport: game.sport,
      season: game.season,
      level: game.level,
    }));
}

const conferenceGames = conferenceEvents(sampleGames);
if (document.getElementById('calendar')) renderCalendar(conferenceGames);
if (document.getElementById('upcoming')) renderUpcoming(conferenceGames);
