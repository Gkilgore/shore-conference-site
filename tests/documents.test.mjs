// Tests the document viewer links, the archive sorting, and the template sheet checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { parseCsv, checkDocuments, checkAlignment, alignmentTeams, documentTypes } from '../tools/sheets.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({});
vm.runInContext(read('data/conference-resources.js') + read('data/document-archive.js') + read('js/document-archive.js') +
  ';globalThis.api = { allDocuments, archiveGroups, applyUploads, documentSeries, schoolYearOf, documentTypeTabs, archive: shoreDocumentArchive,' +
  ' resources: shorePublicResources, lists: shoreConferenceResources.divisionLists };', context);
const { allDocuments, archiveGroups, applyUploads, documentSeries, schoolYearOf, documentTypeTabs, archive, resources, lists } = context.api;
const copy = value => JSON.parse(JSON.stringify(value));
const upload = { title: '2027 Soccer Rules and Entry Information', type: 'Tournament regulations', sport: 'Soccer',
  school_year: '2027-28', file: 'sct_soccer_rules_2027.pdf', description: 'Rules.', added: '2027-09-01' };

test('school years follow the season', () => {
  assert.equal(schoolYearOf('Fall', 2026), '2026-27');
  assert.equal(schoolYearOf('Winter', 2026), '2026-27');
  assert.equal(schoolYearOf('Spring', 2027), '2026-27');
  assert.equal(schoolYearOf('Fall', 1999), '1999-00');
});
test('every saved file is in the archive once, under a school year', () => {
  const records = allDocuments(archive, resources, lists);
  assert.equal(new Set(records.map(record => record.url)).size, records.length);
  assert.equal(records.length, archive.uploads.length + Object.values(resources).flat().length + new Set(lists.map(list => list.url)).size);
  for (const record of records) assert.match(record.schoolYear || '', /^\d{4}-\d{2}$/, record.title);
  const labels = archiveGroups(records).map(group => group.label);
  assert.ok(labels.includes('2026–27'));
  assert.equal(labels.join(), [...labels].sort().reverse().join());
  for (const url of Object.keys(archive.legacyYears)) assert.ok(records.some(record => record.url === url), url);
});
test('a new edition replaces the older one on its tab and both stay in the archive', () => {
  const records = allDocuments({ ...copy(archive), uploads: [upload] }, copy(resources), lists);
  const tabs = applyUploads(copy(resources), records);
  const titles = tabs.tournaments.map(record => record.title);
  assert.ok(titles.includes(upload.title));
  assert.ok(!titles.includes('2026 Soccer Rules and Entry Information'));
  assert.equal(tabs.tournaments.length, resources.tournaments.length);
  const added = tabs.tournaments.find(record => record.title === upload.title);
  assert.equal(added.url, 'assets/documents/2027-28/sct_soccer_rules_2027.pdf');
  assert.ok(added.version && added.description && added.format && added.reviewed);
  assert.equal(archiveGroups(records).map(group => group.label).slice(0, 2).join(), '2027–28,2026–27');
  assert.ok(records.some(record => record.title === '2026 Soccer Rules and Entry Information'));
});
test('an older file added later does not replace the current one', () => {
  const old = { ...upload, title: '2025 Soccer Rules and Entry Information', school_year: '2025-26', file: 'old.pdf' };
  const tabs = applyUploads(copy(resources), allDocuments({ ...copy(archive), uploads: [old] }, copy(resources), lists));
  assert.equal(tabs.tournaments.map(record => record.title).join(), resources.tournaments.map(record => record.title).join());
});
test('titles that differ only by year are one series', () => {
  assert.equal(documentSeries({ title: '2026 Field Hockey SCT Bracket', sport: 'Field Hockey' }),
    documentSeries({ title: '2027 Field Hockey SCT Bracket', sport: 'Field Hockey' }));
  assert.notEqual(documentSeries({ title: '2026 Field Hockey SCT Bracket', sport: 'Field Hockey' }),
    documentSeries({ title: '2026 Field Hockey Coaches Cup Bracket', sport: 'Field Hockey' }));
  assert.equal(Object.keys(documentTypeTabs).join(), documentTypes.join());
});
test('pages that link to saved PDFs send them through the viewer', () => {
  for (const page of ['resources', 'school', 'tournament', 'archive']) assert.match(read(page + '.html'), /js\/document-links\.js/, page);
  const viewer = read('document.html');
  for (const script of ['data/document-archive.js', 'js/document-archive.js', 'js/document.js']) assert.ok(viewer.includes(script), script);
  assert.doesNotMatch(viewer, /document-links\.js/);
  const page = read('resources.html');
  assert.ok(page.includes('href="#archive"') && page.includes('id="archive"') && page.includes('id="archive-list"'));
  assert.ok(page.indexOf('js/document-archive.js') < page.indexOf('js/resources.js'), 'new files are added before the tabs are drawn');
});
test('the document template passes its own check', () => {
  const rows = parseCsv(read('templates/documents.csv'));
  assert.equal(rows.length, 2);
  assert.deepEqual(checkDocuments(rows, rows.map(row => row.file)), []);
});
test('the document check names each problem row', () => {
  const rows = parseCsv('title,type,sport,school_year,file,description,notes\n"Rules, 2027",Rulebook,,2027-29,../x.pdf,\nA,Other,,2027-28,a.pdf,"Line one\nline two"\nB,Other,,2027-28,a.pdf,Same file');
  assert.equal(rows[0].title, 'Rules, 2027');
  assert.equal(rows[1].description, 'Line one\nline two');
  const problems = checkDocuments(rows, ['a.pdf'], []);
  for (const text of ['Row 2: description is empty', 'Row 2: type "Rulebook"', 'Row 2: school_year "2027-29"', 'Row 2: file "../x.pdf" must be', 'file "a.pdf" is listed twice']) {
    assert.ok(problems.some(problem => problem.includes(text)), text);
  }
  assert.ok(checkDocuments([rows[1]], [], []).some(problem => problem.includes('not in the folder')));
  assert.ok(checkDocuments([rows[1]], ['a.pdf'], ['assets/documents/2027-28/a.pdf']).some(problem => problem.includes('already on the site')));
});
test('the alignment template passes, and the check catches unknown and doubled schools', () => {
  const schools = { 'colts-neck': 'Colts Neck', marlboro: 'Marlboro', 'shore-regional': 'Shore Regional' };
  const rows = parseCsv(read('templates/alignment.csv'));
  assert.deepEqual(checkAlignment(rows, schools), []);
  assert.deepEqual(alignmentTeams(rows, schools)[0], { label: '2027-28 Fall Boys Soccer',
    divisions: { 'A North': ['colts-neck', 'marlboro'], 'A Central': ['shore-regional'] } });
  const bad = parseCsv('school_year,season,sport,gender,division,school\n2027-28,Fall,Soccer,Boys,A North,Marlboro\n2027-28,Fall,Soccer,Boys,B North,marlboro\n2027-28,Autumn,Soccer,Boys,B North,Brick');
  const problems = checkAlignment(bad, schools);
  assert.ok(problems.some(problem => problem.includes('Marlboro is already in A North')));
  assert.ok(problems.some(problem => problem.includes('school "Brick" is not in the school directory')));
  assert.ok(problems.some(problem => problem.includes('season "Autumn"')));
});
test('every added file exists on the site', () => {
  for (const item of archive.uploads) assert.ok(existsSync(new URL('../assets/documents/' + item.school_year + '/' + item.file, import.meta.url)), item.file);
});
test('the division pop-up puts the saved list address on its own button, not on a school link', () => {
  assert.match(read('js/resources.js'), /dialog\.querySelector\('\.actions a'\)\.href = /);
  assert.doesNotMatch(read('js/resources.js'), /dialog\.querySelector\('a'\)\.href/);
});

// The viewer and the archive read the division lists too, so they must handle entries that name two
// schools and the two swimming lists that share one PDF.
const viewerContext = vm.createContext({});
vm.runInContext(read('data/school-directory.js') + read('data/conference-resources.js') + read('data/document-archive.js') +
  read('js/document-archive.js') + ';globalThis.api = { allDocuments, documentDivisionSets, sharedTitle, schools: shoreSchools,' +
  ' lists: shoreConferenceResources.divisionLists, archive: shoreDocumentArchive, resources: shorePublicResources };', viewerContext);
const viewer = viewerContext.api;
const viewerRecords = viewer.allDocuments(viewer.archive, viewer.resources, viewer.lists);
const savedFile = name => viewerRecords.find(record => record.url === 'assets/documents/' + name);

test('division lists saved in one file share one archive record that keeps both lists', () => {
  assert.equal(viewerRecords.filter(record => record.url.endsWith('2026_2027_Boys_and_Girls_Swimming.pdf')).length, 1);
  const swimming = savedFile('2026_2027_Boys_and_Girls_Swimming.pdf');
  assert.equal(swimming.title, '2026-27 Boys’ and Girls’ Swimming Divisions');
  assert.deepEqual(copy(swimming.lists.map(list => list.genders.join())), ['Boys', 'Girls']);
  assert.equal(viewer.sharedTitle(['2027 Baseball Divisions']), '2027 Baseball Divisions');
  assert.equal(viewer.sharedTitle(['2027 Baseball Divisions', '2027 Baseball Divisions']), '2027 Baseball Divisions');
  assert.equal(viewer.sharedTitle(['Boys Golf', 'Girls Golf']), 'Boys and Girls Golf');
});

test('the viewer names every school in a division list, including entries that name two', () => {
  for (const record of viewerRecords.filter(record => record.lists)) {
    for (const set of viewer.documentDivisionSets(record, viewer.schools)) {
      for (const name of set.divisions.flatMap(division => division.members)) {
        assert.doesNotMatch(name, /^[a-z-]+(\/[a-z-]+)*$/, record.title + ' shows a raw code: ' + name);
      }
    }
  }
  const [gymnastics] = copy(viewer.documentDivisionSets(savedFile('Gymnastics_2026_Divisions.pdf'), viewer.schools));
  assert.ok(gymnastics.divisions.find(division => division.name === 'B North').members
    .includes('Red Bank Regional / Rumson-Fair Haven Regional'));
  const swimming = copy(viewer.documentDivisionSets(savedFile('2026_2027_Boys_and_Girls_Swimming.pdf'), viewer.schools));
  assert.deepEqual(swimming.map(set => set.title), ['2026-27 Boys’ Swimming Divisions', '2026-27 Girls’ Swimming Divisions']);
  assert.ok(swimming[0].divisions[0].members.includes('Christian Brothers Academy'));
  assert.ok(swimming[1].divisions[0].members.includes('Trinity Hall'));
});

// Files uploaded on the staff Documents tab.
const staff = vm.createContext({});
vm.runInContext(read('js/staff-documents.js') + ';globalThis.api = { documentSchoolYears, documentFilePath, documentUploadProblems, documentMaxBytes };', staff);
const row = { id: '11111111-2222-3333-4444-555555555555', title: '2027 Soccer Rules and Entry Information', type: 'Tournament regulations',
  sport: 'Soccer', school_year: '2027-28', file_path: '2027-28/rules-ab12cd34.pdf', description: 'Rules.', note: null, added: '2027-09-01' };
test('an uploaded file opens in the viewer by id and replaces the older edition on its tab', () => {
  const { uploadedDocuments } = vm.runInContext('({ uploadedDocuments })', context);
  const [record] = uploadedDocuments([row], 'https://files.example/');
  assert.equal(record.url, 'document.html?doc=' + row.id);
  assert.equal(record.fileUrl, 'https://files.example/2027-28/rules-ab12cd34.pdf');
  const records = allDocuments({ ...copy(archive), uploads: [record] }, copy(resources), lists);
  const titles = applyUploads(copy(resources), records).tournaments.map(item => item.title + '|' + item.url).join();
  assert.ok(titles.includes(row.title + '|document.html?doc=' + row.id));
  assert.ok(!titles.includes('2026 Soccer Rules and Entry Information'));
  assert.ok(archiveGroups(records)[0].types.some(group => group.records.some(item => item.url === record.url)));
});
test('the upload form offers next school year first and names files safely', () => {
  const { documentSchoolYears, documentFilePath } = staff.api;
  assert.equal(documentSchoolYears(new Date(2026, 10, 14)).slice(0, 3).join(), '2027-28,2026-27,2025-26');
  assert.equal(documentSchoolYears(new Date(2027, 2, 1))[1], '2026-27');
  assert.equal(documentSchoolYears(new Date(2027, 6, 1))[1], '2027-28');
  const path = documentFilePath('2027-28', '../SCT Soccer (rules) 2027.PDF', 'ab12cd34');
  assert.equal(path, '2027-28/SCT_Soccer_rules_2027-ab12cd34.pdf');
  assert.match(path, /^\d{4}-\d{2}\/[A-Za-z0-9._-]{1,120}\.pdf$/);
  assert.match(documentFilePath('2027-28', '….pdf', 'ab12cd34'), /^2027-28\/document-ab12cd34\.pdf$/);
  assert.match(documentFilePath('2027-28', 'x'.repeat(300) + '.pdf', 'ab12cd34'), /^\d{4}-\d{2}\/[A-Za-z0-9._-]{1,120}\.pdf$/);
});
test('the upload form names what is missing or wrong', () => {
  const { documentUploadProblems, documentMaxBytes } = staff.api;
  const fields = { title: 'T', type: 'Other', school_year: '2027-28', description: 'D' };
  const pdf = { name: 'a.pdf', type: 'application/pdf', size: 1000 };
  assert.equal(documentUploadProblems(fields, pdf, documentTypes).length, 0);
  assert.equal(documentUploadProblems(fields, null, documentTypes).join(), 'Choose a PDF file.');
  assert.ok(documentUploadProblems(fields, { ...pdf, name: 'a.docx', type: 'application/msword' }, documentTypes).join().includes('must be a PDF'));
  assert.ok(documentUploadProblems(fields, { ...pdf, size: documentMaxBytes + 1 }, documentTypes).join().includes('larger than 10 MB'));
  assert.equal(documentUploadProblems({ title: ' ', type: 'Memo', school_year: '', description: '' }, pdf, documentTypes).length, 4);
});
test('the documents tab is wired for the conference admin view and the database rules protect it', () => {
  const admin = read('admin.html');
  for (const id of ['staff-documents-tab', 'staff-documents-panel', 'document-form', 'document-list', 'document-status']) assert.ok(admin.includes('id="' + id + '"'), id);
  assert.ok(admin.indexOf('js/document-archive.js') < admin.indexOf('js/staff-documents.js'));
  assert.match(read('js/staff-schedule.js'), /documentsTab\.hidden = role !== 'conference_office'/);
  const sql = read('supabase/migrations/20261201000100_conference_documents.sql');
  assert.match(sql, /alter table public\.conference_documents enable row level security/);
  assert.match(sql, /u\.role in \('conference_office', 'site_admin'\)/);
  assert.doesNotMatch(sql.match(/grant select \(([^)]*)\)/)[1], /uploaded_by/);
  for (const type of documentTypes) assert.ok(sql.includes("'" + type + "'"), type);
  assert.match(sql, /array\['application\/pdf'\]/);
  for (const page of ['resources', 'document']) assert.ok(read(page + '.html').indexOf('js/supabase-config.js') < read(page + '.html').indexOf('js/document-archive.js'), page);
});
