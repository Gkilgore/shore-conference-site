// Imports games from a CSV file: reads it, previews every row, flags problems, then saves the ready rows.
const importColumns = ['date', 'start_time', 'sport', 'home_away', 'opponent',
  'location', 'bus_departure', 'pickup_location', 'early_dismissal_time', 'return_time', 'transport_notes', 'notes'];
const importAliases = {
  game_date: 'date', time: 'start_time', start: 'start_time', 'home/away': 'home_away', home_or_away: 'home_away', 'h/a': 'home_away',
  venue: 'location', facility: 'location', 'bus departure': 'bus_departure', bus: 'bus_departure', pickup: 'pickup_location',
  'early dismissal': 'early_dismissal_time', 'early dismissal time': 'early_dismissal_time',
  return: 'return_time', opponents: 'opponent', 'opponents/title': 'opponent', transportation_notes: 'transport_notes', game_notes: 'notes',
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
  // Handle text format like "TUESDAY, DEC 08, 2026" or "MONDAY, JANUARY 04, 2027"
  if (!match && (match = value.match(/^[A-Za-z]+,\s*([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/))) {
    const monthName = match[1].toUpperCase();
    day = match[2];
    year = match[3];
    const months = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
    month = months[monthName.substring(0, 3)];
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
  let key = value.trim().toLowerCase();
  // For single-character symbols like @, check before stripping
  if (key === '@' || key === 'a' || key === 'h') {
    for (const [result, words] of Object.entries(choices)) if (words.includes(key)) return result;
  }
  // Strip punctuation for multi-character patterns
  key = key.replace(/[.'"–—-]/g, '');
  for (const [result, words] of Object.entries(choices)) if (words.includes(key)) return result;
  return null;
}

// Helper functions for PDF text parsing
function parsePdfScheduleText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const games = [];
  let currentDate = null;
  let i = 0;

  // Pattern for day of week with date (e.g., "TUESDAY, DEC 08, 2026")
  const datePattern = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i;
  
  // Pattern for time (e.g., "4:00pm", "5:30pm")
  const timePattern = /^\d{1,2}:\d{2}\s*(am|pm|a\.m\.|p\.m\.)?/i;

  while (i < lines.length) {
    const line = lines[i];
    
    // Check for date line
    const dateMatch = line.match(datePattern);
    if (dateMatch) {
      const monthStr = dateMatch[2];
      const day = dateMatch[3];
      const year = dateMatch[4];
      currentDate = parseMonthDayYear(monthStr, day, year);
      i++;
      continue;
    }

    // Check for time line
    if (currentDate && timePattern.test(line)) {
      const timeStr = formatTime(line);
      
      // Look ahead for the rest of the game info
      let homeAway = '';
      let opponent = '';
      let location = '';
      let status = '';
      let j = i + 1;

      // Next line should have home/away indicator (H or A)
      if (j < lines.length) {
        const nextLine = lines[j];
        if (nextLine === 'H' || nextLine.match(/^Home/i)) {
          homeAway = 'Home';
          j++;
        } else if (nextLine === 'A' || nextLine.match(/^Away/i) || nextLine === '@') {
          homeAway = 'Away';
          j++;
        }
      }

      // Look for opponent name and other details in next few lines
      while (j < lines.length && j < i + 10) {
        const nextLine = lines[j];
        
        // Stop if we hit another date
        if (nextLine.match(datePattern)) break;
        
        // Check if this line has opponent info
        const opMatch = nextLine.match(/(?:@\s+|vs\.?\s+|VS\s+)(.+?)(?:\s*\/|$)/i);
        if (opMatch) {
          opponent = opMatch[1].trim();
          // Remove extra info after the opponent name
          opponent = opponent.replace(/\s+or\s+.*/i, '').replace(/\s+\(.*\)/, '').trim();
        }
        
        // Check for game type (SCRIMMAGE, GAME, TOURNAMENT, Play Day)
        if (nextLine.match(/^(SCRIMMAGE|GAME|TOURNAMENT|Play Day)/i)) {
          status = 'Scheduled';
          j++;
          break;
        }
        
        // Check for facility/location - but skip if it's just a category label
        if (nextLine.match(/(?:Gym|Gymnasium|Field|School|Court|Arena|Main|North|South|East|West|Off Site)/i)
            && !nextLine.match(/^(Sport|Start Time|H\/A|Opponents|Type|Facility|Girls Varsity)$/i)) {
          if (!location) {
            location = nextLine;
          }
        }
        
        j++;
      }

      // Add the game if we have enough info
      if (currentDate && timeStr) {
        games.push({
          date: currentDate,
          start_time: timeStr,
          home_away: homeAway || 'Home',
          opponent: opponent.replace(/\s+\/.*$/, '').trim() || 'TBD',
          location: location.replace(/\s+-.*$/, '').trim() || 'TBD',
          sport: 'Basketball',
          gender: 'Girls',
          level: 'Varsity',
          status: status || 'Scheduled',
          notes: ''
        });
      }

      i = j;
      continue;
    }

    i++;
  }

  return games;
}

function parseMonthDayYear(monthStr, day, year) {
  const monthMap = {
    'JAN': '01', 'JANUARY': '01',
    'FEB': '02', 'FEBRUARY': '02',
    'MAR': '03', 'MARCH': '03',
    'APR': '04', 'APRIL': '04',
    'MAY': '05',
    'JUN': '06', 'JUNE': '06',
    'JUL': '07', 'JULY': '07',
    'AUG': '08', 'AUGUST': '08',
    'SEP': '09', 'SEPTEMBER': '09',
    'OCT': '10', 'OCTOBER': '10',
    'NOV': '11', 'NOVEMBER': '11',
    'DEC': '12', 'DECEMBER': '12'
  };

  const month = monthMap[monthStr.toUpperCase()];
  if (!month) return null;

  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function formatTime(timeStr) {
  // Convert "4:00pm" to "16:00" format, keeping "TBD" as-is
  if (timeStr.toLowerCase() === 'tbd') return 'TBD';
  
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/i);
  if (!match) return timeStr;

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3];

  if (meridiem) {
    if (hour === 12) {
      hour = meridiem.toLowerCase().startsWith('a') ? 0 : 12;
    } else if (meridiem.toLowerCase().startsWith('p')) {
      hour += 12;
    }
  }

  return `${String(hour).padStart(2, '0')}:${minute}`;
}

function escapeCsvCell(value) {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

// Combines file previews before any saves, with one duplicate set and accurate file/row labels.
async function previewScheduleFiles(files, check, teamInfo) {
  const rows = [], errors = [], seen = new Set();
  if (files.length > 20) return { rows, errors: ['Choose up to 20 files at a time.'] };
  for (const file of files) {
    if (file.size > 1048576) { errors.push(file.name + ': over 1 MB. Split this file into smaller files.'); continue; }
    
    // Handle PDF files: attempt extraction via PDF.js if available
    if (/\.pdf$/i.test(file.name)) {
      if (typeof window === 'undefined' || !window.pdfjsLib) {
        errors.push(file.name + ': PDF could not be converted. Try uploading as CSV instead.');
        continue;
      }
      try {
        const pdf = await window.pdfjsLib.getDocument(await file.arrayBuffer()).promise;
        let allText = '';
        
        // Extract all text from all pages
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          // Build text from items, grouping by Y position for better line preservation
          const itemsByY = {};
          textContent.items.forEach(item => {
            const y = Math.round(item.y);
            if (!itemsByY[y]) itemsByY[y] = [];
            itemsByY[y].push(item.str);
          });
          
          // Sort by Y coordinate (descending, since PDF Y goes top to bottom)
          const sortedLines = Object.keys(itemsByY)
            .sort((a, b) => Number(b) - Number(a))
            .map(y => itemsByY[y].join(' '));
          
          allText += sortedLines.join('\n') + '\n';
        }
        
        // Parse the extracted text
        const games = parsePdfScheduleText(allText);
        
        if (games.length === 0) {
          errors.push(file.name + ': no games could be extracted. Check the PDF format.');
          continue;
        }

        // Build CSV
        const header = 'date,start_time,home_away,opponent,location,sport,notes';
        const csvRows = [header];
        
        games.forEach(game => {
          const row = [
            game.date || '',
            game.start_time || '',
            game.home_away || '',
            game.opponent || '',
            game.location || '',
            game.sport || '',
            game.notes || ''
          ];
          csvRows.push(row.map(cell => escapeCsvCell(String(cell))).join(','));
        });

        const csvText = csvRows.join('\n');
        const cells = parseCsv(csvText);
        const [headerRow = [], ...dataRows] = cells;
        const header2 = headerRow.map(name => {
          const key = name.trim().toLowerCase();
          return importAliases[key] ?? importAliases[key.replace(/ /g, '_')] ?? key.replace(/ /g, '_');
        });
        
        if (dataRows.length === 0) {
          errors.push(file.name + ': PDF extracted no games.');
          continue;
        }
        
        if (rows.length + dataRows.length > 500) {
          return { rows: [], errors: [...errors, 'Import up to 500 games at a time across all selected files.'] };
        }
        
        rows.push(...dataRows.map((cells,index) => ({ ...check(cells,header2,seen,teamInfo), source: { file: file.name, row: index+2 } })));
      } catch (error) {
        // Check if it's a scanned PDF (image-based)
        const errorMsg = error.message || '';
        const isScannedPdf = errorMsg.includes('page is not structured') || errorMsg.includes('no text') || !allText || allText.trim().length === 0;
        
        if (isScannedPdf || (allText && allText.trim().split('\n').filter(l => l.trim()).length < 3)) {
          errors.push(file.name + ': This is a scanned PDF image. Please convert it to text with OCR (optical character recognition) or save it as a CSV instead.');
        } else {
          errors.push(file.name + ': PDF could not be read (' + error.message + '). Check the format and try again.');
        }
        continue;
      }
    } else if (!/\.csv$/i.test(file.name)) {
      errors.push(file.name + ': choose a CSV or PDF file.');
      continue;
    } else {
      // Handle CSV files
      let text;
      try { text = await file.text(); } catch { errors.push(file.name + ': could not be read. Choose it again.'); continue; }
      const [headerRow = [], ...dataRows] = parseCsv(text);
      const header = headerRow.map(name => {
        const key = name.trim().toLowerCase();
        return importAliases[key] ?? importAliases[key.replace(/ /g, '_')] ?? key.replace(/ /g, '_');
      });
      const missing = ['date','start_time','sport','home_away','opponent','location'].filter(name => !header.includes(name));
      if (missing.length) { errors.push(file.name + ': missing columns: ' + missing.join(', ') + '. Start from the template.'); continue; }
      if (!dataRows.length) { errors.push(file.name + ': has a header row but no games.'); continue; }
      if (rows.length + dataRows.length > 500) return { rows: [], errors: [...errors, 'Import up to 500 games at a time across all selected files.'] };
      rows.push(...dataRows.map((cells,index) => ({ ...check(cells,header,seen,teamInfo), source: { file: file.name, row: index+2 } })));
    }
  }
  return { rows, errors };
}

function startStaffImport(client, { currentSchool, schools, opponents = () => [], existingGames, onImported, sendTransportationEmail,
  getSelectedTeam = () => null, post = async () => ({ ok: true, held: [], heldIds: new Set() }) }) {
  const fileInput = document.getElementById('import-file');
  const template = document.getElementById('import-template');
  const summary = document.getElementById('import-summary');
  const table = document.getElementById('import-preview');
  const saveBtn = document.getElementById('import-save');
  const clear = document.getElementById('import-clear');
  const errorList = document.getElementById('import-file-errors');
  let rows = [];
  let fileErrors = [], requestNumber = 0;
  let active = true;
  let editingState = {};

  function check(cells, header, seen, teamInfo) {
    const raw = Object.fromEntries(importColumns.map(name => [name, (cells[header.indexOf(name)] ?? '').trim()]));
    const problems = [];
    const need = (name, label) => { if (!raw[name]) problems.push(label + ' is missing'); return raw[name]; };
    const school = currentSchool();
    const game = { school_id: school.slug, id: null, revision: null };

    game.game_date = need('date', 'Date') && importDate(raw.date);
    if (raw.date && !game.game_date) problems.push('Use a date like 2026-11-09 or 11/9/2026');
    const timeIsTbd = raw.start_time.toLowerCase() === 'tbd';
    game.start_time = timeIsTbd ? null : need('start_time', 'Start time') && importTime(raw.start_time);
    if (raw.start_time && !timeIsTbd && !game.start_time) problems.push('Use a time like 3:45 PM, 15:45 or TBD');
    game.sport = need('sport', 'Sport') && raw.sport.replace(/\s+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    if (game.sport && game.sport.length > 60) problems.push('Sport is too long');
    game.gender = teamInfo?.gender || null;
    game.level = teamInfo?.level || null;
    game.season = game.sport && seasonOf(game.sport, game.gender);
    if (!game.season || game.season === 'Other') game.season = null;
    if (raw.home_away) {
      game.home_away = pickValue(raw.home_away, { Home: ['home', 'h', 'vs'], Away: ['away', 'a', 'at', '@'] });
      if (!game.home_away) problems.push('Home or away must be Home or Away');
    } else {
      problems.push('Home or away is missing');
      game.home_away = null;
    }
    const opponent = need('opponent', 'Opponent');
    const listed = opponent && opponents().find(item =>
      [item.name.toLowerCase(), item.slug].includes(opponent.toLowerCase()));
    const member = listed && schools().find(item =>
      item.slug === listed.slug && item.is_conference_member);
    if (listed?.slug === school.slug) problems.push('A school can’t play itself');
    game.opponent_school_id = member && member.slug !== school.slug ? member.slug : null;
    game.opponent_directory_slug = listed?.slug ?? null;
    game.opponent_name = member ? null : listed?.name ?? (opponent || null);
    if (game.opponent_name && game.opponent_name.length > 100) problems.push('Opponent is too long');
    game.location = need('location', 'Location');
    if (game.location && game.location.length > 160) problems.push('Location is too long');
    game.status = 'Scheduled';
    for (const [name, label] of [['bus_departure', 'Bus departure'], ['early_dismissal_time', 'Early dismissal'],
      ['return_time', 'Return time']]) {
      game[name] = raw[name] ? importTime(raw[name]) : null;
      if (raw[name] && !game[name]) problems.push(label + ' isn’t a time');
    }
    game.pickup_location = raw.pickup_location || null;
    game.transport_notes = raw.transport_notes || null;
    game.notes = raw.notes || null;
    if ((game.notes ?? '').length > 1000 || (game.transport_notes ?? '').length > 1000) problems.push('Notes are too long');

    const key = [game.sport, game.game_date, game.start_time].join('|');
    let state = problems.length ? 'problem' : 'ready';
    if (state === 'ready' && existingGames().some(saved => {
      const savedKey = [saved.teams.sport, 
        saved.game_date, saved.start_time ? saved.start_time.slice(0, 5) : null].join('|');
      return savedKey === key;
    })) {
      state = 'duplicate';
      problems.push('Already on the schedule');
    } else if (state === 'ready' && seen.has(key)) {
      state = 'duplicate';
      problems.push('Repeats an earlier row');
    }
    if (state === 'ready') seen.add(key);
    return { game, state, problems, raw };
  }

  function validateGameData(game) {
    const problems = [];
    if (!game.game_date) problems.push('Date is missing');
    if (!game.start_time && game.start_time !== null) problems.push('Start time must be set');
    if (!game.sport) problems.push('Sport is missing');
    if (!game.home_away) problems.push('Home or away is missing');
    if (!game.opponent_name && !game.opponent_school_id) problems.push('Opponent is missing');
    if (!game.location) problems.push('Location is missing');
    if (game.opponent_name && game.opponent_name.length > 100) problems.push('Opponent is too long');
    if (game.location && game.location.length > 160) problems.push('Location is too long');
    if ((game.notes ?? '').length > 1000 || (game.transport_notes ?? '').length > 1000) problems.push('Notes are too long');
    return problems;
  }

  function getRowKey(game) {
    return [game.sport, game.gender, game.level, game.game_date, game.start_time].join('|');
  }

  let heldNote = '';
  function renderEditableRow(row, rowIndex) {
    const { game, raw, state } = row;
    const tr = document.createElement('tr');
    tr.className = 'is-' + state;

    // Row number
    const rowNumTd = document.createElement('td');
    rowNumTd.textContent = String(row.source.row);
    tr.append(rowNumTd);

    // Status
    const statusTd = document.createElement('td');
    const labels = { ready: 'Ready', problem: 'Needs a fix', duplicate: 'Skipped', imported: 'Posted',
      held: 'Saved, not posted', failed: 'Failed' };
    statusTd.textContent = labels[state];
    tr.append(statusTd);

    // Date - editable
    const dateTd = document.createElement('td');
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = game.game_date || '';
    if (typeof dateInput.addEventListener === 'function') {
      dateInput.addEventListener('change', () => {
        game.game_date = dateInput.value || null;
        row.state = validateRow(row);
        show();
      });
    }
    dateTd.append(dateInput);
    tr.append(dateTd);

    // Time - editable
    const timeTd = document.createElement('td');
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.value = game.start_time || '';
    if (typeof timeInput.addEventListener === 'function') {
      timeInput.addEventListener('change', () => {
        game.start_time = timeInput.value || null;
        row.state = validateRow(row);
        show();
      });
    }
    timeTd.append(timeInput);
    tr.append(timeTd);

    // Home/Away - editable
    const haTd = document.createElement('td');
    const haSelect = document.createElement('select');
    haSelect.className = 'import-home-away';
    haSelect.append(...['Home', 'Away'].map(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (game.home_away === val) opt.selected = true;
      return opt;
    }));
    if (typeof haSelect.addEventListener === 'function') {
      haSelect.addEventListener('change', () => {
        game.home_away = haSelect.value || null;
        row.state = validateRow(row);
        show();
      });
    }
    haTd.append(haSelect);
    tr.append(haTd);

    // Opponent - editable
    const oppTd = document.createElement('td');
    const oppInput = document.createElement('input');
    oppInput.type = 'text';
    oppInput.value = game.opponent_name || game.opponent_directory_slug || '';
    oppInput.placeholder = 'Opponent';
    if (typeof oppInput.addEventListener === 'function') {
      oppInput.addEventListener('change', () => {
        const newValue = oppInput.value || null;
        game.opponent_name = newValue;
        // When opponent is manually edited, check if it matches a directory entry
        if (newValue) {
          const listed = opponents().find(item =>
            [item.name.toLowerCase(), item.slug].includes(newValue.toLowerCase()));
          const member = listed && schools().find(item =>
            item.slug === listed.slug && item.is_conference_member);
          game.opponent_school_id = member && member.slug !== game.school_id ? member.slug : null;
          game.opponent_directory_slug = listed?.slug ?? null;
        } else {
          game.opponent_school_id = null;
          game.opponent_directory_slug = null;
        }
        row.state = validateRow(row);
        show();
      });
    }
    oppTd.append(oppInput);
    tr.append(oppTd);

    // Location - editable
    const locTd = document.createElement('td');
    const locInput = document.createElement('input');
    locInput.type = 'text';
    locInput.value = game.location || '';
    locInput.placeholder = 'Location';
    if (typeof locInput.addEventListener === 'function') {
      locInput.addEventListener('change', () => {
        game.location = locInput.value || null;
        row.state = validateRow(row);
        show();
      });
    }
    locTd.append(locInput);
    tr.append(locTd);

    // Problems - only show if there are problems
    const problemsText = [...row.problems];
    if (row.emailError) {
      problemsText.push('Transportation email not sent: ' + row.emailError);
    }
    if (problemsText.length > 0) {
      const problemsTd = document.createElement('td');
      problemsTd.textContent = problemsText.join('; ');
      tr.append(problemsTd);
    }

    return tr;
  }

  function validateRow(row) {
    const { game } = row;
    row.problems = [];
    
    if (!game.game_date) row.problems.push('Date is missing');
    if (!game.start_time && game.start_time !== null) row.problems.push('Start time must be set');
    if (!game.sport) row.problems.push('Sport is missing');
    if (!game.home_away) row.problems.push('Home or away is missing');
    if (!game.opponent_name && !game.opponent_school_id) row.problems.push('Opponent is missing');
    if (!game.location) row.problems.push('Location is missing');
    
    // Check duplicates
    const key = [game.sport, game.game_date, game.start_time].join('|');
    if (existingGames().some(saved => {
      const savedKey = [saved.teams.sport, 
        saved.game_date, saved.start_time ? saved.start_time.slice(0, 5) : null].join('|');
      return savedKey === key;
    })) {
      row.problems.push('Already on the schedule');
      return 'duplicate';
    }
    
    return row.problems.length ? 'problem' : 'ready';
  }

  function show() {
    errorList.hidden = !fileErrors.length;
    errorList.replaceChildren(...fileErrors.map(text => { const item=document.createElement('li'); item.textContent=text; return item; }));
    const counts = { ready: 0, problem: 0, duplicate: 0, imported: 0, held: 0, failed: 0 };
    rows.forEach(row => counts[row.state]++);
    table.hidden = !rows.length;
    clear.hidden = !rows.length && !fileErrors.length;
    saveBtn.hidden = !rows.length;
    saveBtn.textContent = 'Confirm & Save Schedule';
    
    table.tBodies[0].replaceChildren(...rows.map((row, index) => renderEditableRow(row, index)));
    
    const emailFailures = rows.filter(row => row.emailError);
    if (rows.length) {
      summary.textContent = [
        counts.ready && counts.ready + ' ready', counts.problem && counts.problem + (counts.problem === 1 ? ' needs a fix' : ' need a fix'),
        counts.duplicate && counts.duplicate + ' skipped', counts.imported && counts.imported + ' posted', counts.held && counts.held + ' saved but not posted',
        counts.failed && counts.failed + ' failed',
      ].filter(Boolean).join(' · ') + (counts.problem ? '. Fix those rows to continue.' : '.') +
        (counts.held ? ' ' + heldNote : '') +
        (emailFailures.length ? ' ' + emailFailures.length +
          (emailFailures.length === 1 ? ' transportation email was' : ' transportation emails were') +
          ' not sent. Fix the contact or email setup and save those games again.' : '');
    }
  }

  function reset() {
    requestNumber++;
    rows = [];
    fileErrors = [];
    editingState = {};
    fileInput.value = '';
    fileInput.disabled = clear.disabled = false;
    summary.textContent = '';
    saveBtn.disabled = false;
    show();
  }

  template.onclick = () => {
    const lines = [importColumns.join(','),
      '2026-11-09,3:45 PM,Soccer,Home,Colts Neck,Marlboro Turf Field,,,,,,',
      '2026-11-12,4:00 PM,Field Hockey,Away,Shore Regional,Shore Regional Turf Field,3:00 PM,Front loop,1:30 PM,6:30 PM,,'];
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv' }));
    link.download = 'game-import-template.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  fileInput.onchange = async () => {
    const request = ++requestNumber;
    const files = Array.from(fileInput.files);
    rows = [];
    fileErrors = [];
    editingState = {};
    summary.textContent = files.length ? 'Reading files…' : '';
    if (!files.length) return show();
    const selectedTeam = getSelectedTeam();
    const teamInfo = selectedTeam ? { gender: selectedTeam.gender, level: selectedTeam.level } : null;
    const preview = await previewScheduleFiles(files, check, teamInfo);
    if (!active || request !== requestNumber) return;
    rows = preview.rows.sort((a,b) => [a.game.sport,a.game.gender,a.game.level,a.game.season].join('|')
      .localeCompare([b.game.sport,b.game.gender,b.game.level,b.game.season].join('|')));
    fileErrors = preview.errors;
    summary.textContent = '';
    show();
  };

  function sanitizeGameForSave(game) {
    // Create a copy to avoid mutating the original
    const sanitized = { ...game };
    // Ensure all fields that the backend expects are present, using null for missing values
    // The backend will handle null values appropriately
    sanitized.id = sanitized.id || null;
    sanitized.revision = sanitized.revision || null;
    // Ensure required string fields are not undefined
    if (sanitized.school_id === undefined) sanitized.school_id = null;
    if (sanitized.sport === undefined) sanitized.sport = null;
    if (sanitized.gender === undefined) sanitized.gender = null;
    if (sanitized.level === undefined) sanitized.level = null;
    if (sanitized.season === undefined) sanitized.season = null;
    if (sanitized.home_away === undefined) sanitized.home_away = null;
    if (sanitized.location === undefined) sanitized.location = null;
    if (sanitized.status === undefined) sanitized.status = null;
    // Optional fields
    if (sanitized.opponent_name === undefined) sanitized.opponent_name = null;
    if (sanitized.opponent_school_id === undefined) sanitized.opponent_school_id = null;
    if (sanitized.opponent_directory_slug === undefined) sanitized.opponent_directory_slug = null;
    if (sanitized.notes === undefined) sanitized.notes = null;
    if (sanitized.pickup_location === undefined) sanitized.pickup_location = null;
    if (sanitized.transport_notes === undefined) sanitized.transport_notes = null;
    if (sanitized.import_batch === undefined) sanitized.import_batch = null;
    return sanitized;
  }

  saveBtn.onclick = async () => {
    const request = requestNumber;
    const ready = rows.filter(row => row.state === 'ready');
    // One batch across all files. The saved games are posted together once every row has been tried.
    const batch = crypto.randomUUID();
    ready.forEach(row => { row.game.import_batch = batch; });
    saveBtn.disabled = true;
    fileInput.disabled = true;
    clear.disabled = true;
    for (const [index, row] of ready.entries()) {
      if (!active || request !== requestNumber) return;
      summary.textContent = 'Importing ' + (index + 1) + ' of ' + ready.length + '…';
      const sanitized = sanitizeGameForSave(row.game);
      const { data, error } = await client.rpc('save_staff_game', { input: sanitized });
      if (!active || request !== requestNumber) return;
      row.state = error ? 'failed' : 'held';
      row.id = data;
      if (error) {
        const errorMsg = error.message || (typeof error === 'string' ? error : 'Could not be saved. Check this row and try again.');
        row.problems.push(errorMsg);
      } else if (row.game.status === 'Scheduled' && row.game.bus_departure && sendTransportationEmail) {
        const result = await sendTransportationEmail(data);
        if (!active || request !== requestNumber) return;
        if (!result.ok) row.emailError = result.message;
      }
    }
    // Rows stay "Saved, not posted" until the server confirms they are public.
    const saved = ready.filter(row => row.state === 'held');
    if (saved.length) {
      summary.textContent = 'Posting ' + saved.length + (saved.length === 1 ? ' game…' : ' games…');
      const result = await post(saved.map(row => row.id));
      if (!active || request !== requestNumber) return;
      if (result.ok) saved.forEach(row => { if (!result.heldIds.has(row.id)) row.state = 'imported'; });
      heldNote = !result.ok ? 'Posting didn’t go through. The games are saved. Open Teams and choose Post schedule for each team.'
        : 'Open Teams and choose Post schedule for ' + result.held.join(', ') + '. Those teams have other games that aren’t public, so nothing was posted for them.';
    }
    fileInput.disabled = false;
    clear.disabled = false;
    saveBtn.disabled = false;
    show();
    const imported = ready.filter(row => row.state === 'imported' || row.state === 'held');
    if (imported.length) onImported(imported[0].game.game_date);
  };

  clear.onclick = reset;

  return {
    reset,
    stop() {
      active = false;
      requestNumber++;
      fileInput.onchange = template.onclick = saveBtn.onclick = clear.onclick = null;
    },
  };
}
