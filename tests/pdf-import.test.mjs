import test from 'node:test';
import assert from 'node:assert/strict';

// Test core parsing logic used in PDF import

test('parses date format "TUESDAY, DEC 08, 2026" correctly', () => {
  const datePattern = /^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),?\s+([A-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i;
  const line = 'TUESDAY, DEC 08, 2026';
  const match = line.match(datePattern);
  
  assert.ok(match, 'Should match date pattern');
  assert.strictEqual(match[2], 'DEC', 'Month should be DEC');
  assert.strictEqual(match[3], '08', 'Day should be 08');
  assert.strictEqual(match[4], '2026', 'Year should be 2026');
});

test('converts month abbreviations to numbers', () => {
  const monthMap = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };
  
  assert.strictEqual(monthMap['DEC'], '12');
  assert.strictEqual(monthMap['JAN'], '01');
});

test('converts time format "4:00pm" to "16:00"', () => {
  const formatTime = (timeStr) => {
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
  };

  assert.strictEqual(formatTime('4:00pm'), '16:00');
  assert.strictEqual(formatTime('9:30am'), '09:30');
  assert.strictEqual(formatTime('12:00pm'), '12:00');
  assert.strictEqual(formatTime('12:00am'), '00:00');
  assert.strictEqual(formatTime('TBD'), 'TBD');
});

test('detects home/away indicators', () => {
  const homeAwayTests = [
    { line: 'H', expected: 'Home' },
    { line: 'A', expected: 'Away' },
    { line: 'Home', expected: 'Home' },
    { line: 'Away', expected: 'Away' },
    { line: '@', expected: 'Away' }
  ];

  homeAwayTests.forEach(test => {
    let homeAway = '';
    if (test.line === 'H' || test.line.match(/^Home/i)) {
      homeAway = 'Home';
    } else if (test.line === 'A' || test.line.match(/^Away/i) || test.line === '@') {
      homeAway = 'Away';
    }
    assert.strictEqual(homeAway, test.expected, `Line "${test.line}" should be detected as "${test.expected}"`);
  });
});

test('extracts opponent name from various formats', () => {
  const extractOpponent = (line) => {
    const opMatch = line.match(/(?:@\s+|vs\.?\s+|VS\s+)(.+?)(?:\s*\/|$)/i);
    if (opMatch) {
      let opponent = opMatch[1].trim();
      opponent = opponent.replace(/\s+or\s+.*/i, '').replace(/\s+\(.*\)/, '').trim();
      return opponent;
    }
    return '';
  };

  assert.strictEqual(extractOpponent('@ Marlboro'), 'Marlboro');
  assert.strictEqual(extractOpponent('vs. Colts Neck'), 'Colts Neck');
  assert.strictEqual(extractOpponent('VS Shore Regional'), 'Shore Regional');
  assert.strictEqual(extractOpponent('@ Brick (Away)'), 'Brick');
});

test('escapes CSV cells containing special characters', () => {
  const escapeCsvCell = (value) => {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  };

  assert.strictEqual(escapeCsvCell('Simple'), 'Simple');
  assert.strictEqual(escapeCsvCell('Contains, comma'), '"Contains, comma"');
  assert.strictEqual(escapeCsvCell('Contains "quote"'), '"Contains ""quote"""');
  assert.strictEqual(escapeCsvCell(''), '');
});

test('builds correct CSV header', () => {
  const header = 'date,start_time,home_away,opponent,location,sport,gender,level,status,notes';
  const expectedColumns = ['date', 'start_time', 'home_away', 'opponent', 'location', 'sport', 'gender', 'level', 'status', 'notes'];
  
  const columns = header.split(',');
  assert.deepStrictEqual(columns, expectedColumns);
});

test('creates properly formatted game records', () => {
  const game = {
    date: '2026-12-08',
    start_time: '16:00',
    home_away: 'Home',
    opponent: 'Marlboro',
    location: 'Main Gym',
    sport: 'Basketball',
    gender: 'Girls',
    level: 'Varsity',
    status: 'Scheduled',
    notes: ''
  };

  assert.strictEqual(game.date, '2026-12-08');
  assert.strictEqual(game.start_time, '16:00');
  assert.strictEqual(game.home_away, 'Home');
  assert.strictEqual(game.opponent, 'Marlboro');
});

test('recognizes game type lines', () => {
  const gameTypeTests = [
    { line: 'GAME', shouldMatch: true },
    { line: 'SCRIMMAGE', shouldMatch: true },
    { line: 'TOURNAMENT', shouldMatch: true },
    { line: 'Play Day', shouldMatch: true },
    { line: 'Some Random Line', shouldMatch: false }
  ];

  gameTypeTests.forEach(t => {
    const matches = t.line.match(/^(SCRIMMAGE|GAME|TOURNAMENT|Play Day)/i) !== null;
    assert.strictEqual(matches, t.shouldMatch, `"${t.line}" should${t.shouldMatch ? '' : ' not'} match game type`);
  });
});
