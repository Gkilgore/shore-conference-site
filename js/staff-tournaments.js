// Manages checked tournament drafts, publication reviews and school-owned bus details.
function startStaffTournaments(client, { schools = () => [] } = {}) {
  const el = id => document.getElementById(id);
  const root = el('staff-tournaments-panel');
  const manager = el('tournament-manager');
  const select = el('tournament-select');
  const status = el('tournament-status');
  const dialog = el('tournament-review-dialog');
  const clone = value => JSON.parse(JSON.stringify(value));
  let active = false, stopped = false, generation = 0, busy = false;
  let actorRole = null, schoolId = null, records = [], conflicts = [], transportation = [];
  let selected = null, working = null, dirty = false, review = null, proposal = null, csvText = '';
  let draftActor = null;
  const manages = () => actorRole === 'site_admin' || actorRole === 'conference_office';
  const editable = () => active && !stopped && !busy && manages() && working;
  const schoolName = id => schools().find(school => school.slug === id)?.name ?? id;

  function node(tag, text, className) {
    const item = document.createElement(tag);
    if (text !== undefined) item.textContent = text;
    if (className) item.className = className;
    return item;
  }
  function button(text, action) {
    const item = node('button', text, 'button secondary');
    item.type = 'button';
    item.onclick = action;
    return item;
  }
  function option(text, value) {
    const item = node('option', text);
    item.value = value;
    return item;
  }
  function input(id, value, type = 'text') {
    const item = node('input');
    item.id = id;
    item.type = type;
    item.value = value ?? '';
    return item;
  }
  function field(label, item) {
    const wrapper = node('label', label);
    wrapper.append(item);
    return wrapper;
  }
  function pick(id, values, value) {
    const item = node('select');
    item.id = id;
    item.append(...values.map(entry => option(entry[0], entry[1])));
    item.value = value ?? '';
    return item;
  }
  function setBusy(value) {
    busy = value;
    for (const target of [root,dialog]) {
      for (const item of target.querySelectorAll('input,select,textarea,button')) item.disabled = value;
    }
    updateActions();
  }
  function updateActions() {
    el('tournament-save').disabled = !editable();
    el('tournament-review').disabled = !editable() || dirty || !selected?.revision;
    el('tournament-export').disabled = !working || busy;
    el('tournament-publish').disabled = busy || !review;
    el('tournament-discard').hidden = !dirty;
    el('tournament-dirty').textContent = dirty ? 'Unsaved draft. Save before publishing or signing out.' : selected ? 'Saved draft.' : '';
  }
  function invalidateReview() {
    review = null;
    dialog.close();
    el('tournament-publish').disabled = true;
  }
  function changed() {
    dirty = true;
    proposal = null;
    el('tournament-proposal').hidden = true;
    invalidateReview();
    updateActions();
    renderIssues();
    renderBracket(working,el('tournament-draft-bracket'),'draft-');
  }
  function issueList(target, issues, source = working) {
    target.replaceChildren(...issues.map(issue => {
      const match = source?.matches.find(item => item.id === issue.match_id);
      const label = match?.label || (issue.match_id ? 'Tournament game' : '');
      return node('li',(label ? label + ' — ' : '') + (issue.blocking ? 'Fix before publishing. ' : '') + issue.message);
    }));
  }
  function otherGames(id = selected?.id) {
    const prefix = 'tournament-' + id + '-';
    return conflicts.filter(game => !String(game.id).startsWith(prefix));
  }
  function renderIssues() {
    issueList(el('tournament-issues'), working ? TournamentEngine.validate(working, otherGames()) : []);
  }
  function errorMessage(error) {
    if (error?.code === '40001') return 'This tournament changed. Reload the saved version, review your changes and try again.';
    if (error?.code === '42501') return 'Your invited access no longer permits this action. Reload tournaments to check your access.';
    return error?.message || 'The request could not finish. Try again.';
  }
  async function request(name, args) {
    const result = await client.rpc(name, args);
    if (result.error) throw result.error;
    return result.data;
  }
  async function operation(action, done, target = status) {
    if (!active || stopped || busy) return;
    const ticket = generation;
    setBusy(true);
    try {
      const data = await action();
      if (!active || stopped || ticket !== generation) return;
      done(data);
    } catch (error) {
      if (!active || stopped || ticket !== generation) return;
      if (error?.code === '42501') { dirty = false;reset();active = true; }
      target.textContent = errorMessage(error);
      status.textContent = errorMessage(error);
      review = null;
      el('tournament-publish').disabled = true;
    } finally {
      if (active && !stopped && ticket === generation) setBusy(false);
    }
  }
  function fillSelect() {
    select.replaceChildren(...records.map(record => option((record.draft ?? record.published).name || 'Untitled tournament', record.id)));
    select.value = selected?.id ?? '';
  }
  function selectRecord(record) {
    selected = record;
    working = record ? clone(manages() ? record.draft : record.published) : null;
    dirty = false;
    draftActor = actorRole + ':' + (schoolId ?? '');
    proposal = null;
    csvText = '';
    el('tournament-import-file').value = '';
    el('tournament-import-mapping').replaceChildren();
    el('tournament-proposal').hidden = true;
    invalidateReview();
    el('tournament-participants').value = (working?.participants ?? []).map(participant => (participant.seed ? participant.seed + '. ' : '') + participant.name).join('\n');
    fillSelect();
    render();
  }
  function storeRecord(record) {
    const index = records.findIndex(item => item.id === record.id);
    if (index < 0) records.push(record);
    else records[index] = record;
    selectRecord(record);
  }
  async function load() {
    if (stopped || busy) return;
    active = true;
    const ticket = ++generation;
    const unsaved = dirty && working ? {selected,working:clone(working),actor:draftActor} : null;
    actorRole = null;schoolId = null;
    manager.hidden = true;
    el('tournament-readonly').hidden = true;
    el('tournament-selector').hidden = true;
    el('tournament-transport').hidden = true;
    invalidateReview();
    status.textContent = 'Checking tournament access…';
    await operation(() => request('list_tournaments'), data => {
      if (ticket !== generation) return;
      actorRole = data.actor_role;
      schoolId = data.school_id;
      records = ['site_admin','conference_office','ad'].includes(actorRole) ? data.tournaments ?? [] : [];
      conflicts = data.conflicts ?? [];
      transportation = data.transportation ?? [];
      const saved = records.find(record => record.id === unsaved?.selected.id);
      const restore = unsaved && manages() && unsaved.actor === actorRole + ':' + (schoolId ?? '') && (saved || !unsaved.selected.revision);
      if (restore && !saved) records.push(unsaved.selected);
      selectRecord(records.find(record => record.id === selected?.id) ?? records[0] ?? null);
      if (restore) {
        selected = unsaved.selected;
        working = unsaved.working;
        dirty = true;
        fillSelect();render();
      }
      status.textContent = manages() ? 'Conference-owned games. Ordinary school schedules remain read-only for conference staff.'
        : actorRole === 'ad' ? 'Published tournament games for your school. Add your school’s bus details below.' : 'Tournament access is unavailable for this account.';
      if (restore && saved && saved.revision !== selected.revision) status.textContent = 'The saved tournament changed while you were away. Your unsaved draft is kept. Download its master CSV before discarding and reloading the current version.';
    });
  }
  function blankDocument() {
    return { name: '', sport: '', gender: 'Girls', level: 'Varsity', season: 'Spring', season_year: new Date().getFullYear(),
      duration_minutes: 90, turnaround_minutes: 15, rest_minutes: 60, windows: [], participants: [], matches: [] };
  }
  function newTournament() {
    if (!active || busy || !manages()) return;
    if (dirty) { status.textContent = 'Save this draft before creating another tournament.'; return; }
    generation++;
    const record = { id: crypto.randomUUID(), revision: 0, published_revision: null, draft: blankDocument(), published: null, issues: [] };
    records.push(record);
    selectRecord(record);
    dirty = true;
    updateActions();
    el('tournament-name').focus();
  }
  function render() {
    manager.hidden = !manages();
    el('tournament-editor').hidden = !manages() || !working;
    el('tournament-readonly').hidden = manages() || !working;
    el('tournament-selector').hidden = !records.length;
    el('tournament-empty').textContent = records.length ? '' : manages() ? 'Create a tournament or import a master CSV.' : 'No published tournament games involve your school yet.';
    if (manages()) {
      renderSchools();
      if (working) { renderMetadata(); renderWindows(); renderMatches(); renderIssues(); renderBracket(working,el('tournament-draft-bracket'),'draft-'); }
    } else if (working) renderPublished();
    renderTransport();
    updateActions();
  }
  function renderMetadata() {
    const target = el('tournament-metadata');
    target.replaceChildren();
    const fields = [ ['name','Tournament name','text'], ['sport','Sport','text'], ['gender','Gender','text'], ['level','Level','text'],
      ['season','Season','text'], ['season_year','Season year','number'], ['duration_minutes','Game minutes','number'],
      ['turnaround_minutes','Venue turnaround minutes','number'], ['rest_minutes','Team rest minutes','number'] ];
    const choices = {gender:['Boys','Girls','Coed'],level:['Varsity','JV','Freshman'],season:['Fall','Winter','Spring']};
    for (const [name, label, type] of fields) {
      const id = 'tournament-' + name.replaceAll('_','-');
      const item = choices[name] ? pick(id,choices[name].map(value => [value,value]),working[name]) : input(id,working[name],type);
      if (type === 'number') item.min = name === 'season_year' ? '2000' : name === 'duration_minutes' ? '1' : '0';
      else item.maxLength = name === 'name' ? 120 : 60;
      item.onchange = () => {
        if (!editable()) return;
        working[name] = type === 'number' ? Number(item.value) : item.value.trim();
        changed();
      };
      target.append(field(label, item));
    }
  }
  function renderSchools() {
    const target = el('tournament-school-options');
    target.replaceChildren(...schools().map(school => option(school.name, school.slug)));
  }
  function renderWindows() {
    const target = el('tournament-windows');
    target.replaceChildren(...working.windows.map((window, index) => {
      const row = node('div', undefined, 'filters tournament-window');
      for (const [name, label, type] of [['date','Date','date'],['start','Start','time'],['end','End','time'],['venue','Venue','text']]) {
        const item = input('tournament-window-' + index + '-' + name, window[name], type);
        item.onchange = () => { if (editable()) { window[name] = item.value; changed(); } };
        row.append(field(label, item));
      }
      row.append(button('Remove window', () => { if (editable()) { working.windows.splice(index,1); changed(); renderWindows(); } }));
      return row;
    }));
  }
  function slotName(document, match, side) {
    const resolved = match['resolved_' + side];
    const slot = match[side] ?? {};
    const participant = document.participants.find(item => item.id === (resolved ?? slot.participant_id));
    if (participant) return participant.name;
    const source = document.matches.find(item => item.id === slot.winner_of);
    return source ? 'Winner of ' + (source.label || source.id) : 'Unassigned';
  }
  function resolvedDocument(value) { return TournamentEngine.resolve(value); }
  function renderBracket(value, target, prefix) {
    renderPublicTournament(resolvedDocument(value),target,{idPrefix:prefix,headingLevel:5,linkSchools:false,emptyText:'Choose teams or import a CSV to create a bracket.'});
  }
  function renderMatches() {
    const resolved = resolvedDocument(working);
    const target = el('tournament-match-rows');
    target.replaceChildren(...resolved.matches.map(match => {
      const original = working.matches.find(item => item.id === match.id);
      const row = node('tr');
      row.append(node('th', (match.label || match.id) + ' · Round ' + match.round));
      row.append(node('td', slotName(resolved,match,'a') + ' vs. ' + slotName(resolved,match,'b')));
      for (const [name, type] of [['game_date','date'],['start_time','time'],['venue','text']]) {
        const item = input('tournament-match-' + match.id + '-' + name, match[name], type);
        item.setAttribute('aria-label', (match.label || match.id) + ' ' + name.replaceAll('_',' '));
        item.onchange = () => { if (editable()) { original[name] = item.value || (type === 'text' ? '' : null); changed(); } };
        const cell = node('td'); cell.append(item); row.append(cell);
      }
      const home = pick('tournament-match-' + match.id + '-home', [['Neutral','neutral'],['A home','a'],['B home','b']], match.home_side);
      home.setAttribute('aria-label', (match.label || match.id) + ' home side');
      home.onchange = () => { if (editable()) { original.home_side = home.value; changed(); } };
      const statusPick = pick('tournament-match-' + match.id + '-status', ['Scheduled','Postponed','Canceled','Final','Forfeit'].map(value => [value,value]), match.status);
      statusPick.setAttribute('aria-label', (match.label || match.id) + ' status');
      statusPick.onchange = () => { if (editable()) { original.status = statusPick.value; changed(); renderMatches(); } };
      const winnerOptions = [['Choose winner',''], ...[match.resolved_a,match.resolved_b].filter(Boolean).map(id => [resolved.participants.find(item => item.id === id)?.name ?? id,id])];
      if (match.winner_id && !winnerOptions.some(item => item[1] === match.winner_id)) winnerOptions.push(['Invalid previous winner — clear result', match.winner_id]);
      const winner = pick('tournament-match-' + match.id + '-winner', winnerOptions, match.winner_id);
      winner.setAttribute('aria-label', (match.label || match.id) + ' winner');
      winner.onchange = () => { if (editable()) { original.winner_id = winner.value || null; changed(); renderMatches(); } };
      const sideCell = node('td'); sideCell.append(home); row.append(sideCell);
      const resultCell = node('td'); resultCell.append(statusPick, field('Winner',winner));
      for (const side of ['a','b']) {
        const score = input('tournament-match-' + match.id + '-score-' + side, match['score_' + side], 'number');
        score.min = '0';
        score.onchange = () => { if (editable()) { original['score_' + side] = score.value === '' ? null : Number(score.value); changed(); } };
        resultCell.append(field('Score ' + side.toUpperCase(),score));
      }
      if (match.winner_id || match.status === 'Final' || match.status === 'Forfeit' || match.score_a != null || match.score_b != null) {
        const clear = button('Clear result', () => {
          if (!editable()) return;
          Object.assign(original,{status:'Scheduled',winner_id:null,score_a:null,score_b:null});
          changed();renderMatches();
        });
        clear.id = 'tournament-match-' + match.id + '-clear';
        resultCell.append(clear);
      }
      row.append(resultCell);
      return row;
    }));
  }
  function renderPublished() {
    const resolved = resolvedDocument(working);
    el('tournament-readonly-title').textContent = working.name;
    const matches = resolved.matches.filter(match => [match.resolved_a,match.resolved_b].some(id => resolved.participants.find(participant => participant.id === id)?.school_id === schoolId));
    el('tournament-published-games').replaceChildren(...matches.map(match => {
      const row = node('li');
      row.append(node('strong',match.label || match.id),node('span',slotName(resolved,match,'a') + ' vs. ' + slotName(resolved,match,'b')),
        node('span',[match.game_date,match.start_time,match.venue,match.status].filter(Boolean).join(' · ')));
      return row;
    }));
  }
  function showProposal(document, label, details, id = selected?.id) {
    proposal = { document: clone(document), id };
    el('tournament-proposal-title').textContent = label;
    el('tournament-proposal-summary').textContent = details;
    const issues = TournamentEngine.validate(document,otherGames(id));
    issueList(el('tournament-proposal-issues'),issues,document);
    renderBracket(document,el('tournament-proposal-bracket'),'proposal-');
    el('tournament-proposal-apply').textContent = label === 'Review replacement bracket' ? 'Replace bracket draft' : 'Use this draft proposal';
    el('tournament-proposal').hidden = false;
    el('tournament-proposal-title').focus();
  }
  function proposeBracket() {
    if (!editable()) return;
    try {
      const result = TournamentEngine.participantsFromText(el('tournament-participants').value,schools());
      if (result.errors.length) { status.textContent = result.errors.map(item => item.message ?? item).join(' '); return; }
      const matches = TournamentEngine.generateBracket(result.participants);
      showProposal({...clone(working), participants:result.participants,matches},'Review replacement bracket',
        result.participants.map(item => item.seed + '. ' + item.name).join(' · ') + '. Replaces all ' + working.matches.length + ' existing matches and their results.');
    } catch (error) { status.textContent = errorMessage(error); }
  }
  async function proposeSchedule() {
    if (!editable()) return;
    proposal = null;
    el('tournament-proposal').hidden = true;
    status.textContent = 'Checking current games before proposing a schedule…';
    await operation(async () => {
      try {
        return await request('list_tournaments');
      } catch (error) {
        if (error?.code === '42501' || error?.code === '40001') throw error;
        throw new Error('Current games could not be checked, so no schedule was proposed. Posted games stay unchanged. Try again.');
      }
    }, data => {
      if (data.actor_role !== actorRole || data.school_id !== schoolId) {
        dirty = false;
        reset();
        active = true;
        actorRole = data.actor_role;
        schoolId = data.school_id;
        records = ['site_admin','conference_office','ad'].includes(actorRole) ? data.tournaments ?? [] : [];
        conflicts = data.conflicts ?? [];
        transportation = data.transportation ?? [];
        selectRecord(records[0] ?? null);
        status.textContent = 'Your tournament access changed. Review the current workspace before continuing.';
        return;
      }
      conflicts = data.conflicts ?? [];
      const result = TournamentEngine.schedule(clone(working),clone(working.windows),otherGames());
      showProposal(result.document,'Review proposed schedule','Check dates, times, venues and unscheduled matches before using this proposal. For school games without an end time, checks allow the game length entered above.');
      issueList(el('tournament-proposal-issues'),result.issues,result.document);
      status.textContent = 'Schedule proposal ready. Review the bracket before using it. Posted games stay unchanged.';
    });
  }
  function applyProposal() {
    if (!active || !manages() || busy || !proposal) return;
    const next = proposal;
    if (dirty && selected && next.id !== selected.id) { status.textContent = 'Save this draft before importing into a different tournament.';return; }
    generation++;
    if (!selected || next.id !== selected.id) {
      let record = records.find(item => item.id === next.id);
      if (!record) {
        record = {id:next.id || crypto.randomUUID(),revision:0,published_revision:null,draft:next.document,published:null};
        records.push(record);
      }
      selectRecord(record);
    }
    working = clone(next.document);
    changed();render();
    status.textContent = 'Proposal added to your working draft. Save when ready.';
    el('tournament-matches-title').focus();
  }
  async function readImport() {
    if (!active || busy || !manages()) return;
    const file = el('tournament-import-file').files?.[0];
    if (!file) return;
    if (file.size > 1048576) { status.textContent = 'Choose a CSV smaller than 1 MB.'; return; }
    const ticket = ++generation;
    proposal = null;
    el('tournament-proposal').hidden = true;
    try {
      const text = await file.text();
      if (!active || stopped || ticket !== generation) return;
      csvText = text;
      const [headers = []] = parseCsv(text);
      const target = el('tournament-import-mapping');
      target.replaceChildren(...TournamentEngine.csvHeaders.map(name => {
        const item = pick('tournament-map-' + name, [['Not mapped',''],...headers.map(header => [header,header])],headers.includes(name) ? name : '');
        item.dataset.column = name;
        item.onchange = () => { proposal = null; el('tournament-proposal').hidden = true; };
        return field(name.replaceAll('_',' '),item);
      }));
      status.textContent = 'Choose the spreadsheet columns to use, then preview the bracket. Matching games are updated and other games are kept.';
    } catch (error) { if (active && ticket === generation) status.textContent = errorMessage(error); }
  }
  function mergeImport(existing, incoming, mapping) {
    if (!existing) return clone(incoming);
    const imported = clone(incoming);
    const explicitIds = mapping.participants || mapping.a_participant_id || mapping.b_participant_id;
    if (!explicitIds) {
      const replacements = new Map();
      const usedIds = new Set(existing.participants.map(participant => participant.id));
      const usedSeeds = new Set(existing.participants.map(participant => participant.seed));
      const identity = participant => [participant.name.trim().toLowerCase(), participant.school_id || '', participant.team_id || ''].join('|');
      imported.participants = imported.participants.map(participant => {
        const previous = existing.participants.find(item => identity(item) === identity(participant));
        if (previous) {
          replacements.set(participant.id,previous.id);
          return clone(previous);
        }
        let number = 1;
        while (usedIds.has('p' + number)) number++;
        const id = 'p' + number;
        usedIds.add(id);
        replacements.set(participant.id,id);
        participant.id = id;
        if (!mapping.a_seed && !mapping.b_seed) {
          let seed = 1;
          while (usedSeeds.has(seed)) seed++;
          participant.seed = seed;
        }
        usedSeeds.add(participant.seed);
        return participant;
      });
      for (const match of imported.matches) {
        for (const side of ['a','b']) {
          if (match[side].participant_id) match[side].participant_id = replacements.get(match[side].participant_id);
        }
        if (match.winner_id) match.winner_id = replacements.get(match.winner_id) || match.winner_id;
      }
    }
    const result = clone(existing);
    for (const name of ['name','sport','gender','level','season','season_year','duration_minutes','turnaround_minutes','rest_minutes','windows']) {
      if (mapping[name]) result[name] = imported[name];
    }
    const mergeById = (before, after) => [...before.filter(item => !after.some(next => next.id === item.id)),...after];
    result.participants = mergeById(result.participants,imported.participants);
    const matches = imported.matches.map(match => {
      const previous = existing.matches.find(item => item.id === match.id);
      if (!previous) return match;
      const updated = clone(previous);
      for (const name of ['round','label','game_date','start_time','venue','home_side','status','winner_id','score_a','score_b']) {
        if (mapping[name]) updated[name] = match[name];
      }
      for (const side of ['a','b']) {
        if (Object.keys(mapping).some(name => name.startsWith(side + '_') && mapping[name])) updated[side] = match[side];
      }
      return updated;
    });
    result.matches = mergeById(result.matches,matches);
    return result;
  }
  function previewImport() {
    if (!active || !manages() || busy || !csvText) return;
    try {
      const mapping = Object.fromEntries(Array.from(el('tournament-import-mapping').querySelectorAll('select'),item => [item.dataset.column,item.value]));
      const result = TournamentEngine.parseCsv(csvText,mapping,schools());
      if (result.errors.length) { status.textContent = result.errors.map(error => error.message ?? error).join(' '); return; }
      const id = result.tournament_id || selected?.id || crypto.randomUUID();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) { status.textContent = 'Use a valid tournament ID or leave tournament_id blank for a new tournament.'; return; }
      const existing = id === selected?.id ? working : records.find(record => record.id === id)?.draft;
      const document = mergeImport(existing,result.document,mapping);
      const updates = result.document.matches.filter(match => existing?.matches.some(old => old.id === match.id)).length;
      showProposal(document,'Review CSV import',result.document.matches.length - updates + ' new matches. ' + updates + ' existing matches updated. ' +
        (existing ? existing.matches.length - updates : 0) + ' other matches kept. Tournament ' + (document.name || 'Untitled tournament') + '.',id);
    } catch (error) { status.textContent = errorMessage(error); }
  }
  async function saveDraft() {
    if (!editable()) return;
    const id = selected.id, revision = selected.revision, document = clone(working);
    status.textContent = 'Saving draft…';
    await operation(() => request('save_tournament',{p_id:id,p_expected_revision:revision,p_document:document}), record => {
      storeRecord(record);
      status.textContent = 'Draft saved. Review publishing to update school and conference calendars.';
    });
  }
  function dateLabel(value) {
    if (!value) return 'To be scheduled';
    const date = new Date(value + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(date);
  }
  function timeLabel(value) {
    if (!value) return 'To be scheduled';
    const date = new Date('2000-01-01T' + value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(date) + ' ET';
  }
  function metadataFields(value) {
    if (!value) return {};
    const participants = value.participants.map(participant => {
      const school = participant.school_id ? schoolName(participant.school_id) : '';
      return (participant.seed ? participant.seed + '. ' : '') + participant.name +
        (school && school !== participant.name ? ' (' + school + ')' : '');
    });
    const windows = value.windows.map(window => [dateLabel(window.date),timeLabel(window.start) + '–' + timeLabel(window.end),window.venue || 'Venue to be chosen'].join(' · '));
    return {
      'Tournament name':value.name,'Sport':value.sport,'Gender':value.gender,'Level':value.level,
      'Season':value.season,'Season year':String(value.season_year),
      'Game length':value.duration_minutes + ' minutes','Between games at a venue':value.turnaround_minutes + ' minutes',
      'Team rest':value.rest_minutes + ' minutes','Teams and seeds':participants.join(' · ') || 'No teams',
      'Playing windows':windows.join(' / ') || 'No playing windows',
    };
  }
  function matchFields(match, value) {
    if (!match || !value) return {};
    const resolved = resolvedDocument(value);
    const current = resolved.matches.find(item => item.id === match.id) ?? match;
    const nameA = slotName(resolved,current,'a'), nameB = slotName(resolved,current,'b');
    return {
      'Match name':current.label || 'Tournament game','Round':String(current.round),
      'Team A':nameA,'Team B':nameB,'Date':dateLabel(current.game_date),'Time':timeLabel(current.start_time),
      'Venue':current.venue || 'To be chosen','Home team':current.home_side === 'neutral' ? 'Neutral site' : current.home_side === 'a' ? nameA : nameB,
      'Status':current.status,'Winner':resolved.participants.find(item => item.id === current.winner_id)?.name || 'No winner entered',
      'Score A':current.score_a == null ? 'No score entered' : String(current.score_a),
      'Score B':current.score_b == null ? 'No score entered' : String(current.score_b),
    };
  }
  function fieldChanges(title, before, after, { removed = false, emptyText = 'Tournament details above apply to this match.' } = {}) {
    const section = node('section',undefined,'tournament-change');
    section.append(node('h4',title));
    if (removed) section.append(node('p','This match will be removed from the posted tournament.'));
    const list = node('ul',undefined,'tournament-field-changes');
    for (const name of new Set([...Object.keys(before),...Object.keys(after)])) {
      if (before[name] === after[name]) continue;
      const row = node('li');
      row.append(node('strong',name),node('span','Published — ' + (before[name] || 'Not published')),
        node('span','Draft — ' + (after[name] || 'Removed')));
      list.append(row);
    }
    if (!list.children.length) list.append(node('li',emptyText));
    section.append(list);
    return section;
  }
  async function reviewDraft() {
    if (!editable() || dirty || !selected.revision) return;
    await operation(() => request('review_tournament',{p_id:selected.id}), data => {
      review = data;
      el('tournament-review-schools').textContent = 'Affected schools — ' + (data.affected_schools.map(item => schoolName(typeof item === 'string' ? item : item.school_id ?? item.slug)).join(', ') || 'None');
      const metadata = value => value ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'matches')) : null;
      const changes = [];
      if (JSON.stringify(metadata(data.draft)) !== JSON.stringify(metadata(data.published))) {
        changes.push(fieldChanges('Tournament details',metadataFields(data.published),metadataFields(data.draft),{emptyText:'Team assignments updated.'}));
      }
      for (const change of data.changes) {
        const title = change.after?.label || change.before?.label || 'Tournament game';
        changes.push(fieldChanges(title,matchFields(change.before,data.published),matchFields(change.after,data.draft),{removed:!change.after}));
      }
      el('tournament-review-changes').replaceChildren(...changes);
      issueList(el('tournament-review-issues'),data.issues,data.draft);
      const initial = !data.published;
      el('tournament-review-scope').hidden = initial;
      el('tournament-publish-scope').value = 'all';
      el('tournament-review-selection').replaceChildren(...data.changes.filter(change => data.draft.matches.some(match => match.id === change.id) || data.published?.matches.some(match => match.id === change.id)).map(change => {
        const checkbox = input('tournament-publish-' + change.id,'','checkbox');
        checkbox.value = change.id;
        checkbox.checked = true;
        return field(change.after?.label || change.before?.label || 'Tournament game',checkbox);
      }));
      el('tournament-review-selection').hidden = true;
      el('tournament-review-status').textContent = initial ? 'First publication includes the full tournament.' : 'Publish all changes or select changed matches. Changes to tournament details and participants require full publication. Include every later game affected by a corrected result.';
      el('tournament-publish').disabled = false;
      dialog.showModal();
    },el('tournament-review-status'));
  }
  async function publish() {
    if (!active || !manages() || busy || !review || !dialog.open) return;
    const snapshot = review;
    const subset = Boolean(snapshot.published) && el('tournament-publish-scope').value === 'selected';
    const ids = subset ? Array.from(el('tournament-review-selection').querySelectorAll('input:checked'),item => item.value) : null;
    if (subset && !ids.length) { el('tournament-review-status').textContent = 'Select at least one changed match.'; return; }
    el('tournament-publish').disabled = true;
    await operation(() => request('publish_tournament',{p_id:snapshot.id,p_token:snapshot.token,p_match_ids:ids}),record => {
      storeRecord(record);
      status.textContent = 'Tournament published. School and conference calendars use the approved games.';
    },el('tournament-review-status'));
  }
  function ownPublishedMatches() {
    if (!selected?.published || actorRole !== 'ad' || !schoolId) return [];
    const resolved = resolvedDocument(selected.published);
    return resolved.matches.filter(match => [match.resolved_a,match.resolved_b].some(id => resolved.participants.find(participant => participant.id === id)?.school_id === schoolId));
  }
  function renderTransport() {
    const matches = ownPublishedMatches();
    el('tournament-transport').hidden = !matches.length;
    el('tournament-bus-school').textContent = schoolName(schoolId) ?? '';
    el('tournament-bus-match').replaceChildren(...matches.map(match => option((match.label || match.id) + ' · ' + (match.game_date || 'Unscheduled'),match.id)));
    el('tournament-bus-match').value = matches[0]?.id ?? '';
    loadBus();
  }
  function busRow(matchId) {
    return transportation.find(row => row.tournament_id === selected?.id && row.match_id === matchId && row.school_id === schoolId);
  }
  function loadBus() {
    const row = busRow(el('tournament-bus-match').value);
    for (const name of ['bus_departure','pickup_location','return_time','notes']) el('tournament-' + name.replaceAll('_','-')).value = row?.[name] ?? '';
    el('tournament-bus-confirmed').checked = Boolean(row?.bus_confirmed);
    el('tournament-bus-status').textContent = '';
  }
  async function saveBus(event) {
    event.preventDefault();
    if (!active || busy || actorRole !== 'ad') return;
    const matchId = el('tournament-bus-match').value;
    if (!ownPublishedMatches().some(match => match.id === matchId)) return;
    const transport = {};
    for (const name of ['bus_departure','pickup_location','return_time','notes']) transport[name] = el('tournament-' + name.replaceAll('_','-')).value.trim() || null;
    transport.bus_confirmed = el('tournament-bus-confirmed').checked;
    await operation(() => request('save_tournament_transport',{p_tournament:selected.id,p_match:matchId,p_school:schoolId,p_expected_revision:busRow(matchId)?.revision ?? 0,p_transport:transport}),row => {
      transportation = transportation.filter(item => !(item.tournament_id === row.tournament_id && item.match_id === row.match_id && item.school_id === row.school_id));
      transportation.push(row);
      el('tournament-bus-status').textContent = 'Your school’s bus details are saved.';
    },el('tournament-bus-status'));
  }
  function downloadCsv(csv, filename) {
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link = node('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
  function exportMaster() {
    if (!working || busy || !manages()) return;
    downloadCsv(TournamentEngine.exportCsv(working,selected.id),'tournament-' + selected.id + '.csv');
  }
  function downloadTemplate() {
    if (!active || busy || !manages()) return;
    const example = blankDocument();
    Object.assign(example,{
      name:'Example tournament — replace these details',sport:'Softball',season_year:2027,
      windows:[{date:'2027-04-10',start:'09:00',end:'12:00',venue:'Example field'}],
      participants:[
        {id:'example-colts-neck',name:'Colts Neck',school_id:'colts-neck',team_id:null,seed:1},
        {id:'example-marlboro',name:'Marlboro',school_id:'marlboro',team_id:null,seed:2},
      ],
    });
    example.matches = TournamentEngine.generateBracket(example.participants);
    Object.assign(example.matches[0],{label:'Example final',game_date:'2027-04-10',start_time:'09:00',venue:'Example field'});
    downloadCsv(TournamentEngine.exportCsv(example,''),'tournament-template-example.csv');
  }
  function reset() {
    generation++;
    active = false;
    busy = false;
    actorRole = null;
    schoolId = null;
    records = [];conflicts = [];transportation = [];
    if (!dirty) { selected = null;working = null;draftActor = null; }
    proposal = null;csvText = '';
    invalidateReview();
    manager.hidden = true;
    el('tournament-transport').hidden = true;
    el('tournament-readonly').hidden = true;
    select.replaceChildren();
    el('tournament-proposal').hidden = true;
    el('tournament-import-file').value = '';
    el('tournament-import-mapping').replaceChildren();
    for (const id of ['tournament-metadata','tournament-windows','tournament-school-options','tournament-match-rows','tournament-published-games','tournament-review-changes','tournament-proposal-bracket','tournament-draft-bracket','tournament-proposal-issues','tournament-issues','tournament-review-issues']) el(id).replaceChildren();
    el('tournament-selector').hidden = true;
    el('tournament-participants').value = '';
    for (const id of ['tournament-bus-departure','tournament-pickup-location','tournament-return-time','tournament-notes']) el(id).value = '';
    el('tournament-bus-confirmed').checked = false;
    status.textContent = '';
    setBusy(false);
  }
  const handlers = [
    ['tournament-template','onclick',downloadTemplate],
    ['tournament-new','onclick',newTournament],['tournament-save','onclick',saveDraft],['tournament-review','onclick',reviewDraft],
    ['tournament-publish','onclick',publish],['tournament-export','onclick',exportMaster],['tournament-generate','onclick',proposeBracket],
    ['tournament-propose-schedule','onclick',proposeSchedule],['tournament-import-file','onchange',readImport],['tournament-import-preview','onclick',previewImport],
    ['tournament-proposal-apply','onclick',applyProposal],['tournament-proposal-cancel','onclick',() => { proposal = null;el('tournament-proposal').hidden = true; }],
    ['tournament-participants','oninput',() => { proposal = null;el('tournament-proposal').hidden = true; }],
    ['tournament-bus-match','onchange',loadBus],['tournament-bus-form','onsubmit',saveBus],
    ['tournament-review-cancel','onclick',invalidateReview],
    ['tournament-publish-scope','onchange',() => { el('tournament-review-selection').hidden = el('tournament-publish-scope').value !== 'selected'; }],
    ['tournament-add-window','onclick',() => { if (editable()) { working.windows.push({date:'',start:'09:00',end:'18:00',venue:''});changed();renderWindows(); } }],
    ['tournament-add-school','onclick',() => {
      if (!editable()) return;
      const school = schools().find(item => item.slug === el('tournament-school-options').value);
      if (school) {
        el('tournament-participants').value = [el('tournament-participants').value,school.name].filter(Boolean).join('\n');
        proposal = null;
        el('tournament-proposal').hidden = true;
      }
    }],
    ['tournament-select','onchange',() => {
      if (busy || dirty) { select.value = selected?.id ?? '';status.textContent = 'Save this draft before switching tournaments.';return; }
      generation++;
      selectRecord(records.find(record => record.id === select.value));
    }],
    ['tournament-reload','onclick',() => { if (dirty) { status.textContent = 'Save your working draft, or use Discard unsaved changes and reload.';return; }return load(); }],
    ['tournament-discard','onclick',() => { if (!active || busy) return;dirty = false;return load(); }],
  ];
  for (const [id,event,handler] of handlers) el(id)[event] = handler;
  dialog.oncancel = event => {
    if (busy) event.preventDefault();
    else invalidateReview();
  };
  dialog.onclose = () => {
    if (!dialog.open) { review = null;el('tournament-publish').disabled = true; }
  };
  reset();
  return { load, reset, stop() {
    dirty = false;reset();stopped = true;
    for (const [id,event] of handlers) el(id)[event] = null;
    dialog.oncancel = dialog.onclose = null;
  } };
}
