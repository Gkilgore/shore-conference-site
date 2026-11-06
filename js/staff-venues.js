// School venue lists: edited under School settings and offered as a dropdown in the game editor.
// Home games list the school's own venues; away games against a conference school list that school's.
const otherVenue = '__other';

function startStaffVenues(client, { currentSchool, schools, fields }) {
  const list = document.getElementById('venue-list');
  const addForm = document.getElementById('venue-add');
  const status = document.getElementById('venue-status');
  const picker = document.getElementById('venue-select');
  const pickerLabel = document.getElementById('venue-pick');
  const typedLabel = document.getElementById('venue-typed');
  let venues = [];
  let editable = false;
  let active = true;
  let request = 0;

  function namesFor(slug) {
    return venues.filter(venue => venue.school_id === slug).map(venue => venue.name)
      .sort((a, b) => a.localeCompare(b));
  }

  // Until the venue migration is applied, the demo schools use the lists in data/sample-data.js.
  function demoVenues() {
    if (typeof sampleSchools === 'undefined') return [];
    return Object.entries(sampleSchools).flatMap(([slug, school]) =>
      (school.venues ?? []).map(name => ({ id: slug + ':' + name, school_id: slug, name, address: null })));
  }

  async function load() {
    const current = ++request;
    const { data, error } = await client.from('school_venues').select('id,school_id,name,address');
    if (!active || current !== request) return;
    editable = !error;
    venues = error ? demoVenues() : data;
    showSettings();
    syncPicker(fields.location.value);
  }

  // ----- Game editor dropdown -----
  // Whose list applies: the school's own for home games, the opponent's for away games
  // against a conference school, and none (type it) for away games against anyone else.
  function venueOwner() {
    if (fields.home_away.value === 'Home') return currentSchool();
    return schools().find(school => school.slug === fields.opponent_school_id.value) ?? null;
  }

  function syncPicker(keep = fields.location.value) {
    const owner = venueOwner();
    const names = owner ? namesFor(owner.slug) : [];
    pickerLabel.hidden = !names.length;
    if (!names.length) {
      showTyped(true);
      fields.location.value = keep;
      return;
    }
    pickerLabel.firstChild.textContent = owner.name + ' venue ';
    picker.replaceChildren(new Option('Choose a ' + owner.name + ' venue', ''),
      ...names.map(name => new Option(name, name)), new Option('Other venue…', otherVenue));
    const match = names.find(name => name.toLowerCase() === keep.trim().toLowerCase());
    picker.value = match ?? (keep ? otherVenue : '');
    fields.location.value = match ?? keep;
    showTyped(picker.value === otherVenue);
  }

  function showTyped(typed) {
    typedLabel.hidden = !typed;
    fields.location.required = typed;
    picker.required = !pickerLabel.hidden && !typed;
  }

  picker.onchange = () => {
    const typed = picker.value === otherVenue;
    fields.location.value = typed ? '' : picker.value;
    showTyped(typed);
    if (typed) fields.location.focus();
  };
  const resync = () => syncPicker('');
  fields.home_away.addEventListener('change', resync);
  fields.opponent_school_id.addEventListener('change', resync);

  // ----- School settings list -----
  function button(label, onclick, aria) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'button secondary';
    element.textContent = label;
    element.setAttribute('aria-label', aria);
    element.onclick = onclick;
    return element;
  }

  function input(value, label, placeholder, maxLength) {
    const element = document.createElement('input');
    element.value = value ?? '';
    element.placeholder = placeholder;
    element.maxLength = maxLength;
    element.setAttribute('aria-label', label);
    return element;
  }

  function showSettings() {
    const school = currentSchool();
    if (!school) return;
    addForm.hidden = !editable;
    status.textContent = editable ? status.textContent
      : 'Venue lists are not set up yet. The dropdowns use the sample venues until the venue migration is installed.';
    const own = venues.filter(venue => venue.school_id === school.slug).sort((a, b) => a.name.localeCompare(b.name));
    list.replaceChildren(...(own.length ? own.map(venue => {
      const item = document.createElement('li');
      const name = input(venue.name, 'Venue name', 'Venue name', 160);
      const address = input(venue.address, 'Address for ' + venue.name, 'Address (optional)', 200);
      name.disabled = address.disabled = !editable;
      const save = button('Save', async () => {
        if (!name.value.trim()) { status.textContent = 'A venue needs a name.'; return; }
        save.disabled = true;
        const { error } = await client.from('school_venues')
          .update({ name: name.value.trim(), address: address.value.trim() || null }).eq('id', venue.id);
        if (!active) return;
        status.textContent = error
          ? 'That venue could not be saved. Each venue name must be different.'
          : 'Venue saved. Games already saved keep the old name.';
        load();
      }, 'Save ' + venue.name);
      save.hidden = true;
      name.oninput = address.oninput = () => { save.hidden = false; };
      const remove = button('Delete', async () => {
        if (remove.dataset.confirm !== 'yes') {
          remove.dataset.confirm = 'yes';
          remove.textContent = 'Confirm delete';
          remove.classList.add('is-danger');
          return;
        }
        remove.disabled = true;
        const { error } = await client.from('school_venues').delete().eq('id', venue.id);
        if (!active) return;
        status.textContent = error ? 'That venue could not be deleted.' : venue.name + ' was removed. Saved games keep it.';
        load();
      }, 'Delete ' + venue.name);
      remove.hidden = !editable;
      item.append(name, address, save, remove);
      return item;
    }) : [Object.assign(document.createElement('li'), { className: 'staff-empty', textContent: 'No venues yet. Add your fields, gyms and courts below.' })]));
  }

  addForm.onsubmit = async event => {
    event.preventDefault();
    const name = addForm.elements.venue_name.value.trim();
    if (namesFor(currentSchool().slug).some(saved => saved.toLowerCase() === name.toLowerCase())) {
      status.textContent = name + ' is already on the list.';
      return;
    }
    const { error } = await client.from('school_venues').insert({
      school_id: currentSchool().slug, name, address: addForm.elements.venue_address.value.trim() || null,
    });
    if (!active) return;
    status.textContent = error ? 'That venue could not be added. Try again.' : name + ' was added.';
    if (!error) addForm.reset();
    load();
  };

  return {
    load,
    sync: syncPicker,
    showSettings() {
      status.textContent = '';
      showSettings();
    },
    stop() {
      active = false;
      addForm.onsubmit = picker.onchange = null;
      fields.home_away.removeEventListener('change', resync);
      fields.opponent_school_id.removeEventListener('change', resync);
    },
  };
}
