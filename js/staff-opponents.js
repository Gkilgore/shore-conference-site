// Manages each school's opponent shortlist and the site-admin NJSIAA directory upload.
function makeOpponentSlug(name) {
  return String(name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/g, '');
}

function previewOpponentDirectoryCsv(text) {
  const rows = typeof parseCsv === 'function' ? parseCsv(text) : [];
  if (!rows.length) return { rows: [], errors: ['The file is empty.'] };
  const header = rows[0].map(value => value.trim().toLowerCase().replace(/ /g, '_'));
  const nameIndex = header.indexOf('name') >= 0 ? header.indexOf('name') : header.indexOf('school_name');
  const slugIndex = header.indexOf('slug');
  if (nameIndex < 0) return { rows: [], errors: ['The CSV needs a name column.'] };
  const data = rows.slice(1);
  if (data.length > 2000) return { rows: [], errors: ['Upload up to 2,000 schools at a time.'] };
  const seen = new Set();
  return {
    errors: [],
    rows: data.map((cells, index) => {
      const name = (cells[nameIndex] ?? '').trim().replace(/\s+/g, ' ');
      const enteredSlug = slugIndex < 0 ? '' : (cells[slugIndex] ?? '').trim();
      const slug = enteredSlug || makeOpponentSlug(name);
      let issue = '';
      if (!name) issue = 'School name is missing.';
      else if (name.length > 100) issue = 'School name is longer than 100 characters.';
      else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) issue = 'Add a valid slug or leave it blank to generate one.';
      else if (seen.has(slug)) issue = 'This slug appears more than once in the file.';
      if (!issue) seen.add(slug);
      return { line: index + 2, name, slug, issue };
    }),
  };
}

function startStaffOpponents(client, { currentSchool, activeSchools, canImport, onChanged = () => {} }) {
  const status = document.getElementById('opponents-status');
  const search = document.getElementById('opponent-search');
  const addSelect = document.getElementById('opponent-add-school');
  const addForm = document.getElementById('opponent-add-form');
  const list = document.getElementById('opponent-list');
  const importSection = document.getElementById('opponent-directory-import');
  const fileInput = document.getElementById('opponent-directory-file');
  const templateButton = document.getElementById('opponent-directory-template');
  const previewButton = document.getElementById('opponent-directory-preview-button');
  const summary = document.getElementById('opponent-directory-summary');
  const preview = document.getElementById('opponent-directory-preview');
  const saveDirectory = document.getElementById('opponent-directory-save');
  let directory = [];
  let selected = new Set();
  let previewRows = [];
  let directoryState = 'loading';
  let request = 0;
  let active = true;

  importSection.hidden = !canImport;

  function getDirectoryEntry(slug) {
    return directory.find(item => item.slug === slug) ?? null;
  }

  function hasSchoolProfile(slug) {
    return activeSchools().some(item => item.slug === slug);
  }

  function entries() {
    return [...selected].map(getDirectoryEntry).filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function refreshAddOptions() {
    const school = currentSchool();
    const query = search.value.trim().toLocaleLowerCase();
    const available = directory.filter(item => item.slug !== school?.slug && !selected.has(item.slug) &&
      (!query || item.name.toLocaleLowerCase().includes(query)));
    addSelect.replaceChildren(new Option(
      available.length ? 'Choose a school' : query ? 'No schools match' : 'No more schools to add', '',
    ), ...available.map(item => new Option(item.name, item.slug)));
    addForm.querySelector('button[type="submit"]').disabled = !available.length || directoryState !== 'ready';
  }

  function render() {
    const school = currentSchool();
    if (!school) return;
    refreshAddOptions();
    const ownEntries = entries().filter(item => item.slug !== school.slug);
    list.replaceChildren(...(ownEntries.length ? ownEntries.map(item => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'opponent-entry-name';
      label.textContent = item.name;
      const identity = document.createElement('span');
      identity.className = 'opponent-entry-identity';
      identity.textContent = hasSchoolProfile(item.slug) ? 'School profile' : 'Directory only';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button secondary';
      remove.textContent = 'Remove';
      remove.setAttribute('aria-label', 'Remove ' + item.name + ' from your opponent list');
      remove.onclick = () => removeOpponent(item);
      row.append(label, identity, remove);
      return row;
    }) : [Object.assign(document.createElement('li'), {
      className: 'staff-empty',
      textContent: directoryState === 'ready' ? 'Your opponent list is empty.' : 'Your opponent list could not load.',
    })]));
    onChanged();
  }

  async function loadDirectory(force = false) {
    if (directoryState === 'ready' && !force) return true;
    directoryState = 'loading';
    try {
      const { data, error } = await client.from('opponent_directory').select('slug,name').order('name');
      if (!active) return false;
      if (error) {
        directoryState = 'error';
        status.textContent = ['42P01', 'PGRST205'].includes(error.code)
          ? 'The opponent directory is not set up yet. Ask the site admin to apply the opponent directory migration.'
          : 'The opponent directory could not load. Check your connection or access, then try again.';
        return false;
      }
      directory = data ?? [];
      directoryState = 'ready';
      return true;
    } catch {
      if (!active) return false;
      directoryState = 'error';
      status.textContent = 'The opponent directory could not load. Check your connection, then try again.';
      return false;
    }
  }

  async function load() {
    const school = currentSchool();
    const current = ++request;
    selected = new Set();
    list.replaceChildren();
    if (!school) return false;
    status.textContent = 'Loading your opponent list…';
    if (!await loadDirectory()) {
      if (active && current === request) render();
      return false;
    }
    try {
      const { data, error } = await client.from('school_opponents')
        .select('opponent_slug').eq('school_id', school.slug);
      if (!active || current !== request) return false;
      if (error) {
        status.textContent = 'Your opponent list could not load. Check your access, then try again.';
        render();
        return false;
      }
      selected = new Set((data ?? []).map(item => item.opponent_slug));
      status.textContent = '';
      render();
      return true;
    } catch {
      if (!active || current !== request) return false;
      status.textContent = 'Your opponent list could not load. Check your connection, then try again.';
      render();
      return false;
    }
  }

  async function addOpponent() {
    const school = currentSchool();
    const slug = addSelect.value;
    if (!school || !getDirectoryEntry(slug) || selected.has(slug)) return;
    const submit = addForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    const { error } = await client.from('school_opponents').insert({
      school_id: school.slug, opponent_slug: slug,
    });
    if (!active) return;
    status.textContent = error ? 'That school could not be added. Refresh the list and try again.'
      : getDirectoryEntry(slug).name + ' was added to your opponent list.';
    if (!error) await load();
    else submit.disabled = false;
  }

  async function removeOpponent(item) {
    const school = currentSchool();
    if (!school || !selected.has(item.slug)) return;
    const { error } = await client.from('school_opponents').delete()
      .eq('school_id', school.slug).eq('opponent_slug', item.slug);
    if (!active) return;
    status.textContent = error ? 'That school could not be removed. Refresh the list and try again.'
      : item.name + ' was removed. Games already saved keep their opponent.';
    if (!error) await load();
  }

  function previewDirectory() {
    const file = fileInput.files?.[0];
    if (!file) {
      summary.textContent = 'Choose a CSV file first.';
      preview.hidden = true;
      saveDirectory.hidden = true;
      return;
    }
    if (file.size > 1048576 || !/\.csv$/i.test(file.name)) {
      summary.textContent = file.size > 1048576 ? 'The file is over 1 MB. Split it into smaller CSV files.'
        : 'Choose a CSV file.';
      preview.hidden = true;
      saveDirectory.hidden = true;
      return;
    }
    file.text().then(text => {
      if (!active) return;
      const result = previewOpponentDirectoryCsv(text);
      previewRows = result.rows;
      preview.replaceChildren(...previewRows.map(item => {
        const row = document.createElement('p');
        row.className = item.issue ? 'opponent-directory-problem' : '';
        row.textContent = 'Row ' + item.line + ': ' + (item.name || '(no name)') +
          (item.issue ? ' — ' + item.issue : ' · ' + item.slug);
        return row;
      }));
      preview.hidden = !previewRows.length;
      const ready = previewRows.filter(item => !item.issue).length;
      const problems = previewRows.length - ready;
      summary.textContent = result.errors.length ? result.errors.join(' ')
        : ready + ' ready' + (ready === 1 ? ' school' : ' schools') +
          (problems ? ' · ' + problems + ' problem ' + (problems === 1 ? 'row' : 'rows') + ' will be skipped.' : '.');
      saveDirectory.hidden = !ready;
    }).catch(() => {
      summary.textContent = 'The CSV file could not be read. Choose it again.';
      preview.hidden = true;
      saveDirectory.hidden = true;
    });
  }

  async function importDirectory() {
    const rows = previewRows.filter(item => !item.issue).map(({ slug, name }) => ({ slug, name }));
    if (!rows.length) return;
    saveDirectory.disabled = true;
    summary.textContent = 'Saving the directory…';
    try {
      const { data, error } = await client.rpc('import_opponent_directory', { p_rows: rows });
      if (!active) return;
      if (error) {
        summary.textContent = error.code === '42501'
          ? 'Only a site admin can update the master school list.'
          : 'The directory was not saved. Check the CSV and your connection, then try again.';
        saveDirectory.disabled = false;
        return;
      }
      await loadDirectory(true);
      summary.textContent = (data?.imported ?? rows.length) + ' schools added or updated. Existing AD lists were kept.';
      preview.hidden = true;
      saveDirectory.hidden = true;
      saveDirectory.disabled = false;
      fileInput.value = '';
      render();
    } catch {
      if (!active) return;
      summary.textContent = 'The directory may not have saved. Reload the directory before trying again.';
      saveDirectory.disabled = false;
    }
  }

  function downloadTemplate() {
    const blob = new Blob(['name,slug\nColts Neck,colts-neck\nNew Jersey Example School,\n'], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'njsiaa-schools-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  search.oninput = refreshAddOptions;
  addForm.onsubmit = event => { event.preventDefault(); addOpponent(); };
  templateButton.onclick = downloadTemplate;
  previewButton.onclick = previewDirectory;
  saveDirectory.onclick = importDirectory;

  return {
    load,
    loadDirectory,
    entries,
    directory: () => directory,
    entry: getDirectoryEntry,
    state: () => directoryState,
    reset() {
      request++;
      selected = new Set();
      list.replaceChildren();
      status.textContent = '';
    },
    stop() {
      active = false;
      request++;
      addForm.onsubmit = search.oninput = null;
      templateButton.onclick = previewButton.onclick = saveDirectory.onclick = null;
      list.replaceChildren();
    },
  };
}
