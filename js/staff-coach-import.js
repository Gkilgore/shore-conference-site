// Imports a coach list from CSV: one row per coach and sport, merged by email, previewed before saving.
function startCoachImport(client, { currentSchool, coaches, onImported }) {
  const fileInput = document.getElementById('coach-import-file');
  const template = document.getElementById('coach-import-template');
  const summary = document.getElementById('coach-import-summary');
  const table = document.getElementById('coach-import-preview');
  const save = document.getElementById('coach-import-save');
  const clear = document.getElementById('coach-import-clear');
  const invite = document.getElementById('coach-import-invite');
  let entries = [];
  let active = true;

  function levelsFrom(value) {
    const words = value.toLowerCase().split(/\s*(?:[;\/&+]|,|\band\b)\s*/).filter(Boolean);
    if (words.includes('all')) return [...coachLevels];
    return words.map(word => pickValue(word, { Varsity: ['varsity', 'v', 'var'], JV: ['jv', 'junior varsity'], Freshman: ['freshman', 'fr', 'f', '9th', 'frosh'] }));
  }

  function read(header, rows) {
    const byEmail = new Map();
    rows.forEach((cells, index) => {
      const value = name => (cells[header.indexOf(name)] ?? '').trim();
      const email = value('email').toLowerCase();
      const key = email || 'row-' + index;
      const entry = byEmail.get(key) ?? { rows: [], email, name: '', teams: [], problems: [] };
      entry.rows.push(index + 2);
      entry.name = entry.name || value('name');
      if (!email) entry.problems.push('Email is missing');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) entry.problems.push(email + ' isn’t an email address');
      const sport = value('sport').replace(/\s+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
      const gender = pickValue(value('gender'), { Boys: ['boys', 'b', 'boy', 'mens'], Girls: ['girls', 'g', 'girl', 'womens'], Coed: ['coed', 'co-ed', 'mixed'] });
      const levels = levelsFrom(value('level'));
      if (!sport) entry.problems.push('Row ' + (index + 2) + ': sport is missing');
      if (!gender) entry.problems.push('Row ' + (index + 2) + ': gender must be Boys, Girls or Coed');
      if (!levels.length || levels.includes(null)) entry.problems.push('Row ' + (index + 2) + ': level must be Varsity, JV, Freshman or All');
      if (sport && gender && levels.length && !levels.includes(null)) {
        for (const level of levels) {
          const team = { sport, gender, level };
          if (!entry.teams.some(saved => sameTeam(saved, team))) entry.teams.push(team);
        }
      }
      byEmail.set(key, entry);
    });
    return [...byEmail.values()].map(entry => {
      const existing = coaches().find(coach => coach.email === entry.email);
      const added = entry.teams.filter(team => !existing?.coach_teams.some(saved => sameTeam(saved, team)));
      entry.existing = existing;
      entry.added = added;
      entry.state = entry.problems.length ? 'problem' : !existing ? 'new' : added.length ? 'adds' : 'same';
      return entry;
    });
  }

  function show() {
    const labels = { new: 'New coach', adds: 'Adds teams', same: 'No change', problem: 'Needs a fix', saved: 'Saved', failed: 'Failed' };
    const toSave = entries.filter(entry => entry.state === 'new' || entry.state === 'adds');
    table.hidden = !entries.length;
    clear.hidden = !entries.length;
    save.hidden = !toSave.length;
    invite.parentElement.hidden = !entries.some(entry => entry.state === 'new');
    save.textContent = 'Save ' + toSave.length + (toSave.length === 1 ? ' coach' : ' coaches');
    table.tBodies[0].replaceChildren(...entries.map(entry => {
      const line = document.createElement('tr');
      line.className = 'is-' + ({ new: 'ready', adds: 'ready', same: 'duplicate', problem: 'problem', saved: 'imported', failed: 'failed' }[entry.state]);
      const teams = entry.state === 'adds' ? entry.added : entry.teams;
      line.append(...[entry.rows.join(', '), labels[entry.state], entry.email, entry.name || entry.existing?.name || '',
        teams.map(coachTeamLabel).join(', '), entry.problems.join('; ')].map(text => {
        const cell = document.createElement('td');
        cell.textContent = text;
        return cell;
      }));
      return line;
    }));
    const count = state => entries.filter(entry => entry.state === state).length;
    summary.textContent = entries.length ? [
      count('new') && count('new') + ' new', count('adds') && count('adds') + ' adding teams',
      count('same') && count('same') + ' no change', count('problem') && count('problem') + ' need a fix',
      count('saved') && count('saved') + ' saved', count('failed') && count('failed') + ' failed',
    ].filter(Boolean).join(' · ') + '.' : summary.textContent;
  }

  function reset() {
    entries = [];
    fileInput.value = '';
    summary.textContent = '';
    show();
  }

  template.onclick = () => {
    const lines = ['name,email,sport,gender,level',
      'Pat Rivera,privera@school.example.org,Soccer,Girls,Varsity; JV',
      'Sam Lee,slee@school.example.org,Soccer,Girls,JV',
      'Jordan Park,jpark@school.example.org,Basketball,Boys,All'];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' }));
    link.download = 'coach-list-template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    entries = [];
    if (!file) return show();
    const [headerRow = [], ...rows] = parseCsv(await file.text());
    if (!active) return;
    const header = headerRow.map(name => name.trim().toLowerCase());
    const missing = ['email', 'sport', 'gender', 'level'].filter(name => !header.includes(name));
    if (missing.length) summary.textContent = 'This file is missing columns: ' + missing.join(', ') + '. Start from the template.';
    else if (!rows.length) summary.textContent = 'This file has a header row but no coaches.';
    else if (rows.length > 500) summary.textContent = 'Import up to 500 rows at a time.';
    else entries = read(header, rows);
    show();
  };

  save.onclick = async () => {
    const toSave = entries.filter(entry => entry.state === 'new' || entry.state === 'adds');
    save.disabled = fileInput.disabled = clear.disabled = true;
    for (const [index, entry] of toSave.entries()) {
      summary.textContent = 'Saving ' + (index + 1) + ' of ' + toSave.length + '…';
      const teams = [...(entry.existing?.coach_teams ?? []), ...entry.added];
      const { error } = await client.rpc('save_coach', { input: {
        id: entry.existing?.id ?? null, school_id: currentSchool().slug,
        name: entry.name || entry.existing?.name || '', email: entry.email, teams,
        invite: !entry.existing && invite.checked,
      } });
      if (!active) return;
      entry.state = error ? 'failed' : 'saved';
      if (error) entry.problems.push('Could not be saved. Try again.');
    }
    save.disabled = fileInput.disabled = clear.disabled = false;
    show();
    onImported();
  };

  clear.onclick = reset;

  return {
    reset,
    stop() {
      active = false;
      fileInput.onchange = template.onclick = save.onclick = clear.onclick = null;
    },
  };
}
