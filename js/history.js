// Enhances the History tab with sourced stories, decade navigation and a filterable athlete gallery.
(() => {
  const root = document.getElementById('history');
  if (!root) return;
  const data = shoreHistory;
  document.getElementById('history-original').open = false;
  const make = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const link = (text, href) => {
    const element = make('a', text);
    element.href = href;
    return element;
  };
  const sourceLinks = record => {
    const group = make('p', '', 'history-citations');
    group.append(make('span', 'Sources: '));
    record.sources.forEach((id, index) => {
      if (index) group.append(' · ');
      group.append(link(data.sources[id].publisher, '#history-source-' + id));
    });
    if (record.locator) group.append(' · ' + record.locator);
    return group;
  };
  function photoFigure(key, eager = false) {
    const photo = data.photos[key];
    const figure = make('figure', '', 'history-photo');
    const img = make('img');
    Object.assign(img, { src: photo.src, alt: photo.alt, width: photo.width, height: photo.height, loading: eager ? 'eager' : 'lazy', decoding: 'async' });
    const caption = make('figcaption');
    caption.append(link(photo.credit, photo.source), ' · ', link(photo.license, photo.licenseUrl));
    figure.append(img, caption);
    return figure;
  }
  document.getElementById('history-hero-photo').append(photoFigure('rampone', true));
  const decades = [...new Set(data.milestones.map(item => Math.floor(item.year / 10) * 10))];
  const decadeControls = document.getElementById('history-decades');
  const timeline = document.getElementById('history-events');
  const decadeStatus = document.getElementById('history-decade-status');
  const buttons = [];
  const events = [];
  let activeDecade = 'all';
  for (const decade of ['all', ...decades]) {
    const button = make('button', decade === 'all' ? 'All years' : decade + 's', 'button secondary');
    button.type = 'button';
    button.setAttribute('aria-controls', 'history-events');
    button.addEventListener('click', () => selectDecade(decade));
    decadeControls.append(button);
    buttons.push({ button, decade });
  }
  for (const item of data.milestones) {
    const li = make('li');
    const details = make('details', '', 'history-event');
    details.id = item.id;
    const summary = make('summary');
    summary.append(make('span', item.date, 'history-date'), make('span', item.title, 'history-event-title'), make('span', item.summary, 'history-event-intro'));
    const body = make('div', '', 'history-expanded');
    if (item.photo) body.append(photoFigure(item.photo));
    body.append(make('p', item.detail), sourceLinks(item));
    details.append(summary, body);
    li.append(details);
    timeline.append(li);
    events.push({ item, li, details });
  }
  function selectDecade(decade) {
    activeDecade = decade;
    for (const entry of buttons) entry.button.setAttribute('aria-pressed', String(entry.decade === decade));
    let count = 0;
    for (const entry of events) {
      entry.li.hidden = decade !== 'all' && Math.floor(entry.item.year / 10) * 10 !== decade;
      if (!entry.li.hidden) count++;
    }
    decadeStatus.textContent = (decade === 'all' ? 'All decades' : decade + 's') + ' · ' + count + ' milestones';
  }
  selectDecade(decades[0]);
  // Ordinary buttons stay in the Tab order; arrow keys are an additional shortcut.
  decadeControls.addEventListener('keydown', event => {
    const index = buttons.findIndex(entry => entry.button === event.target);
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
    if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = buttons.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    buttons[next].button.focus();
    selectDecade(buttons[next].decade);
  });

  const sportSelect = document.getElementById('history-sport');
  const eraSelect = document.getElementById('history-era');
  for (const sport of [...new Set(data.athletes.flatMap(item => item.sports))].sort()) sportSelect.add(new Option(sport, sport));
  for (const decade of [...new Set(data.athletes.map(item => item.decade))].sort()) eraSelect.add(new Option(decade + 's', decade));
  const cards = [];
  const groups = [
    { key: 'conference', target: document.getElementById('history-athletes') },
    { key: 'shore-area', target: document.getElementById('history-shore-greats') },
    { key: 'research', target: document.getElementById('history-membership-research') }
  ];
  function athleteCard(athlete) {
    const card = make('article', '', 'history-athlete');
    card.id = athlete.id;
    if (athlete.photo) card.append(photoFigure(athlete.photo));
    else {
      const mark = make('div', '', 'history-school-mark');
      const logo = make('img');
      const school = shoreSchools[athlete.slug];
      if (school) {
        Object.assign(logo, { src: school.logo, alt: athlete.school + ' school mark', width: 100, height: 100, loading: 'lazy' });
        mark.append(logo);
      }
      mark.append(make('span', 'School mark · portrait not yet available', 'doc-meta'));
      card.append(mark);
    }
    const body = make('div', '', 'history-card-body');
    body.append(make('p', athlete.sports.join(' / '), 'eyebrow'), make('h4', athlete.name));
    const schoolLine = make('p', '', 'history-school-line');
    schoolLine.append(link(athlete.school, 'school.html?school=' + encodeURIComponent(athlete.slug)), ' · ' + athlete.era);
    body.append(schoolLine, make('p', athlete.summary));
    const detail = make('details');
    detail.append(make('summary', 'Career and sources'));
    const expanded = make('div', '', 'history-expanded');
    expanded.append(make('p', athlete.detail));
    if (athlete.note) expanded.append(make('p', athlete.note, 'history-note'));
    expanded.append(sourceLinks(athlete));
    detail.append(expanded);
    body.append(detail);
    card.append(body);
    return card;
  }
  for (const group of groups) {
    for (const athlete of data.athletes.filter(item => item.membership === group.key)) {
      const card = athleteCard(athlete);
      group.target.append(card);
      cards.push({ athlete, card });
    }
  }
  function filterAthletes() {
    const selected = new Set(filterHistoryAthletes(data.athletes, sportSelect.value, eraSelect.value).map(item => item.id));
    for (const { athlete, card } of cards) card.hidden = !selected.has(athlete.id);
    for (const group of groups) group.target.closest('[data-history-group]').hidden = !cards.some(({ athlete }) => athlete.membership === group.key && selected.has(athlete.id));
    document.getElementById('history-results').textContent = selected.size + (selected.size === 1 ? ' profile' : ' profiles') + ' · era means school years';
    document.getElementById('history-empty').hidden = selected.size !== 0;
  }
  sportSelect.addEventListener('change', filterAthletes);
  eraSelect.addEventListener('change', filterAthletes);
  document.getElementById('history-reset').addEventListener('click', () => {
    sportSelect.value = 'all'; eraSelect.value = 'all'; filterAthletes();
  });
  filterAthletes();

  const stories = document.getElementById('history-stories');
  for (const item of data.stories) {
    const card = make('article', '', 'history-story' + (item.featured ? ' history-featured' : ''));
    card.id = item.id;
    if (item.photo) card.append(photoFigure(item.photo));
    const body = make('div', '', 'history-card-body');
    body.append(make('p', item.date, 'history-date'), make('h4', item.title), make('p', item.summary));
    const details = make('details');
    details.append(make('summary', 'Read the story'));
    const expanded = make('div', '', 'history-expanded');
    expanded.append(make('p', item.detail), sourceLinks(item));
    details.append(expanded);
    body.append(details);
    card.append(body);
    stories.append(card);
  }
  for (const item of data.membership) {
    const li = make('li'); li.id = item.id;
    li.append(make('p', item.date, 'history-date'), make('h4', item.title), make('p', item.summary), sourceLinks(item));
    document.getElementById('history-membership').append(li);
  }
  for (const [id, source] of Object.entries(data.sources)) {
    const li = make('li'); li.id = 'history-source-' + id;
    li.append(link(source.title, source.url), make('p', source.publisher + ' · Checked ' + source.checked, 'doc-meta'));
    if (source.note) li.append(make('p', source.note, 'doc-meta'));
    document.getElementById('history-source-list').append(li);
  }
  for (const photo of Object.values(data.photos)) {
    const li = make('li');
    li.append(link(photo.alt, photo.source), make('p', photo.credit + ' · ' + photo.changes, 'doc-meta'), link(photo.license, photo.licenseUrl));
    document.getElementById('history-photo-credits').append(li);
  }
  // A shared link must reveal an item even if the visitor previously filtered it out.
  function revealHash() {
    const id = location.hash.slice(1);
    const event = events.find(entry => entry.item.id === id);
    if (event) {
      const decade = Math.floor(event.item.year / 10) * 10;
      if (activeDecade !== 'all' && activeDecade !== decade) selectDecade(decade);
      event.details.open = true;
    }
    const athlete = cards.find(entry => entry.athlete.id === id);
    if (athlete) {
      sportSelect.value = 'all'; eraSelect.value = 'all'; filterAthletes();
      athlete.card.querySelector('details').open = true;
    }
    const target = document.getElementById(id);
    if (target && root.contains(target)) {
      for (let parent = target.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (parent.tagName === 'DETAILS') parent.open = true;
      }
      requestAnimationFrame(() => target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
    }
  }
  addEventListener('hashchange', revealHash);
  addEventListener('popstate', revealHash);
  if (location.hash !== '#history') revealHash();
  root.classList.add('history-ready');
})();
