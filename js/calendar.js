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
function renderCalendar(events) {
  const target = document.getElementById('calendar');
  const filters = document.getElementById('calendar-filters');
  if (!window.FullCalendar) {
    filters.hidden = true;
    target.textContent = 'The calendar could not load. Check your connection and refresh.';
    return;
  }

  const fields = filters.elements;
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
      const day = monthDay.format(new Date(next));
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

  const showGameDetails = createGameDetails(target);
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
      showGameDetails(event);
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
      const query = fields.search.value.trim().toLowerCase();
      const firstDay = range.startStr.slice(0, 10);
      const afterLastDay = range.endStr.slice(0, 10);
      const matches = events.filter(game =>
        (!fields.school?.value || game.schools.includes(fields.school.value)) &&
        (!fields.sport.value || game.sport === fields.sport.value) &&
        (!fields.gender?.value || game.gender === fields.gender.value) &&
        (!fields.level.value || game.level === fields.level.value) &&
        (game.title + ' ' + game.location).toLowerCase().includes(query));
      const results = matches.filter(game =>
        game.start.slice(0, 10) >= firstDay && game.start.slice(0, 10) < afterLastDay);
      document.getElementById('filter-count').textContent = results.length
        ? results.length + (results.length === 1 ? ' game' : ' games') + ' in this view. Select a game for details.' : '';
      showEmpty(results, matches, afterLastDay);
      // Tells the page which team and which part of the year are on screen.
      window.dispatchEvent(new CustomEvent('shore:calendar-view', { detail: {
        sport: fields.sport.value, gender: fields.gender?.value ?? '', level: fields.level.value,
        date: new Date((range.start.getTime() + range.end.getTime()) / 2).toISOString().slice(0, 10),
      } }));
      showEvents(results);
    },
    eventContent({ event, timeText, view }) {
      const content = document.createElement('div');
      const inList = view.type.startsWith('list');
      content.className = 'game';
      const title = document.createElement('span');
      title.className = 'game-title';
      title.textContent = event.title;
      if (!inList && timeText) {
        const time = document.createElement('span');
        time.className = 'game-time';
        time.textContent = timeText;
        content.append(time);
      }
      content.append(title);
      const details = [event.extendedProps.location, event.extendedProps.bus].filter(Boolean);
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

function createGameDetails(calendar) {
  const dialog = document.createElement('dialog');
  dialog.className = 'game-details';
  dialog.setAttribute('aria-labelledby', 'game-details-title');
  dialog.innerHTML = `
    <p class="eyebrow">Game details</p>
    <h2 id="game-details-title"></h2>
    <dl></dl>
    <p><a class="button secondary" data-tournament-bracket hidden>View tournament bracket</a></p>
    <form method="dialog"><button class="button secondary" autofocus>Close</button></form>
  `;
  calendar.after(dialog);

  const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeStyle: 'short' });
  return event => {
    const details = event.extendedProps;
    const rows = [
      ['When', event.start ? dateFormat.format(event.start) + ' ET' : 'Time to be announced'],
      ['Venue', details.location || 'To be announced'],
      ['Status', details.status || 'Scheduled'],
    ];
    if (details.bus) rows.push(['Transportation', details.bus]);
    const bracket = dialog.querySelector('[data-tournament-bracket]');
    bracket.hidden = !details.tournament_id;
    if (details.tournament_id) bracket.href = 'tournament.html?id=' + encodeURIComponent(details.tournament_id) +
      (details.match_id ? '#match-' + encodeURIComponent(details.match_id) : '');
    dialog.querySelector('h2').textContent = event.title;
    dialog.querySelector('dl').replaceChildren(...rows.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      return [term, description];
    }));
    dialog.showModal();
  };
}
