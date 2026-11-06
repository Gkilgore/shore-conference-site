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
  // Open to the sports in season when there are games for it; "All seasons" shows the rest.
  fillSeasonFilters(fields.season, fields.sport, events);
  if (events.some(game => game.season === currentSeason())) fields.season.value = currentSeason();
  fillSportOptions(fields.season, fields.sport, events);

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
      const results = events.filter(game =>
        game.start.slice(0, 10) >= firstDay && game.start.slice(0, 10) < afterLastDay &&
        (!fields.school?.value || game.schools.includes(fields.school.value)) &&
        (!fields.season.value || game.season === fields.season.value) &&
        (!fields.sport.value || game.sport === fields.sport.value) &&
        (!fields.gender?.value || game.gender === fields.gender.value) &&
        (!fields.level.value || game.level === fields.level.value) &&
        (game.title + ' ' + game.location).toLowerCase().includes(query));
      document.getElementById('filter-count').textContent =
        results.length + (results.length === 1 ? ' game in this view.' : ' games in this view.');
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
  filters.addEventListener('input', event => {
    if (event.target === fields.season) fillSportOptions(fields.season, fields.sport, events);
    calendar.refetchEvents();
  });
  filters.addEventListener('reset', () => setTimeout(() => {
    fillSportOptions(fields.season, fields.sport, events);
    calendar.refetchEvents();
  }, 0));
  window.addEventListener('shore:season-selected', ({ detail }) => {
    if (!detail) return;
    fields.season.value = detail.season;
    fillSportOptions(fields.season, fields.sport, events);
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
