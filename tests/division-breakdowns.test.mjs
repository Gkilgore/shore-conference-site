// Checks that every division list carries its whole alignment and matches the checked transcription,
// that short and combined names name the right schools, that saved pages show typos corrected, and that
// nothing a visitor loads points at the old site.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/school-directory.js') + read('data/conference-resources.js') + read('js/resource-lists.js') +
  read('data/archived-resources.js') + read('js/archive.js') +
  ';globalThis.out = { schools: shoreSchools, lists: shoreConferenceResources.divisionLists, divisionBreakdown, divisionEntrySchools,' +
  ' archivedResources, archiveTypoFixes, fixArchivedText };', context);
const { schools, lists, divisionBreakdown, divisionEntrySchools, archivedResources, archiveTypoFixes, fixArchivedText } = context.out;
const transcriptions = JSON.parse(read('docs/source-archive/division-transcriptions.json'));
const names = JSON.parse(read('docs/source-archive/division-name-map.json'));
const plain = value => JSON.parse(JSON.stringify(value));
const find = (sport, gender, season) => lists.filter(list =>
  list.sports.includes(sport) && list.genders.includes(gender) && list.season === season);
const only = (sport, gender, season) => {
  const found = find(sport, gender, season);
  assert.equal(found.length, 1, sport + ' ' + gender);
  return plain(found[0].divisions);
};

// The transcription key for a list: its saved page or PDF name; the two swimming pages are split by team.
const sourceKey = list => {
  const name = decodeURIComponent(list.url.split(/page=|\//).pop()).replace(/\.pdf$/, '');
  return name === '2026_2027_Boys_and_Girls_Swimming' ? 'swimming-' + list.genders[0].toLowerCase() : name;
};
// The documented rules, applied independently of the data file: one school, a combined entry split at "/",
// or a short name that counts as every school it could mean, minus any the same list names on its own.
const direct = printed => {
  const name = printed.trim();
  if (Object.hasOwn(names.slugs, name.toLowerCase())) return [names.slugs[name.toLowerCase()]];
  const parts = name.split('/').map(part => part.trim().toLowerCase());
  return parts.length > 1 && parts.every(part => Object.hasOwn(names.slugs, part)) ? parts.map(part => names.slugs[part]) : null;
};
const mapList = divisions => {
  const listed = new Set(Object.values(divisions).flat().flatMap(printed => direct(printed) ?? []));
  return Object.fromEntries(Object.entries(divisions).map(([division, members]) => [division, members.map(printed => {
    const name = printed.trim();
    const slugs = direct(name) ?? names.ambiguous[name.toLowerCase()]?.filter(slug => !listed.has(slug));
    return slugs ? slugs.join('/') : name;
  })]));
};

test('every list has every division of its alignment, with all members', () => {
  assert.equal(lists.length, 25);
  for (const list of lists) {
    assert.equal(list.complete, true, list.title);
    assert.equal(list.allDivisions, true, list.title);
    const divisions = Object.values(list.divisions);
    assert.ok(divisions.length >= 1 && divisions.every(members => members.length >= 2), list.title);
  }
});

test('each list equals its checked transcription after name mapping, in source order', () => {
  const used = new Set();
  for (const list of lists) {
    const key = sourceKey(list);
    assert.ok(Object.hasOwn(transcriptions, key), list.title + ' has no transcription ' + key);
    used.add(key);
    assert.deepEqual(plain(list.divisions), mapList(transcriptions[key]), list.title);
  }
  assert.deepEqual([...used].sort(), Object.keys(transcriptions).sort(), 'every transcription is used once');
});

test('the name map covers every printed name and points only at real schools', () => {
  for (const member of Object.values(transcriptions).flatMap(Object.values).flat()) {
    const printed = member.trim();
    assert.ok(direct(printed) || Object.hasOwn(names.ambiguous, printed.toLowerCase()) || Object.hasOwn(names.printed, printed), printed);
  }
  const slugs = [...Object.values(names.slugs), ...Object.values(names.ambiguous).flat()];
  for (const slug of slugs) assert.ok(Object.hasOwn(schools, slug), slug);
  for (const name of Object.keys(names.ambiguous)) {
    assert.equal(Object.hasOwn(names.slugs, name), false, name);
    assert.ok(names.ambiguous[name].length > 1, name);
  }
  for (const typo of Object.keys(names.typos)) assert.ok(Object.hasOwn(names.slugs, typo), typo + ' must map to a school');
});

test('every entry is a school, several schools joined by "/", or a printed name with a note', () => {
  for (const list of lists) {
    for (const entry of Object.values(list.divisions).flat()) {
      if (divisionEntrySchools(entry, schools).length) continue;
      assert.doesNotMatch(entry, /^[a-z-]+(\/[a-z-]+)*$/, list.title + ': unknown slug in ' + entry);
      assert.ok(Object.hasOwn(names.printed, entry), list.title + ': unexpected name ' + entry);
      assert.ok(list.notes.some(note => note.includes('“' + entry + '”')), list.title + ': no note for ' + entry);
    }
  }
});

test('a short name counts as every school it could mean, unless the list names one on its own', () => {
  const hockey = only('Ice Hockey', 'Boys', 'Winter');
  assert.ok(hockey['Shore North'].includes('brick-township/brick-memorial'));
  assert.ok(hockey['Shore South'].includes('rumson-fair-haven-regional'));
  const wrestling = only('Wrestling', 'Girls', 'Winter');
  assert.ok(wrestling['A North'].includes('middletown-north/middletown-south'));
  assert.ok(wrestling['A South'].includes('brick-township/brick-memorial'));
  assert.ok(wrestling['A South'].includes('toms-river-east/toms-river-north/toms-river-south'));
  // Softball lists Brick Memorial on its own, so its "Brick" is Brick Township.
  const softball = only('Softball', 'Girls', 'Spring');
  assert.ok(softball.Independence.includes('brick-memorial') && softball.Liberty.includes('brick-township'));
  // Football lists Red Bank Catholic on its own, so its "Red Bank" is Red Bank Regional.
  const football = only('Football', 'Boys', 'Fall');
  assert.ok(football['A North'].includes('red-bank-catholic') && football['C North'].includes('red-bank-regional'));
  for (const list of [find('Ice Hockey', 'Boys', 'Winter')[0], find('Wrestling', 'Girls', 'Winter')[0]]) {
    assert.ok(list.notes.some(note => /until confirmed/.test(note)), list.title);
  }
});

test('combined teams name both schools in one entry', () => {
  const gymnastics = only('Gymnastics', 'Girls', 'Fall');
  assert.ok(gymnastics['B North'].includes('red-bank-regional/rumson-fair-haven-regional'));
  assert.ok(gymnastics['A South'].includes('brick-memorial/brick-township'));
  assert.ok(gymnastics['A South'].includes('manchester-township/jackson-township'));
  const crossCountry = only('Cross Country', 'Boys', 'Fall');
  assert.ok(crossCountry['B Central'].includes('henry-hudson-regional/keyport'));
  assert.ok(crossCountry['B South'].includes('(Ocean Academy)'));
  assert.equal(Object.values(crossCountry).flat().includes('ocean-academy'), false);
});

test('a school sits in at most one division of a list, counting every school an entry names', () => {
  for (const list of lists) {
    const all = Object.values(list.divisions).flat().flatMap(entry => entry.split('/'));
    assert.equal(new Set(all).size, all.length, list.title);
  }
});

test('boys and girls swimming are separate lists with different A North members', () => {
  const boys = only('Swimming', 'Boys', 'Winter');
  const girls = only('Swimming', 'Girls', 'Winter');
  assert.deepEqual([...find('Swimming', 'Boys', 'Winter')[0].genders], ['Boys']);
  assert.deepEqual([...find('Swimming', 'Girls', 'Winter')[0].genders], ['Girls']);
  assert.ok(boys['A North'].includes('christian-brothers-academy') && !boys['A North'].includes('trinity-hall'));
  assert.ok(girls['A North'].includes('trinity-hall') && !girls['A North'].includes('christian-brothers-academy'));
});

test('every sport, team and season on file, with the right year', () => {
  const expected = {
    'Fall 2026': ['Boys Soccer', 'Girls Soccer', 'Girls Field Hockey', 'Girls Tennis', 'Girls Volleyball', 'Boys Cross Country',
      'Girls Cross Country', 'Boys Football', 'Girls Gymnastics'],
    'Winter 2026': ['Boys Basketball', 'Girls Basketball', 'Boys Ice Hockey', 'Coed Ice Hockey', 'Boys Wrestling', 'Girls Wrestling',
      'Boys Swimming', 'Girls Swimming'],
    'Spring 2027': ['Boys Baseball', 'Girls Softball', 'Boys Golf', 'Girls Golf', 'Boys Lacrosse', 'Girls Lacrosse', 'Boys Tennis',
      'Boys Track', 'Girls Track', 'Boys Volleyball', 'Girls Flag Football'],
  };
  const actual = {};
  for (const list of lists) {
    for (const gender of list.genders) (actual[list.season + ' ' + list.year] ??= []).push(gender + ' ' + list.sports[0]);
  }
  for (const key of Object.keys(expected)) assert.deepEqual(actual[key].sort(), expected[key].sort(), key);
  assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
});

test('the pop-up breakdown lists every division and team, linking each school an entry names', () => {
  const [football] = find('Football', 'Boys', 'Fall');
  const breakdown = plain(divisionBreakdown(football, schools));
  assert.deepEqual(breakdown.divisions.map(division => division.name),
    ['A North', 'B North', 'C North', 'D North', 'A South', 'B South', 'C South']);
  assert.equal(breakdown.summary, 'All 7 divisions, 42 teams.');
  assert.deepEqual(breakdown.divisions[2].members.at(-1), { name: 'Red Bank Regional', schools: [{ slug: 'red-bank-regional', name: 'Red Bank Regional' }] });
  assert.deepEqual(breakdown.notes, []);
  const [wrestling] = find('Wrestling', 'Girls', 'Winter');
  const toms = plain(divisionBreakdown(wrestling, schools)).divisions[1].members.at(-1);
  assert.equal(toms.name, 'Toms River East / Toms River North / Toms River South');
  assert.deepEqual(toms.schools.map(school => school.slug), ['toms-river-east', 'toms-river-north', 'toms-river-south']);
  assert.equal(divisionBreakdown(wrestling, schools).summary, 'All 2 divisions, 13 teams.', 'a combined entry is one team');
  const [crossCountry] = find('Cross Country', 'Boys', 'Fall');
  const printed = plain(divisionBreakdown(crossCountry, schools)).divisions.flatMap(division => division.members)
    .find(member => member.name === '(Ocean Academy)');
  assert.deepEqual(printed, { name: '(Ocean Academy)', schools: [] });
  const partial = divisionBreakdown({ divisions: { 'A North': ['marlboro'] }, complete: true, allDivisions: false, reviewed: '2026-11-13' }, schools);
  assert.match(partial.summary, /Only some divisions/);
  const namesOnly = divisionBreakdown({ divisions: { 'A North': ['marlboro'] }, complete: false, reviewed: '2026-11-13' }, schools);
  assert.equal(namesOnly.divisions[0].members, null);
  assert.match(divisionBreakdown({ divisions: null }, schools).summary, /not copied/);
});

test('typos are corrected when shown, and no typo note is left for a visitor', () => {
  const saved = JSON.stringify(archivedResources);
  for (const [wrong, right] of archiveTypoFixes) {
    assert.ok(saved.includes(JSON.stringify(wrong).slice(1, -1)), 'stale fix: ' + wrong);
    assert.equal(fixArchivedText('x ' + wrong + ' y'), 'x ' + right + ' y');
  }
  assert.equal(fixArchivedText('TRINTIY HALL'), 'TRINITY HALL');
  assert.equal(fixArchivedText('HOLMDEL'), 'HOLMDEL');
  for (const list of lists) assert.equal(list.notes.some(note => /prints|typo/i.test(note)), false, list.title);
  const volleyball = only('Volleyball', 'Girls', 'Fall');
  const gymnastics = only('Gymnastics', 'Girls', 'Fall');
  assert.ok(volleyball['A North'].includes('trinity-hall') && gymnastics['B North'].includes('manalapan'));
});

test('no page, script, style or data file a visitor loads mentions the old conference site', () => {
  const root = new URL('../', import.meta.url);
  const files = [
    ...readdirSync(root).filter(name => name.endsWith('.html')),
    ...['js', 'css', 'data'].flatMap(dir => readdirSync(new URL(dir + '/', root)).map(name => dir + '/' + name)),
  ];
  assert.ok(files.length > 30);
  for (const file of files) assert.doesNotMatch(read(file), /theshoreconference\.com/i, file);
});
