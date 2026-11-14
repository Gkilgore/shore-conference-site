// Checks the hand-kept record of official division lists, school links and tournament sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(source('data/school-directory.js') + source('data/conference-resources.js') +
  ';globalThis.out = { schools: shoreSchools, resources: shoreConferenceResources };', context);
const { schools, resources } = context.out;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const find = (sport, gender, season, year) => resources.divisionLists.find(list =>
  list.sports.includes(sport) && list.genders.includes(gender) && list.season === season && list.year === year);

test('every division list names its source, level, season and review', () => {
  for (const list of resources.divisionLists) {
    assert.match(list.url, /^(assets\/documents\/[\w.-]+\.pdf|archive\.html\?page=[\w.-]+)$/, list.title);
    assert.equal(list.status, 'verified');
    assert.match(list.reviewed, isoDate);
    assert.equal(list.level, 'Varsity');
    assert.ok(['Fall', 'Winter', 'Spring'].includes(list.season) && Number.isInteger(list.year), list.title);
    assert.ok(list.sports.length && list.genders.length, list.title);
  }
});

test('division members written as slugs are real schools, including each part of a joined entry', () => {
  for (const list of resources.divisionLists) {
    for (const members of Object.values(list.divisions ?? {})) {
      for (const member of members) {
        if (!/^[a-z-]+(\/[a-z-]+)*$/.test(member)) continue;
        for (const slug of member.split('/')) assert.ok(Object.hasOwn(schools, slug), list.title + ': ' + slug);
      }
    }
  }
});

test('a school sits in at most one division of a list', () => {
  for (const list of resources.divisionLists) {
    const all = Object.values(list.divisions ?? {}).flat().flatMap(member => member.split('/'));
    assert.equal(new Set(all).size, all.length, list.title);
  }
});

test('pilot assignments match the official lists', () => {
  const soccer = find('Soccer', 'Boys', 'Fall', 2026).divisions;
  assert.ok(soccer['A North'].includes('colts-neck') && soccer['A North'].includes('marlboro'));
  assert.ok(soccer['A Central'].includes('shore-regional'));
  const golf = find('Golf', 'Boys', 'Spring', 2027).divisions;
  assert.ok(golf.Mickelson.includes('colts-neck') && golf.Hogan.includes('marlboro') && golf.Snead.includes('shore-regional'));
});

test('school links are https, reviewed and only for real schools', () => {
  for (const [slug, entry] of Object.entries(resources.schoolSites)) {
    assert.ok(Object.hasOwn(schools, slug), slug);
    assert.match(entry.url, /^https:\/\//, slug);
    assert.ok(['verified', 'needs-review'].includes(entry.status), slug);
    assert.match(entry.reviewed, isoDate);
    if (entry.status === 'needs-review') assert.ok(entry.note, slug + ' needs a note saying what to settle');
  }
  for (const slug of ['colts-neck', 'marlboro', 'shore-regional']) assert.equal(resources.schoolSites[slug].status, 'verified');
  assert.equal(resources.schoolSites['jackson-township'].status, 'needs-review');
});

test('tournament sources keep disputed dates unconfirmed', () => {
  const [soccer] = resources.tournamentSources;
  assert.match(soccer.rules_url, /^assets\/documents\/[\w.-]+\.pdf$/);
  for (const gender of ['Boys', 'Girls']) {
    const dates = Object.fromEntries(soccer.dates[gender].map(row => [row.label, row]));
    for (const label of ['Qualification cutoff', 'Quarterfinals', 'Semifinals']) {
      assert.equal(dates[label].confirmed, false);
      assert.equal(dates[label].date, '');
      assert.ok(dates[label].note);
    }
    assert.equal(dates.Finals.date, '2026-10-24');
    for (const row of soccer.dates[gender]) if (row.confirmed) assert.match(row.date, isoDate);
  }
});
