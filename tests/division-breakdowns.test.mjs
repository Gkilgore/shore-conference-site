// Checks that every division list carries its whole alignment, matches the checked transcription,
// keeps combined and ambiguous names as printed, and that nothing a visitor loads points at the old site.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/school-directory.js') + read('data/conference-resources.js') + read('js/resource-lists.js') +
  ';globalThis.out = { schools: shoreSchools, lists: shoreConferenceResources.divisionLists, divisionBreakdown };', context);
const { schools, lists, divisionBreakdown } = context.out;
const transcriptions = JSON.parse(read('docs/source-archive/division-transcriptions.json'));
const names = JSON.parse(read('docs/source-archive/division-name-map.json'));
const find = (sport, gender, season) => lists.filter(list =>
  list.sports.includes(sport) && list.genders.includes(gender) && list.season === season);

// The transcription key for a list: its saved page or PDF name; the two swimming pages are split by team.
const sourceKey = list => {
  const name = decodeURIComponent(list.url.split(/page=|\//).pop()).replace(/\.pdf$/, '');
  return name === '2026_2027_Boys_and_Girls_Swimming' ? 'swimming-' + list.genders[0].toLowerCase() : name;
};
const mapped = printed => names.slugs[printed.trim().toLowerCase()] ?? printed.trim();

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
    const expected = Object.fromEntries(Object.entries(transcriptions[key]).map(([division, members]) => [division, members.map(mapped)]));
    assert.deepEqual(JSON.parse(JSON.stringify(list.divisions)), expected, list.title);
  }
  assert.deepEqual([...used].sort(), Object.keys(transcriptions).sort(), 'every transcription is used once');
});

test('the name map covers every printed name, and printed-only names are never turned into schools', () => {
  for (const division of Object.values(transcriptions)) {
    for (const member of Object.values(division).flat()) {
      const printed = member.trim();
      assert.ok(Object.hasOwn(names.slugs, printed.toLowerCase()) || Object.hasOwn(names.printed, printed), printed);
    }
  }
  for (const slug of Object.values(names.slugs)) assert.ok(Object.hasOwn(schools, slug), slug);
  for (const printed of Object.keys(names.printed)) assert.equal(Object.hasOwn(names.slugs, printed.toLowerCase()), false, printed);
  for (const list of lists) {
    for (const member of Object.values(list.divisions).flat()) {
      if (!Object.hasOwn(schools, member)) {
        assert.ok(Object.hasOwn(names.printed, member), list.title + ': unexpected name ' + member);
        assert.ok(list.notes.some(note => note.includes('“' + member + '”')), list.title + ': no note for ' + member);
      }
    }
  }
});

test('combined teams stay combined', () => {
  const gymnastics = find('Gymnastics', 'Girls', 'Fall')[0].divisions;
  assert.ok(gymnastics['B North'].includes('RBR/RFH'));
  assert.ok(gymnastics['A South'].includes('Brick Mem./Brick Twp.') && gymnastics['A South'].includes('Manchester/Jackson'));
  const crossCountry = find('Cross Country', 'Boys', 'Fall')[0].divisions;
  assert.ok(crossCountry['B Central'].includes('Henry Hudson/Keyport'));
  assert.ok(crossCountry['B South'].includes('(Ocean Academy)'));
  assert.equal(Object.values(crossCountry).flat().includes('ocean-academy'), false);
});

test('boys and girls swimming are separate lists with different A North members', () => {
  const [boys] = find('Swimming', 'Boys', 'Winter');
  const [girls] = find('Swimming', 'Girls', 'Winter');
  assert.notEqual(boys, girls);
  assert.deepEqual([...boys.genders], ['Boys']);
  assert.deepEqual([...girls.genders], ['Girls']);
  assert.ok(boys.divisions['A North'].includes('christian-brothers-academy') && !boys.divisions['A North'].includes('trinity-hall'));
  assert.ok(girls.divisions['A North'].includes('trinity-hall') && !girls.divisions['A North'].includes('christian-brothers-academy'));
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
  for (const [sport, gender, season] of [['Soccer', 'Boys', 'Fall'], ['Basketball', 'Girls', 'Winter'], ['Lacrosse', 'Girls', 'Spring']]) {
    assert.equal(find(sport, gender, season).length, 1, sport + ' ' + gender);
  }
});

test('the pop-up breakdown lists every division and team, linking only real schools', () => {
  const [football] = find('Football', 'Boys', 'Fall');
  const breakdown = divisionBreakdown(football, schools);
  assert.deepEqual([...breakdown.divisions.map(division => division.name)],
    ['A North', 'B North', 'C North', 'D North', 'A South', 'B South', 'C South']);
  assert.equal(breakdown.summary, 'All 7 divisions, 42 teams.');
  const redBank = breakdown.divisions[2].members.find(member => member.name === 'Red Bank');
  assert.deepEqual({ ...redBank }, { slug: null, name: 'Red Bank' });
  assert.equal(breakdown.divisions[0].members[0].name, 'Holmdel');
  assert.ok(breakdown.notes.some(note => note.includes('Red Bank')));
  const partial = divisionBreakdown({ divisions: { 'A North': ['marlboro'] }, complete: true, allDivisions: false, reviewed: '2026-11-13' }, schools);
  assert.match(partial.summary, /Only some divisions/);
  const namesOnly = divisionBreakdown({ divisions: { 'A North': ['marlboro'] }, complete: false, reviewed: '2026-11-13' }, schools);
  assert.equal(namesOnly.divisions[0].members, null);
  assert.match(divisionBreakdown({ divisions: null }, schools).summary, /not copied/);
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
