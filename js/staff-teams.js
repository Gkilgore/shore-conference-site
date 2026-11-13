// Teams tab: one team's schedule, unmatched games and whether it is posted (plus coaches, when switched on).
// It reads what the other controllers already loaded and sends every change through their existing steps.
function startStaffTeams({ games, groups, states, links, coaches, schoolName, filterValues,
  openGame, addGame, reviewTeam, unpublishTeam, editCoach, addCoach }) {
  const list = document.getElementById('team-list');
  const detail = document.getElementById('team-detail');
  const status = document.getElementById('teams-status');
  const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const seasons = ['Fall', 'Winter', 'Spring'];
  let selected = null;

  function node(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function button(text, className, action) {
    const item = node('button', text, 'button ' + className);
    item.type = 'button';
    item.onclick = action;
    return item;
  }
  function today() {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  const when = game => new Date(game.game_date + 'T12:00');

  // A team is one sport, gender, level and season. The publish records also carry its year.
  // If those have not loaded, teams are still listed from the saved games, without a publish status.
  function teams() {
    const all = games();
    const byId = new Map(all.map(game => [game.id, game]));
    const fromGroups = groups().map(group => ({
      key: group.team_id + '|' + group.season_year, group, label: publicationTeamLabel(group),
      sport: group.sport, gender: group.gender, level: group.level, season: group.season,
      games: group.games.filter(entry => entry.draft).map(entry => byId.get(entry.id)).filter(Boolean),
    }));
    if (fromGroups.length) return sort(fromGroups);
    const derived = new Map();
    for (const game of all) {
      const team = game.teams;
      const key = [team.sport, team.gender, team.level, team.season].join('|');
      if (!derived.has(key)) derived.set(key, { key, group: null, ...team,
        label: [team.gender, team.level, team.sport].join(' ') + ' · ' + team.season, games: [] });
      derived.get(key).games.push(game);
    }
    return sort([...derived.values()]);
  }
  function sort(items) {
    const levels = ['Varsity', 'JV', 'Freshman'];
    return items.sort((a, b) => seasons.indexOf(a.season) - seasons.indexOf(b.season) || a.sport.localeCompare(b.sport) ||
      a.gender.localeCompare(b.gender) || levels.indexOf(a.level) - levels.indexOf(b.level) || a.key.localeCompare(b.key));
  }

  function publishState(team) {
    const group = team.group;
    if (!group) return { text: '', tone: '' };
    if (!group.published_at) return { text: 'Not posted', tone: 'is-draft' };
    if (group.pending_count) return { text: group.pending_count + (group.pending_count === 1 ? ' change' : ' changes') + ' not posted', tone: 'is-draft' };
    return { text: 'Posted', tone: 'is-public' };
  }
  // Upcoming games against member schools whose entry differs from the other school's.
  function unmatched(team) {
    const map = links();
    if (!(map instanceof Map)) return [];
    return team.games.filter(game => game.game_date >= today() && game.opponent_school_id && map.get(game.id) && !map.get(game.id).linked);
  }
  const opponent = game => (game.home_away === 'Home' ? 'vs. ' : 'at ') + (schoolName(game.opponent_school_id) || game.opponent_name || 'Opponent');

  function renderList(all) {
    const filters = filterValues();
    const visible = all.filter(team => ['sport', 'season', 'level', 'gender'].every(name => !filters[name] || filters[name] === team[name]));
    list.replaceChildren(...visible.map(team => {
      const row = node('li');
      const open = node('button', undefined, 'team-row');
      open.type = 'button';
      open.dataset.team = team.key;
      const next = team.games.find(game => game.game_date >= today());
      const count = team.games.length + (team.games.length === 1 ? ' game' : ' games');
      const state = publishState(team);
      const misses = unmatched(team).length;
      const tags = node('span', undefined, 'team-tags');
      if (misses) tags.append(node('span', misses + ' not matched', 'team-tag is-problem'));
      if (state.text) tags.append(node('span', state.text, 'team-tag ' + state.tone));
      open.append(node('strong', team.label), node('span', count + (next ? ' · next ' + shortDate.format(when(next)) : ''), 'team-meta'), tags);
      open.onclick = () => { selected = team.key; status.textContent = ''; render(); document.getElementById('team-title').focus(); };
      row.append(open);
      return row;
    }));
    if (!all.length) list.append(node('li', 'No teams yet. A team shows up here once it has a game.', 'staff-empty'));
    else if (!visible.length) list.append(node('li', 'No teams match these filters.', 'staff-empty'));
  }

  function gameRow(game, reason) {
    const row = node('li');
    const date = node('time', shortDate.format(when(game)));
    date.dateTime = game.game_date;
    const title = node('strong', opponent(game));
    const state = states().map.get(game.id);
    if (state) title.append(' ', node('span', state === 'Draft' ? 'Not posted' : 'Change not posted', 'staff-tag'));
    if (game.status !== 'Scheduled') title.append(' ', node('span', game.status, 'staff-tag is-' + game.status.toLowerCase()));
    const time = game.start_time ? timeFormat.format(new Date(game.game_date + 'T' + game.start_time)) : 'TBD';
    const details = node('span', [dateFormat.format(when(game)).split(',')[0], time, game.location].filter(Boolean).join(' · '));
    if (reason) details.append(node('em', reason, 'staff-reason'));
    const edit = button('Edit', 'secondary', () => openGame(game));
    edit.setAttribute('aria-label', 'Edit ' + shortDate.format(when(game)) + ' ' + opponent(game));
    row.append(date, title, details, edit);
    return row;
  }
  function section(title, ...children) {
    const host = node('section', undefined, 'staff-section');
    host.append(node('h4', title), ...children);
    return host;
  }

  function renderDetail(team) {
    const state = publishState(team);
    const group = team.group;
    const back = button('← All teams', 'secondary', () => {
      const key = selected;
      selected = null; status.textContent = ''; render();
      [...list.querySelectorAll('.team-row')].find(row => row.dataset.team === key)?.focus();
    });
    back.id = 'team-back';
    const heading = node('h4', team.label, 'team-heading');
    heading.id = 'team-title';
    heading.tabIndex = -1;
    const stateLine = node('p', undefined, 'team-state');
    if (state.text) stateLine.append(node('span', state.text, 'team-tag ' + state.tone));
    if (group && !group.published_at) stateLine.append(' Families can’t see this schedule yet.');
    else if (group?.pending_count) stateLine.append(' Families still see the earlier version.');
    const actions = node('div', undefined, 'actions');
    actions.append(button('Add game', 'primary', () => addGame(team)));
    if (group) {
      const publish = button('Post schedule', 'secondary', () => reviewTeam(team.key));
      publish.disabled = Boolean(group.published_at && !group.pending_count);
      actions.append(publish);
      if (group.published_at) actions.append(button('Take down…', 'secondary', () => unpublishTeam(team.key)));
    }
    const head = node('div', undefined, 'team-head');
    head.append(back, heading, stateLine, actions);

    const parts = [head];
    const misses = unmatched(team);
    if (misses.length) {
      const games = node('ul', undefined, 'game-list staff-attention team-games');
      games.append(...misses.map(game => gameRow(game, links().get(game.id).reason)));
      parts.push(section('Not matched with the other school',
        node('p', 'These aren’t on the conference calendar yet. Fix the detail shown, or ask the other school to fix theirs.', 'staff-hint'), games));
    }

    const schedule = node('ul', undefined, 'game-list staff-attention team-games');
    schedule.append(...(team.games.length ? team.games.map(game => gameRow(game))
      : [node('li', 'No games yet.', 'staff-empty')]));
    parts.push(section('Schedule', schedule));

    // Coaches are shown only while coach lists are switched on.
    detail.replaceChildren(...parts);
    if (!coaches()) return;
    const assigned = coaches().filter(coach => coach.coach_teams.some(item => sameTeam(item, team)));
    const coachList = node('ul', undefined, 'team-coaches');
    coachList.append(...(assigned.length ? assigned.map(coach => {
      const row = node('li');
      const edit = button('Edit', 'secondary', () => editCoach(coach.id));
      edit.setAttribute('aria-label', 'Edit coach ' + (coach.name || coach.email));
      row.append(node('strong', coach.name || coach.email), node('span', coach.name ? coach.email : ''), edit);
      return row;
    }) : [node('li', 'No coach listed for this team.', 'staff-empty')]));
    const coachActions = node('div', undefined, 'actions');
    coachActions.append(button('Add a coach', 'secondary', () => addCoach(team)));
    parts.push(section('Coaches', coachList, coachActions));

    detail.replaceChildren(...parts);
  }

  function render() {
    const all = teams();
    const team = all.find(item => item.key === selected);
    if (!team) selected = null;
    list.hidden = Boolean(team);
    detail.hidden = !team;
    if (team) renderDetail(team);
    else { detail.replaceChildren(); renderList(all); }
  }

  return {
    render,
    setStatus(text) { status.textContent = text; },
    reset() { selected = null; status.textContent = ''; list.replaceChildren(); detail.replaceChildren(); },
  };
}
