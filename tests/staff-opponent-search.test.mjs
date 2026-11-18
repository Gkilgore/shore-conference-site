// Checks grouped opponent search and selection data for the game editor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/staff-opponent-search.js', import.meta.url), 'utf8'), context);
const search = context.searchStaffOpponents;
const pick = context.opponentSelection;

const schools = [
  { slug: 'marlboro', name: 'Marlboro', source: 'conference' },
  { slug: 'colts-neck', name: 'Colts Neck', source: 'conference', address: 'Colts Neck, NJ' },
  { slug: 'shore-regional', name: 'Shore Regional', source: 'conference' },
  { slug: 'eastview-a', name: 'Eastview School', source: 'custom', added_by_school: 'marlboro' },
  { slug: 'eastview-b', name: 'Eastview School', source: 'custom', added_by_school: 'colts-neck' },
  { slug: 'north-eastview', name: 'North Eastview High School', source: 'njsiaa', address: 'Newark, NJ' },
];

test('search groups matching words and keeps only this school’s saved schools', () => {
  const results = search(schools, 'view', 'marlboro');
  assert.deepEqual(Array.from(results, group => group.title), ['Your saved schools', 'NJSIAA schools']);
  assert.deepEqual(Array.from(results[0].items, item => item.slug), ['eastview-a']);
  assert.deepEqual(Array.from(results[1].items, item => item.slug), ['north-eastview']);
});

test('search excludes own school and orders conference, saved, NJSIAA', () => {
  const results = search(schools, '', 'marlboro');
  assert.deepEqual(Array.from(results, group => group.title), ['Shore Conference', 'Your saved schools', 'NJSIAA schools']);
  assert.deepEqual(Array.from(results[0].items, item => item.slug), ['colts-neck', 'shore-regional']);
});

test('conference selection uses school identity and outside selection keeps a name', () => {
  assert.deepEqual({ ...pick(schools[1]) }, {
    opponent_school_id: 'colts-neck', opponent_directory_slug: 'colts-neck', opponent_name: null,
  });
  assert.deepEqual({ ...pick(schools[3]) }, {
    opponent_school_id: null, opponent_directory_slug: 'eastview-a', opponent_name: 'Eastview School',
  });
  assert.deepEqual({ ...pick({ name: 'Old free text' }) }, {
    opponent_school_id: null, opponent_directory_slug: null, opponent_name: 'Old free text',
  });
});

test('away venue uses the chosen address only when empty', () => {
  assert.equal(context.opponentAwayVenue('Away', '', schools[5]), 'North Eastview High School, Newark, NJ');
  assert.equal(context.opponentAwayVenue('Home', '', schools[5]), '');
  assert.equal(context.opponentAwayVenue('Away', 'Field 2', schools[5]), 'Field 2');
});

test('result subtitle shows the town', () => {
  assert.equal(context.opponentTown('59 Five Points Road, Colts Neck NJ 07722'), 'Colts Neck');
});
