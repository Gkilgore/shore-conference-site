// Saves school transportation contacts, previews requests, and sends them after a bus is scheduled.
function startStaffTransportation(client, invite, selectedSchool, gameTitle) {
  const form = document.getElementById('transportation-contact-form');
  const email = document.getElementById('transportation-email');
  const status = document.getElementById('transportation-contact-status');
  const contactsList = document.getElementById('transportation-contacts-list');
  const contactsUL = document.getElementById('transportation-contacts');
  const preview = document.getElementById('preview-transportation-email');
  const previewFromEditor = document.getElementById('preview-editor-transportation-email');
  const dialog = document.getElementById('transportation-draft');
  const submit = form.querySelector('button[type="submit"]');
  let active = true;
  let requestNumber = 0;

  const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

  function readContacts(school) {
    return client.from('school_transportation_contacts')
      .select('id, email').eq('school_id', school).order('created_at');
  }

  async function renderContacts(contacts) {
    contactsUL.innerHTML = '';
    if (contacts.length === 0) {
      contactsList.style.display = 'none';
      return;
    }
    contactsList.style.display = 'block';
    for (const contact of contacts) {
      const li = document.createElement('li');
      
      const email_span = document.createElement('span');
      email_span.textContent = contact.email;
      
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = 'Will receive emails';
      
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'button secondary';
      removeBtn.textContent = 'Remove';
      removeBtn.onclick = async () => {
        removeBtn.disabled = true;
        const { error } = await client.from('school_transportation_contacts').delete().eq('id', contact.id);
        if (!active) return;
        if (error) {
          status.textContent = 'Could not remove contact. Try again.';
          removeBtn.disabled = false;
        } else {
          status.textContent = 'Contact removed.';
          email.value = '';
          await load();
        }
      };
      
      li.appendChild(email_span);
      li.appendChild(badge);
      li.appendChild(removeBtn);
      contactsUL.appendChild(li);
    }
  }

  async function load() {
    const request = ++requestNumber;
    const school = selectedSchool().slug;
    form.reset();
    submit.disabled = true;
    status.textContent = 'Loading contacts…';
    const { data, error } = await readContacts(school);
    if (!active || request !== requestNumber) return;
    if (error) {
      status.textContent = 'Contacts could not be loaded. Open Transportation again to retry.';
      return;
    }
    email.value = '';
    status.textContent = '';
    submit.disabled = false;
    await renderContacts(data || []);
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const request = ++requestNumber;
    const school = selectedSchool().slug;
    const address = email.value.trim();
    
    if (!address) {
      status.textContent = 'Please enter an email address.';
      return;
    }
    
    submit.disabled = true;
    status.textContent = 'Adding contact…';
    const { error } = await client.from('school_transportation_contacts').insert({ school_id: school, email: address });
    
    if (!active || request !== requestNumber) return;
    
    if (error) {
      if (error.message.includes('unique')) {
        status.textContent = 'This email is already added.';
      } else {
        status.textContent = 'The contact could not be added. Try again.';
      }
      submit.disabled = false;
    } else {
      status.textContent = 'Contact added!';
      email.value = '';
      await load();
    }
  };

  function clear(button) {
    button.hidden = true;
    button.onclick = null;
  }

  function setPreview(game, fromEditor = false) {
    const button = fromEditor ? previewFromEditor : preview;
    clear(button);
    const bus = game?.transportation;
    if (!bus?.bus_departure || game.status !== 'Scheduled') return;
    button.hidden = false;
    button.onclick = () => openDraft(game);
  }

  async function sendForSavedGame(gameId) {
    if (!active) return { ok: false, message: 'Transportation email could not be sent because the schedule was closed.' };
    try {
      const { data, error } = await client.functions.invoke('transportation-email', { body: { game_id: gameId } });
      if (error) {
        let detail = '';
        if (error.context && typeof error.context.json === 'function') {
          try { detail = (await error.context.json()).error ?? ''; } catch {}
        }
        return { ok: false, message: detail || error.message || 'The email service could not be reached.' };
      }
      if (data?.sent) return { ok: true };
      if (data?.skipped) return { ok: true, skipped: true };
      return { ok: false, message: data?.error || 'The email service returned an unexpected response.' };
    } catch (error) {
      return { ok: false, message: error?.message || 'The email service could not be reached.' };
    }
  }

  async function openDraft(game) {
    if (!active) return;
    const school = selectedSchool();
    const request = ++requestNumber;
    const bus = game.transportation;
    const date = new Date(game.game_date + 'T12:00');
    const time = value => value ? timeFormat.format(new Date(game.game_date + 'T' + value)) + ' ET' : 'Not specified';
    document.getElementById('transportation-draft-to').textContent = 'Looking up contacts…';
    document.getElementById('transportation-draft-cc').textContent =
      invite.role === 'ad' ? invite.email : 'The school AD’s email will be copied when an AD sends it.';
    document.getElementById('transportation-draft-subject').textContent =
      'Scheduled bus · ' + school.name + ' · ' + gameTitle(game) + ' · ' + game.game_date;
    document.getElementById('transportation-draft-body').textContent = [
      'Bus transportation details for ' + school.name + '.',
      'This is an information email; no confirmation is needed.',
      '',
      'Game: ' + gameTitle(game),
      'Date: ' + dateFormat.format(date),
      'Start: ' + (game.start_time ? time(game.start_time) : 'TBD'),
      'Venue: ' + game.location,
      'Bus departure: ' + time(bus.bus_departure),
      'Pickup: ' + (bus.pickup_location || 'Not specified'),
      'Early dismissal: ' + time(bus.early_dismissal_time),
      'Return: ' + time(bus.return_time),
      ...(bus.notes ? ['Transportation notes: ' + bus.notes] : []),
    ].join('\n');
    dialog.showModal();
    const { data, error } = await readContacts(school.slug);
    if (!active || request !== requestNumber || !dialog.open) return;
    if (error || !data || data.length === 0) {
      document.getElementById('transportation-draft-to').textContent = 'No contacts saved. Add one in Transportation.';
    } else {
      document.getElementById('transportation-draft-to').textContent = data.map(c => c.email).join(', ');
    }
  }

  return {
    load,
    setPreview,
    sendForSavedGame,
    reset() {
      requestNumber++;
      clear(preview);
      clear(previewFromEditor);
      if (dialog.open) dialog.close();
    },
    stop() {
      active = false;
      if (dialog.open) dialog.close();
      form.onsubmit = null;
      clear(preview);
      clear(previewFromEditor);
    },
  };
}
