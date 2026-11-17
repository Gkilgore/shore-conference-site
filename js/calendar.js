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
  // Squares are narrow, so levels are shortened there: "Boys F Football".
  const shortLevel = level => ({ Varsity: 'V', Freshman: 'F' })[level] ?? level;
  // and genders to a letter: "(B) F Football", "(G) JV Soccer".
  const shortGender = gender => ({ Boys: '(B)', Girls: '(G)', Coed: '(C)' })[gender] ?? gender;
  // Month, week and day squares on a school calendar stay short: the team's name, or the opponent
  // once a sport is chosen. Clicking a game opens the full details. The conference
  // calendar keeps both schools in the square.
  function squareLabel(event) {
    const { sport, gender, level, status } = event.extendedProps;
    // The conference square shows a status as its own label, so the title drops it.
    if (fields.school) return status && event.title.endsWith(' · ' + status) ? event.title.slice(0, -status.length - 3) : event.title;
    const team = [gender, level, sport].filter(Boolean).join(' ');
    if (!team || !event.title.startsWith(team)) return event.title;
    if (!fields.sport?.value) return [shortGender(gender), shortLevel(level), sport].filter(Boolean).join(' ');
    let rest = event.title.slice(team.length).replace(/^\s*·?\s*/, '');
    if (status && rest.endsWith(' · ' + status)) rest = rest.slice(0, -status.length - 3);
    return rest || team;
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
      matchup: [shortGender(gender), shortLevel(level), sport].filter(Boolean).join(' ') + (other ? (home ? ' vs. ' : ' @ ') + other : '') };
  }
  // For school-specific calendars, apply colors based on home/away status using CSS variables
  // set by the school page (--school-color and --school-accent).
  function schoolCalendarSquare(event) {
    if (fields.school || !schoolSlug) return null;
    // Handle both direct property (sample data) and extendedProps (real FullCalendar events)
    const homeAway = event.home_away ?? event.extendedProps?.home_away;
    if (!homeAway) return null;
    const isHome = homeAway === 'Home';
    // Store the CSS variable name so we can apply it, and also store the computed color value
    return { 
      color: isHome ? 'var(--school-color)' : 'var(--school-accent)',
      colorVariable: isHome ? '--school-color' : '--school-accent',
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
    return (rest || event.title).replace(/(^| )at (?=\S)/, '$1@ ');
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
  const calendar = new FullCalendar.Calendar(target, {
    initialView: preferredCalendarView(),
    headerToolbar: {
      start: 'title',
      center: 'dayGridMonth,timeGridWeek,listMonth,listDay',
      end: 'prev,next',
    },
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
    eventDidMount({ el }) {
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
      title.textContent = (inList ? event.title : (square?.useSchoolColor ? squareLabel(event) : (square?.matchup ?? squareLabel(event))))
        .replace(/(^| )at (?=\S)/, '$1@ ');
      // Time and Home/Away share the first line so the square stays short.
      const head = document.createElement('span');
      head.className = 'game-head';
      const displayedTime = movedTo ? '' : (event.allDay ? 'TBD' : timeText) + (movedFrom ? '*' : '');
      if (inList && movedFrom) title.textContent = '* ' + title.textContent;
      // List rows: a Postponed or Canceled label leads the title, as in Next games.
      const listStatus = event.extendedProps.status;
      if (inList && listStatus && !['Scheduled', 'Moved'].includes(listStatus)) {
        if (title.textContent.endsWith(' · ' + listStatus)) title.textContent = title.textContent.slice(0, -listStatus.length - 3);
        const label = document.createElement('span');
        label.className = 'game-status is-' + listStatus.toLowerCase();
        label.textContent = listStatus;
        title.prepend(label, ' ');
      }
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
        // For CSS variables, use the CSS variable for text color
        if (square.colorVariable) {
          content.style.setProperty('color', square.colorVariable === '--school-color' 
            ? 'var(--school-ink)' 
            : 'var(--accent-ink)');
        }
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
      if (inList && details.length) {
        const line = document.createElement('small');
        line.textContent = details.join(' · ');
        content.append(line);
      }
      return { domNodes: [content] };
    },
  });
  filters.addEventListener('submit', event => event.preventDefault());
  filters.addEventListener('input', () => calendar.refetchEvents());
  filters.addEventListener('reset', () => setTimeout(() => calendar.refetchEvents(), 0));
  // A "schedules are now posted" link opens the calendar on that season's first month with games.
  window.addEventListener('shore:season-selected', ({ detail }) => {
    if (!detail) return;
    calendar.gotoDate(detail.date);
    calendar.refetchEvents();
  });
  calendar.render();
  followPreferredView(calendar);
}

// The game pop-up. A colored band names the team and the matchup, in the same colors as the game on the
// calendar: on a school page (schoolColors) the school color for home games, its accent for away games and
// grey for postponed or canceled ones; elsewhere navy, yellow for postponed and red for canceled.
// Below it: when, where (with directions), bus and early dismissal, the original slot of a moved game, and notes.
function createGameDetails(calendar, { schoolColors = false } = {}) {
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
        <form method="dialog"><button class="button secondary" autofocus>Close</button></form>
      </div>
    </div>
  `;
  calendar.after(dialog);
  // A click on the dimmed backdrop closes the pop-up.
  dialog.addEventListener?.('click', event => { if (event.target === dialog) dialog.close(); });

  const dayFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const clock = value => value ? timeFormat.format(new Date('2000-01-01T' + value)) : '';
  return event => {
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
    heading.textContent = (rest || event.title).replace(/(^| )at (?=\S)/, '$1@ ');
    const teamLine = dialog.querySelector('.game-card-team');
    teamLine.textContent = rest ? team : '';
    if (status !== 'Scheduled') {
      const label = document.createElement('span');
      label.className = 'game-status is-' + status.toLowerCase();
      label.textContent = status;
      teamLine.append(label);
    }
    dialog.className = 'game-details game-card is-' + status.toLowerCase() +
      (schoolColors ? ' uses-school-colors is-' + (homeAway === 'Away' ? 'away' : 'home') : '');

    const when = event.start ? dayFormat.format(event.start) + ' · ' + (event.allDay ? 'Time TBD' : timeFormat.format(event.start) + ' ET')
      : 'Date and time to be announced';
    const bus = details.bus || (game.transportation?.bus_departure ? 'Bus ' + clock(game.transportation.bus_departure) : '');
    const rows = [['When', when], ['Where', details.location || 'To be announced']];
    if (details.moved_from) rows.push(['Originally', details.moved_from.text]);
    if (bus) rows.push(['Bus', bus.replace(/^Bus /, '')]);
    if (details.earlyDismissal) rows.push(['Early dismissal', details.earlyDismissal]);
    const notes = details.notes ?? game.notes;
    if (notes) rows.push(['Notes', notes]);
    dialog.querySelector('dl').replaceChildren(...rows.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      return [term, description];
    }));

    const directions = dialog.querySelector('[data-directions]');
    directions.hidden = !details.location;
    if (details.location) directions.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(details.location);
    const bracket = dialog.querySelector('[data-tournament-bracket]');
    // The bracket page is switched off for now. Use "!details.tournament_id" here to bring the link back.
    bracket.hidden = true;
    if (details.tournament_id) bracket.href = 'tournament.html?id=' + encodeURIComponent(details.tournament_id) +
      (details.match_id ? '#match-' + encodeURIComponent(details.match_id) : '');
    dialog.showModal();
  };
}
