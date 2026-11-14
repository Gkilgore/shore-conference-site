// Checks that a division is named only for the exact team and season the official list covers.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source('data/school-directory.js') + source('data/conference-resources.js') + source('js/team-info.js') +
  ';globalThis.out = { teamDivision, seasonYear, seasonLabel, schoolSite };', context);
const { teamDivision, seasonYear, seasonLabel, schoolSite } = context.out;
const fall = '2026-10-15';
const spring = '2027-04-20';
const ask = team => teamDivision({ school: 'marlboro', date: fall, gender: '', level: '', ...team });

test('assigned for a varsity team', () => {
  const result = ask({ sport: 'Soccer', gender: 'Boys', level: 'Varsity' });
  assert.equal(result.state, 'assigned');
  assert.equal(result.division, 'A North');
  assert.equal(result.label, 'Fall 2026');
  assert.equal(result.level, 'Varsity');
  assert.ok(result.members.includes('colts-neck'));
  assert.equal(teamDivision({ school: 'shore-regional', sport: 'Soccer', gender: 'Boys', level: 'Varsity', date: fall }).division, 'A Central');
});

test('JV never inherits the varsity division', () => {
  for (const level of ['JV', 'Freshman']) {
    const result = ask({ sport: 'Soccer', gender: 'Boys', level });
    assert.equal(result.state, 'not-varsity');
    assert.equal(result.division, undefined);
  }
});

test('all sports makes no division claim', () => {
  assert.equal(ask({ sport: '' }).state, 'all');
  const result = ask({ sport: '', gender: 'Boys', level: 'Varsity' });
  assert.equal(result.state, 'all');
  assert.equal(result.division, undefined);
});

test('sport without gender offers lists, not a division', () => {
  const result = ask({ sport: 'Soccer' });
  assert.equal(result.state, 'choose-team');
  assert.equal(result.lists.length, 2);
  assert.equal(result.division, undefined);
});

test('Girls Tennis resolves with gender unset', () => {
  assert.equal(ask({ sport: 'Girls Tennis' }).division, 'B North');
  assert.equal(ask({ sport: 'Tennis', gender: 'Girls' }).division, 'B North');
});

test('a sport with a fall team and a spring team needs the team chosen', () => {
  assert.equal(ask({ sport: 'Tennis' }).state, 'choose-team');
  const boys = teamDivision({ school: 'marlboro', sport: 'Tennis', gender: 'Boys', level: '', date: spring });
  assert.equal(boys.division, 'American');
  assert.equal(boys.label, 'Spring 2027');
  assert.equal(ask({ sport: 'Tennis', gender: 'Girls' }).label, 'Fall 2026');
});

test('Cross Country resolves for either gender', () => {
  for (const gender of ['Boys', 'Girls', '']) assert.equal(ask({ sport: 'Cross Country', gender }).division, 'A North');
});

test('next school year has no record', () => {
  const result = teamDivision({ school: 'marlboro', sport: 'Soccer', gender: 'Boys', level: 'Varsity', date: '2027-10-15' });
  assert.equal(result.state, 'none');
  assert.equal(result.label, 'Fall 2027');
  assert.equal(result.division, undefined);
});

test('a school missing from the divisions on file gets the list only', () => {
  const result = ask({ sport: 'Field Hockey', gender: 'Girls', level: 'Varsity' });
  assert.equal(result.state, 'list');
  assert.match(result.list.url, /FH_2026_divisions/);
});

test('incomplete list shows no member list', () => {
  vm.runInContext(`shoreConferenceResources.divisionLists.push({ sports: ['Fencing'], genders: ['Girls'], level: 'Varsity',
    season: 'Winter', year: 2026, title: 'Test list', url: 'archive.html?page=test', complete: false, divisions: { 'A North': ['marlboro'] } })`, context);
  const result = teamDivision({ school: 'marlboro', sport: 'Fencing', gender: 'Girls', level: 'Varsity', date: '2027-01-20' });
  vm.runInContext('shoreConferenceResources.divisionLists.pop()', context);
  assert.equal(result.division, 'A North');
  assert.equal(result.members, null);
});

test('schools beyond the pilot three get their division from the full lists', () => {
  const result = teamDivision({ school: 'toms-river-east', sport: 'Soccer', gender: 'Boys', level: 'Varsity', date: fall });
  assert.equal(result.division, 'A South');
  assert.ok(result.members.includes('southern-regional'));
  const track = teamDivision({ school: 'marlboro', sport: 'Track', gender: 'Boys', level: 'Varsity', date: spring });
  assert.equal(track.division, 'A North');
  assert.equal(track.members.length, 8);
  const winter = '2027-01-20';
  assert.equal(teamDivision({ school: 'trinity-hall', sport: 'Swimming', gender: 'Girls', level: 'Varsity', date: winter }).division, 'A North');
  assert.equal(teamDivision({ school: 'trinity-hall', sport: 'Swimming', gender: 'Boys', level: 'Varsity', date: winter }).state, 'list');
  assert.equal(teamDivision({ school: 'trinity-hall', sport: 'Swimming', gender: 'Girls', level: 'JV', date: winter }).state, 'not-varsity');
});

test('each school named by a short or combined entry gets that division', () => {
  const winter = '2027-01-20';
  const division = (school, sport, gender, date) => teamDivision({ school, sport, gender, level: 'Varsity', date }).division;
  assert.equal(division('brick-township', 'Ice Hockey', 'Boys', winter), 'Shore North');
  assert.equal(division('brick-memorial', 'Ice Hockey', 'Boys', winter), 'Shore North');
  assert.equal(division('rumson-fair-haven-regional', 'Ice Hockey', 'Boys', winter), 'Shore South');
  assert.equal(division('middletown-south', 'Wrestling', 'Girls', winter), 'A North');
  assert.equal(division('toms-river-north', 'Wrestling', 'Girls', winter), 'A South');
  assert.equal(division('red-bank-regional', 'Football', 'Boys', fall), 'C North');
  assert.equal(division('red-bank-catholic', 'Football', 'Boys', fall), 'A North');
  assert.equal(division('brick-township', 'Softball', 'Girls', spring), 'Liberty');
  assert.equal(division('brick-memorial', 'Softball', 'Girls', spring), 'Independence');
  assert.equal(division('jackson-township', 'Gymnastics', 'Girls', fall), 'A South');
  assert.equal(division('keyport', 'Cross Country', 'Girls', fall), 'B Central');
  assert.equal(teamDivision({ school: 'ocean-academy', sport: 'Cross Country', gender: 'Boys', level: 'Varsity', date: fall }).state, 'list');
});

test('unknown sport has nothing on file', () => {
  assert.equal(ask({ sport: 'Fencing' }).state, 'none');
});

test('season years and labels', () => {
  assert.equal(seasonYear('Fall', '2026-09-01'), 2026);
  assert.equal(seasonYear('Winter', '2027-01-20'), 2026);
  assert.equal(seasonYear('Spring', '2027-04-20'), 2027);
  assert.equal(seasonYear('Spring', '2026-11-10'), 2027);
  assert.equal(seasonLabel('Winter', 2026), 'Winter 2026–27');
  assert.equal(seasonLabel('Spring', 2027), 'Spring 2027');
  assert.equal(ask({ sport: 'Basketball', gender: 'Boys' }).label, 'Winter 2026–27');
});

test('school link only when verified', () => {
  assert.match(schoolSite('marlboro').url, /^https:\/\/sites\.google\.com\/frhsd\.com\/mrhsseca/);
  assert.equal(schoolSite('jackson-township'), null);
  assert.equal(schoolSite('ocean-academy'), null);
  assert.equal(schoolSite('not-a-school'), null);
});
