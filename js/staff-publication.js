// Reviews and publishes selected team schedules while working games remain private drafts.
function startStaffPublication(client, currentSchool, { canEdit = () => true, filterValues = () => ({}), schools = () => [], onPublished = () => {} } = {}) {
  const section = document.getElementById('publication-section');
  const form = document.getElementById('publication-form');
  const list = document.getElementById('publication-teams');
  const status = document.getElementById('publication-status');
  const reviewButton = document.getElementById('publication-review');
  const unpublishButton = document.getElementById('publication-unpublish');
  const selectAll = document.getElementById('publication-select-all');
  const dialog = document.getElementById('publication-dialog');
  const dialogTitle = document.getElementById('publication-dialog-title');
  const dialogStatus = document.getElementById('publication-dialog-status');
  const confirm = document.getElementById('publication-confirm');
  const publicLink = document.getElementById('publication-public-link');
  let groups = [], requestNumber = 0, active = true, pending = null, busy = false;

  const key = group => group.team_id + '|' + group.season_year;
  const selected = () => new Set([...list.querySelectorAll('input:checked')].map(input => input.value));
  function updateButtons() {
    const checked = selected();
    reviewButton.disabled = busy || !checked.size;
    unpublishButton.disabled = busy || !groups.some(group => checked.has(key(group)) && group.published_at);
    selectAll.disabled = busy || !list.querySelector('input');
    const inputs = list.querySelectorAll('input');
    selectAll.textContent = inputs.length && checked.size === inputs.length ? 'Clear all' : 'Select all';
  }

  // Which working games differ from what families see: never published (Draft) or edited since (Changed).
  function states() {
    const map = new Map();
    let removed = 0;
    for (const group of groups) for (const entry of group.games) {
      if (!entry.draft) { if (entry.published && group.published_at) removed++; continue; }
      if (!group.published_at || !entry.published) map.set(entry.id, 'Draft');
      else if (entry.changed ?? publicationChanges(entry).length > 0) map.set(entry.id, 'Changed');
    }
    return { map, removed };
  }

  function render() {
    const checked = selected();
    const filters = filterValues();
    // Teams with something to publish come first.
    const visible = groups.filter(group => ['sport','season','level','gender'].every(name => !filters[name] || filters[name] === group[name]))
      .sort((first, second) => Boolean(second.pending_count) - Boolean(first.pending_count));
    list.replaceChildren(...visible.map(group => {
      const row = document.createElement('li');
      const label = document.createElement('label');
      label.className = 'staff-check';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = key(group);
      checkbox.checked = checked.has(key(group));
      checkbox.disabled = busy;
      label.append(checkbox, publicationTeamLabel(group));
      const details = document.createElement('p');
      const count = group.games.filter(entry => entry.draft).length;
      const games = count + (count === 1 ? ' game' : ' games');
      const pending = group.pending_count + (group.pending_count === 1 ? ' change' : ' changes') + ' not public yet';
      details.textContent = !group.published_at ? 'Not published · ' + games
        : group.pending_count ? 'Published · ' + pending : 'Published · ' + games + ' · up to date';
      row.append(label, details);
      return row;
    }));
    if (!visible.length && groups.length) status.textContent = 'No team schedules match these filters.';
    updateButtons();
  }

  async function load() {
    const request = ++requestNumber;
    section.hidden = !canEdit();
    if (section.hidden || !currentSchool()) return false;
    const school = currentSchool().slug;
    busy = true;
    list.querySelectorAll('input').forEach(input => input.disabled = true);
    updateButtons();
    status.textContent = 'Loading team publication status…';
    const { data, error } = await client.rpc('review_schedule_publication', { p_school: school });
    if (!active || request !== requestNumber) return false;
    busy = false;
    if (error) {
      groups = [];
      list.replaceChildren();
      status.textContent = 'Publication status could not load. Reopen Schedule to try again.';
      updateButtons();
      return false;
    }
    groups = data;
    status.textContent = groups.length ? 'Tick the teams that are ready, then choose Review and publish.'
      : 'Add or import games first. Each team appears here once it has games.';
    render();
    return true;
  }

  function preview(chosen, { gameId = null, withdraw = false } = {}) {
    if (!chosen.length || busy) return;
    const names = Object.fromEntries(schools().map(school => [school.slug, school.name]));
    pending = { school: currentSchool().slug, withdraw, selections: chosen.map(group => ({
      team_id: group.team_id, season_year: group.season_year, token: group.token,
      ...(gameId ? { game_ids: [gameId] } : {}),
    })) };
    dialogTitle.textContent = withdraw ? 'Unpublish these schedules?' : gameId ? 'Review this change' : 'Review and publish';
    document.getElementById('publication-dialog-summary').textContent = withdraw
      ? 'These schedules will be removed from public calendars and subscriptions. Your working games will stay saved.'
      : 'Check what families will see. Times are Eastern.';
    const content = document.getElementById('publication-dialog-games');
    content.replaceChildren(...chosen.map(group => {
      const host = document.createElement('section');
      host.className = 'staff-section';
      const heading = document.createElement('h3');
      heading.textContent = publicationTeamLabel(group);
      const games = document.createElement('ul');
      games.className = 'publication-games';
      for (const entry of group.games.filter(entry => (!gameId || entry.id === gameId) && (!withdraw || entry.published))) {
        const game = withdraw ? entry.published : entry.draft ?? entry.published;
        const row = document.createElement('li');
        const title = document.createElement('strong');
        const opponent = names[game.opponent_school_id] ?? game.opponent_name ?? game.opponent_school_id ?? 'Opponent';
        title.textContent = publicationDate(game.game_date) + ' · ' + publicationTime(game.start_time) +
          (game.home_away === 'Home' ? ' vs. ' : ' at ') + opponent;
        const venue = document.createElement('p');
        venue.textContent = [game.location, game.status].filter(Boolean).join(' · ');
        const changes = document.createElement('ul');
        const lines = withdraw ? ['Remove from the public calendar'] : publicationChanges(entry, names);
        for (const line of lines.length ? lines : ['No unpublished changes']) {
          const detail = document.createElement('li');
          detail.textContent = line;
          changes.append(detail);
        }
        if (!entry.published && !withdraw) {
          for (const text of [game.notes, game.transportation?.bus_departure && 'Bus departure: ' + publicationTime(game.transportation.bus_departure),
            game.transportation?.pickup_location && 'Pickup: ' + game.transportation.pickup_location,
            game.transportation?.return_time && 'Return: ' + publicationTime(game.transportation.return_time)].filter(Boolean)) {
            const detail = document.createElement('li'); detail.textContent = text; changes.append(detail);
          }
        }
        row.append(title, venue, changes);
        games.append(row);
      }
      host.append(heading, games);
      return host;
    }));
    confirm.textContent = withdraw ? 'Unpublish' : gameId ? 'Publish this change' : 'Publish';
    confirm.disabled = false;
    dialogStatus.textContent = '';
    dialog.showModal();
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const keys = selected();
    if (!await load()) return;
    preview(groups.filter(group => keys.has(key(group))));
  };
  list.onchange = updateButtons;
  selectAll.onclick = () => {
    const inputs = [...list.querySelectorAll('input')];
    const checked = inputs.some(input => !input.checked);
    inputs.forEach(input => input.checked = checked);
    updateButtons();
  };
  unpublishButton.onclick = async () => {
    const keys = selected();
    if (!await load()) return;
    preview(groups.filter(group => keys.has(key(group)) && group.published_at), { withdraw: true });
  };
  confirm.onclick = async () => {
    if (!pending || busy) return;
    const action = pending, request = ++requestNumber;
    busy = true;
    confirm.disabled = true;
    dialogStatus.textContent = action.withdraw ? 'Unpublishing…' : 'Publishing reviewed changes…';
    const { error } = await client.rpc('publish_schedule_changes', {
      p_school: action.school, selections: action.selections, withdraw: action.withdraw,
    });
    if (!active || request !== requestNumber) return;
    busy = false;
    confirm.disabled = false;
    if (error) {
      if (error.code === '40001') confirm.disabled = true;
      dialogStatus.textContent = error.code === '40001'
        ? 'The schedule changed after this review. Close this preview and review it again.'
        : error.code === '22023' ? error.message : 'The reviewed changes could not be published. Please try again.';
      return;
    }
    dialog.close();
    pending = null;
    await load();
    status.textContent = action.withdraw ? 'Unpublished. Families no longer see these schedules. Your games are still saved here.'
      : 'Published. The school page shows it now. Calendar apps pick it up at their next refresh, which can take hours.';
    publicLink.href = 'school.html?school=' + encodeURIComponent(action.school);
    publicLink.hidden = false;
    onPublished();
  };

  return {
    load, render, states,
    async reviewGame(id) {
      if (!await load()) return;
      const affected = groups.filter(group => group.games.some(entry => entry.id === id));
      const group = affected.find(group => group.games.some(entry => entry.id === id && entry.draft));
      if (!group) return;
      // Moving a game between teams/years needs both full schedules, not an isolated game push.
      preview(affected.length > 1 ? affected : [group],
        affected.length === 1 && group.published_at ? { gameId: id } : {});
    },
    reset() {
      requestNumber++; groups = []; pending = null; busy = false;
      list.replaceChildren(); status.textContent = ''; section.hidden = true; publicLink.hidden = true;
      if (dialog.open) dialog.close();
      updateButtons();
    },
    stop() {
      active = false; requestNumber++;
      form.onsubmit = list.onchange = selectAll.onclick = unpublishButton.onclick = confirm.onclick = null;
      if (dialog.open) dialog.close();
    },
  };
}
