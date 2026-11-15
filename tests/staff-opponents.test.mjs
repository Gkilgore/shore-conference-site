// Verifies the master school CSV preview and its generated stable identifiers.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({});
for (const file of ['staff-import.js', 'staff-opponents.js']) {
  vm.runInContext(readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
}

test('directory preview generates stable slugs and flags duplicate or invalid rows', () => {
  const result = context.previewOpponentDirectoryCsv(
    'name,slug\nNorth Harbor High School,\nOther School,other-school\nOther School,other-school\n,missing-name',
  );
  assert.deepEqual(Array.from(result.rows, row => [row.slug, row.issue]), [
    ['north-harbor-high-school', ''],
    ['other-school', ''],
    ['other-school', 'This slug appears more than once in the file.'],
    ['missing-name', 'School name is missing.'],
  ]);
});

test('directory preview rejects files over the server import limit', () => {
  const rows = ['name,slug', ...Array.from({length: 2001}, (_, index) => `School ${index},school-${index}`)].join('\n');
  const result = context.previewOpponentDirectoryCsv(rows);
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /2,000 schools/);
});
