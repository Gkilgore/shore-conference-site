// Schedule tab: pick one team and see its games as a table, each with an Edit button.
// Games that don't match the other school's entry are flagged on their row.
function startStaffTeamSchedule({ teams, links, states, schoolName, openGame, canEdit }) {
  const picker = document.getElementById('games-team');
  const host = document.getElementById('games-team-schedule');
  const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const clock = (date, time) => time ? timeFormat.format(new Date(date + 'T' + time)) : '';
  let chosen = '';

  function node(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  const opponent = game => (game.home_away === 'Home' ? 'vs. ' : '@ ') +
    (schoolName(game.opponent_school_id) || game.opponent_name || 'Opponent');

  function row(game) {
    const tr = node('tr');
    const date = node('td', dateFormat.format(new Date(game.game_date + 'T12:00')));
    const who = node('td');
    who.append(node('strong', opponent(game)));
    const state = states().map.get(game.id);
    if (state) who.append(' ', node('span', state === 'Draft' ? 'Not posted' : 'Change not posted', 'staff-tag'));
    const link = links() instanceof Map ? links().get(game.id) : null;
    if (link && !link.linked && game.game_date >= new Date().toISOString().slice(0, 10)) {
      tr.classList.add('is-unmatched');
      who.append(node('span', 'Not matched: ' + link.reason, 'staff-reason'));
    }
    const status = node('td', game.status === 'Scheduled' ? '' : game.status);
    if (game.status !== 'Scheduled') status.className = 'is-' + game.status.toLowerCase();
    tr.append(date, node('td', clock(game.game_date, game.start_time) || 'TBD'), who,
      node('td', game.location || ''), node('td', clock(game.game_date, game.transportation?.bus_departure) || '—'), status);
    if (canEdit()) {
      const cell = node('td');
      const edit = node('button', 'Edit', 'button secondary');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Edit ' + dateFormat.format(new Date(game.game_date + 'T12:00')) + ' ' + opponent(game));
      edit.onclick = () => openGame(game);
      cell.append(edit);
      tr.append(cell);
    }
    return tr;
  }

  function render() {
    const all = teams();
    picker.replaceChildren(...all.map(team => new Option(team.label, team.key)));
    if (!all.some(team => team.key === chosen)) chosen = all.find(team => team.games.length)?.key ?? all[0]?.key ?? '';
    picker.value = chosen;
    picker.disabled = !all.length;
    const team = all.find(item => item.key === chosen);
    if (!team) {
      host.replaceChildren(node('p', 'No teams yet. Add your teams on My Teams first.', 'staff-empty'));
      return;
    }
    if (!team.games.length) {
      host.replaceChildren(node('p', 'No games yet for ' + team.label + '. Add a game or import a schedule.', 'staff-empty'));
      return;
    }
    const table = node('table', undefined, 'staff-schedule-table');
    const head = node('tr');
    for (const label of ['Date', 'Time', 'Opponent', 'Venue', 'Bus', 'Status', ...(canEdit() ? [''] : [])]) {
      const th = node('th', label);
      th.scope = 'col';
      head.append(th);
    }
    const thead = node('thead');
    thead.append(head);
    const body = node('tbody');
    body.append(...team.games.map(row));
    table.append(thead, body);
    const wrap = node('div', undefined, 'staff-schedule-table-wrap');
    wrap.append(table);
    host.replaceChildren(wrap);
  }

  picker.onchange = () => { chosen = picker.value; render(); };
  return {
    render,
    // The team picked here, so Add game can start with it filled in.
    selected: () => teams().find(team => team.key === chosen) ?? null,
    reset() { chosen = ''; host.replaceChildren(); picker.replaceChildren(); },
    stop() { picker.onchange = null; },
  };
}
