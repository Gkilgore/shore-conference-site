// Copy an existing team's schedule to another team, shifting times and dates, switching home and away, or replacing locations.
function startStaffCopySchedule(client, { currentSchool, teams, homeVenues = () => [], onCopied }) {
  const dialog = document.getElementById('copy-schedule-dialog');
  if (!dialog) return { open: () => {}, stop: () => {} };

  const field = name => dialog.querySelector('[name="' + name + '"]');
  const form = dialog.querySelector('form');
  const cancelBtn = field('copy-cancel');
  const confirmBtn = field('copy-confirm');
  const sourceTeamSelect = field('copy-source-team');
  const targetTeamSelect = field('copy-target-team');
  const hoursInput = field('copy-shift-hours');
  const minutesInput = field('copy-shift-minutes');
  const daysInput = field('copy-shift-days');
  const startDateInput = field('copy-start-date');
  const startDateField = dialog.querySelector('.copy-start-date');
  const startDateHint = dialog.querySelector('.copy-start-date-hint');
  const bulkLocationInput = field('copy-bulk-location');
  const homeVenueSelect = field('copy-home-venue');
  const homeLocationInput = field('copy-home-location');
  const homeVenuePick = dialog.querySelector('.copy-home-venue-pick');
  const homeVenueTyped = dialog.querySelector('.copy-home-venue-typed');
  const swapHint = dialog.querySelector('.copy-swap-hint');
  const otherVenue = '__other';
  const previewContainer = dialog.querySelector('.copy-schedule-preview-region');

  let sourceTeam = null;
  let targetTeam = null;
  let gamesToCopy = [];

  const checked = name => dialog.querySelector('[name="' + name + '"]:checked')?.value;
  const yes = name => checked(name) === 'yes';
  const amount = input => Math.abs(parseInt(input.value, 10)) || 0;
  const pad = number => String(number).padStart(2, '0');

  function addDays(date, days) {
    const day = new Date(date + 'T12:00:00Z');
    day.setUTCDate(day.getUTCDate() + days);
    return day.toISOString().slice(0, 10);
  }

  function daysBetween(from, to) {
    return Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000);
  }

  // Everything the AD chose, read once so the preview and the copy use the same rules.
  function settings() {
    const firstDate = gamesToCopy.map(game => game.game_date).sort()[0];
    const setStartDate = yes('copy-set-start-date');
    return {
      minutes: Number(checked('copy-shift-hours-dir')) * amount(hoursInput) * 60
        + Number(checked('copy-shift-minutes-dir')) * amount(minutesInput),
      days: setStartDate ? (startDateInput.value && firstDate ? daysBetween(firstDate, startDateInput.value) : 0)
        : Number(checked('copy-shift-days-dir')) * amount(daysInput),
      tbd: yes('copy-time-tbd'),
      swap: yes('copy-swap-home-away'),
      location: checked('copy-location-option') === 'bulk' ? bulkLocationInput.value.trim() : '',
      homeLocation: checked('copy-location-option') === 'home' ? homeLocation() : '',
    };
  }

  function adjust(game, choice) {
    let date = addDays(game.game_date, choice.days);
    let time = game.start_time ? game.start_time.slice(0, 5) : null;
    if (choice.tbd) time = null;
    else if (time && choice.minutes) {
      const [hours, minutes] = time.split(':').map(Number);
      const total = hours * 60 + minutes + choice.minutes;
      // A shift past midnight moves the game to the next or previous day.
      date = addDays(date, Math.floor(total / 1440));
      const clock = ((total % 1440) + 1440) % 1440;
      time = pad(Math.floor(clock / 60)) + ':' + pad(clock % 60);
    }
    const flip = { Home: 'Away', Away: 'Home' };
    const homeAway = choice.swap ? flip[game.home_away] ?? game.home_away : game.home_away;
    // The home facility follows the switched side, so a game that becomes home gets the new facility.
    const location = choice.location || (homeAway === 'Home' && choice.homeLocation) || game.location;
    return { game_date: date, start_time: time, home_away: homeAway, location };
  }

  function timeFormat(time) {
    if (!time) return 'TBD';
    const [hour, minute] = time.split(':').map(Number);
    return (hour % 12 || 12) + ':' + pad(minute) + (hour < 12 ? ' AM' : ' PM');
  }

  function dateFormat(date) {
    return new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function describe(game) {
    const opponent = game.opponent_name || game.opponent_school_id || 'Unknown';
    return dateFormat(game.game_date) + ' · ' + timeFormat(game.start_time) + ' · '
      + (game.home_away === 'Home' ? 'vs. ' : '@ ') + opponent + ' · ' + (game.location || 'No location');
  }

  // Home facility: the school's venue list when it has one, with Other venue… for a typed name.
  function homeLocation() {
    return homeVenuePick.hidden || homeVenueSelect.value === otherVenue
      ? homeLocationInput.value.trim() : homeVenueSelect.value;
  }

  function populateHomeVenues() {
    const names = homeVenues();
    homeVenuePick.hidden = !names.length;
    homeVenueSelect.replaceChildren(new Option('Choose a venue', ''),
      ...names.map(name => new Option(name, name)), new Option('Other venue…', otherVenue));
  }

  function populateTeamSelects() {
    const options = () => [new Option('Select a team', ''), ...teams().map(team => new Option(team.label, team.key))];
    sourceTeamSelect.replaceChildren(...options());
    targetTeamSelect.replaceChildren(...options());
  }

  function syncChoices() {
    const tbd = yes('copy-time-tbd');
    const setStartDate = yes('copy-set-start-date');
    // TBD replaces the hour and minute shift; a set start date replaces the day shift.
    for (const name of ['copy-shift-hours', 'copy-shift-minutes']) {
      dialog.querySelectorAll('[name="' + name + '"], [name="' + name + '-dir"]').forEach(input => { input.disabled = tbd; });
    }
    dialog.querySelectorAll('[name="copy-shift-days"], [name="copy-shift-days-dir"]').forEach(input => { input.disabled = setStartDate; });
    startDateField.hidden = !setStartDate;
    startDateHint.hidden = !setStartDate;
    bulkLocationInput.closest('.copy-option-fields').hidden = checked('copy-location-option') !== 'bulk';
    homeVenueSelect.closest('.copy-option-fields').hidden = checked('copy-location-option') !== 'home';
    homeVenueTyped.hidden = !homeVenuePick.hidden && homeVenueSelect.value !== otherVenue;
    swapHint.hidden = !yes('copy-swap-home-away') || checked('copy-location-option') !== 'same';
    updatePreview();
  }

  function updatePreview() {
    sourceTeam = teams().find(team => team.key === sourceTeamSelect.value);
    targetTeam = teams().find(team => team.key === targetTeamSelect.value);
    gamesToCopy = sourceTeam?.games ?? [];
    confirmBtn.disabled = true;

    if (!sourceTeam || !targetTeam) { previewContainer.textContent = 'Select both a source and target team.'; return; }
    if (sourceTeam.key === targetTeam.key) { previewContainer.textContent = 'Source and target teams must be different.'; return; }
    if (!gamesToCopy.length) { previewContainer.textContent = sourceTeam.label + ' has no games to copy.'; return; }
    if (yes('copy-set-start-date') && !startDateInput.value) { previewContainer.textContent = 'Choose the first game date.'; return; }
    if (checked('copy-location-option') === 'home' && !homeLocation()) { previewContainer.textContent = 'Choose the home game facility.'; return; }
    if (checked('copy-location-option') === 'bulk' && !bulkLocationInput.value.trim()) { previewContainer.textContent = 'Enter the location for every game.'; return; }

    const choice = settings();
    const summary = document.createElement('p');
    summary.textContent = 'Will copy ' + gamesToCopy.length + ' game' + (gamesToCopy.length === 1 ? '' : 's')
      + ' from ' + sourceTeam.label + ' to ' + targetTeam.label + ':';
    const list = document.createElement('ul');
    list.className = 'copy-schedule-preview';
    for (const game of gamesToCopy) {
      const before = describe(game);
      const after = describe({ ...game, ...adjust(game, choice) });
      const item = document.createElement('li');
      const line = document.createElement('span');
      line.textContent = after;
      item.append(line);
      if (after !== before) {
        const was = document.createElement('small');
        was.textContent = 'Was ' + before;
        item.append(was);
      }
      list.append(item);
    }
    const wrap = document.createElement('div');
    wrap.append(summary, list);
    previewContainer.replaceChildren(wrap);
    confirmBtn.disabled = false;
  }

  async function copy() {
    if (!sourceTeam || !targetTeam || sourceTeam.key === targetTeam.key) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Copying...';
    const choice = settings();
    const copied = [];
    let failed = 0;

    for (const game of gamesToCopy) {
      const { data, error } = await client.rpc('save_staff_game', { input: {
        school_id: currentSchool().slug,
        team_id: targetTeam.id,
        opponent_school_id: game.opponent_school_id || null,
        opponent_name: game.opponent_name || null,
        status: 'Scheduled',
        notes: game.notes || null,
        ...adjust(game, choice),
      } });
      if (error) failed++;
      else copied.push(data);
    }

    confirmBtn.textContent = 'Copy schedule';
    dialog.close();
    if (onCopied) onCopied(copied.length, failed);
  }

  // Enter in a field submits the form; only copy when the button is enabled.
  form.onsubmit = event => { event.preventDefault(); if (!confirmBtn.disabled) copy(); };
  form.onchange = syncChoices;
  form.oninput = updatePreview;
  cancelBtn.onclick = () => dialog.close();

  return {
    open() {
      populateTeamSelects();
      populateHomeVenues();
      form.reset();
      syncChoices();
      dialog.showModal();
    },
    stop() {
      form.onsubmit = null;
      form.onchange = null;
      form.oninput = null;
      cancelBtn.onclick = null;
    },
  };
}
