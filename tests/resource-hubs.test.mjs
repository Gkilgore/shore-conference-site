// Tests how the Resources page groups division lists and what its document records must carry.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/conference-resources.js') + read('js/resource-lists.js') +
  ';globalThis.api = { divisionGroups, divisionTeamLabel, seasonLabel, lists: shoreConferenceResources.divisionLists, resources: shorePublicResources };', context);
const { divisionGroups, lists, resources } = context.api;
const groups = divisionGroups(lists);
const teams = label => groups.find(group => group.label === label).teams.map(team => team.label);

test('division lists are grouped by season, and winter shows both years', () => {
  assert.equal(groups.map(group => group.label).join(', '), 'Fall 2026, Winter 2026–27, Spring 2027');
  assert.equal(groups.flatMap(group => group.teams).length, lists.length);
});
test('a sport with more than one list names the team; a sport with one list does not', () => {
  assert.ok(teams('Fall 2026').includes('Boys Soccer'));
  assert.ok(teams('Fall 2026').includes('Girls Soccer'));
  assert.ok(teams('Fall 2026').includes('Football'));
  assert.ok(teams('Fall 2026').includes('Cross Country'));
  assert.ok(teams('Fall 2026').includes('Girls Volleyball'));
  assert.ok(teams('Spring 2027').includes('Boys Volleyball'));
  assert.ok(teams('Spring 2027').includes('Track'));
});
test('each team keeps its own list', () => {
  const soccer = groups[0].teams.find(team => team.label === 'Boys Soccer').list;
  assert.ok(soccer.divisions['A North'].includes('marlboro'));
  assert.equal(divisionGroups([]).length, 0);
});
test('public resource records link to saved copies, with edition labels and review dates', () => {
  for (const record of Object.values(resources).flat()) {
    assert.match(record.url, /^(assets\/documents\/[\w.-]+\.pdf|archive\.html\?page=[\w.-]+)$/);
    assert.match(record.reviewed, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.version && record.description && record.format);
    assert.equal('matches' in record, false, 'a resource cannot create calendar matches');
  }
});
test('the old addresses forward to their Resources tab', () => {
  for (const [page, target] of [['about', 'resources.html'], ['divisions', 'resources.html#divisions'],
    ['tournaments', 'resources.html#tournaments'], ['inside', 'resources.html#documents']]) {
    assert.ok(read(page + '.html').includes('url=' + target + '"'), page);
  }
  const page = read('resources.html');
  for (const id of ['about', 'history', 'divisions', 'tournaments', 'documents']) {
    assert.ok(page.includes('href="#' + id + '"') && page.includes('id="' + id + '"'), id);
  }
});
