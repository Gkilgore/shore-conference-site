// Selects matched games for the conference calendar and homepage preview.
function conferenceEvents(games) {
  const scheduled = games.filter(game =>
    game.status === 'Scheduled' &&
    Object.hasOwn(sampleSchools, game.school) &&
    Object.hasOwn(sampleSchools, game.opponent) &&
    game.school !== game.opponent
  );

  return scheduled
    .filter(home => home.home && scheduled.some(away =>
      !away.home && away.school === home.opponent && away.opponent === home.school &&
      away.sport === home.sport && away.gender === home.gender && away.level === home.level &&
      away.start === home.start && away.location === home.location
    ))
    .map(game => ({
      title: teamLabel(game) + ' · ' + sampleSchools[game.opponent].name +
        ' at ' + sampleSchools[game.school].name,
      start: game.start,
      location: game.location,
      schools: [game.school, game.opponent],
      sport: game.sport,
      season: seasonOf(game.sport, game.gender),
      level: game.level,
    }));
}

const conferenceGames = conferenceEvents(sampleGames);
if (document.getElementById('calendar')) renderCalendar(conferenceGames);
if (document.getElementById('upcoming')) renderUpcoming(conferenceGames);
