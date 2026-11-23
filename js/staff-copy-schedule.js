// Copy an existing team's schedule to another team, with bulk editing of time and location.
function startStaffCopySchedule(client, { currentSchool, teams, onCopied }) {
  const dialog = document.getElementById('copy-schedule-dialog');
  const form = dialog?.querySelector('form');
  const cancelBtn = dialog?.querySelector('[name="copy-cancel"]');
  const sourceTeamSelect = dialog?.querySelector('[name="copy-source-team"]');
  const targetTeamSelect = dialog?.querySelector('[name="copy-target-team"]');
  const timeOptionRadios = dialog?.querySelectorAll('[name="copy-time-option"]');
  const timeOffsetInput = dialog?.querySelector('[name="copy-time-offset"]');
  const singleTimeInput = dialog?.querySelector('[name="copy-single-time"]');
  const timeOffsetUnit = dialog?.querySelector('[name="copy-time-offset-unit"]');
  const locationOptionRadios = dialog?.querySelectorAll('[name="copy-location-option"]');
  const bulkLocationInput = dialog?.querySelector('[name="copy-bulk-location"]');
  const previewContainer = dialog?.querySelector('[role="region"]');
  const confirmBtn = dialog?.querySelector('[name="copy-confirm"]');
  
  if (!dialog) return { open: () => {}, stop: () => {} };

  let sourceTeam = null;
  let targetTeam = null;
  let gamesToCopy = [];

  function populateTeamSelects() {
    const allTeams = teams();
    const options = () => [new Option('Select a team', ''), ...allTeams.map(team => new Option(team.label, team.key))];
    sourceTeamSelect.replaceChildren(...options());
    targetTeamSelect.replaceChildren(...options());
  }

  function updatePreview() {
    sourceTeam = teams().find(t => t.key === sourceTeamSelect.value);
    targetTeam = teams().find(t => t.key === targetTeamSelect.value);
    gamesToCopy = sourceTeam?.games ?? [];
    
    if (!sourceTeam || !targetTeam || sourceTeam.key === targetTeam.key) {
      previewContainer.textContent = sourceTeam && targetTeam && sourceTeam.key === targetTeam.key
        ? 'Source and target teams must be different.'
        : 'Select both a source and target team.';
      confirmBtn.disabled = true;
      return;
    }

    const timeOption = [...timeOptionRadios].find(r => r.checked)?.value;
    const locationOption = [...locationOptionRadios].find(r => r.checked)?.value;

    if (!gamesToCopy.length) {
      previewContainer.textContent = sourceTeam.label + ' has no games to copy.';
      confirmBtn.disabled = true;
      return;
    }

    const preview = gamesToCopy.map(game => {
      let newTime = game.start_time;
      if (timeOption === 'offset' && timeOffsetInput.value) {
        const offset = parseInt(timeOffsetInput.value);
        const unit = timeOffsetUnit.value === 'hours' ? 60 : 1;
        const [hours, mins] = (game.start_time || '00:00').split(':').map(Number);
        const totalMins = hours * 60 + mins + (offset * unit);
        const newHours = Math.floor(totalMins / 60) % 24;
        const newMins = totalMins % 60;
        newTime = String(newHours).padStart(2, '0') + ':' + String(newMins).padStart(2, '0');
      } else if (timeOption === 'single') {
        newTime = singleTimeInput.value || game.start_time;
      }
      
      let newLocation = game.location;
      if (locationOption === 'bulk') {
        newLocation = bulkLocationInput.value || game.location;
      }

      return {
        date: game.game_date,
        time: (game.start_time ? timeFormat(game.start_time) : 'TBD') + (newTime !== game.start_time ? ' → ' + timeFormat(newTime) : ''),
        opponent: (game.home_away === 'Home' ? 'vs. ' : '@ ') + (game.opponent_name || game.opponent_school_id || 'Unknown'),
        location: game.location + (newLocation !== game.location ? ' → ' + newLocation : ''),
        newTime, newLocation,
      };
    });

    const html = document.createElement('div');
    const summary = document.createElement('p');
    summary.textContent = 'Will copy ' + gamesToCopy.length + ' game' + (gamesToCopy.length === 1 ? '' : 's') + 
      ' from ' + sourceTeam.label + ' to ' + targetTeam.label + ':';
    html.append(summary);

    const list = document.createElement('ul');
    list.className = 'copy-schedule-preview';
    preview.forEach(game => {
      const item = document.createElement('li');
      item.textContent = game.date + ' ' + game.time + ' ' + game.opponent + ' @ ' + game.location;
      list.append(item);
    });
    html.append(list);
    previewContainer.replaceChildren(html);
    confirmBtn.disabled = false;
  }

  function timeFormat(time) {
    if (!time) return 'TBD';
    const [hour, minute] = time.split(':').map(Number);
    return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
  }

  function timeOptionChanged() {
    const choice = [...timeOptionRadios].find(r => r.checked)?.value;
    timeOffsetInput.closest('.copy-option-fields').hidden = choice !== 'offset';
    singleTimeInput.closest('.copy-option-fields').hidden = choice !== 'single';
    updatePreview();
  }

  function locationOptionChanged() {
    bulkLocationInput.closest('.copy-option-fields').hidden = [...locationOptionRadios].find(r => r.checked)?.value !== 'bulk';
    updatePreview();
  }

  async function copy() {
    if (!sourceTeam || !targetTeam || sourceTeam.key === targetTeam.key) return;

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Copying...';

    const timeOption = [...timeOptionRadios].find(r => r.checked)?.value;
    const locationOption = [...locationOptionRadios].find(r => r.checked)?.value;
    const copied = [];
    let failed = 0;

    for (const game of gamesToCopy) {
      let newTime = game.start_time;
      if (timeOption === 'offset' && timeOffsetInput.value) {
        const offset = parseInt(timeOffsetInput.value);
        const unit = timeOffsetUnit.value === 'hours' ? 60 : 1;
        const [hours, mins] = (game.start_time || '00:00').split(':').map(Number);
        const totalMins = hours * 60 + mins + (offset * unit);
        const newHours = Math.floor(totalMins / 60) % 24;
        const newMins = totalMins % 60;
        newTime = String(newHours).padStart(2, '0') + ':' + String(newMins).padStart(2, '0');
      } else if (timeOption === 'single') {
        newTime = singleTimeInput.value || game.start_time;
      }

      let newLocation = game.location;
      if (locationOption === 'bulk') {
        newLocation = bulkLocationInput.value || game.location;
      }

      const gameData = {
        school_id: currentSchool().slug,
        team_id: targetTeam.id,
        game_date: game.game_date,
        start_time: newTime,
        opponent_school_id: game.opponent_school_id || null,
        opponent_name: game.opponent_name || null,
        home_away: game.home_away,
        location: newLocation,
        status: 'Scheduled',
        notes: game.notes || null,
      };

      const { data, error } = await client.rpc('save_staff_game', { input: gameData });
      if (error) {
        failed++;
      } else {
        copied.push(data);
      }
    }

    confirmBtn.textContent = 'Copy schedule';
    dialog.close();
    
    if (onCopied) {
      onCopied(copied.length, failed);
    }
  }

  sourceTeamSelect.onchange = updatePreview;
  targetTeamSelect.onchange = updatePreview;
  timeOptionRadios.forEach(radio => radio.onchange = timeOptionChanged);
  locationOptionRadios.forEach(radio => radio.onchange = locationOptionChanged);
  timeOffsetInput.onchange = updatePreview;
  timeOffsetUnit.onchange = updatePreview;
  singleTimeInput.onchange = updatePreview;
  bulkLocationInput.onchange = updatePreview;
  // Enter in a field submits the form; only copy when the button is enabled.
  form.onsubmit = event => { event.preventDefault(); if (!confirmBtn.disabled) copy(); };
  cancelBtn.onclick = () => dialog.close();

  return {
    open() {
      populateTeamSelects();
      sourceTeamSelect.value = '';
      targetTeamSelect.value = '';
      timeOffsetInput.value = '';
      singleTimeInput.value = '';
      bulkLocationInput.value = '';
      [...timeOptionRadios].forEach(r => r.checked = r.value === 'same');
      [...locationOptionRadios].forEach(r => r.checked = r.value === 'same');
      timeOptionChanged();
      locationOptionChanged();
      updatePreview();
      dialog.showModal();
    },
    stop() {
      sourceTeamSelect.onchange = null;
      targetTeamSelect.onchange = null;
      timeOptionRadios.forEach(radio => radio.onchange = null);
      locationOptionRadios.forEach(radio => radio.onchange = null);
      timeOffsetInput.onchange = null;
      timeOffsetUnit.onchange = null;
      singleTimeInput.onchange = null;
      bulkLocationInput.onchange = null;
      form.onsubmit = null;
      cancelBtn.onclick = null;
    },
  };
}
