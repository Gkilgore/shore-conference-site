// Loads published matched games; the matching helper also supports explicit sample previews.
function conferenceEvents(games) {
  // Same rules as the plan's match check: both schools entered it and every detail agrees, except location:
  // the home school's location is the one shown.
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
      away.game_date === game.game_date && away.start_time === game.start_time);
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

// Each school's saved main color, so a conference game shows in its home school's color.
// If it can't load, the calendar falls back to the site's school list.
async function loadSchoolColors() {
  try {
    const url = new URL('/rest/v1/schools', shoreSupabase.url);
    url.searchParams.set('select', 'slug,primary_color');
    const response = await fetch(url, {
      headers: { apikey: shoreSupabase.publishableKey, Authorization: 'Bearer ' + shoreSupabase.publishableKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return {};
    return Object.fromEntries((await response.json()).filter(row => row.primary_color).map(row => [row.slug, row.primary_color]));
  } catch {
    return {};
  }
}

(async () => {
  const sample = new URLSearchParams(location.search).get('sample') === '1';
  const status = document.getElementById('public-schedule-status');
  try {
    const [schedule, colors] = sample ? [null, {}]
      : await Promise.all([loadPublicCalendar({ scope: 'conference' }), loadSchoolColors()]);
    const games = sample ? conferenceEvents(sampleGames) : publicCalendarEvents(schedule);
    games.forEach(game => { game.homeColor = colors[game.schools?.[0]] ?? null; });
    if (status) status.textContent = sample ? 'Sample schedule' : '';
    if (document.getElementById('calendar')) renderCalendar(games);
    if (document.getElementById('upcoming')) renderUpcoming(games, { showChanged: true });
    // On the calendar page the list sits under the calendar, shows five games and follows its filters.
    const filters = document.getElementById('calendar-filters');
    if (filters && document.getElementById('upcoming')) {
      const showFiltered = () => {
        const { school, sport, gender, level, search } = filters.elements;
        const query = search.value.trim().toLowerCase();
        renderUpcoming(games.filter(game => (!school.value || game.schools.includes(school.value)) &&
          (!sport.value || game.sport === sport.value) && (!gender.value || game.gender === gender.value) &&
          (!level.value || game.level === level.value) &&
          (game.title + ' ' + (game.location ?? '')).toLowerCase().includes(query)), { showChanged: true, limit: 5 });
      };
      showFiltered();
      filters.addEventListener('input', showFiltered);
      filters.addEventListener('reset', () => setTimeout(showFiltered, 0));
    }
    setSubscriptionLink({ scope: 'conference' });
  } catch (error) {
    if (status) status.textContent = error.message;
    if (document.getElementById('calendar-filters')) document.getElementById('calendar-filters').hidden = true;
    if (document.getElementById('upcoming')) document.getElementById('upcoming').textContent = 'The schedule didn’t load. Refresh to try again.';
    const link = document.getElementById('subscribe-calendar');
    if (link) link.hidden = true;
  }
})();
