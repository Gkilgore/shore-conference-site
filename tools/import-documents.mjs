// Adds new PDFs to the site from a filled copy of templates/documents.csv. docs/documents.md has the steps.
//   node tools/import-documents.mjs <sheet.csv> <folder with the PDFs>          checks and previews, changes nothing
//   node tools/import-documents.mjs <sheet.csv> <folder with the PDFs> --save   copies the PDFs and updates the site
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, openSync, readSync, closeSync } from 'node:fs';
import { resolve, join } from 'node:path';
import vm from 'node:vm';
import { parseCsv, checkDocuments } from './sheets.mjs';

const [sheet, folder, flag] = process.argv.slice(2);
if (!sheet || !folder) {
  console.error('Usage: node tools/import-documents.mjs <sheet.csv> <folder with the PDFs> [--save]');
  process.exit(2);
}
const root = resolve(import.meta.dirname, '..');
const dataPath = join(root, 'data/document-archive.js');
const source = readFileSync(dataPath, 'utf8');
const start = source.indexOf('const shoreDocumentArchive = ');
const archive = vm.runInNewContext('(' + source.slice(source.indexOf('{', start)).replace(/;\s*$/, '') + ')');

const rows = parseCsv(readFileSync(sheet, 'utf8'));
const files = readdirSync(folder);
const problems = checkDocuments(rows, files, archive.uploads.map(upload => 'assets/documents/' + upload.school_year + '/' + upload.file));
// A real PDF starts with %PDF.
for (const row of rows) {
  if (!files.includes(row.file)) continue;
  const handle = openSync(join(folder, row.file), 'r');
  const head = Buffer.alloc(4);
  readSync(handle, head, 0, 4, 0);
  closeSync(handle);
  if (head.toString() !== '%PDF') problems.push('Row ' + row.line + ': file "' + row.file + '" is not a PDF.');
}
if (problems.length) {
  console.error('Fix these and run again. Nothing was changed.\n' + problems.map(text => '  ' + text).join('\n'));
  process.exit(1);
}

for (const row of rows) console.log([row.school_year, row.type, row.title, row.file].join('  |  '));
if (flag !== '--save') {
  console.log('\n' + rows.length + ' file(s) look right. Run again with --save to add them.');
  process.exit(0);
}
const added = new Date().toISOString().slice(0, 10);
for (const row of rows) {
  mkdirSync(join(root, 'assets/documents', row.school_year), { recursive: true });
  copyFileSync(join(folder, row.file), join(root, 'assets/documents', row.school_year, row.file));
  archive.uploads.push({ title: row.title, type: row.type, sport: row.sport || '', school_year: row.school_year, file: row.file,
    description: row.description, ...(row.notes ? { note: row.notes } : {}), added });
}
writeFileSync(dataPath, source.slice(0, start) + 'const shoreDocumentArchive = ' + JSON.stringify(archive, null, 2) + ';\n');
console.log('\nAdded ' + rows.length + ' file(s). Run the tests, look at the Information page, then commit.');
