// Selects and brands a school, then loads its published schedule (or an explicitly requested sample).
const schoolQuery = new URLSearchParams(location.search).get('school');
const hostname = location.hostname.split('.');
const subdomain = hostname.length >= 3 && !location.hostname.endsWith('.github.io')
  ? hostname[0]
  : '';
const schoolSlug = schoolQuery ?? (Object.hasOwn(sampleSchools, subdomain) ? subdomain : 'marlboro');

(async () => {
if (Object.hasOwn(sampleSchools, schoolSlug)) {
  const school = sampleSchools[schoolSlug];
  const title = school.name + ' Athletics';
  document.title = title + ' | The Shore Conference';
  const emphasis = document.createElement('em');
  emphasis.textContent = 'Athletics';
  document.getElementById('page-title').replaceChildren(school.name + ' ', emphasis);
  document.getElementById('school-welcome').textContent =
    'Welcome to the ' + school.name + ' schedule. Browse games by sport or level and check where and when they’re played.';
  const logo = document.getElementById('school-logo');
  logo.src = 'assets/logos/' + schoolSlug + '.png';
  logo.hidden = false;
  buildLogoWall(document.querySelector('.school-hero'), logo.src);
  document.documentElement.style.setProperty('--school-color', school.color);
  document.documentElement.style.setProperty('--school-accent', school.accent);
  document.documentElement.style.setProperty('--school-ink', readableInk(school.color));
  document.documentElement.style.setProperty('--accent-ink', readableInk(school.accent));

  let games = sampleGames.filter(game => game.school === schoolSlug).map(game => ({
    title: teamLabel(game) + (game.home_away === 'Home' ? ' vs. ' : ' at ') +
      (sampleSchools[game.opponent_school_id]?.name ?? game.opponent_name) +
      (game.status === 'Scheduled' ? '' : ' · ' + game.status),
    start: game.game_date + 'T' + game.start_time,
    location: game.location,
    sport: game.sport,
    gender: game.gender,
    season: game.season,
    level: game.level,
    status: game.status,
    classNames: game.status === 'Scheduled' ? [] : ['is-' + game.status.toLowerCase()],
    // Bus times show only on the owning school's calendar. Whether the bus is confirmed stays staff-only.
    bus: game.transportation?.bus_departure ? 'Bus ' + formatBusTime(game.transportation.bus_departure) : '',
  }));
  const status = document.getElementById('public-schedule-status');
  const sample = new URLSearchParams(location.search).get('sample') === '1';
  try {
    if (!sample) {
      const schedule = await loadPublicCalendar({ scope: 'school', school: schoolSlug });
      games = publicCalendarEvents(schedule);
      status.textContent = schedule.published ? 'Published schedule · Eastern Time' : 'This school has not published its schedule yet.';
      document.getElementById('subscribe-calendar').hidden = !schedule.published;
    } else status.textContent = 'Sample schedule · Eastern Time';
    renderUpcoming(games);
    renderCalendar(games);
    setSubscriptionLink({ scope: 'school', school: schoolSlug });
    if (!sample && !games.length && status.textContent.startsWith('This school')) {
      document.getElementById('subscribe-calendar').hidden = true;
    }
  } catch (error) {
    status.textContent = error.message;
    document.getElementById('subscribe-calendar').hidden = true;
    document.getElementById('calendar-filters').hidden = true;
    document.getElementById('upcoming').textContent = 'Schedule unavailable. Please try again later.';
  }
} else {
  document.getElementById('page-title').textContent = 'School not found';
  document.getElementById('school-welcome').textContent = 'Choose a school from the directory.';
  document.getElementById('calendar-link').hidden = true;
  document.getElementById('subscribe-calendar').hidden = true;
  document.getElementById('school-content').hidden = true;
}
})();

function formatBusTime(time) {
  const [hour, minute] = time.split(':');
  return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM');
}
