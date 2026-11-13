// Tests public resource selection without changing schedule data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/conference-resources.js') + read('js/resource-filters.js') +
  ';globalThis.api = { selectDivisionLists, divisionCoverage, selectPublicResources, lists: shoreConferenceResources.divisionLists, resources: shorePublicResources };', context);
const { selectDivisionLists, divisionCoverage, lists } = context.api;

test('sport, gender, season and year select the matching alignment', () => {
  const found = selectDivisionLists(lists, { sport: 'Soccer', gender: 'Boys', season: 'Fall', year: '2026' });
  assert.equal(found.length, 1);
  assert.equal(divisionCoverage(found[0], 'marlboro').division, 'A North');
  assert.equal(divisionCoverage(found[0], 'shore-regional').division, 'A Central');
});
test('missing schools retain the source and report unknown coverage', () => {
  const found = selectDivisionLists(lists, { sport: 'Soccer', gender: 'Boys', school: 'ocean-academy' });
  assert.equal(found.length, 1);
  assert.equal(divisionCoverage(found[0], 'ocean-academy').state, 'source-only');
});
test('partial memberships are not presented as complete', () => {
  const found = selectDivisionLists(lists, { sport: 'Gymnastics' })[0];
  const coverage = divisionCoverage(found, 'marlboro');
  assert.equal(coverage.division, 'A North');
  assert.equal(coverage.state, 'partial');
  assert.equal(coverage.members.length, 0);
});
test('unknown years and filters do not fall back to a different season', () => {
  assert.equal(selectDivisionLists(lists, { year: '2099' }).length, 0);
  assert.equal(selectDivisionLists(lists, { sport: 'Unknown' }).length, 0);
  assert.equal(selectDivisionLists(lists, { season: 'Winter', year: '2027' }).length, 0);
});

test('competitions within a sport remain separate and searchable', () => {
  const { selectPublicResources, resources } = context.api;
  const cup = selectPublicResources(resources.tournaments, { sport: 'Field Hockey', competition: 'Coaches Cup', year: '2026' });
  assert.equal(cup.length, 1);
  assert.match(cup[0].title, /Coaches Cup/);
  assert.equal(selectPublicResources(resources.tournaments, { year: '2099' }).length, 0);
  assert.equal(selectPublicResources(resources.documents, { search: ' CONSTITUTION ' }).length, 1);
});

test('public resource records retain official sources, edition labels and review dates', () => {
  for (const record of Object.values(context.api.resources).flat()) {
    assert.equal(new URL(record.url).hostname, 'theshoreconference.com');
    assert.match(record.reviewed, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(record.version && record.description && record.format);
    assert.equal('matches' in record, false, 'a resource cannot create calendar matches');
  }
});

test('phone navigation and resource disclosure preserve focus when closed', () => {
  const handlers = {};
  const doc = { activeElement: null, addEventListener: (name, fn) => { handlers[name] = fn; } };
  const toggle = { hidden: true, setAttribute() {}, focus() { doc.activeElement = this; },
    addEventListener: (_, fn) => { handlers.toggle = fn; } };
  const first = { focus() { doc.activeElement = this; } };
  const summary = { focus() { doc.activeElement = this; } };
  const resourceLink = {};
  const resources = { open: false, querySelector: () => summary,
    contains: element => element === resourceLink || element === summary };
  const nav = { hidden: false, querySelector: selector => selector === 'a' ? first : resources,
    contains: element => element === first || resources.contains(element), addEventListener() {} };
  doc.querySelector = selector => selector === '.nav-toggle' ? toggle : nav;
  const media = { matches: true, addEventListener: (_, fn) => { handlers.resize = fn; } };
  vm.runInNewContext(read('js/navigation.js'), { document: doc, matchMedia: () => media, setTimeout });
  assert.equal(nav.hidden, true);
  handlers.toggle();
  assert.equal(nav.hidden, false);
  resources.open = true;
  doc.activeElement = resourceLink;
  handlers.keydown({ key: 'Escape' });
  assert.equal(resources.open, false);
  assert.equal(doc.activeElement, summary);
  handlers.keydown({ key: 'Escape' });
  assert.equal(nav.hidden, true);
  assert.equal(doc.activeElement, toggle);
  media.matches = false;
  handlers.resize();
  assert.equal(nav.hidden, false);
  assert.equal(doc.activeElement, first);
});
