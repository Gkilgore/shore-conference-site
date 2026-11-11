// Reads approved tournament documents from the public calendar and renders every bracket branch.
function renderPublicTournament(tournament, target, { idPrefix = '', headingLevel = 2, linkSchools = true, emptyText = 'No matches have been published.' } = {}) {
  const participants = new Map((tournament.participants || []).map(participant => [participant.id, participant]));
  const matches = new Map((tournament.matches || []).map(match => [match.id, match]));
  const rounds = new Map();
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const text = (tag, value, className) => {
    const element = document.createElement(tag);
    element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  for (const match of [...matches.values()].sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))) {
    if (!rounds.has(match.round)) {
      const section = document.createElement('section');
      section.className = 'tournament-round';
      const heading = text('h' + headingLevel, 'Round ' + match.round);
      heading.id = idPrefix + 'round-' + match.round;
      section.setAttribute('aria-labelledby', heading.id);
      const list = document.createElement('ol');
      section.append(heading, list);
      rounds.set(match.round, { section, list });
    }
    const card = document.createElement('li');
    card.className = 'tournament-match is-' + match.status.toLowerCase();
    card.id = idPrefix + 'match-' + match.id;
    card.append(text('h' + Math.min(headingLevel + 1, 6), match.label));
    for (const side of ['a', 'b']) {
      const slot = match[side];
      const previous = matches.get(slot.winner_of);
      const resolved = match['resolved_' + side] || slot.participant_id ||
        (['Final', 'Forfeit'].includes(previous?.status) ? previous.winner_id : null);
      const participant = participants.get(resolved);
      const name = participant ? (participant.seed ? participant.seed + '. ' : '') + participant.name
        : 'Winner of ' + (previous?.label || slot.winner_of || 'earlier match');
      const row = document.createElement('p');
      row.className = 'tournament-slot';
      const linksToSchool = Boolean(linkSchools && participant?.school_id);
      const label = text(linksToSchool ? 'a' : 'span', name);
      if (linksToSchool) label.href = 'school.html?school=' + encodeURIComponent(participant.school_id);
      row.append(label);
      if (match['score_' + side] != null) row.append(text('span', String(match['score_' + side]), 'tournament-score'));
      card.append(row);
    }
    const when = [];
    if (match.game_date) when.push(dateFormat.format(new Date(match.game_date + 'T12:00:00Z')));
    if (match.start_time) when.push(timeFormat.format(new Date('2000-01-01T' + match.start_time)) + ' ET');
    card.append(text('p', when.join(' · ') || 'Schedule to be announced'));
    card.append(text('p', match.venue || 'Venue to be announced'));
    const winner = participants.get(match.winner_id);
    const result = ['Final', 'Forfeit'].includes(match.status) && winner
      ? match.status + ' · Winner ' + winner.name : match.status;
    card.append(text('p', result, 'tournament-result'));
    rounds.get(match.round).list.append(card);
  }
  target.replaceChildren(...[...rounds.values()].map(round => round.section));
  if (!rounds.size) target.append(text('p', emptyText));
}

// Shows a tournament's rules link, confirmed director and confirmed dates. Unconfirmed details stay off the page.
function renderTournamentInfo(tournament, target) {
  const info = tournament.info || {};
  const items = [];
  const item = (label, content) => {
    const row = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = label;
    row.append(name, content);
    items.push(row);
  };
  if (/^https:\/\/\S+$/.test(info.rules_url || '')) {
    const link = document.createElement('a');
    link.href = info.rules_url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Tournament rules';
    item('Official', link);
  }
  if (info.director && info.director_confirmed === true) item('Director', info.director);
  const dateFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
  for (const row of Array.isArray(info.dates) ? info.dates : []) {
    if (row.confirmed === true && /^\d{4}-\d{2}-\d{2}$/.test(row.date || '') && row.label) {
      item(row.label, dateFormat.format(new Date(row.date + 'T12:00:00Z')));
    }
  }
  target.replaceChildren();
  target.hidden = !items.length;
  if (!items.length) return;
  const list = document.createElement('ul');
  list.append(...items);
  target.append(list);
}

(async () => {
  const target = document.getElementById('tournament-bracket');
  if (!target) return;
  const status = document.getElementById('tournament-status');
  const id = new URLSearchParams(location.search).get('id');
  if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    status.textContent = 'Choose a tournament from a calendar game.';
    return;
  }
  try {
    const schedule = await loadPublicCalendar({ scope: 'conference' });
    const record = (schedule.tournaments || []).find(tournament => tournament.id === id);
    if (!record) {
      status.textContent = 'This tournament has no published bracket.';
      return;
    }
    const tournament = record.document;
    document.title = tournament.name + ' | The Shore Conference';
    document.getElementById('tournament-title').textContent = tournament.name;
    document.getElementById('tournament-description').textContent = [tournament.gender, tournament.level,
      tournament.sport, tournament.season, tournament.season_year].filter(Boolean).join(' · ');
    renderTournamentInfo(tournament, document.getElementById('tournament-info'));
    renderPublicTournament(tournament, target);
    status.textContent = 'Published bracket and results · Eastern Time';
    const selected = location.hash.slice(1);
    if (selected.startsWith('match-')) document.getElementById(selected)?.scrollIntoView({ block: 'center' });
  } catch (error) {
    status.textContent = error.message || 'The bracket could not be loaded. Please refresh to try again.';
  }
})();
