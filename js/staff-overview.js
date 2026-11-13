// Schedule totals and unlinked games, plus unconfirmed buses for the Transportation tab.
function startStaffOverview(client, { currentSchool, gameTitle, canEdit, openEditor }) {
  const stats = document.getElementById('overview-stats');
  const linkList = document.getElementById('link-list');
  const busSection = document.getElementById('bus-section');
  const busList = document.getElementById('bus-list');
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  let links = null;
  let games = [];
  let request = 0;
  let active = true;

  function todayKey() {
    const today = new Date();
    return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
  }

  function note(text) {
    const item = document.createElement('li');
    item.className = 'staff-empty';
    item.textContent = text;
    return item;
  }

  function row(game, reason) {
    const item = document.createElement('li');
    const date = document.createElement('time');
    const title = document.createElement('strong');
    const details = document.createElement('span');
    const start = new Date(game.game_date + 'T12:00');
    date.dateTime = game.game_date;
    date.textContent = dateFormat.format(start);
    title.textContent = gameTitle(game);
    details.textContent = [game.start_time ? timeFormat.format(new Date(game.game_date + 'T' + game.start_time)) : 'TBD',
      game.location].join(' · ');
    const flag = document.createElement('em');
    flag.className = 'staff-reason';
    flag.textContent = reason;
    details.append(flag);
    item.append(date, title, details);
    if (canEdit()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'button secondary';
      button.textContent = 'Edit';
      button.setAttribute('aria-label', 'Edit ' + title.textContent);
      button.onclick = () => openEditor(game);
      item.append(button);
    }
    return item;
  }

  function stat(label, count, tone) {
    const item = document.createElement('li');
    item.className = count && tone ? 'is-' + tone : '';
    const number = document.createElement('strong');
    number.textContent = count ?? '–';
    item.append(number, label);
    return item;
  }

  function render(visible = games) {
    games = visible;
    const upcoming = games.filter(game => game.game_date >= todayKey());
    const conference = upcoming.filter(game => game.opponent_school_id);
    const checked = links instanceof Map;
    const unlinked = checked ? conference.filter(game => links.get(game.id) && !links.get(game.id).linked) : [];
    const linked = checked ? conference.filter(game => links.get(game.id)?.linked).length : null;
    const needsBus = upcoming.filter(game =>
      game.status === 'Scheduled' && game.home_away === 'Away' && !game.transportation?.bus_confirmed);

    busSection.hidden = !canEdit();
    stats.replaceChildren(
      stat('Upcoming games', upcoming.length),
      stat('Matched with opponent', linked, 'linked'),
      stat('Not matched', checked ? unlinked.length : null, 'problem'),
    );

    if (links === null) linkList.replaceChildren(note('Checking which games match…'));
    else if (!checked) linkList.replaceChildren(note('Match checks are not set up yet.'));
    else linkList.replaceChildren(...(unlinked.length
      ? unlinked.map(game => row(game, links.get(game.id).reason))
      : [note('Every upcoming conference game in this view matches.')]));

    busList.replaceChildren(...(needsBus.length
      ? needsBus.map(game => row(game, game.transportation?.bus_departure ? 'Bus entered, not confirmed' : 'No bus entered yet'))
      : [note('Every upcoming away game in this view has a confirmed bus.')]));
  }

  async function load(visible) {
    const school = currentSchool();
    const current = ++request;
    links = null;
    render(visible);
    if (!school) return;
    const { data, error } = await client.rpc('game_link_status', { school: school.slug });
    if (!active || current !== request) return;
    links = error ? 'unavailable' : new Map(data.map(item => [item.game_id, item]));
    render();
  }

  return {
    load,
    render,
    links: () => links,
    reset() {
      request++;
      links = null;
      games = [];
    },
    stop() {
      active = false;
    },
  };
}
