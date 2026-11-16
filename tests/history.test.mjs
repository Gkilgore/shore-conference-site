// Checks combined history filters and source integrity before historical records reach readers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/history.js') + read('js/history-data.js') + ';globalThis.api={data:shoreHistory,filter:filterHistoryAthletes};', context);
const { data, filter } = context.api;

test('sport and school-era filters intersect, including multisport athletes', () => {
  const entries = [
    { id: 'a', sports: ['Soccer', 'Basketball'], decade: 1990, membership: 'conference' },
    { id: 'b', sports: ['Basketball'], decade: 2010, membership: 'conference' },
    { id: 'c', sports: ['Basketball'], decade: 1960, membership: 'shore-area' }
  ];
  assert.equal(filter(entries, 'Basketball', '1990', 'conference').map(x => x.id).join(), 'a');
  assert.equal(filter(entries, 'Basketball', 'all', 'conference').map(x => x.id).join(), 'a,b');
  assert.equal(filter(entries, 'all', 'all', 'shore-area').map(x => x.id).join(), 'c');
  assert.equal(filter(entries, 'Soccer', '2010', 'conference').length, 0);
  assert.equal(filter(entries, 'all', 'all', 'all').length, 3);
});

test('every public historical record resolves to a real source and a unique anchor', () => {
  const ids = new Set();
  for (const entry of [...data.milestones, ...data.athletes, ...data.stories, ...data.membership]) {
    assert.ok(!ids.has(entry.id), entry.id + ' duplicate');
    ids.add(entry.id);
    assert.ok(entry.sources.length, entry.id + ' needs evidence');
    for (const id of entry.sources) {
      const source = data.sources[id];
      assert.ok(source?.title && source?.url && source?.publisher, entry.id + ': ' + id);
      assert.doesNotMatch(source.url, /theshoreconference\.com|turn\d+|javascript:/i);
    }
  }
});

test('athlete classifications keep later-member alumni out of the conference gallery', () => {
  const confirmed = filter(data.athletes, 'all', 'all', 'conference');
  assert.ok(confirmed.some(x => x.id === 'christie-rampone'));
  assert.ok(!confirmed.some(x => x.id === 'bob-verga'));
  assert.ok(data.athletes.some(x => x.id === 'bob-verga' && x.membership === 'shore-area'));
  assert.ok(!data.athletes.some(x => /Jenny Thompson/.test(x.name)));
});

test('published photographs have local files, accessible descriptions, and reuse credits', () => {
  for (const [id, photo] of Object.entries(data.photos)) {
    assert.ok(existsSync(new URL('../' + photo.src, import.meta.url)), id);
    for (const field of ['alt', 'credit', 'source', 'license', 'licenseUrl', 'changes']) assert.ok(photo[field], id + ': ' + field);
    assert.ok(photo.width > 0 && photo.height > 0);
  }
});
