// Copy an existing team's schedule to another team, shifting times and dates, switching home and away, or changing the home facility.
function startStaffCopySchedule(client, { currentSchool, teams, games = () => [], homeVenues = () => [],
  post = async () => ({ ok: true, held: [], heldIds: new Set() }), onCopied }) {
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

  // Everything the AD chose, read once so the preview and the copy use the same rules.
  function settings() {
    return {
      minutes: Number(checked('copy-shift-hours-dir')) * amount(hoursInput) * 60
        + Number(checked('copy-shift-minutes-dir')) * amount(minutesInput),
      days: Number(checked('copy-shift-days-dir')) * amount(daysInput),
      tbd: yes('copy-time-tbd'),
      swap: yes('copy-swap-home-away'),
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
    const location = (homeAway === 'Home' && choice.homeLocation) || game.location;
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
    // TBD replaces the hour and minute shift.
    for (const name of ['copy-shift-hours', 'copy-shift-minutes']) {
      dialog.querySelectorAll('[name="' + name + '"], [name="' + name + '-dir"]').forEach(input => { input.disabled = tbd; });
    }
    homeVenueSelect.closest('.copy-option-fields').hidden = checked('copy-location-option') !== 'home';
    homeVenueTyped.hidden = !homeVenuePick.hidden && homeVenueSelect.value !== otherVenue;
    swapHint.hidden = !yes('copy-swap-home-away') || checked('copy-location-option') !== 'same';
    updatePreview();
  }

  function updatePreview() {
    sourceTeam = teams().find(team => team.key === sourceTeamSelect.value);
    targetTeam = teams().find(team => team.key === targetTeamSelect.value);
    gamesToCopy = sourceTeam ? sourceGames(sourceTeam) : [];
    confirmBtn.disabled = true;

    if (!sourceTeam || !targetTeam) { previewContainer.textContent = 'Select both a source and target team.'; return; }
    if (sourceTeam.key === targetTeam.key) { previewContainer.textContent = 'Source and target teams must be different.'; return; }
    if (!gamesToCopy.length) { previewContainer.textContent = sourceTeam.label + ' has no games to copy.'; return; }
    if (checked('copy-location-option') === 'home' && !homeLocation()) { previewContainer.textContent = 'Choose the home game facility.'; return; }

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

  // A school year starts July 1. Fall and winter are named by the year they start in, spring by the year it is played.
  function seasonYear(season, date) {
    const [year, month] = date.split('-').map(Number);
    const start = month >= 7 ? year : year - 1;
    return season === 'Spring' ? start + 1 : start;
  }

  // Every saved game on the source team, posted or not, for one season: the team's posted season when the
  // team list knows it, otherwise the latest season with games. A team keeps its record across years.
  function sourceGames(team) {
    const all = games().filter(game => game.team_id === team.id && game.game_date);
    const year = team.group?.season_year ?? Math.max(...all.map(game => seasonYear(team.season, game.game_date)));
    return all.filter(game => seasonYear(team.season, game.game_date) === year)
      .sort((a, b) => (a.game_date + (a.start_time ?? '')).localeCompare(b.game_date + (b.start_time ?? '')));
  }

  async function copy() {
    if (!sourceTeam || !targetTeam || sourceTeam.key === targetTeam.key) return;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Copying...';
    const choice = settings();
    const copied = [];
    const errors = [];

    for (const game of gamesToCopy) {
      // The save finds the team by sport, gender, level and season (it ignores team_id), so send the target's.
      const { data, error } = await client.rpc('save_staff_game', { input: {
        school_id: currentSchool().slug,
        team_id: targetTeam.id,
        sport: targetTeam.sport, gender: targetTeam.gender, level: targetTeam.level, season: targetTeam.season,
        opponent_school_id: game.opponent_school_id || null,
        opponent_directory_slug: game.opponent_directory_slug || null,
        opponent_name: game.opponent_name || null,
        status: 'Scheduled',
        notes: game.notes || null,
        ...adjust(game, choice),
      } });
      if (error) errors.push(error.message || 'Could not be saved.');
      else copied.push(data);
    }
    // Saving posts each game when the database supports it; posting again here covers older setups.
    const posted = copied.length ? await post(copied) : { ok: true, held: [] };

    confirmBtn.textContent = 'Copy schedule';
    if (errors.length) {
      // Keep the box open so a failure is seen, with the reason the database gave.
      previewContainer.textContent = (copied.length ? copied.length + ' copied. ' : '') + errors.length +
        (errors.length === 1 ? ' game' : ' games') + ' could not be copied: ' + [...new Set(errors)].join(' ');
      confirmBtn.disabled = false;
      if (copied.length && onCopied) onCopied(copied.length, errors.length, posted);
      return;
    }
    dialog.close();
    if (onCopied) onCopied(copied.length, 0, posted);
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
