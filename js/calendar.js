// Configures the shared calendar and updates its events when filters change.

// Phones (including landscape and "desktop site" mode) and small tablets start in the list view.
// Rotating or resizing across that size switches between the list and the month grid.
const listViewQuery = matchMedia('(max-width: 768px), (pointer: coarse) and (max-width: 1000px)');

function preferredCalendarView() {
  return listViewQuery.matches ? 'listMonth' : 'dayGridMonth';
}

function followPreferredView(calendar) {
  const update = () => calendar.changeView(preferredCalendarView());
  listViewQuery.addEventListener('change', update);
  return () => listViewQuery.removeEventListener('change', update);
}

// Squares and the game pop-up are narrow, so levels and genders are shortened: "(B) F Football", "(G) JV Soccer".
const shortLevel = level => ({ Varsity: 'V', Freshman: 'F' })[level] ?? level;
const shortGender = gender => ({ Boys: '(B)', Girls: '(G)', Coed: '(C)' })[gender] ?? gender;
// List rows, Next games and the pop-up name the team on one line ("Girls Frsh Soccer") and the matchup
// ("@ Colts Neck") on the next. Levels read Varsity, JV and Frsh.
const displaySport = ({ gender, sport } = {}) =>
  gender && sport?.toLowerCase().startsWith(gender.toLowerCase() + ' ')
    ? sport.slice(gender.length + 1) : sport;
const cardTeam = ({ gender, level, sport } = {}) =>
  [gender, ({ Freshman: 'Frsh' })[level] ?? level, displaySport({ gender, sport })].filter(Boolean).join(' ');
function matchupParts(text) {
  const format = text.match(/\s*\/\s*(VS\/JV\s+\d+\s+quarters?)\s*$/i);
  let matchup = (format ? text.slice(0, format.index) : text).trim();
  const away = matchup.match(/^(?:at|@)\s+/i);
  const home = matchup.match(/^vs\.?\s+/i);
  if (away) matchup = '@ ' + matchup.slice(away[0].length).replace(/^(?:at|@)\s+/i, '').trim();
  else if (home) matchup = 'vs. ' + matchup.slice(home[0].length).replace(/^vs\.?\s+/i, '').trim();
  return { matchup };
}
function splitTeamTitle(title, details = {}) {
  const team = [details.gender, details.level, details.sport].filter(Boolean).join(' ');
  const at = team ? title.indexOf(team) : -1;
  if (at < 0) return { team: '', matchup: title };
  return { team: (title.slice(0, at) + cardTeam(details)).trim(),
    matchup: matchupParts(title.slice(at + team.length).replace(/^\s*·?\s*/, '')).matchup };
}
function cardTeamLine(team) {
  const line = document.createElement('span');
  line.className = 'game-card-sport';
  line.textContent = team;
  return line;
}

function renderCalendar(events, { schoolSlug = null } = {}) {
  const target = document.getElementById('calendar');
  const filters = document.getElementById('calendar-filters');
  if (!window.FullCalendar || !target || !filters) {
    if (filters) filters.hidden = true;
    if (target) target.textContent = 'The calendar could not load. Check your connection and refresh.';
    return;
  }

  const fields = filters.elements;
  let singleTeam = false;
  // Month, week and day squares on a school calendar stay short: the team's name, or the opponent
  // once a sport is chosen. Clicking a game opens the full details. The conference
  // calendar keeps both schools in the square.
  function squareLabel(event) {
    const { sport, gender, level, status } = event.extendedProps;
    // The conference square shows a status as its own label, so the title drops it.
    if (fields.school) return status && event.title.endsWith(' · ' + status) ? event.title.slice(0, -status.length - 3) : event.title;
    const team = [gender, level, sport].filter(Boolean).join(' ');
    if (!team || !event.title.startsWith(team)) return event.title;
    if (!fields.sport?.value) return [shortGender(gender), shortLevel(level), displaySport({ gender, sport })]
      .filter(Boolean).join(' ');
    let rest = event.title.slice(team.length).replace(/^\s*·?\s*/, '');
    if (status && rest.endsWith(' · ' + status)) rest = rest.slice(0, -status.length - 3);
    return matchupParts(rest).matchup || team;
  }
  // Conference calendar: a scheduled game takes the home school's main color (saved by the school when the page
  // loaded it, otherwise the site's school list). Postponed, canceled and moved games keep their status colors.
  function conferenceHomeColor(event) {
    if (!fields.school) return null;
    const { status, homeColor, moved_to: movedTo, schools: involved = [] } = event.extendedProps;
    if (movedTo || (status && status !== 'Scheduled')) return null;
    const directory = typeof shoreSchools !== 'undefined' ? shoreSchools : sampleSchools;
    const color = homeColor || directory[involved[0]]?.color;
    return /^#[0-9a-f]{6}$/i.test(color ?? '') ? color : null;
  }
  // Conference calendar squares keep the conference colors (navy, yellow for postponed, red for
  // canceled). Each has three lines: the school's name (the picked school's when the School filter is
  // set, otherwise the home school), the time, then the team and opponent.
  function conferenceSquare(event) {
    if (!fields.school) return null;
    const involved = event.extendedProps.schools ?? [];
    const slug = involved.includes(fields.school.value) ? fields.school.value : involved[0];
    const directory = typeof shoreSchools !== 'undefined' ? shoreSchools : sampleSchools;
    const home = slug === involved[0];
    if (!directory[slug]) return null;
    const other = directory[involved[home ? 1 : 0]]?.name;
    const { sport, gender, level } = event.extendedProps;
    return { school: directory[slug].name, homeAway: home ? 'Home' : 'Away',
      matchup: [shortGender(gender), shortLevel(level), displaySport({ gender, sport })].filter(Boolean).join(' ') +
        (other ? (home ? ' vs. ' : ' @ ') + other : '') };
  }
  // School calendars: a home game is filled with the school's main color; an away game is light grey with a
  // frame in that color, so home and away tell apart at a glance whatever the school's second color is.
  function schoolCalendarSquare(event) {
    if (fields.school || !schoolSlug) return null;
    // Handle both direct property (sample data) and extendedProps (real FullCalendar events)
    const homeAway = event.home_away ?? event.extendedProps?.home_away;
    if (!homeAway) return null;
    const isHome = homeAway === 'Home';
    // Store the CSS variable name so we can apply it, and also store the computed color value
    return { 
      color: isHome ? 'var(--school-color)' : 'var(--paper)',
      colorVariable: isHome ? '--school-color' : '--paper',
      homeAway: homeAway,
      useSchoolColor: true  // Flag to indicate this uses school colors, not conference display
    };
  }
  // "vs. Colts Neck" or "at Colts Neck": the event title without its team name and status.
  function opponentText(event) {
    const { sport, gender, level, status } = event.extendedProps;
    const team = [gender, level, sport].filter(Boolean).join(' ');
    let rest = team && event.title.startsWith(team) ? event.title.slice(team.length).replace(/^\s*·?\s*/, '') : event.title;
    if (status && rest.endsWith(' · ' + status)) rest = rest.slice(0, -status.length - 3);
    return matchupParts(rest || event.title).matchup;
  }
  // With one sport on screen, a short label such as "Girls JV" beside the time tells its teams apart.
  function teamTag(event) {
    if (fields.school || !fields.sport?.value || singleTeam) return null;
    const { gender, level } = event.extendedProps;
    const text = [shortGender(gender), shortLevel(level)].filter(Boolean).join(' ');
    if (!text) return null;
    const tag = document.createElement('span');
    tag.className = 'game-team-tag';
    tag.textContent = text;
    tag.title = [gender, level].filter(Boolean).join(' ');
    return tag;
  }
  if (fields.school) {
    const schools = typeof shoreSchools !== 'undefined' ? shoreSchools : sampleSchools;
    for (const [slug, school] of Object.entries(schools).sort(([, first], [, second]) => first.name.localeCompare(second.name))) {
      fields.school.add(new Option(school.name, slug));
    }
  }
  const levels = [...new Set(events.map(game => game.level))].sort();
  for (const level of levels) fields.level.add(new Option(level, level));
  // No season filter on public calendars: the month view covers it, and sports are grouped by season.
  fillSportOptions(null, fields.sport, events);

  // Shown between the filters and the calendar when nothing matches: says why and offers the way out.
  const empty = document.createElement('div');
  const emptyText = document.createElement('p');
  const emptyAction = document.createElement('button');
  const monthDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  empty.className = 'calendar-empty';
  empty.hidden = true;
  emptyText.setAttribute('role', 'status');
  emptyAction.type = 'button';
  emptyAction.className = 'button secondary';
  empty.append(emptyText, emptyAction);
  filters.after(empty);

  function showEmpty(results, matches, afterLastDay) {
    empty.hidden = results.length > 0;
    if (results.length) return;
    const filtered = ['school', 'sport', 'gender', 'level', 'search'].some(name => fields[name]?.value);
    const next = matches.map(game => game.start).filter(start => start.slice(0, 10) >= afterLastDay).sort()[0];
    if (next) {
      const day = monthDay.format(new Date(next.slice(0, 10) + 'T12:00'));
      emptyText.textContent = 'No games in this view. Next game: ' + day + '.';
      emptyAction.textContent = 'Go to ' + day;
      emptyAction.onclick = () => calendar.gotoDate(next.slice(0, 10));
    } else {
      emptyText.textContent = matches.length ? 'No games in this view.'
        : filtered ? 'No games match these filters.' : 'No games are posted yet.';
      emptyAction.textContent = 'Clear filters';
      emptyAction.onclick = () => filters.reset();
    }
    emptyAction.hidden = !next && !filtered;
  }

  const showGameDetails = createGameDetails(target, { schoolColors: Boolean(schoolSlug) });
  // Phones fold the filters behind a Filters button in the calendar header; it shows how many are set.
  // A school page's heading names the filtered team: "Full schedule", "Football schedule", "Girls JV Lacrosse schedule".
  const heading = document.getElementById('calendar-title');
  function syncHeading() {
    if (!heading) return;
    const team = cardTeam({ gender: fields.gender?.value, level: fields.level?.value, sport: fields.sport?.value });
    heading.textContent = team ? team + ' schedule' : 'Full schedule';
  }
  function syncFiltersButton() {
    syncHeading();
    const button = target.querySelector('.fc-filtersToggle-button');
    if (!button) return;
    const active = [...fields].filter(field => field.name && field.value.trim()).length;
    button.textContent = 'Filters' + (active ? ' · ' + active : '');
    button.setAttribute('aria-expanded', String(filters.classList.contains('is-open')));
    button.setAttribute('aria-controls', 'calendar-filters');
  }
  const calendar = new FullCalendar.Calendar(target, {
    initialView: preferredCalendarView(),
    headerToolbar: {
      start: 'title',
      center: 'dayGridMonth,timeGridWeek,listMonth,listDay filtersToggle',
      end: 'prev,next',
    },
    customButtons: {
      filtersToggle: { text: 'Filters', click: () => { filters.classList.toggle('is-open'); syncFiltersButton(); } },
    },
    datesSet: () => syncFiltersButton(),
    views: {
      dayGridMonth: { buttonText: 'Month', dayMaxEvents: 2 },
      timeGridWeek: { buttonText: 'Week', eventMaxStack: 2 },
      listMonth: { buttonText: 'List' },
      listDay: { buttonText: 'Day' },
    },
    moreLinkClick: 'listDay',
    moreLinkText: count => '+' + count + ' more',
    navLinks: true,
    navLinkDayClick: 'listDay',
    eventOrder: 'start,title',
    eventInteractive: true,
    eventClick({ event }) {
      // A "moved" note on the old date jumps to the game's new date instead of opening details.
      const movedTo = event.extendedProps.moved_to;
      if (movedTo) calendar.gotoDate(movedTo.start.slice(0, 10));
      else showGameDetails(event);
    },
    eventDidMount({ el, event }) {
      // A postponed or canceled list row strikes out the old time and puts the status label under it.
      const status = event.extendedProps.status;
      const timeCell = el.querySelector?.('.fc-list-event-time');
      if (timeCell && (status === 'Postponed' || status === 'Canceled')) {
        const oldTime = document.createElement('s');
        oldTime.textContent = timeCell.textContent;
        const label = document.createElement('span');
        label.className = 'game-status is-' + status.toLowerCase();
        label.textContent = status;
        timeCell.replaceChildren(oldTime, label);
      }
      const homeColor = conferenceHomeColor(event);
      if (homeColor) {
        const ink = readableInk(homeColor);
        if (timeCell) timeCell.style.cssText += ';background:' + homeColor + ';color:' + ink;
        else {
          for (const [name, value] of [['--fc-event-bg-color', homeColor], ['--fc-event-border-color', homeColor],
            ['--fc-event-text-color', ink], ['background', homeColor], ['color', ink]]) el.style.setProperty(name, value);
        }
      }
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-haspopup', 'dialog');
      el.addEventListener('keydown', key => {
        if (key.key !== 'Enter' && key.key !== ' ') return;
        key.preventDefault();
        key.stopPropagation();
        el.click();
      });
    },
    lazyFetching: false,
    height: 'auto',
    noEventsText: 'No games in this view.',
    events(range, showEvents) {
      const query = (fields.search?.value ?? '').trim().toLowerCase();
      const firstDay = range.startStr.slice(0, 10);
      const afterLastDay = range.endStr.slice(0, 10);
      const matches = events.filter(game =>
        (!fields.school?.value || (game.schools ?? []).includes(fields.school?.value)) &&
        (!fields.sport?.value || game.sport === fields.sport?.value) &&
        (!fields.gender?.value || game.gender === fields.gender?.value) &&
        (!fields.level?.value || game.level === fields.level?.value) &&
        (game.title + ' ' + game.location).toLowerCase().includes(query));
      const results = matches.filter(game =>
        game.start.slice(0, 10) >= firstDay && game.start.slice(0, 10) < afterLastDay);
      // Read aloud by screen readers when filters change; not shown on screen.
      document.getElementById('filter-count').textContent = results.length
        ? results.length + (results.length === 1 ? ' game shown.' : ' games shown.') : '';
      showEmpty(results, matches, afterLastDay);
      // With one team on screen the squares need no team tag.
      singleTeam = Boolean(fields.sport?.value) &&
        new Set(matches.map(game => [game.sport, game.gender, game.level].join('|'))).size === 1;
      // Tells the page which team and which part of the year are on screen.
      window.dispatchEvent(new CustomEvent('shore:calendar-view', { detail: {
        sport: fields.sport?.value, gender: fields.gender?.value ?? '', level: fields.level?.value,
        date: new Date((range.start.getTime() + range.end.getTime()) / 2).toISOString().slice(0, 10),
      } }));
      // School-page squares carry a class so the status fills (yellow, red) step aside for the school's color.
      // The conference calendar keeps its own colors.
      // A "moved" note keeps its plain white look on school pages too.
      // is-home and is-away color the List view's time cell like the squares.
      showEvents(schoolSlug ? results.map(game => game.moved_to ? game : ({ ...game,
        classNames: [...(game.classNames ?? []), 'school-colored', game.home_away === 'Away' ? 'is-away' : 'is-home'] })) : results);
    },
    eventContent({ event, timeText, view }) {
      const content = document.createElement('div');
      const inList = view.type.startsWith('list');
      content.className = 'game';
      const title = document.createElement('span');
      title.className = 'game-title';
      // Moved games: the old date keeps a note saying where the game went, and the game at its new date
      // gets an asterisk after its time.
      const { moved_to: movedTo, moved_from: movedFrom } = event.extendedProps;
      const square = inList ? null : (conferenceSquare(event) || (movedTo ? null : schoolCalendarSquare(event)));
      // For school calendars (useSchoolColor), don't try to show matchup
      // Calendar views write an away game as "@ Colts Neck" to save space.
      const listParts = inList ? splitTeamTitle(event.title, event.extendedProps) : null;
      title.textContent = (inList ? listParts.matchup : (square?.useSchoolColor ? squareLabel(event) : (square?.matchup ?? squareLabel(event))))
        .replace(/(^| )at (?=\S)/, '$1@ ');
      // Time and Home/Away share the first line so the square stays short.
      const head = document.createElement('span');
      head.className = 'game-head';
      const displayedTime = movedTo ? '' : (event.allDay ? 'TBD' : timeText) + (movedFrom ? '*' : '');
      if (inList && movedFrom) title.textContent = '* ' + title.textContent;
      // List rows: a Postponed or Canceled label goes under the struck-out time (see eventDidMount).
      const listStatus = event.extendedProps.status;
      if (inList && listStatus && title.textContent.endsWith(' · ' + listStatus)) {
        title.textContent = title.textContent.slice(0, -listStatus.length - 3);
      }
      // School pages: a Home or Away tag leads the opponent in List rows, as on the month squares.
      const listHomeAway = inList && schoolSlug && !movedTo ? createHomeAwayBadge(event.extendedProps.home_away) : null;
      if (listHomeAway) title.prepend(listHomeAway, ' ');
      if (listParts?.team) title.prepend(cardTeamLine(listParts.team));
      if (displayedTime && (!inList || event.allDay)) {
        const time = document.createElement('span');
        time.className = 'game-time';
        time.textContent = displayedTime;
        head.append(time);
      }
      const tag = inList ? null : teamTag(event);
      if (tag) head.append(tag);
      // Only show home/away badge on school calendars, not conference calendars (color already conveys this)
      if (square?.useSchoolColor) {
        const homeAway = createHomeAwayBadge(square?.homeAway ?? event.extendedProps.game?.home_away ?? event.extendedProps.home_away ?? event.home_away);
        if (homeAway) head.append(homeAway);
      }
      // Only show the top section (school name + status) for conference square, not school calendar
      if (square && !square.useSchoolColor) {
        const top = document.createElement('span');
        top.className = 'game-head';
        const school = document.createElement('span');
        school.className = 'game-school';
        school.textContent = square.school;
        if (school.textContent) top.append(school);
        // Top right: the time, or the status word in its place for a postponed or canceled game. The yellow
        // or red fill shows the status too; the word is for anyone who can't tell the colors apart.
        const status = event.extendedProps.status || event.status;
        if (status && status !== 'Scheduled') {
          const label = document.createElement('span');
          label.className = 'game-status on-fill';
          label.textContent = status;
          top.append(label);
        } else if (displayedTime) {
          const time = document.createElement('span');
          time.className = 'game-time';
          time.textContent = displayedTime;
          top.append(time);
        }
        head.replaceChildren();
        if (top.childNodes.length) content.append(top);
      } else if (square && square.useSchoolColor) {
        // For school calendars, apply the color styling
        content.classList.add('has-school-color');
        // Use setProperty for CSS variables to work in inline styles
        content.style.setProperty('background', square.color);
        content.style.setProperty('color', square.homeAway === 'Home' ? 'var(--school-ink)' : 'var(--ink)');
        if (square.homeAway !== 'Home') content.classList.add('is-away-square');
        // Two lines: the team on the left with the time on the right (a Postponed or Canceled label takes
        // the time's place), then the opponent. "vs." or "at" says home or away, so no badge is needed.
        const { sport, gender, level } = event.extendedProps;
        const status = event.extendedProps.status || event.status;
        const top = document.createElement('span');
        top.className = 'game-head';
        const team = document.createElement('span');
        team.className = 'game-school';
        team.textContent = [shortGender(gender), shortLevel(level), sport].filter(Boolean).join(' ');
        top.append(team);
        if (status && status !== 'Scheduled') {
          // The square turns grey so a gold or yellow school color is never mistaken for Postponed;
          // the yellow or red label says which.
          content.style.setProperty('background', 'var(--steel)');
          content.style.setProperty('color', 'var(--ink)');
          const label = document.createElement('span');
          label.className = 'game-status is-' + status.toLowerCase();
          label.textContent = status;
          top.append(label);
        } else if (displayedTime) {
          const time = document.createElement('span');
          time.className = 'game-time';
          time.textContent = displayedTime;
          top.append(time);
        }
        head.replaceChildren();
        content.append(top);
        title.textContent = opponentText(event);
      }
      if (movedTo && !inList && !square) {
        const label = document.createElement('span');
        label.className = 'game-status on-fill';
        label.textContent = 'Moved';
        head.append(label);
      }
      if (head.childNodes.length) content.append(head);
      content.append(title);
      if (movedTo && !inList) {
        const line = document.createElement('span');
        line.className = 'game-moved';
        line.textContent = 'To ' + movedTo.text;
        content.append(line);
      }
      const details = [event.extendedProps.location, event.extendedProps.bus,
        event.extendedProps.earlyDismissal && 'Early dismissal ' + event.extendedProps.earlyDismissal].filter(Boolean);
      content.title = 'View details: ' + event.title;
      if (inList && (details.length || (event.extendedProps.location && !movedTo))) {
        const line = document.createElement('small');
        line.className = 'game-list-details';
        line.textContent = details.join(' · ');
        // List rows get a Directions link when the game has a venue.
        if (event.extendedProps.location && !movedTo) {
          line.append(directionsPart(details.length, event.extendedProps.location, event.extendedProps.schools));
        }
        content.append(line);
      }
      return { domNodes: [content] };
    },
  });
  filters.addEventListener('submit', event => event.preventDefault());
  filters.addEventListener('input', () => { calendar.refetchEvents(); syncFiltersButton(); });
  filters.addEventListener('reset', () => setTimeout(() => { calendar.refetchEvents(); syncFiltersButton(); }, 0));
  // A "schedules are now posted" link opens the calendar on that season's first month with games.
  window.addEventListener('shore:season-selected', ({ detail }) => {
    if (!detail) return;
    calendar.gotoDate(detail.date);
    calendar.refetchEvents();
  });
  calendar.render();
  followPreferredView(calendar);
}

// Venue addresses come from the schools' saved venue lists, which anyone may read. Loaded once, on first use,
// as a map of "school|venue name" to address.
let venueAddressList = null;
function loadVenueAddresses() {
  return venueAddressList ??= (async () => {
    if (typeof shoreSupabase === 'undefined') return new Map();
    try {
      const url = new URL('/rest/v1/school_venues', shoreSupabase.url);
      url.searchParams.set('select', 'school_id,name,address');
      const response = await fetch(url, { signal: AbortSignal.timeout(8000),
        headers: { apikey: shoreSupabase.publishableKey, Authorization: 'Bearer ' + shoreSupabase.publishableKey } });
      if (!response.ok) return new Map();
      const rows = await response.json();
      return new Map(rows.filter(row => row.address).map(row => [row.school_id + '|' + row.name.trim().toLowerCase(), row.address]));
    } catch { return new Map(); }
  })();
}
// The venue's address: first a venue of a school in this game, then any school's venue with that name.
function findVenueAddress(map, location, schools = []) {
  const name = location.trim().toLowerCase();
  for (const school of schools) if (map.has(school + '|' + name)) return map.get(school + '|' + name);
  for (const [key, address] of map) if (key.endsWith('|' + name)) return address;
  return '';
}
const directionsUrl = place => 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place);
// The Directions link with the dot before it, in one piece so phones can hide both (the pop-up has Directions).
function directionsPart(afterText, location, schools) {
  const part = document.createElement('span');
  part.className = 'game-directions-part';
  part.append(afterText ? ' · ' : '', createDirectionsLink(location, schools));
  return part;
}
// A small "Directions" link for game rows. It searches the venue name, then the saved address once loaded.
// Its clicks stay inside it, so a row that opens the game pop-up does not open as well.
function createDirectionsLink(location, schools) {
  const link = document.createElement('a');
  link.className = 'game-directions';
  link.textContent = 'Directions';
  link.target = '_blank';
  link.rel = 'noopener';
  link.href = directionsUrl(location);
  link.setAttribute('aria-label', 'Directions to ' + location + ' (opens in a new tab)');
  for (const type of ['click', 'keydown']) link.addEventListener(type, event => event.stopPropagation());
  loadVenueAddresses().then(map => {
    const address = findVenueAddress(map, location, schools);
    if (address) link.href = directionsUrl(location + ', ' + address);
  });
  return link;
}

// The game pop-up. A colored band names the team and the matchup: maroon on the conference calendar, and on a
// school page (schoolColors) the school color for home games and its accent for away games. A postponed or
// canceled game's band is grey everywhere, with its yellow or red label. Below it: when, where (the venue's
// saved address and directions), the original slot of a moved game, bus, early dismissal and notes.
// Staff pages pass onEdit to add an Edit game button, and canEdit to hide it from read-only viewers.
function createGameDetails(calendar, { schoolColors = false, onEdit = null, canEdit = () => true } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'game-details game-card';
  dialog.setAttribute('aria-labelledby', 'game-details-title');
  dialog.innerHTML = `
    <div class="game-card-band">
      <p class="game-card-team"></p>
      <h2 id="game-details-title"></h2>
    </div>
    <div class="game-card-body">
      <dl></dl>
      <div class="actions">
        <a class="button secondary" data-directions target="_blank" rel="noopener">Directions<span class="visually-hidden"> (opens in a new tab)</span></a>
        <a class="button secondary" data-tournament-bracket hidden>View tournament bracket</a>
        <button class="button primary" type="button" data-edit hidden>Edit game</button>
        <form method="dialog"><button class="button secondary" autofocus>Close</button></form>
      </div>
    </div>
  `;
  calendar.after(dialog);
  // A click on the dimmed backdrop closes the pop-up.
  dialog.addEventListener?.('click', event => { if (event.target === dialog) dialog.close(); });

  let shown = 0;
  const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const clock = value => value ? timeFormat.format(new Date('2000-01-01T' + value)) : '';
  return event => {
    const editButton = dialog.querySelector('[data-edit]');
    editButton.hidden = !onEdit || !canEdit();
    editButton.onclick = () => {
      dialog.close();
      onEdit(event);
    };
    const details = event.extendedProps;
    const game = details.game ?? {};
    const teams = game.teams ?? {};
    const sport = details.sport ?? teams.sport, gender = details.gender ?? teams.gender, level = details.level ?? teams.level;
    const status = details.status ?? game.status ?? 'Scheduled';
    const homeAway = details.home_away ?? game.home_away;
    // "Girls Varsity Soccer" in the band's small line; the rest of the title ("@ Marlboro") is the heading.
    const team = [gender, level, sport].filter(Boolean).join(' ');
    let rest = event.title.replace(new RegExp(' · (' + status + '|TBD)$'), '').replace(/ · TBD$/, '');
    if (team && rest.startsWith(team)) rest = rest.slice(team.length).replace(/^\s*·?\s*/, '');
    const heading = dialog.querySelector('h2');
    const formatted = matchupParts(rest || event.title);
    heading.textContent = formatted.matchup;
    const teamLine = dialog.querySelector('.game-card-team');
    teamLine.textContent = rest ? cardTeam({ gender, level, sport }) : '';
    if (status !== 'Scheduled') {
      const label = document.createElement('span');
      label.className = 'game-status is-' + status.toLowerCase();
      label.textContent = status;
      teamLine.append(label);
    }
    dialog.className = 'game-details game-card is-' + status.toLowerCase() +
      (schoolColors ? ' uses-school-colors is-' + (homeAway === 'Away' ? 'away' : 'home') : '');

    // "Tue, Nov 3 · 3:45 PM" fits on one line; every calendar page already says times are Eastern.
    const when = event.start ? dayFormat.format(event.start) + ' · ' + (event.allDay ? 'Time TBD' : timeFormat.format(event.start))
      : 'Date and time to be announced';
    const bus = details.bus || (game.transportation?.bus_departure ? 'Bus ' + clock(game.transportation.bus_departure) : '');
    const rows = [['When', when], ['Where', details.location || 'To be announced']];
    if (details.moved_from) rows.push(['Originally', details.moved_from.text]);
    if (details.pickup) rows.push(['Pickup', details.pickup]);
    if (bus) rows.push(['Bus', bus.replace(/^Bus /, '')]);
    if (details.earlyDismissal) rows.push(['Early dismissal', details.earlyDismissal]);
    const notes = (details.notes ?? game.notes ?? '')
      .replace(/(?:^|\s*·\s*)VS\/JV\s+\d+\s+quarters?\s*$/i, '').trim();
    if (notes) rows.push(['Notes', notes]);
    dialog.querySelector('dl').replaceChildren(...rows.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      if (label === 'When') description.className = 'game-card-when';
      return [term, description];
    }));

    const directions = dialog.querySelector('[data-directions]');
    directions.hidden = !details.location;
    if (details.location) directions.href = directionsUrl(details.location);
    // Fill in the address once the venue list has loaded, unless another game was opened meanwhile.
    const opened = ++shown;
    const schools = details.schools ?? [game.school_id, game.opponent_school_id].filter(Boolean);
    if (details.location) loadVenueAddresses().then(map => {
      const address = findVenueAddress(map, details.location, schools);
      if (!address || opened !== shown) return;
      const where = [...dialog.querySelectorAll('dt')].find(term => term.textContent === 'Where')?.nextElementSibling;
      if (where) {
        const line = document.createElement('span');
        line.className = 'game-card-address';
        line.textContent = address;
        where.append(line);
      }
      directions.href = directionsUrl(details.location + ', ' + address);
    });
    const bracket = dialog.querySelector('[data-tournament-bracket]');
    // The bracket page is switched off for now. Use "!details.tournament_id" here to bring the link back.
    bracket.hidden = true;
    if (details.tournament_id) bracket.href = 'tournament.html?id=' + encodeURIComponent(details.tournament_id) +
      (details.match_id ? '#match-' + encodeURIComponent(details.match_id) : '');
    dialog.showModal();
  };
}
