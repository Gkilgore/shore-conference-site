// Checks a filled copy of templates/alignment.csv and prints each team's divisions. Changes nothing.
//   node tools/check-alignment.mjs <sheet.csv>
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { parseCsv, checkAlignment, alignmentTeams } from './sheets.mjs';

const sheet = process.argv[2];
if (!sheet) {
  console.error('Usage: node tools/check-alignment.mjs <sheet.csv>');
  process.exit(2);
}
const directory = readFileSync(join(resolve(import.meta.dirname, '..'), 'data/school-directory.js'), 'utf8');
const schools = vm.runInNewContext(directory + ';Object.fromEntries(Object.entries(shoreSchools).map(([slug, school]) => [slug, school.name]))');
const rows = parseCsv(readFileSync(sheet, 'utf8'));
const problems = checkAlignment(rows, schools);
if (problems.length) {
  console.error('Fix these and run again.\n' + problems.map(text => '  ' + text).join('\n'));
  process.exit(1);
}
for (const team of alignmentTeams(rows, schools)) {
  console.log('\n' + team.label);
  for (const [division, members] of Object.entries(team.divisions)) console.log('  ' + division + ': ' + members.join(', '));
}
console.log('\nThe sheet checks out.');
