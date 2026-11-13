// Renders public division and document lists from reviewed sources, with shareable filters.
(() => {
  const form = document.getElementById('resource-filters');
  if (!form) return;
  const kind = form.dataset.kind;
  const results = document.getElementById('resource-results');
  const count = document.getElementById('resource-count');
  const isDivisions = kind === 'divisions';
  const records = isDivisions ? shoreConferenceResources.divisionLists : shorePublicResources[kind];
  const node = (tag, value, className) => {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  const link = (title, href) => {
    const element = node('a', title);
    element.href = href;
    return element;
  };
  const names = values => [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
  for (const field of form.querySelectorAll('select')) {
    let options;
    if (field.name === 'school') {
      options = Object.entries(shoreSchools).map(([slug, school]) => [slug, school.name])
        .sort((a, b) => a[1].localeCompare(b[1]));
    } else {
      const key = isDivisions && field.name === 'sport' ? 'sports' :
        isDivisions && field.name === 'gender' ? 'genders' : field.name;
      options = names(records.flatMap(record => record[key] || [])).map(value => [value, value]);
      if (field.name === 'year') options.reverse();
    }
    for (const [value, title] of options) field.add(new Option(title, value));
  }
  const loadQuery = () => {
    const query = new URLSearchParams(location.search);
    for (const field of form.querySelectorAll('select, input')) {
      const value = query.get(field.name) || '';
      if (field.tagName === 'SELECT' && value && ![...field.options].some(option => option.value === value)) {
        // Keep an unavailable selection visible rather than quietly showing unrelated results.
        field.add(new Option('Unavailable: ' + value, value));
      }
      field.value = value;
    }
  };
  const filters = () => Object.fromEntries(new FormData(form));
  const members = values => {
    const list = document.createElement('ul');
    for (const slug of values) {
      const item = document.createElement('li');
      item.append(shoreSchools[slug] ? link(shoreSchools[slug].name, 'school.html?school=' + encodeURIComponent(slug)) : node('span', slug + ' (name in source)'));
      list.append(item);
    }
    return list;
  };
  function divisionCard(record, school) {
    const card = node('article', '', 'resource-card');
    card.append(node('h2', record.title));
    const label = record.season === 'Winter' ? 'Winter ' + record.year + '–' + String(record.year + 1).slice(2) : record.season + ' ' + record.year;
    card.append(node('p', label + ' · Shown for varsity · Reviewed ' + record.reviewed, 'resource-meta'));
    if (school) {
      const coverage = divisionCoverage(record, school);
      const name = shoreSchools[school]?.name || school;
      card.append(node('p', coverage.division ? name + ': ' + coverage.division :
        name + ': assignment not on file here. Check the official list.'));
      if (coverage.state === 'partial') card.append(node('p', 'Only part of this division has been checked. The full membership is in the official list.'));
      if (coverage.members.length) card.append(members(coverage.members));
    } else if (record.divisions) {
      card.append(node('p', 'Selected divisions only; this is not the full conference list.', 'resource-meta'));
      for (const [division, schools] of Object.entries(record.divisions)) {
        card.append(node('h3', division));
        if (record.complete) card.append(members(schools));
        else card.append(node('p', 'Membership is only partly checked. See the official list.'));
      }
    } else card.append(node('p', 'Source available; school assignments have not been copied here.'));
    card.append(link(record.title + ' — full list', record.url));
    return card;
  }
  function resourceCard(record) {
    const card = node('article', '', 'resource-card');
    card.append(node(kind === 'documents' ? 'h3' : 'h2', record.title), node('p', record.description));
    card.append(node('p', [record.category, record.sport, record.competition, record.year,
      'Source label: ' + record.version, 'Checked ' + record.reviewed].filter(Boolean).join(' · '), 'resource-meta'));
    if (record.note) card.append(node('p', record.note));
    card.append(link(record.title + ' (' + record.format + ')', record.url));
    return card;
  }
  const render = () => {
    const chosen = filters();
    const found = isDivisions ? selectDivisionLists(records, chosen) : selectPublicResources(records, chosen);
    const invalidSchool = isDivisions && chosen.school && !Object.hasOwn(shoreSchools, chosen.school);
    const shown = invalidSchool ? [] : found;
    results.replaceChildren(...shown.map(record => isDivisions ? divisionCard(record, chosen.school) : resourceCard(record)));
    count.textContent = shown.length + (isDivisions ? (shown.length === 1 ? ' division list' : ' division lists') :
      (shown.length === 1 ? ' resource' : ' resources')) + ' shown.';
    if (!shown.length) results.append(node('p', 'No resources match these filters. Clear filters to see what is on file.', 'resource-card'));
  };
  const update = () => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters())) if (value) query.set(key, value);
    history.replaceState(null, '', location.pathname + (query.size ? '?' + query : '') + location.hash);
    render();
  };
  form.addEventListener('submit', event => { event.preventDefault(); update(); });
  form.addEventListener('change', update);
  let searchTimer;
  form.addEventListener('input', event => {
    if (event.target.type !== 'search') return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(update, 200);
  });
  form.addEventListener('reset', () => setTimeout(update, 0));
  window.addEventListener('popstate', () => { loadQuery(); render(); });
  loadQuery();
  render();
  form.hidden = false;
})();
