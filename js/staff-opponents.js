// Manages each school's opponent shortlist and adds non-conference schools by name.
function startStaffOpponents(client, { currentSchool, activeSchools, onChanged = () => {} }) {
  const status = document.getElementById('opponents-status');
  const nameInput = document.getElementById('opponent-name');
  const addForm = document.getElementById('opponent-add-form');
  const list = document.getElementById('opponent-list');
  const submit = addForm.querySelector('button[type="submit"]');
  let directory = [];
  let selected = new Set();
  let directoryState = 'loading';
  let request = 0;
  let saving = false;
  let active = true;

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

  function render() {
    const school = currentSchool();
    if (!school) return;
    submit.disabled = saving;
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
          ? 'The opponent list is not set up yet. Ask the site admin to apply the opponent directory migration.'
          : 'The opponent list could not load. Check your connection or access, then try again.';
        return false;
      }
      directory = data ?? [];
      directoryState = 'ready';
      return true;
    } catch {
      if (!active) return false;
      directoryState = 'error';
      status.textContent = 'The opponent list could not load. Check your connection, then try again.';
      return false;
    }
  }

  async function load() {
    const school = currentSchool();
    const current = ++request;
    selected = new Set();
    nameInput.value = '';
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
    const name = nameInput.value.trim().replace(/\s+/g, ' ');
    if (!school) return;
    if (!name) {
      status.textContent = 'Enter a school name to add it to your list.';
      return;
    }
    if (name.length > 100) {
      status.textContent = 'School names must be 100 characters or fewer.';
      return;
    }
    if (name.toLocaleLowerCase() === school.name.trim().toLocaleLowerCase()) {
      status.textContent = 'Your school cannot be its own opponent.';
      return;
    }
    if (entries().some(item => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
      status.textContent = name + ' is already on your opponent list.';
      return;
    }

    saving = true;
    submit.disabled = true;
    try {
      const { data, error } = await client.rpc('add_school_opponent', {
        p_school: school.slug,
        p_name: name,
      });
      if (!active) return;
      if (error) {
        if (['42883', '42P01', 'PGRST202', 'PGRST205'].includes(error.code)) {
          status.textContent = 'Manual opponent lists are not set up yet. Ask the site admin to apply the opponent directory migration.';
        } else if (error.code === '42501') {
          status.textContent = 'You do not have permission to change this school’s opponent list.';
        } else if (error.code === '22023') {
          status.textContent = error.message || 'Check the school name and try again.';
        } else {
          status.textContent = 'The opponent was not added. Check your connection and try again.';
        }
        return;
      }
      nameInput.value = '';
      await loadDirectory(true);
      const refreshed = await load();
      status.textContent = data?.added
        ? (refreshed ? data.name + ' was added to your opponent list.'
          : data.name + ' was added, but the list could not refresh. Reload the tab to see it.')
        : data?.name + ' is already on your opponent list.';
    } catch {
      if (active) status.textContent = 'The opponent was not added. Check your connection and try again.';
    } finally {
      if (active) {
        saving = false;
        submit.disabled = false;
      }
    }
  }

  async function removeOpponent(item) {
    const school = currentSchool();
    if (!school || !selected.has(item.slug)) return;
    try {
      const { error } = await client.from('school_opponents').delete()
        .eq('school_id', school.slug).eq('opponent_slug', item.slug);
      if (!active) return;
      if (error) {
        status.textContent = 'That school could not be removed. Refresh the list and try again.';
        return;
      }
      await load();
      status.textContent = item.name + ' was removed. Games already saved keep their opponent.';
    } catch {
      if (active) status.textContent = 'That school could not be removed. Check your connection and try again.';
    }
  }

  addForm.onsubmit = event => { event.preventDefault(); return addOpponent(); };

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
      nameInput.value = '';
      list.replaceChildren();
      status.textContent = '';
    },
    stop() {
      active = false;
      request++;
      addForm.onsubmit = null;
      list.replaceChildren();
    },
  };
}
