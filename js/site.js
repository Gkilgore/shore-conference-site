// Builds school directories, logo backdrops and upcoming-game previews.
// Sport names are normalized here so public pages share one small icon set.
const sportIconNames = new Set(['football', 'basketball', 'baseball', 'soccer', 'lacrosse', 'wrestling', 'track', 'swimming', 'volleyball', 'tennis', 'hockey', 'golf']);
function sportIconName(sport) {
  const name = String(sport || '').toLowerCase();
  if (name.includes('field hockey') || name.includes('ice hockey')) return 'hockey';
  if (name.includes('cross country') || name.includes('track')) return 'track';
  if (name.includes('softball')) return 'baseball';
  if (name.includes('bowling')) return null;
  for (const icon of sportIconNames) if (name.includes(icon)) return icon;
  return null;
}
function createSportIcon(sport) {
  const name = sportIconName(sport);
  if (!name) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  const use = document.createElementNS(ns, 'use');
  svg.classList.add('sport-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  use.setAttribute('href', 'assets/icons/sports.svg#' + name);
  svg.append(use);
  return svg;
}

function teamLabel(game) {
  return [game.gender, game.level, game.sport].join(' ');
}

// Picks black or white text so it stays readable on a school's chosen color.
function readableInk(hex) {
  const value = parseInt(hex.slice(1), 16);
  const [red, green, blue] = [value >> 16, (value >> 8) & 255, value & 255].map(channel => {
    channel /= 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > 0.179 ? '#000000' : '#ffffff';
}

// Fills a hero with a faint, staggered repeat of a logo, like a signing-day backdrop.
function buildLogoWall(host, src, rows = 9, perRow = 26, logoBackground = 'transparent') {
  host.querySelector('.logo-wall')?.remove();
  const wall = document.createElement('div');
  wall.className = 'logo-wall';
  wall.dataset.logoBackground = logoBackground;
  wall.setAttribute('aria-hidden', 'true');
  for (let row = 0; row < rows; row++) {
    const line = document.createElement('div');
    line.className = 'logo-wall-row';
    for (let index = 0; index < perRow; index++) {
      const logo = document.createElement('img');
      logo.src = src;
      logo.alt = '';
      line.append(logo);
    }
    wall.append(line);
  }
  host.classList.add('has-logo-wall');
  host.prepend(wall);
}

for (const host of document.querySelectorAll('[data-logo-wall]')) {
  buildLogoWall(host, host.dataset.logoWall);
}

// showChanged keeps postponed and canceled games in the list, each with a status label before the matchup.
function renderUpcoming(events, { showChanged = false } = {}) {
  const list = document.getElementById('upcoming');
  const now = new Date().toISOString().slice(0, 10);
  const scheduled = game => !game.status || game.status === 'Scheduled';
  const games = events.filter(game => (showChanged || scheduled(game)) && game.start.slice(0, 10) >= now)
    .sort((first, second) => first.start.localeCompare(second.start)).slice(0, 3);
  if (!games.length) {
    list.innerHTML = '<li class="empty-schedule">No upcoming games are listed.</li>';
    return;
  }

  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  list.replaceChildren(...games.map(game => {
    const row = document.createElement('li');
    const date = document.createElement('time');
    const title = document.createElement('strong');
    const details = document.createElement('span');
    const start = new Date(game.start.slice(0, 10) + 'T12:00');
    date.dateTime = game.start;
    date.textContent = dateFormat.format(start);
    if (scheduled(game)) {
      title.textContent = game.title;
      details.textContent = [game.start.includes('T') ? timeFormat.format(new Date(game.start)) : 'TBD',
        game.location, game.bus,
        game.earlyDismissal && 'Early dismissal ' + game.earlyDismissal].filter(Boolean).join(' · ');
    } else {
      // Calendar titles end with " · Postponed"; here the status leads, so drop that ending.
      const label = document.createElement('em');
      const matchup = document.createElement('span');
      label.className = 'game-status is-' + game.status.toLowerCase();
      label.textContent = game.status;
      matchup.textContent = game.title.endsWith(' · ' + game.status) ? game.title.slice(0, -game.status.length - 3) : game.title;
      title.append(label, ' ', matchup);
      details.textContent = ['Was ' + (game.start.includes('T') ? timeFormat.format(new Date(game.start)) : 'TBD'),
        game.location, game.earlyDismissal && 'Early dismissal ' + game.earlyDismissal].filter(Boolean).join(' · ');
    }
    const icon = createSportIcon(game.sport);
    if (icon) title.prepend(icon);
    row.append(date, title, details);
    return row;
  }));
}

const directory = document.getElementById('school-directory');
if (directory) {
  const search = document.getElementById('school-search');
  const schools = Object.entries(typeof shoreSchools !== 'undefined' ? shoreSchools : sampleSchools).sort(([, first], [, second]) =>
    first.name.localeCompare(second.name));
  search.addEventListener('input', showSchools);
  showSchools();

  function showSchools() {
    const query = search.value.trim().toLowerCase();
    const matches = schools.filter(([, school]) => school.name.toLowerCase().includes(query));
    document.getElementById('directory-count').textContent =
      matches.length ? matches.length + (matches.length === 1 ? ' school' : ' schools') : 'No schools match your search.';
    directory.replaceChildren(...matches.map(([slug, school]) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      const logo = document.createElement('img');
      const label = document.createElement('span');
      const hint = document.createElement('small');
      link.href = 'school.html?school=' + encodeURIComponent(slug);
      link.style.setProperty('--card-color', school.color);
      link.style.setProperty('--card-ink', readableInk(school.color));
      logo.src = school.logo || 'assets/logos/' + slug + '.png';
      logo.alt = '';
      logo.width = logo.height = 48;
      logo.loading = 'lazy';
      logo.decoding = 'async';
      label.textContent = school.name;
      hint.textContent = 'View schedule →';
      label.append(hint);
      link.append(logo, label);
      item.append(link);
      return item;
    }));
  }
}

// Browser-tab icon: the conference logo by default, or a school's logo on its own pages.
function setPageIcon(src) {
  const icon = document.getElementById('page-icon');
  if (icon) icon.href = src || 'assets/logos/shore-conference.svg';
}
