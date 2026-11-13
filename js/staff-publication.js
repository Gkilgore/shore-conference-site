// Posts saved games to the public schedule. Saving or importing posts straight away; there is no draft step.
// The database still keeps a working copy and a public copy of each game, so this controller copies one to
// the other right after a save. A reviewed dialog remains for two deliberate actions: posting a team's
// held-back games together, and taking a team's schedule down.
function startStaffPublication(client, currentSchool, { canEdit = () => true, schools = () => [], onPublished = () => {} } = {}) {
  const dialog = document.getElementById('publication-dialog');
  const dialogTitle = document.getElementById('publication-dialog-title');
  const dialogStatus = document.getElementById('publication-dialog-status');
  const confirm = document.getElementById('publication-confirm');
  let groups = [], requestNumber = 0, active = true, pending = null, busy = false;

  const key = group => group.team_id + '|' + group.season_year;
  // A game the public does not see as saved: never posted, edited since, or deleted but still showing.
  function waiting(group, entry) {
    if (!entry.draft) return Boolean(entry.published && group.published_at);
    if (!group.published_at || !entry.published) return true;
    return entry.changed ?? publicationChanges(entry).length > 0;
  }

  // Which working games differ from what families see. Normally none: these are games from before
  // posting became automatic, or a save whose posting step failed.
  function states() {
    const map = new Map();
    let removed = 0;
    for (const group of groups) for (const entry of group.games) {
      if (!waiting(group, entry)) continue;
      if (!entry.draft) removed++;
      else map.set(entry.id, !group.published_at || !entry.published ? 'Draft' : 'Changed');
    }
    return { map, removed };
  }

  async function load() {
    const request = ++requestNumber;
    if (!canEdit() || !currentSchool()) return false;
    const { data, error } = await client.rpc('review_schedule_publication', { p_school: currentSchool().slug });
    if (!active || request !== requestNumber) return false;
    if (error) { groups = []; return false; }
    groups = data;
    return true;
  }

  // Posts the given games (saved, changed or just deleted) and nothing else.
  // A team whose other games are still held back is left alone unless the server can post this one game
  // by itself, so posting never exposes games the AD did not just save. Those teams come back in `held`.
  // Returns { ok, held: [team labels], heldIds: Set } and never reports success the server did not confirm.
  async function post(ids, retry = true) {
    const want = new Set(ids);
    if (!await load()) return { ok: false, held: [], heldIds: new Set() };
    const school = currentSchool().slug;
    const affected = groups.filter(group => group.games.some(entry => want.has(entry.id)));
    // A game that changed team or season shows in two schedules, and the server posts those together.
    const shared = new Set([...want].filter(id => affected.filter(group => group.games.some(entry => entry.id === id)).length > 1));
    const selections = [], held = [];
    for (const group of affected) {
      const mine = group.games.filter(entry => want.has(entry.id));
      // Already public as saved (the server posts inside the save once its migration has run).
      if (!mine.some(entry => waiting(group, entry))) continue;
      const others = group.games.some(entry => !want.has(entry.id) && waiting(group, entry));
      const whole = { team_id: group.team_id, season_year: group.season_year, token: group.token };
      if (!others) selections.push(whole);
      else if (group.published_at && mine.length === 1 && !shared.has(mine[0].id)) selections.push({ ...whole, game_ids: [mine[0].id] });
      else held.push(group);
    }
    // Both halves of a moved game go together or not at all.
    const blocked = new Set(held.flatMap(group => group.games.filter(entry => shared.has(entry.id)).map(entry => entry.id)));
    const sendable = selections.filter(selection => {
      const group = affected.find(item => key(item) === selection.team_id + '|' + selection.season_year);
      const stays = !group.games.some(entry => blocked.has(entry.id));
      if (!stays) held.push(group);
      return stays;
    });
    const heldIds = new Set(held.flatMap(group => group.games.filter(entry => want.has(entry.id)).map(entry => entry.id)));
    const result = { ok: true, held: [...new Set(held.map(publicationTeamLabel))], heldIds };
    if (!sendable.length) return result;
    const request = ++requestNumber;
    const { error } = await client.rpc('publish_schedule_changes', { p_school: school, selections: sendable, withdraw: false });
    if (!active || request !== requestNumber) return { ...result, ok: false };
    // Someone saved in between. Read the schedule again and try once more.
    if (error?.code === '40001' && retry) return post(ids, false);
    if (error) { await load(); return { ...result, ok: false }; }
    await load();
    return result;
  }

  // The reviewed step, for posting a team's held-back games or taking its schedule down.
  function preview(chosen, withdraw) {
    if (!chosen.length || busy) return;
    const names = Object.fromEntries(schools().map(school => [school.slug, school.name]));
    pending = { school: currentSchool().slug, withdraw, selections: chosen.map(group => ({
      team_id: group.team_id, season_year: group.season_year, token: group.token })) };
    dialogTitle.textContent = withdraw ? 'Take this schedule down?' : 'Post this schedule';
    document.getElementById('publication-dialog-summary').textContent = withdraw
      ? 'Families will no longer see this team’s games. The games stay saved here.'
      : 'Check what families will see. Times are Eastern.';
    const content = document.getElementById('publication-dialog-games');
    content.replaceChildren(...chosen.map(group => {
      const host = document.createElement('section');
      host.className = 'staff-section';
      const heading = document.createElement('h3');
      heading.textContent = publicationTeamLabel(group);
      const games = document.createElement('ul');
      games.className = 'publication-games';
      for (const entry of group.games.filter(entry => !withdraw || entry.published)) {
        const game = withdraw ? entry.published : entry.draft ?? entry.published;
        const row = document.createElement('li');
        const title = document.createElement('strong');
        const opponent = names[game.opponent_school_id] ?? game.opponent_name ?? game.opponent_school_id ?? 'Opponent';
        title.textContent = publicationDate(game.game_date) + ' · ' + publicationTime(game.start_time) +
          (game.home_away === 'Home' ? ' vs. ' : ' at ') + opponent;
        const venue = document.createElement('p');
        venue.textContent = [game.location, game.status].filter(Boolean).join(' · ');
        const changes = document.createElement('ul');
        const lines = withdraw ? ['Remove from the public schedule'] : publicationChanges(entry, names);
        for (const line of lines.length ? lines : ['Already posted']) {
          const detail = document.createElement('li');
          detail.textContent = line;
          changes.append(detail);
        }
        row.append(title, venue, changes);
        games.append(row);
      }
      host.append(heading, games);
      return host;
    }));
    confirm.textContent = withdraw ? 'Take down' : 'Post schedule';
    confirm.disabled = false;
    dialogStatus.textContent = '';
    dialog.showModal();
  }

  confirm.onclick = async () => {
    if (!pending || busy) return;
    const action = pending, request = ++requestNumber;
    busy = true;
    confirm.disabled = true;
    dialogStatus.textContent = action.withdraw ? 'Taking it down…' : 'Posting…';
    const { error } = await client.rpc('publish_schedule_changes', {
      p_school: action.school, selections: action.selections, withdraw: action.withdraw,
    });
    if (!active || request !== requestNumber) return;
    busy = false;
    confirm.disabled = false;
    if (error) {
      if (error.code === '40001') confirm.disabled = true;
      dialogStatus.textContent = error.code === '40001'
        ? 'The schedule changed while you were reviewing. Close this and try again.'
        : error.code === '22023' ? error.message : 'That didn’t go through. Try again.';
      return;
    }
    dialog.close();
    pending = null;
    await load();
    onPublished(action.withdraw);
  };

  return {
    load, states, post,
    groups: () => groups,
    async reviewTeam(teamKey, withdraw = false) {
      if (!await load()) return;
      const group = groups.find(item => key(item) === teamKey);
      if (group && (!withdraw || group.published_at)) preview([group], withdraw);
    },
    reset() {
      requestNumber++; groups = []; pending = null; busy = false;
      if (dialog.open) dialog.close();
    },
    stop() {
      active = false; requestNumber++;
      confirm.onclick = null;
      if (dialog.open) dialog.close();
    },
  };
}
