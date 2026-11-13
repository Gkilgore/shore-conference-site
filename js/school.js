// Selects and brands a school, then loads its published schedule (or an explicitly requested sample).
const schoolQuery = new URLSearchParams(location.search).get('school');
const sample = new URLSearchParams(location.search).get('sample') === '1';
const schoolDirectory = typeof shoreSchools !== 'undefined' ? shoreSchools : (sample ? sampleSchools : {});
const hostname = location.hostname.split('.');
const subdomain = hostname.length >= 3 && !location.hostname.endsWith('.github.io')
  ? hostname[0]
  : '';
const schoolSlug = schoolQuery ?? (Object.hasOwn(schoolDirectory, subdomain) ? subdomain : 'marlboro');

(async () => {
if (Object.hasOwn(schoolDirectory, schoolSlug)) {
  const school = schoolDirectory[schoolSlug];
  const divisionLink = document.getElementById('school-divisions-link');
  if (divisionLink) divisionLink.href = 'divisions.html?school=' + encodeURIComponent(schoolSlug);
  const title = school.name + ' Athletics';
  document.title = title + ' | The Shore Conference';
  const emphasis = document.createElement('em');
  emphasis.textContent = 'Athletics';
  document.getElementById('page-title').replaceChildren(school.name + ' ', emphasis);
  const logo = document.getElementById('school-logo');
  logo.src = school.logo ?? (['colts-neck', 'marlboro', 'shore-regional'].includes(schoolSlug)
    ? 'assets/logos/' + schoolSlug + '.png' : 'assets/logos/shore-conference.svg');
  logo.hidden = false;
  if (typeof setPageIcon === 'function') setPageIcon(logo.src);
  buildLogoWall(document.querySelector('.school-hero'), logo.src, 9, 26, school.logoBackground);
  document.documentElement.style.setProperty('--school-color', school.color);
  document.documentElement.style.setProperty('--school-accent', school.accent);
  document.documentElement.style.setProperty('--school-ink', readableInk(school.color));
  document.documentElement.style.setProperty('--accent-ink', readableInk(school.accent));
  // Recolors the whole page from the school's color: frames, calendar, text and a faint background tint.
  document.documentElement.classList.add('school-page');

  // The school's own athletics site, when its link has been checked.
  const site = schoolSite(schoolSlug);
  const siteLink = document.getElementById('school-site-link');
  if (site) {
    siteLink.href = site.url;
    siteLink.hidden = false;
  }
  window.addEventListener('shore:calendar-view', ({ detail }) =>
    renderTeamInfo(document.getElementById('team-info'), { school: schoolSlug, ...detail }));

  let games = sample ? sampleGames.filter(game => game.school === schoolSlug).map(game => ({
    title: teamLabel(game) + (game.home_away === 'Home' ? ' vs. ' : ' at ') +
      (schoolDirectory[game.opponent_school_id]?.name ?? game.opponent_name) +
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
  })) : [];
  const status = document.getElementById('public-schedule-status');
  try {
    if (!sample) {
      const schedule = await loadPublicCalendar({ scope: 'school', school: schoolSlug });
      games = publicCalendarEvents(schedule);
      status.textContent = 'All times Eastern';
      // Each renderer returns how many items it drew; empty sections stay hidden.
      document.getElementById('school-postings').hidden = !renderSchoolSeasons(document.getElementById('school-seasons'), schedule, notice => {
        window.dispatchEvent(new CustomEvent('shore:season-selected', { detail: notice }));
      });
      document.getElementById('recent-updates').hidden =
        !renderSchoolUpdates(document.getElementById('school-updates'), schedule, schoolDirectory);
    } else {
      status.textContent = 'Sample schedule · Eastern Time';
      document.getElementById('school-postings').hidden = true;
      document.getElementById('recent-updates').hidden = true;
    }
    renderUpcoming(games, { showChanged: true });
    const noUpcoming = document.querySelector('#upcoming .empty-schedule');
    if (noUpcoming && site) {
      const other = siteLink.cloneNode(true);
      other.removeAttribute('id');
      other.className = '';
      noUpcoming.append(' ', other);
    }
    renderCalendar(games);
    setSubscriptionLink({ scope: 'school', school: schoolSlug });
  } catch (error) {
    status.textContent = '';
    document.getElementById('subscribe-calendar').hidden = true;
    document.getElementById('calendar-filters').hidden = true;
    // One message is enough; the sections that depend on the schedule stay hidden.
    document.getElementById('upcoming').textContent = error.message;
    document.getElementById('school-postings').hidden = true;
    document.getElementById('recent-updates').hidden = true;
  }
} else {
  document.getElementById('page-title').textContent = 'School not found';
  document.getElementById('school-welcome').hidden = false;
  document.getElementById('all-schools-link').hidden = false;
  document.getElementById('subscribe-calendar').hidden = true;
  document.getElementById('school-content').hidden = true;
}
})();

function formatBusTime(time) {
  const [hour, minute] = time.split(':');
  return (Number(hour) % 12 || 12) + ':' + minute + (Number(hour) < 12 ? ' AM' : ' PM');
}
