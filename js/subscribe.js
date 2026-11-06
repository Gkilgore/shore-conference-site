// Builds subscription and download URLs from the family's selected calendar, with no login required.
(() => {
  const form = document.getElementById('subscription-filters');
  const fields = form.elements;
  const status = document.getElementById('subscription-status');
  const actions = document.getElementById('subscription-actions');
  const link = document.getElementById('subscription-url');
  const copyStatus = document.getElementById('subscription-copy-status');
  const query = new URLSearchParams(location.search);
  let requestNumber = 0;
  const schools = typeof shoreSchools !== 'undefined' ? shoreSchools : {};
  for (const [slug, school] of Object.entries(schools).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
    fields.school.add(new Option(school.name, slug));
  }
  const sports = [...new Set(Object.values(sportSeasons).flat().map(sport => sport.replace(/^(Boys|Girls) /, '')))];
  if (query.get('sport') && query.get('sport').length <= 100) sports.push(query.get('sport'));
  for (const sport of [...new Set(sports)].sort()) fields.sport.add(new Option(sport, sport));
  fields.scope.value = query.get('scope') === 'conference' ? 'conference' : 'school';
  for (const name of ['school', 'sport', 'gender', 'level', 'season', 'search']) {
    if (query.has(name)) fields[name].value = query.get(name);
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', update);
  let searchTimer;
  fields.search.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(update, 300); });
  document.getElementById('copy-subscription').onclick = async () => {
    try { await navigator.clipboard.writeText(link.value); copyStatus.textContent = 'Subscription link copied.'; }
    catch { link.focus(); link.select(); copyStatus.textContent = 'Select and copy the subscription URL above.'; }
  };

  async function update() {
    const request = ++requestNumber;
    actions.hidden = true;
    copyStatus.textContent = '';
    const conference = fields.scope.value === 'conference';
    // Keep an optional school filter for conference subscriptions entered from the conference page.
    document.getElementById('subscription-school-label').firstChild.textContent = conference ? 'School (optional)' : 'School';
    fields.school.options[0].textContent = conference ? 'All schools' : 'Choose a school';
    if (!conference && !fields.school.value) { status.textContent = 'Choose a school to get started.'; return; }
    const options = { scope: fields.scope.value };
    for (const name of ['school', 'sport', 'gender', 'level', 'season', 'search']) {
      if (fields[name].value) options[name] = fields[name].value;
    }
    history.replaceState(null, '', '?' + new URLSearchParams(options));
    status.textContent = 'Checking this calendar…';
    try {
      const schedule = await loadPublicCalendar(options);
      if (request !== requestNumber) return;
      for (const event of schedule.events) {
        if (![...fields.sport.options].some(option => option.value === event.sport)) fields.sport.add(new Option(event.sport, event.sport));
      }
      const url = calendarFeedUrl(options);
      link.value = url;
      document.getElementById('subscribe-apple').href = url.replace(/^https?:/, 'webcal:');
      document.getElementById('subscribe-google').href = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(url);
      document.getElementById('download-calendar').href = url + '&download=1';
      document.getElementById('subscription-name').textContent = schedule.name;
      status.textContent = schedule.events.length + (schedule.events.length === 1 ? ' game' : ' games') +
        ' currently listed. ' + (conference ? 'New matching games will be included automatically.' : 'New posted games appear as schedules are published.');
      actions.hidden = false;
    } catch (error) {
      if (request === requestNumber) status.textContent = error.status === 404
        ? error.message : 'Subscriptions are temporarily unavailable. Refresh to try again.';
    }
  }
  if (query.get('school') && !Object.hasOwn(schools, query.get('school'))) {
    actions.hidden = true;
    status.textContent = 'School not found. Choose a school from the directory.';
    return;
  }
  update();
})();
