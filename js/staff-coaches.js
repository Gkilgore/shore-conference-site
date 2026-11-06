// Coaches tab: each school's coach list, the teams each coach gets emails for, and the email outbox.
const coachLevels = ['Varsity', 'JV', 'Freshman'];

function coachTeamLabel(team) {
  return [team.gender, team.level, team.sport].join(' ');
}

function sameTeam(first, second) {
  return first.sport.toLowerCase() === second.sport.toLowerCase() &&
    first.gender === second.gender && first.level === second.level;
}

function startStaffCoaches(client, { currentSchool, schools, existingGames }) {
  const status = document.getElementById('coaches-status');
  const form = document.getElementById('coach-form');
  const fields = form.elements;
  const formTitle = document.getElementById('coach-form-title');
  const formStatus = document.getElementById('coach-form-status');
  const chips = document.getElementById('coach-team-chips');
  const addTeam = document.getElementById('coach-team-add');
  const cancel = document.getElementById('coach-form-cancel');
  const sportList = document.getElementById('coach-sports');
  const list = document.getElementById('coach-list');
  const uncovered = document.getElementById('coach-uncovered');
  const outbox = document.getElementById('coach-outbox');
  const draft = document.getElementById('coach-draft');
  const dateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const queuedFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  let coaches = [];
  let teams = [];
  let editing = null;
  let request = 0;
  let active = true;
  let ready = false;

  // ----- Coach form -----
  function showChips() {
    chips.replaceChildren(...teams.map((team, index) => {
      const item = document.createElement('li');
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', 'Remove ' + coachTeamLabel(team));
      remove.onclick = () => { teams.splice(index, 1); showChips(); };
      item.append(coachTeamLabel(team), remove);
      return item;
    }));
    if (!teams.length) chips.append(Object.assign(document.createElement('li'), { className: 'coach-chip-empty', textContent: 'No teams yet' }));
  }

  // Adds the sport, gender and ticked levels as teams. Returns false if nothing usable was entered.
  function takeTeam() {
    const sport = fields.team_sport.value.trim().replace(/\s+/g, ' ');
    const levels = [...form.querySelectorAll('[name="team_level"]:checked')].map(box => box.value);
    if (!sport && !levels.length) return true;
    if (!sport || !levels.length) {
      formStatus.textContent = 'Enter a sport and tick at least one level, then choose Add team.';
      return false;
    }
    for (const level of levels) {
      const team = { sport: sport.replace(/\b\w/g, letter => letter.toUpperCase()), gender: fields.team_gender.value, level };
      if (!teams.some(saved => sameTeam(saved, team))) teams.push(team);
    }
    fields.team_sport.value = '';
    form.querySelectorAll('[name="team_level"]').forEach(box => { box.checked = false; });
    formStatus.textContent = '';
    showChips();
    return true;
  }

  function startForm(coach = null) {
    editing = coach;
    form.reset();
    teams = coach ? coach.coach_teams.map(team => ({ ...team })) : [];
    fields.name.value = coach?.name ?? '';
    fields.email.value = coach?.email ?? '';
    fields.invite.checked = !coach;
    formTitle.textContent = coach ? 'Edit ' + (coach.name || coach.email) : 'Add a coach';
    cancel.hidden = !coach;
    formStatus.textContent = '';
    showChips();
  }

  addTeam.onclick = takeTeam;
  cancel.onclick = () => startForm();
  form.onsubmit = async event => {
    event.preventDefault();
    if (!ready || !takeTeam()) return;
    if (!teams.length) {
      formStatus.textContent = 'Add at least one team so this coach gets game emails.';
      return;
    }
    const email = fields.email.value.trim().toLowerCase();
    if (coaches.some(coach => coach.email === email && coach.id !== editing?.id)) {
      formStatus.textContent = 'That email is already on the list. Edit that coach instead.';
      return;
    }
    const save = form.querySelector('[type="submit"]');
    save.disabled = true;
    formStatus.textContent = 'Saving coach…';
    const { error } = await client.rpc('save_coach', { input: {
      id: editing?.id ?? null, school_id: currentSchool().slug, name: fields.name.value,
      email, teams, invite: fields.invite.checked,
    } });
    if (!active) return;
    save.disabled = false;
    if (error) {
      formStatus.textContent = 'The coach could not be saved. Check the email address and try again.';
      return;
    }
    const invited = fields.invite.checked;
    startForm();
    formStatus.textContent = 'Coach saved.' + (invited ? ' The invite is waiting in the outbox.' : '');
    load();
  };

  // ----- Coach list -----
  function actionButton(label, onclick, aria) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button secondary';
    button.textContent = label;
    if (aria) button.setAttribute('aria-label', aria);
    button.onclick = onclick;
    return button;
  }

  function showList() {
    list.replaceChildren(...(coaches.length ? coaches.map(coach => {
      const item = document.createElement('li');
      const who = document.createElement('div');
      const name = document.createElement('strong');
      const email = document.createElement('span');
      const teamList = document.createElement('ul');
      name.textContent = coach.name || coach.email;
      email.textContent = coach.name ? coach.email : '';
      teamList.className = 'coach-chips';
      teamList.append(...coach.coach_teams.map(team => Object.assign(document.createElement('li'), { textContent: coachTeamLabel(team) })));
      who.append(name, email, teamList);
      const label = coach.name || coach.email;
      const remove = actionButton('Delete', async () => {
        if (remove.dataset.confirm !== 'yes') {
          remove.dataset.confirm = 'yes';
          remove.textContent = 'Confirm delete';
          remove.classList.add('is-danger');
          return;
        }
        remove.disabled = true;
        const { error } = await client.from('coaches').delete().eq('id', coach.id);
        if (!active) return;
        status.textContent = error ? 'The coach could not be deleted. Try again.' : label + ' was removed.';
        load();
      }, 'Delete ' + label);
      const invite = actionButton('Invite', async () => {
        invite.disabled = true;
        const { error } = await client.from('coach_email_outbox')
          .insert({ school_id: currentSchool().slug, coach_id: coach.id, kind: 'welcome' });
        if (!active) return;
        status.textContent = error ? 'The invite could not be queued. Try again.' : 'Invite for ' + label + ' is waiting in the outbox.';
        load();
      }, 'Send an invite to ' + label);
      const edit = actionButton('Edit', () => { startForm(coach); fields.email.focus(); }, 'Edit ' + label);
      const actions = document.createElement('div');
      actions.className = 'coach-actions';
      actions.append(edit, invite, remove);
      item.append(who, actions);
      return item;
    }) : [Object.assign(document.createElement('li'), { className: 'staff-empty', textContent: 'No coaches yet. Add one above or import a list.' })]));

    // Teams that have games but no coach listed, so ADs can spot gaps.
    const gameTeams = [];
    for (const game of existingGames()) {
      if (!gameTeams.some(team => sameTeam(team, game.teams))) gameTeams.push(game.teams);
    }
    const missing = gameTeams.filter(team => !coaches.some(coach => coach.coach_teams.some(saved => sameTeam(saved, team))));
    uncovered.textContent = missing.length
      ? 'No coach listed for: ' + missing.map(coachTeamLabel).sort().join(', ') + '.'
      : '';
    sportList.replaceChildren(...[...new Set(gameTeams.map(team => team.sport))].sort().map(sport => new Option(sport)));
  }

  // ----- Outbox and email previews -----
  function opponentName(game) {
    return schools().find(school => school.slug === game.opponent_school_id)?.name ?? game.opponent_name;
  }

  function gameLine(game) {
    const start = new Date(game.game_date + 'T' + game.start_time);
    return coachTeamLabel(game.teams) + (game.home_away === 'Home' ? ' vs. ' : ' at ') + opponentName(game) +
      ' · ' + dateFormat.format(start) + ', ' + timeFormat.format(start) + ' · ' + game.location;
  }

  function changeLines(entry) {
    const before = entry.previous ?? {};
    const game = entry.games;
    const time = value => timeFormat.format(new Date('2000-01-01T' + value));
    const day = value => dateFormat.format(new Date(value + 'T12:00'));
    return [
      before.game_date !== game.game_date && 'Date: ' + day(before.game_date) + ' → ' + day(game.game_date),
      before.start_time !== game.start_time && 'Time: ' + time(before.start_time) + ' → ' + time(game.start_time),
      before.location !== game.location && 'Location: ' + before.location + ' → ' + game.location,
      before.home_away !== game.home_away && 'Home or away: ' + before.home_away + ' → ' + game.home_away,
      before.status !== game.status && 'Status: ' + before.status + ' → ' + game.status,
    ].filter(Boolean);
  }

  // Builds the subject and body. When sending is added, the server will use this same wording.
  function compose(item) {
    const school = currentSchool().name;
    const coach = item.coaches;
    const hello = 'Hi ' + (coach.name || 'Coach') + ',';
    const footer = ['', 'Questions about a game? Contact the ' + school + ' athletic director.'];
    if (item.kind === 'welcome') {
      const teamsFor = coaches.find(saved => saved.id === item.coach_id)?.coach_teams ?? [];
      return {
        subject: 'You’re on the ' + school + ' coach list',
        body: [hello, '', school + ' added you as a coach for:', ...teamsFor.map(team => '• ' + coachTeamLabel(team)), '',
          'You’ll get an email when one of these teams has a game scheduled, changed, postponed or canceled.', ...footer].join('\n'),
      };
    }
    if (item.kind === 'summary') {
      return {
        subject: item.entries.length + ' new games added to your ' + school + ' schedule',
        body: [hello, '', 'These games were added to the schedule:', ...item.entries.map(entry => '• ' + gameLine(entry.games)), ...footer].join('\n'),
      };
    }
    const game = item.games;
    const title = coachTeamLabel(game.teams) + (game.home_away === 'Home' ? ' vs. ' : ' at ') + opponentName(game);
    const day = dateFormat.format(new Date(game.game_date + 'T12:00'));
    const heading = { scheduled: 'New game', changed: 'Game changed', postponed: 'Game postponed', canceled: 'Game canceled' }[item.kind];
    const intro = {
      scheduled: 'A new game was added to the schedule:',
      changed: 'This game was updated:',
      postponed: 'This game was postponed. A new date will come in a separate email.',
      canceled: 'This game was canceled:',
    }[item.kind];
    return {
      subject: heading + ': ' + title + ', ' + day,
      body: [hello, '', intro, '• ' + gameLine(game),
        ...(item.kind === 'scheduled' ? [] : ['', ...changeLines(item)]),
        ...(game.notes ? ['', 'Notes: ' + game.notes] : []), ...footer].join('\n'),
    };
  }

  function showOutbox(entries) {
    // Rows from one import become one summary per coach.
    const items = [];
    for (const entry of entries) {
      if (!entry.games && entry.kind !== 'welcome') continue;
      const group = entry.batch_id && items.find(item => item.batch_id === entry.batch_id && item.coach_id === entry.coach_id);
      if (group) group.entries.push(entry);
      else if (entry.batch_id) items.push({ ...entry, kind: 'summary', entries: [entry] });
      else items.push(entry);
    }
    const labels = { welcome: 'Invite', summary: 'Import summary', scheduled: 'New game', changed: 'Changed', postponed: 'Postponed', canceled: 'Canceled' };
    outbox.replaceChildren(...(items.length ? items.map(item => {
      const row = document.createElement('li');
      const kind = document.createElement('span');
      kind.className = 'outbox-kind is-' + item.kind;
      kind.textContent = labels[item.kind];
      const text = document.createElement('div');
      const to = document.createElement('strong');
      const what = document.createElement('span');
      to.textContent = (item.coaches.name ? item.coaches.name + ' · ' : '') + item.coaches.email;
      what.textContent = compose(item).subject + ' · queued ' + queuedFormat.format(new Date(item.created_at));
      text.append(to, what);
      row.append(kind, text, actionButton('Preview', () => {
        const email = compose(item);
        document.getElementById('coach-draft-to').textContent = item.coaches.email;
        document.getElementById('coach-draft-subject').textContent = email.subject;
        document.getElementById('coach-draft-body').textContent = email.body;
        draft.showModal();
      }, 'Preview email to ' + item.coaches.email));
      return row;
    }) : [Object.assign(document.createElement('li'), { className: 'staff-empty', textContent: 'No emails waiting.' })]));
  }

  // ----- Loading -----
  async function load() {
    const school = currentSchool();
    if (!school) return;
    const current = ++request;
    status.textContent = 'Loading coaches…';
    const [coachResult, outboxResult] = await Promise.all([
      client.from('coaches').select('id,name,email,coach_teams(sport,gender,level)').eq('school_id', school.slug).order('email'),
      client.from('coach_email_outbox')
        .select('id,kind,created_at,batch_id,previous,coach_id,coaches(name,email),games(game_date,start_time,location,home_away,status,notes,opponent_school_id,opponent_name,teams(sport,gender,level))')
        .eq('school_id', school.slug).eq('status', 'queued').order('created_at', { ascending: false }).limit(300),
    ]);
    if (!active || current !== request) return;
    ready = !coachResult.error;
    form.querySelector('[type="submit"]').disabled = !ready;
    if (!ready) {
      status.textContent = 'Coach lists are not set up yet. They start working once the coach email migration is installed.';
      coaches = [];
      showList();
      outbox.replaceChildren();
      return;
    }
    status.textContent = '';
    coaches = coachResult.data.sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
    showList();
    showOutbox(outboxResult.data ?? []);
  }

  return {
    load,
    coaches: () => coaches,
    reset() {
      request++;
      coaches = [];
      startForm();
    },
    stop() {
      active = false;
      form.onsubmit = addTeam.onclick = cancel.onclick = null;
      if (draft.open) draft.close();
    },
  };
}
