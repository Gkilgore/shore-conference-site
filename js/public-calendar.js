// Reads published calendars and prepares app-independent subscription links.
function calendarFeedUrl(options = {}, format = 'ics') {
  const url = new URL('/functions/v1/public-calendar', shoreSupabase.url);
  for (const [key, value] of Object.entries(options)) if (value) url.searchParams.set(key, value);
  if (format !== 'ics') url.searchParams.set('format', format);
  return url.href;
}

async function loadPublicCalendar(options) {
  const response = await fetch(calendarFeedUrl(options, 'json'), { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (response.status === 404) {
    const error = new Error('School not found. Choose a school from the directory.');
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error('The schedule didn’t load. Refresh to try again.');
  return response.json();
}

function publicCalendarEvents(schedule) {
  return schedule.events.map(game => ({ ...game,
    classNames: game.status === 'Scheduled' ? [] : ['is-' + game.status.toLowerCase()],
    bus: game.transportation?.bus_departure
      ? 'Bus ' + new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
        .format(new Date('2000-01-01T' + game.transportation.bus_departure)) : '',
  }));
}

function setSubscriptionLink(options) {
  const link = document.getElementById('subscribe-calendar');
  if (!link) return;
  const sample = new URLSearchParams(location.search).get('sample') === '1';
  link.hidden = sample;
  if (sample) return;
  const filters = document.getElementById('calendar-filters');
  const update = () => {
    const query = new URLSearchParams(options);
    for (const name of ['school', 'sport', 'gender', 'level', 'search']) {
      const value = filters?.elements[name]?.value;
      if (value) query.set(name, value);
    }
    link.href = 'subscribe.html?' + query;
  };
  filters?.addEventListener('input', update);
  filters?.addEventListener('reset', () => setTimeout(update, 0));
  update();
}
