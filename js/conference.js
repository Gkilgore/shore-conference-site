// Loads published matched games; the matching helper also supports explicit sample previews.
function conferenceEvents(games) {
  // Same rules as the plan's match check: both schools entered it and every detail agrees.
  // A postponed or canceled game stays listed with that status.
  const scheduled = games.filter(game =>
    Object.hasOwn(sampleSchools, game.school) &&
    Object.hasOwn(sampleSchools, game.opponent_school_id ?? '') &&
    game.school !== game.opponent_school_id
  );

  return scheduled.filter(home => home.home_away === 'Home').flatMap(game => {
    const away = scheduled.find(away =>
      away.home_away === 'Away' && away.school === game.opponent_school_id &&
      away.opponent_school_id === game.school &&
      away.sport === game.sport && away.gender === game.gender && away.level === game.level &&
      away.game_date === game.game_date && away.start_time === game.start_time &&
      away.location === game.location);
    if (!away) return [];
    const statuses = [game.status, away.status];
    const status = statuses.includes('Canceled') ? 'Canceled' : statuses.includes('Postponed') ? 'Postponed' : 'Scheduled';
    return [{
      title: teamLabel(game) + ' · ' + sampleSchools[game.opponent_school_id].name +
        ' at ' + sampleSchools[game.school].name + (status === 'Scheduled' ? '' : ' · ' + status),
      status,
      classNames: status === 'Scheduled' ? [] : ['is-' + status.toLowerCase()],
      start: game.game_date + 'T' + game.start_time,
      location: game.location,
      schools: [game.school, game.opponent_school_id],
      sport: game.sport,
      gender: game.gender,
      season: game.season,
      level: game.level,
    }];
  });
}

// Colors ADs saved for their schools. The calendar falls back to the school directory without them.
async function loadSchoolColors() {
  try {
    const url = new URL('/rest/v1/schools', shoreSupabase.url);
    url.searchParams.set('select', 'slug,primary_color');
    const response = await fetch(url, {
      headers: { apikey: shoreSupabase.publishableKey, Authorization: 'Bearer ' + shoreSupabase.publishableKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return {};
    return Object.fromEntries((await response.json()).filter(school => school.primary_color)
      .map(school => [school.slug, school.primary_color]));
  } catch { return {}; }
}

(async () => {
  const sample = new URLSearchParams(location.search).get('sample') === '1';
  const status = document.getElementById('public-schedule-status');
  try {
    const games = sample ? conferenceEvents(sampleGames)
      : publicCalendarEvents(await loadPublicCalendar({ scope: 'conference' }));
    if (status) status.textContent = sample ? 'Sample schedule' : '';
    if (document.getElementById('calendar')) renderCalendar(games, { schoolColors: sample ? {} : await loadSchoolColors() });
    if (document.getElementById('upcoming')) renderUpcoming(games, { showChanged: true });
    setSubscriptionLink({ scope: 'conference' });
  } catch (error) {
    if (status) status.textContent = error.message;
    if (document.getElementById('calendar-filters')) document.getElementById('calendar-filters').hidden = true;
    if (document.getElementById('upcoming')) document.getElementById('upcoming').textContent = 'The schedule didn’t load. Refresh to try again.';
    const link = document.getElementById('subscribe-calendar');
    if (link) link.hidden = true;
  }
})();
