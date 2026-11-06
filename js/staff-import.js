// Imports games from a CSV file: reads it, previews every row, flags problems, then saves the ready rows.
const importColumns = ['date', 'start_time', 'sport', 'gender', 'level', 'season', 'home_away', 'opponent',
  'location', 'status', 'bus_departure', 'pickup_location', 'return_time', 'transport_notes', 'notes'];
const importAliases = {
  game_date: 'date', time: 'start_time', start: 'start_time', 'home/away': 'home_away', home_or_away: 'home_away',
  venue: 'location', 'bus departure': 'bus_departure', bus: 'bus_departure', pickup: 'pickup_location',
  return: 'return_time', transportation_notes: 'transport_notes', game_notes: 'notes',
};

function parseCsv(text) {
  const rows = [[]];
  let field = '';
  let quoted = false;
  text = text.replace(/^﻿/, '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { rows.at(-1).push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index++;
      rows.at(-1).push(field);
      field = '';
      rows.push([]);
    } else field += char;
  }
  rows.at(-1).push(field);
  return rows.filter(row => row.some(cell => cell.trim()));
}

function importDate(value) {
  let match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let [year, month, day] = match ? match.slice(1) : [];
  if (!match && (match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/))) {
    [month, day, year] = match.slice(1);
    if (year.length === 2) year = '20' + year;
  }
  if (!match) return null;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
}

function importTime(value) {
  const match = value.trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (match[3]) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12 + (match[3].startsWith('p') ? 12 : 0);
  } else if (!match[2]) return null;
  if (hour > 23 || minute > 59) return null;
  return String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
}

function timeLabel(time) {
  const [hour, minute] = time.split(':').map(Number);
  return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
}

function pickValue(value, choices) {
  const key = value.trim().toLowerCase().replace(/[.']/g, '');
  for (const [result, words] of Object.entries(choices)) if (words.includes(key)) return result;
  return null;
}

function startStaffImport(client, { currentSchool, schools, existingGames, onImported }) {
  const fileInput = document.getElementById('import-file');
  const template = document.getElementById('import-template');
  const summary = document.getElementById('import-summary');
  const table = document.getElementById('import-preview');
  const save = document.getElementById('import-save');
  const clear = document.getElementById('import-clear');
  let rows = [];
  let active = true;

  function check(cells, header, seen) {
    const raw = Object.fromEntries(importColumns.map(name => [name, (cells[header.indexOf(name)] ?? '').trim()]));
    const problems = [];
    const need = (name, label) => { if (!raw[name]) problems.push(label + ' is missing'); return raw[name]; };
    const school = currentSchool();
    const game = { school_id: school.slug, id: null, revision: null };

    game.game_date = need('date', 'Date') && importDate(raw.date);
    if (raw.date && !game.game_date) problems.push('Use a date like 2026-11-09 or 11/9/2026');
    game.start_time = need('start_time', 'Start time') && importTime(raw.start_time);
    if (raw.start_time && !game.start_time) problems.push('Use a time like 3:45 PM or 15:45');
    game.sport = need('sport', 'Sport') && raw.sport.replace(/\s+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    if (game.sport && game.sport.length > 60) problems.push('Sport is too long');
    game.gender = need('gender', 'Gender') && pickValue(raw.gender, { Boys: ['boys', 'b', 'boy', 'mens'], Girls: ['girls', 'g', 'girl', 'womens'], Coed: ['coed', 'co-ed', 'mixed'] });
    if (raw.gender && !game.gender) problems.push('Gender must be Boys, Girls or Coed');
    game.level = need('level', 'Level') && pickValue(raw.level, { Varsity: ['varsity', 'v', 'var'], JV: ['jv', 'junior varsity'], Freshman: ['freshman', 'fr', 'f', '9th', 'frosh'] });
    if (raw.level && !game.level) problems.push('Level must be Varsity, JV or Freshman');
    game.season = raw.season
      ? pickValue(raw.season, { Fall: ['fall'], Winter: ['winter'], Spring: ['spring'] })
      : game.sport && seasonOf(game.sport, game.gender);
    if (!game.season || game.season === 'Other') { game.season = null; problems.push('Add a season (Fall, Winter or Spring)'); }
    game.home_away = need('home_away', 'Home or away') && pickValue(raw.home_away, { Home: ['home', 'h', 'vs'], Away: ['away', 'a', 'at', '@'] });
    if (raw.home_away && !game.home_away) problems.push('Home or away must be Home or Away');
    const opponent = need('opponent', 'Opponent');
    const member = opponent && schools().find(item =>
      [item.name.toLowerCase(), item.slug].includes(opponent.toLowerCase()));
    if (member?.slug === school.slug) problems.push('A school can’t play itself');
    game.opponent_school_id = member && member.slug !== school.slug ? member.slug : null;
    game.opponent_name = member ? null : opponent || null;
    if (game.opponent_name && game.opponent_name.length > 100) problems.push('Opponent is too long');
    game.location = need('location', 'Location');
    if (game.location && game.location.length > 160) problems.push('Location is too long');
    game.status = raw.status
      ? pickValue(raw.status, { Scheduled: ['scheduled'], Postponed: ['postponed'], Canceled: ['canceled', 'cancelled'] })
      : 'Scheduled';
    if (!game.status) problems.push('Status must be Scheduled, Postponed or Canceled');
    for (const [name, label] of [['bus_departure', 'Bus departure'], ['return_time', 'Return time']]) {
      game[name] = raw[name] ? importTime(raw[name]) : null;
      if (raw[name] && !game[name]) problems.push(label + ' isn’t a time');
    }
    game.pickup_location = raw.pickup_location || null;
    game.transport_notes = raw.transport_notes || null;
    game.notes = raw.notes || null;
    if ((game.notes ?? '').length > 1000 || (game.transport_notes ?? '').length > 1000) problems.push('Notes are too long');

    const key = [game.sport, game.gender, game.level, game.game_date, game.start_time].join('|');
    let state = problems.length ? 'problem' : 'ready';
    if (state === 'ready' && existingGames().some(saved => [saved.teams.sport, saved.teams.gender, saved.teams.level,
      saved.game_date, saved.start_time.slice(0, 5)].join('|') === key)) {
      state = 'duplicate';
      problems.push('Already on the schedule');
    } else if (state === 'ready' && seen.has(key)) {
      state = 'duplicate';
      problems.push('Repeats an earlier row');
    }
    seen.add(key);
    return { game, state, problems, raw };
  }

  function show() {
    const counts = { ready: 0, problem: 0, duplicate: 0, imported: 0, failed: 0 };
    rows.forEach(row => counts[row.state]++);
    table.hidden = !rows.length;
    clear.hidden = !rows.length;
    save.hidden = !counts.ready;
    save.textContent = 'Import ' + counts.ready + (counts.ready === 1 ? ' game' : ' games');
    const labels = { ready: 'Ready', problem: 'Needs a fix', duplicate: 'Skipped', imported: 'Imported', failed: 'Failed' };
    table.tBodies[0].replaceChildren(...rows.map((row, index) => {
      const line = document.createElement('tr');
      line.className = 'is-' + row.state;
      // Show each value the way it will be saved when it could be read, otherwise as typed.
      const { game, raw } = row;
      const cells = [String(index + 2), labels[row.state], game.game_date || raw.date,
        game.start_time ? timeLabel(game.start_time) : raw.start_time,
        [game.gender || raw.gender, game.level || raw.level, game.sport || raw.sport].filter(Boolean).join(' '),
        [game.home_away === 'Home' ? 'vs.' : game.home_away === 'Away' ? 'at' : raw.home_away, raw.opponent]
          .filter(Boolean).join(' '),
        game.location || raw.location, row.problems.join('; ')];
      line.append(...cells.map(text => {
        const cell = document.createElement('td');
        cell.textContent = text;
        return cell;
      }));
      return line;
    }));
    if (rows.length) {
      summary.textContent = [
        counts.ready && counts.ready + ' ready', counts.problem && counts.problem + ' need a fix',
        counts.duplicate && counts.duplicate + ' skipped', counts.imported && counts.imported + ' imported',
        counts.failed && counts.failed + ' failed',
      ].filter(Boolean).join(' · ') + (counts.problem ? '. Fix those rows in the file and choose it again.' : '.');
    }
  }

  function reset() {
    rows = [];
    fileInput.value = '';
    summary.textContent = '';
    save.disabled = false;
    show();
  }

  template.onclick = () => {
    const lines = [importColumns.join(','),
      '2026-11-09,3:45 PM,Soccer,Girls,Varsity,Fall,Home,Colts Neck,Marlboro Turf Field,Scheduled,,,,,',
      '2026-11-12,4:00 PM,Field Hockey,Girls,JV,Fall,Away,Shore Regional,Shore Regional Turf Field,Scheduled,3:00 PM,Front loop,6:30 PM,,'];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' }));
    link.download = 'game-import-template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  fileInput.onchange = async () => {
    const file = fileInput.files[0];
    rows = [];
    if (!file) return show();
    if (file.size > 1048576) {
      summary.textContent = 'This file is over 1 MB. Split it into smaller files.';
      return show();
    }
    const [headerRow = [], ...dataRows] = parseCsv(await file.text());
    if (!active) return;
    const header = headerRow.map(name => {
      const key = name.trim().toLowerCase();
      return importAliases[key] ?? importAliases[key.replace(/ /g, '_')] ?? key.replace(/ /g, '_');
    });
    const missing = ['date', 'start_time', 'sport', 'gender', 'level', 'home_away', 'opponent', 'location']
      .filter(name => !header.includes(name));
    if (missing.length) {
      summary.textContent = 'This file is missing columns: ' + missing.join(', ') + '. Start from the template.';
      return show();
    }
    if (!dataRows.length) {
      summary.textContent = 'This file has a header row but no games.';
      return show();
    }
    if (dataRows.length > 500) {
      summary.textContent = 'Import up to 500 games at a time.';
      return show();
    }
    const seen = new Set();
    rows = dataRows.map(cells => check(cells, header, seen));
    show();
  };

  save.onclick = async () => {
    const ready = rows.filter(row => row.state === 'ready');
    // One batch per import, so each coach gets one summary email instead of one per game.
    const batch = crypto.randomUUID();
    ready.forEach(row => { row.game.import_batch = batch; });
    save.disabled = true;
    fileInput.disabled = true;
    clear.disabled = true;
    for (const [index, row] of ready.entries()) {
      summary.textContent = 'Importing ' + (index + 1) + ' of ' + ready.length + '…';
      const { error } = await client.rpc('save_staff_game', { input: row.game });
      if (!active) return;
      row.state = error ? 'failed' : 'imported';
      if (error) row.problems.push('Could not be saved. Check this row and try again.');
    }
    fileInput.disabled = false;
    clear.disabled = false;
    save.disabled = false;
    show();
    const imported = ready.filter(row => row.state === 'imported');
    if (imported.length) onImported(imported[0].game.game_date);
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
