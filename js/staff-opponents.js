// Loads searchable opponents and manages each school's private saved schools.
function startStaffOpponents(client, { currentSchool, onChanged = () => {} }) {
  const status = document.getElementById('opponents-status');
  const addForm = document.getElementById('opponent-add-form');
  const list = document.getElementById('opponent-list');
  const deleteDialog = document.getElementById('delete-opponent-dialog');
  const deleteSummary = document.getElementById('delete-opponent-summary');
  const deleteConfirm = document.getElementById('delete-opponent-confirm');
  let directory = [], state = 'loading', request = 0, active = true, deleting = null;
  const entry = slug => directory.find(item => item.slug === slug) ?? null;
  const entries = () => directory.filter(item => item.source === 'custom'
    && item.added_by_school === currentSchool()?.slug).sort((a, b) => a.name.localeCompare(b.name));
  const errorText = (error, fallback) => error?.code === '42501'
    ? 'You do not have access to change this school.'
    : error?.code === '23505' ? 'That school is already saved.'
    : error?.code === '22023' ? error.message : fallback;

  function render() {
    const own = entries();
    list.replaceChildren(...(own.length ? own.map(item => {
      const row = document.createElement('li');
      const label = document.createElement('span');
      label.className = 'opponent-entry-details';
      const name = document.createElement('strong');
      name.textContent = item.name;
      label.append(name);
      if (item.address) {
        const address = document.createElement('small');
        address.textContent = item.address;
        label.append(address);
      }
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'button secondary';
      rename.textContent = 'Rename';
      rename.setAttribute('aria-label', 'Rename ' + item.name);
      rename.onclick = () => editRow(row, item);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'button secondary';
      remove.textContent = 'Delete';
      remove.setAttribute('aria-label', 'Delete ' + item.name);
      remove.onclick = () => {
        deleting = item;
        deleteSummary.textContent = 'Delete ' + item.name + '? Games already saved keep the school’s name.';
        deleteDialog.showModal();
      };
      row.append(label, rename, remove);
      return row;
    }) : [Object.assign(document.createElement('li'), {
      className: 'staff-empty', textContent: 'Schools you add while entering games show up here.',
    })]));
    onChanged();
  }

  function editRow(row, item) {
    const form = document.createElement('form');
    form.className = 'filters opponent-rename-form';
    const name = document.createElement('input');
    name.value = item.name;
    name.maxLength = 100;
    name.required = true;
    name.setAttribute('aria-label', 'School name');
    const address = document.createElement('input');
    address.value = item.address ?? '';
    address.maxLength = 300;
    address.setAttribute('aria-label', 'Address, optional');
    const save = document.createElement('button');
    save.type = 'submit';
    save.className = 'button primary';
    save.textContent = 'Save';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'button secondary';
    cancel.textContent = 'Cancel';
    cancel.onclick = render;
    form.append(name, address, save, cancel);
    form.onsubmit = async event => {
      event.preventDefault();
      save.disabled = true;
      const { error } = await client.rpc('rename_custom_opponent', {
        p_slug: item.slug, p_name: name.value.trim(), p_address: address.value.trim() || null,
      });
      if (!active) return;
      if (error) {
        status.textContent = errorText(error, 'The school could not be changed. Try again.');
        save.disabled = false;
      } else {
        await loadDirectory(true);
        render();
        status.textContent = 'School updated.';
      }
    };
    row.replaceChildren(form);
    name.focus();
  }

  async function loadDirectory(force = false) {
    if (state === 'ready' && !force) return true;
    const current = ++request;
    state = 'loading';
    try {
      const { data, error } = await client.from('opponent_directory')
        .select('slug,name,address,source,added_by_school').order('name');
      if (!active || current !== request) return false;
      if (error) throw error;
      directory = data ?? [];
      state = 'ready';
      onChanged();
      return true;
    } catch {
      if (!active || current !== request) return false;
      state = 'error';
      status.textContent = 'Schools could not load. Check your connection and try again.';
      return false;
    }
  }

  async function load() {
    status.textContent = 'Loading schools…';
    const ready = await loadDirectory(true);
    if (!active) return false;
    if (ready) status.textContent = '';
    render();
    return ready;
  }

  async function saveSchool(name, address = '') {
    const school = currentSchool();
    const cleaned = name.trim().replace(/\s+/g, ' ');
    if (!school || !cleaned) {
      status.textContent = 'Enter a school name.';
      return null;
    }
    if (cleaned.toLocaleLowerCase() === school.name.trim().toLocaleLowerCase()) {
      status.textContent = 'Your school cannot be its own opponent.';
      return null;
    }
    try {
      const { data, error } = await client.rpc('save_custom_opponent', {
        p_school: school.slug, p_name: cleaned, p_address: address.trim() || null,
      });
      if (!active) return null;
      if (error) {
        status.textContent = errorText(error, 'The school could not be saved. Try again.');
        return null;
      }
      await loadDirectory(true);
      render();
      status.textContent = data.added ? data.name + ' was saved.' : data.name + ' is ready to select.';
      return entry(data.slug) ?? data;
    } catch {
      if (active) status.textContent = 'The school could not be saved. Try again.';
      return null;
    }
  }

  addForm.onsubmit = async event => {
    event.preventDefault();
    const saved = await saveSchool(document.getElementById('opponent-name').value,
      document.getElementById('opponent-address').value);
    if (saved) addForm.reset();
  };
  deleteConfirm.onclick = async () => {
    if (!deleting) return;
    deleteConfirm.disabled = true;
    const item = deleting;
    const { error } = await client.rpc('delete_custom_opponent', { p_slug: item.slug });
    deleteConfirm.disabled = false;
    if (!active) return;
    if (error) {
      status.textContent = errorText(error, 'The school could not be deleted. Try again.');
      return;
    }
    deleting = null;
    deleteDialog.close();
    await loadDirectory(true);
    render();
    status.textContent = item.name + ' was deleted. Saved games keep its name.';
  };

  return {
    load, loadDirectory, saveSchool, entries, entry, directory: () => directory, state: () => state,
    reset() {
      request++;
      directory = [];
      state = 'loading';
      addForm.reset();
      list.replaceChildren();
      status.textContent = '';
    },
    stop() {
      active = false;
      request++;
      addForm.onsubmit = deleteConfirm.onclick = null;
      list.replaceChildren();
    },
  };
}
