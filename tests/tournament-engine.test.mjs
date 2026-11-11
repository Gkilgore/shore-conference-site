// Verifies seeded brackets, portable CSV documents, results and scheduling constraints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const path = new URL('../js/tournament-engine.js', import.meta.url);
const context = vm.createContext({ console });
if (existsSync(path)) vm.runInContext(readFileSync(path, 'utf8'), context);
const engine = context.TournamentEngine;
const plain = value => JSON.parse(JSON.stringify(value));
const participants = count => Array.from({ length: count }, (_, index) => ({
  id: 'p' + (index + 1), name: 'Team ' + (index + 1), school_id: 'school-' + (index + 1),
  team_id: null, seed: index + 1,
}));
function document(count = 4) {
  const teams = participants(count);
  return { name: 'Spring Cup', sport: 'Softball', gender: 'Girls', level: 'Varsity',
    season: 'Spring', season_year: 2027, duration_minutes: 60, turnaround_minutes: 15,
    rest_minutes: 30, windows: [{ date: '2027-04-10', start: '09:00', end: '18:00', venue: 'Main' }],
    participants: teams, matches: engine.generateBracket(teams) };
}
test('engine exposes the browser contract', () => {
  assert.ok(engine, 'TournamentEngine must be defined');
});
test('eight seeded entrants form four quarterfinals, two semifinals and one final', () => {
  const matches = plain(engine.generateBracket(participants(8)));
  assert.deepEqual(matches.filter(match => match.round === 1).map(match => [match.a.participant_id, match.b.participant_id]),
    [['p1', 'p8'], ['p4', 'p5'], ['p2', 'p7'], ['p3', 'p6']]);
  assert.deepEqual([1, 2, 3].map(round => matches.filter(match => match.round === round).length), [4, 2, 1]);
  assert.deepEqual(matches.filter(match => match.round === 2).map(match => [match.a.winner_of, match.b.winner_of]),
    [['r1m1', 'r1m2'], ['r1m3', 'r1m4']]);
  assert.deepEqual([matches[6].a.winner_of, matches[6].b.winner_of], ['r2m1', 'r2m2']);
});

test('six seeded entrants produce five matches with the top two receiving byes', () => {
  const matches = plain(engine.generateBracket(participants(6)));
  assert.equal(matches.length, 5);
  assert.equal(matches.filter(match => match.round === 1).length, 2);
  assert.deepEqual(matches.filter(match => match.round === 2).flatMap(match => [match.a, match.b])
    .filter(slot => slot.participant_id).map(slot => slot.participant_id).sort(), ['p1', 'p2']);
  const doc = document(6);
  assert.equal(engine.validate(doc).filter(issue => /slot|seed|reference|cycle|advance/i.test(issue.message)).length, 0);
  for (let count = 2; count <= 128; count++) assert.equal(engine.generateBracket(participants(count)).length, count - 1);
  assert.throws(() => engine.generateBracket([{ id: 'a', name: 'A', seed: 1 }, { id: 'b', name: 'B', seed: 1 }]), /seed/i);
});
test('participant text recognizes member schools and preserves guest names', () => {
  const result = plain(engine.participantsFromText('1. Marlboro\n2 Guest, "United"\nShore Regional', [
    { slug: 'marlboro', name: 'Marlboro' }, { slug: 'shore-regional', name: 'Shore Regional' },
  ]));
  assert.deepEqual(result.errors, []);
  assert.equal(result.participants[0].school_id, 'marlboro');
  assert.equal(result.participants[1].name, 'Guest, "United"');
  assert.equal(result.participants[2].seed, 3);
  assert.ok(engine.participantsFromText('1 A\n1 B', []).errors.length);
});
test('CSV mapping and master export preserve IDs, metadata, guest names and dangerous spreadsheet cells', () => {
  const doc = document();
  doc.name = '=SUM(1,2)';
  doc.participants[0].name = "'=literal";
  doc.participants[1].name = '=Guest, "United"\nClub';
  doc.participants[1].school_id = null;
  doc.matches[0].home_side = 'b';
  const csv = engine.exportCsv(doc, 'tournament-id');
  assert.ok(csv.includes("'=SUM"));
  const imported = plain(engine.parseCsv(csv, {}, []));
  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.document, plain(doc));
  assert.deepEqual(plain(engine.parseCsv(engine.exportCsv(imported.document, 'tournament-id'), {}, [])).document, plain(doc));
  const mapped = plain(engine.parseCsv('Game,Round,Host,Visitor\ngame-1,1,Alpha,Guest Club',
    { match_id: 'Game', round: 'Round', a_name: 'Host', b_name: 'Visitor' }, []));
  assert.deepEqual(mapped.errors, []);
  assert.equal(mapped.document.matches[0].id, 'game-1');
  assert.equal(mapped.document.participants[1].name, 'Guest Club');
  assert.ok(engine.parseCsv('match_id,round,a_name,b_name\n"broken,1,A,B', {}, []).errors.length);
});
test('winner corrections preserve recorded results and flag invalid downstream winners', () => {
  const doc = document();
  doc.matches[0].status = 'Final'; doc.matches[0].winner_id = 'p1';
  doc.matches[1].status = 'Final'; doc.matches[1].winner_id = 'p2';
  doc.matches[2].status = 'Final'; doc.matches[2].winner_id = 'p1';
  assert.equal(engine.resolve(doc).matches[2].resolved_a, 'p1');
  doc.matches[0].winner_id = 'p4';
  const resolved = plain(engine.resolve(doc));
  assert.equal(resolved.matches[2].resolved_a, 'p4');
  assert.equal(resolved.matches[2].winner_id, 'p1');
  assert.ok(engine.validate(resolved).some(issue => issue.match_id === resolved.matches[2].id && /winner/i.test(issue.message)));
  doc.matches[0].a = { winner_of: doc.matches[2].id };
  assert.ok(engine.validate(doc).some(issue => /round|cycle/i.test(issue.message)));
  assert.doesNotThrow(() => engine.resolve(doc));
});
test('validation catches duplicate entrances and potential-team conflicts before results', () => {
  const doc = document();
  doc.matches[0].game_date = doc.matches[2].game_date = '2027-04-10';
  doc.matches[0].start_time = doc.matches[2].start_time = '09:00';
  doc.matches[0].venue = 'Main'; doc.matches[2].venue = 'Other';
  assert.ok(engine.validate(doc).some(issue => /potential|rest|depend/i.test(issue.message)));
  doc.matches[1].a = { participant_id: 'p1' };
  assert.ok(engine.validate(doc).some(issue => /starting slot|enters|duplicate/i.test(issue.message)));
});
test('scheduler observes venue turnaround, dependency rest, windows and external games without mutating input', () => {
  const doc = document();
  const before = JSON.stringify(doc);
  const external = [{ id: 'school-game', school_ids: ['school-1'], game_date: '2027-04-10',
    start_time: '09:00', duration_minutes: 60, venue: 'Away' }];
  const result = plain(engine.schedule(doc, doc.windows, external));
  assert.equal(JSON.stringify(doc), before);
  assert.deepEqual(result.document.matches.map(match => match.id), ['r1m1', 'r1m2', 'r2m1']);
  assert.equal(result.document.matches[0].start_time, '10:30');
  assert.equal(result.document.matches[1].start_time, '09:00');
  assert.equal(result.document.matches[2].start_time, '12:00');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(plain(engine.validate(result.document, external)), []);
  const limited = engine.schedule(doc, [{ date: '2027-04-10', start: '09:00', end: '10:00', venue: 'Main' }]);
  assert.ok(limited.document.matches.some(match => !match.start_time));
  assert.ok(limited.issues.some(issue => issue.blocking && /window|unscheduled|fit/i.test(issue.message)));
});
test('invalid calendar dates, completed results and malformed slots block publication', () => {
  const doc = document(2);
  Object.assign(doc.matches[0], { game_date: '2027-02-30', start_time: '24:00', venue: 'Main', status: 'Final' });
  doc.matches[0].a.winner_of = 'missing';
  const issues = engine.validate(doc);
  assert.ok(issues.some(issue => /date/i.test(issue.message)));
  assert.ok(issues.some(issue => /time/i.test(issue.message)));
  assert.ok(issues.some(issue => /winner/i.test(issue.message)));
  assert.ok(issues.some(issue => /exactly one/i.test(issue.message)));
});
test('completed matches reserve their venue before the scheduler places remaining matches', () => {
  const doc = document();
  Object.assign(doc.matches[1], { game_date: '2027-04-10', start_time: '09:00', venue: 'Main', status: 'Final', winner_id: 'p2', score_a: 3, score_b: 1 });
  const result = plain(engine.schedule(doc, doc.windows));
  assert.equal(result.document.matches[0].start_time, '10:15');
  assert.deepEqual(result.document.matches[1], plain(doc.matches[1]));
  assert.equal(result.document.matches[2].start_time, '11:45');
  assert.deepEqual(result.issues, []);
});
test('CSV preview reports invalid structure and conflicting IDs without throwing on malformed participants', () => {
  const malformed = engine.parseCsv('match_id,round,a_name,b_name\nbad!,0,A,B\nbad!,1,A,C', {}, []);
  assert.ok(malformed.errors.some(error => /ID|round/i.test(error)));
  assert.doesNotThrow(() => engine.parseCsv('match_id,participants\ngame,"[null]"', {}, []));
  assert.ok(engine.parseCsv('match_id,participants\ngame,"[null]"', {}, []).errors.length);
});
test('invalid venue windows and missing metadata are publication issues', () => {
  const doc = document(2);
  doc.name = '';
  doc.windows = [{ date: '2027-02-30', start: '10:00', end: '09:00', venue: '' }];
  assert.ok(engine.validate(doc).some(issue => /window/i.test(issue.message)));
  assert.ok(engine.validate(doc).some(issue => /name/i.test(issue.message)));
});
test('separate venues allow parallel games while same-school potential entries remain separated', () => {
  const doc = document();
  doc.windows.push({ date: '2027-04-10', start: '09:00', end: '18:00', venue: 'Second' });
  const scheduled = engine.schedule(doc, doc.windows);
  assert.equal(scheduled.document.matches[0].start_time, '09:00');
  assert.equal(scheduled.document.matches[1].start_time, '09:00');
  assert.equal(scheduled.document.matches[1].venue, 'Second');
  doc.participants[1].school_id = doc.participants[0].school_id;
  const sameSchool = engine.schedule(doc, doc.windows);
  assert.equal(sameSchool.document.matches[1].start_time, '10:30');
});

test('explicitly unmapped canonical CSV headers are ignored while omitted mappings retain autodetection', () => {
  const text = 'match_id,round,a_name,b_name,status\nfirst,1,Alpha,Beta,Unknown';
  assert.ok(engine.parseCsv(text, {}, []).errors.length);
  const result = engine.parseCsv(text, { status: '' }, []);
  assert.deepEqual(plain(result.errors), []);
  assert.equal(result.document.matches[0].status, 'Scheduled');
  assert.equal(result.document.matches[0].id, 'first');
});

test('CSV rejects non-object playing windows before they reach the draft editor', () => {
  for (const value of ['[null]','[3]','["invalid"]','[[]]']) {
    const csv='match_id,round,a_name,b_name,windows\nm1,1,Guest A,Guest B,"'+value.replaceAll('"','""')+'"';
    const result=engine.parseCsv(csv,{},[]);
    assert.ok(result.errors.some(message=>/playing window.*Remove empty or invalid entries/i.test(message)));
  }
});

test('spring-forward scheduling measures game duration and dependency rest in elapsed Eastern minutes', () => {
  const doc = document();
  doc.windows = ['Main', 'Second'].map(venue => ({ date: '2027-03-14', start: '01:30', end: '06:00', venue }));
  const result = plain(engine.schedule(doc, doc.windows));
  assert.equal(result.document.matches[0].start_time, '01:30');
  assert.equal(result.document.matches[1].start_time, '01:30');
  assert.equal(result.document.matches[2].start_time, '04:00');
  assert.deepEqual(result.issues, []);
  result.document.matches[2].start_time = '03:00';
  assert.ok(engine.validate(result.document).some(issue => /rest|Dependency/.test(issue.message)));
});

test('spring-forward windows exclude the skipped hour from available game duration', () => {
  const doc = document(2);
  doc.windows = [{ date: '2027-03-14', start: '01:30', end: '03:00', venue: 'Main' }];
  const result = engine.schedule(doc, doc.windows);
  assert.equal(result.document.matches[0].start_time, null);
  Object.assign(doc.matches[0], { game_date: '2027-03-14', start_time: '01:30', venue: 'Main' });
  assert.ok(engine.validate(doc).some(issue => /window/.test(issue.message)));
});

test('spring-forward external games constrain the proposal using actual elapsed rest', () => {
  const doc = document(2);
  doc.windows = [{ date: '2027-03-14', start: '03:00', end: '06:00', venue: 'Main' }];
  const external = [{ id: 'early-game', school_ids: ['school-1'], game_date: '2027-03-14',
    start_time: '01:30', duration_minutes: 60, venue: 'Away' }];
  const result = plain(engine.schedule(doc, doc.windows, external));
  assert.equal(result.document.matches[0].start_time, '04:00');
  assert.deepEqual(result.issues, []);
});

test('fall-back scheduling counts the repeated hour and uses the later standard-time occurrence', () => {
  const doc = document(2);
  doc.rest_minutes = 60;
  doc.windows = [{ date: '2027-11-07', start: '01:30', end: '04:00', venue: 'Main' }];
  const external = [{ id: 'early-game', school_ids: ['school-1'], game_date: '2027-11-07',
    start_time: '00:30', duration_minutes: 60, venue: 'Away' }];
  Object.assign(doc.matches[0], { game_date: '2027-11-07', start_time: '01:30', venue: 'Main' });
  assert.deepEqual(plain(engine.validate(doc, external)), []);
  const result = plain(engine.schedule(doc, doc.windows, external));
  assert.equal(result.document.matches[0].start_time, '01:30');
  assert.deepEqual(result.issues, []);
  doc.duration_minutes = 120;
  doc.windows = [{ date: '2027-11-07', start: '00:30', end: '02:00', venue: 'Main' }];
  assert.equal(engine.schedule(doc, doc.windows).document.matches[0].start_time, '00:30');
});

test('nonexistent Eastern spring-forward match times and window endpoints have clear blocking issues', () => {
  const doc = document(2);
  doc.windows = [{ date: '2027-03-14', start: '02:30', end: '06:00', venue: 'Main' }];
  Object.assign(doc.matches[0], { game_date: '2027-03-14', start_time: '02:30', venue: 'Main' });
  const issues = engine.validate(doc);
  assert.ok(issues.some(issue => issue.match_id === doc.matches[0].id && /does not exist.*Eastern|Eastern.*does not exist/.test(issue.message)));
  assert.ok(issues.some(issue => issue.match_id === null && /window.*does not exist|does not exist.*window/.test(issue.message)));
  assert.equal(engine.schedule(doc, doc.windows).document.matches[0].start_time, null);
});

test('fall-back proposals skip earlier repeated-hour starts that cannot round-trip through HH:mm', () => {
  const doc = document(2);
  Object.assign(doc, { duration_minutes: 30, rest_minutes: 0, turnaround_minutes: 0 });
  doc.windows = [{ date: '2027-11-07', start: '00:30', end: '03:00', venue: 'Main' }];
  const external = [{ id: 'early-game', school_ids: ['school-1'], game_date: '2027-11-07',
    start_time: '00:00', duration_minutes: 90, venue: 'Away' }];
  const result = plain(engine.schedule(doc, doc.windows, external));
  assert.equal(result.document.matches[0].start_time, '01:00');
  assert.deepEqual(result.issues, []);
  assert.deepEqual(plain(engine.validate(result.document, external)), []);
});

test('minute-by-minute proposals reuse cached Eastern offsets instead of calling Intl in the scan', () => {
  let conversions = 0;
  const fresh = vm.createContext({ Intl: { DateTimeFormat: function (...args) {
    const formatter = new Intl.DateTimeFormat(...args);
    return { formatToParts(value) { conversions++; return formatter.formatToParts(value); } };
  } } });
  vm.runInContext(readFileSync(path, 'utf8'), fresh);
  const doc = document(2);
  doc.windows = [{ date: '2027-03-14', start: '01:30', end: '08:00', venue: 'Main' }];
  const external = [{ id: 'early-game', school_ids: ['school-1'], game_date: '2027-03-14',
    start_time: '01:30', duration_minutes: 180, venue: 'Away' }];
  const result = fresh.TournamentEngine.schedule(doc, doc.windows, external);
  assert.equal(result.document.matches[0].start_time, '06:00');
  assert.ok(conversions < 20, 'Eastern conversion should run once per date and clock-change boundary');
});

test('pasted and CSV school ambiguities list choices with their original line or row', () => {
  const schools = [
    { slug: 'toms-river-north', name: 'Toms River North' },
    { slug: 'toms-river-east', name: 'Toms River East' },
    { slug: 'toms-river-south', name: 'Toms River South' },
    { slug: 'marlboro', name: 'Marlboro' },
  ];
  const pasted = engine.participantsFromText('Marlboro\n\nToms River', schools);
  assert.ok(pasted.errors.some(error => /Line 3/.test(error) && schools.slice(0, 3).every(school => error.includes(school.name))));
  const imported = engine.parseCsv('match_id,a_name,b_name\nm1,Toms River,Unknown Guest', {}, schools);
  assert.ok(imported.errors.some(error => /Row 2/.test(error) && schools.slice(0, 3).every(school => error.includes(school.name))));
  const duplicateNames = [{ slug: 'central-a', name: 'Central' }, { slug: 'central-b', name: 'Central' }];
  assert.ok(engine.participantsFromText('Central\nGuest', duplicateNames).errors.some(error => /central-a/.test(error) && /central-b/.test(error)));
  const exact = engine.participantsFromText('Toms River North\nUnknown Guest', schools);
  assert.deepEqual(plain(exact.errors), []);
  assert.equal(exact.participants[0].school_id, 'toms-river-north');
  assert.equal(exact.participants[1].school_id, null);
  const doc = document(2);
  doc.participants[0].name = 'Toms River'; doc.participants[0].school_id = null;
  const master = engine.parseCsv(engine.exportCsv(doc, 'test-id'), {}, schools);
  assert.deepEqual(plain(master.errors), []);
  assert.equal(master.document.participants[0].school_id, null);
});

test('bracket generation rejects duplicate school identities and normalized guest names', () => {
  const teams = participants(2);
  teams[1].school_id = teams[0].school_id;
  assert.throws(() => engine.generateBracket(teams), /duplicate|only once/i);
  teams.forEach(team => { team.school_id = null; });
  teams[0].name = 'Guest Club'; teams[1].name = ' guest club ';
  assert.throws(() => engine.generateBracket(teams), /duplicate|only once/i);
  assert.ok(engine.participantsFromText('Marlboro\nmarlboro', [{ slug: 'marlboro', name: 'Marlboro' }]).errors.length);
});

test('legacy external gap times normalize like PostgreSQL while tournament inputs still reject them', () => {
  const doc = document(2);
  doc.windows = [{ date: '2027-03-14', start: '03:00', end: '07:00', venue: 'Main' }];
  const external = [{ id: 'legacy-game', school_ids: ['school-1'], game_date: '2027-03-14',
    start_time: '02:30', duration_minutes: 60, venue: 'Away' }];
  Object.assign(doc.matches[0], { game_date: '2027-03-14', start_time: '03:30', venue: 'Main' });
  assert.ok(engine.validate(doc, external).some(issue => /legacy-game/.test(issue.message)));
  const result = plain(engine.schedule(doc, doc.windows, external));
  assert.equal(result.document.matches[0].start_time, '05:00');
  assert.deepEqual(result.issues, []);
  doc.matches[0].start_time = '02:30';
  assert.ok(engine.validate(doc, external).some(issue => /does not exist in Eastern time/.test(issue.message)));
});

test('historical external dates cannot thrash Eastern conversion caches during a blocked proposal', () => {
  let conversions = 0;
  const fresh = vm.createContext({ Intl: { DateTimeFormat: function (...args) {
    const formatter = new Intl.DateTimeFormat(...args);
    return { formatToParts(value) { conversions++; return formatter.formatToParts(value); } };
  } } });
  vm.runInContext(readFileSync(path, 'utf8'), fresh);
  const doc = document(2);
  const external = Array.from({ length: 200 }, (_, index) => ({ id: 'historical-' + index,
    school_ids: ['school-1'], game_date: new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10),
    start_time: '09:00', duration_minutes: 60, venue: 'Main' }));
  external.push({ id: 'same-day-blocker', school_ids: ['school-1'], game_date: '2027-04-10',
    start_time: '09:00', duration_minutes: 420, venue: 'Main' });
  const result = fresh.TournamentEngine.schedule(doc, doc.windows, external);
  assert.equal(result.document.matches[0].start_time, '16:30');
  assert.deepEqual(plain(result.issues), []);
  assert.ok(conversions < 30, 'Irrelevant historical dates must be excluded before Eastern conversion');
});

test('external date filtering preserves cross-midnight rest and long-duration overlaps', () => {
  const doc = document(2);
  doc.windows = [{ date: '2027-04-10', start: '00:00', end: '04:00', venue: 'Main' }];
  const previousDay = [{ id: 'late-game', school_ids: ['school-1'], game_date: '2027-04-09',
    start_time: '23:00', duration_minutes: 60, venue: 'Away' }];
  assert.equal(engine.schedule(doc, doc.windows, previousDay).document.matches[0].start_time, '00:30');
  doc.windows = [{ date: '2027-04-10', start: '09:00', end: '12:00', venue: 'Main' }];
  const longGame = [{ id: 'long-game', school_ids: ['school-1'], game_date: '2027-04-05',
    start_time: '09:00', duration_minutes: 7200, venue: 'Away' }];
  assert.equal(engine.schedule(doc, doc.windows, longGame).document.matches[0].start_time, '09:30');
  doc.rest_minutes = 10080;
  doc.windows = [{ date: '2027-03-14', start: '09:00', end: '14:00', venue: 'Main' }];
  const beforeDst = [{ id: 'prior-week', school_ids: ['school-1'], game_date: '2027-03-07',
    start_time: '09:00', duration_minutes: 60, venue: 'Away' }];
  assert.equal(engine.schedule(doc, doc.windows, beforeDst).document.matches[0].start_time, '11:00');
});

const info = () => ({ rules_url: 'https://theshoreconference.com/rules.pdf', director: 'Pat Example', director_confirmed: true,
  reviewed_on: '2026-11-10', dates: [
    { label: 'Qualification cutoff', date: '', confirmed: false, note: 'Two sources disagree.' },
    { label: 'Finals', date: '2026-10-24', confirmed: true, note: '' }] });

test('rules and dates never become matches or CSV rows', () => {
  const plainDocument = document(), withInfo = { ...document(), info: info() };
  assert.deepEqual(plain(engine.validate(withInfo)), plain(engine.validate(plainDocument)));
  assert.deepEqual(plain(engine.resolve(withInfo).matches), plain(engine.resolve(plainDocument).matches));
  const scheduled = engine.schedule(withInfo, withInfo.windows);
  assert.equal(scheduled.document.matches.length, plainDocument.matches.length);
  assert.deepEqual(plain(scheduled.document.info), info());
  const csv = engine.exportCsv(withInfo, 'cup');
  assert.equal(csv, engine.exportCsv(plainDocument, 'cup'));
  assert.doesNotMatch(csv, /Qualification cutoff|2026-10-24/);
});

test('validate rejects a rules link that is not https', () => {
  for (const rules_url of ['http://example.com/rules.pdf', 'javascript:alert(1)', 'theshoreconference.com/rules']) {
    const issues = engine.validate({ ...document(), info: { ...info(), rules_url } });
    assert.ok(issues.some(issue => issue.blocking && /rules link must start with https/.test(issue.message)), rules_url);
  }
});

test('validate rejects a confirmed date with no date, a bad date and an unnamed date', () => {
  const messages = dates => engine.validate({ ...document(), info: { ...info(), dates } }).filter(issue => !issue.match_id).map(issue => issue.message).join(' | ');
  assert.match(messages([{ label: 'Semifinals', date: '', confirmed: true }]), /Semifinals is marked confirmed but has no date/);
  assert.match(messages([{ label: 'Semifinals', date: '2026-02-30', confirmed: false }]), /Semifinals needs a valid date/);
  assert.match(messages([{ label: '', date: '2026-10-24', confirmed: true }]), /Each key date needs a name/);
  assert.equal(messages([{ label: 'Semifinals', date: '', confirmed: false, note: 'Sources disagree.' }]), '');
});

test('cleanInfo trims text, drops empty rows and reports whether anything is left', () => {
  const clean = engine.cleanInfo({ rules_url: '  https://example.org/r.pdf ', dates: [{ label: ' ', date: '', note: '' }, { label: ' Finals ', date: '2026-10-24', confirmed: 'yes' }] });
  assert.equal(clean.rules_url, 'https://example.org/r.pdf');
  assert.deepEqual(plain(clean.dates), [{ label: 'Finals', date: '2026-10-24', confirmed: false, note: '' }]);
  assert.equal(engine.hasInfo(clean), true);
  assert.equal(engine.hasInfo(undefined), false);
  assert.equal(engine.hasInfo({ dates: [{ label: '', date: '' }], director_confirmed: true }), false);
});
