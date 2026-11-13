// Saves school transportation contacts, previews requests, and sends them after a bus is scheduled.
function startStaffTransportation(client, invite, selectedSchool, gameTitle) {
  const form = document.getElementById('transportation-contact-form');
  const email = document.getElementById('transportation-email');
  const status = document.getElementById('transportation-contact-status');
  const preview = document.getElementById('preview-transportation-email');
  const previewFromEditor = document.getElementById('preview-editor-transportation-email');
  const dialog = document.getElementById('transportation-draft');
  const submit = form.querySelector('button[type="submit"]');
  let active = true;
  let requestNumber = 0;

  const dateFormat = new Intl.DateTimeFormat('en-US', { dateStyle: 'full' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' });

  function readContact(school) {
    return client.from('school_transportation_contacts')
      .select('email').eq('school_id', school).maybeSingle();
  }

  async function load() {
    const request = ++requestNumber;
    const school = selectedSchool().slug;
    form.reset();
    submit.disabled = true;
    status.textContent = 'Loading contact…';
    const { data, error } = await readContact(school);
    if (!active || request !== requestNumber) return;
    if (error) {
      status.textContent = 'The contact could not be loaded. Open Transportation again to retry.';
      return;
    }
    email.value = data?.email ?? '';
    status.textContent = '';
    submit.disabled = false;
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const request = ++requestNumber;
    const school = selectedSchool().slug;
    const address = email.value.trim();
    submit.disabled = true;
    status.textContent = 'Saving contact…';
    const contacts = client.from('school_transportation_contacts');
    const { error } = address
      ? await contacts.upsert({ school_id: school, email: address })
      : await contacts.delete().eq('school_id', school);
    if (!active || request !== requestNumber) return;
    status.textContent = error ? 'The contact could not be saved. Try again.'
      : address ? 'Transportation contact saved.' : 'Transportation contact cleared.';
    submit.disabled = false;
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
    document.getElementById('transportation-draft-to').textContent = 'Looking up contact…';
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
    const { data, error } = await readContact(school.slug);
    if (!active || request !== requestNumber || !dialog.open) return;
    document.getElementById('transportation-draft-to').textContent = error
      ? 'Could not load the contact.' : data?.email ?? 'No contact saved. Add one in Transportation.';
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
