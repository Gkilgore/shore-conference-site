// Selects and brands a school, then shows only its schedule entries.
const schoolQuery = new URLSearchParams(location.search).get('school');
const hostname = location.hostname.split('.');
const subdomain = hostname.length >= 3 && !location.hostname.endsWith('.github.io')
  ? hostname[0]
  : '';
const schoolSlug = schoolQuery ?? (Object.hasOwn(sampleSchools, subdomain) ? subdomain : 'marlboro');

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

  const games = sampleGames.filter(game => game.school === schoolSlug).map(game => ({
    title: teamLabel(game) + (game.home ? ' vs. ' : ' at ') +
      (sampleSchools[game.opponent]?.name ?? game.opponent) +
      (game.status === 'Scheduled' ? '' : ' · ' + game.status),
    start: game.start,
    location: game.location,
    sport: game.sport,
    season: seasonOf(game.sport, game.gender),
    level: game.level,
    status: game.status,
    bus: game.busTime ? 'Bus ' + formatBusTime(game.busTime) : '',
  }));
  renderUpcoming(games);
  renderCalendar(games);
} else {
  document.getElementById('page-title').textContent = 'School not found';
  document.getElementById('school-welcome').textContent = 'Choose a school from the directory.';
  document.getElementById('calendar-link').hidden = true;
  document.getElementById('school-content').hidden = true;
}

function formatBusTime(time) {
  const [hour, minute] = time.split(':');
  return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM');
}
