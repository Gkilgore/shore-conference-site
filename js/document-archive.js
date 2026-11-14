// Sorts saved documents by series and school year, puts newly added files on the Information tabs,
// and draws the Archive tab. The sorting has no page access, so tests can run it.

// Which Information tab shows the newest file of each type. Alignments show on the Divisions tab instead.
const documentTypeTabs = {
  'Alignment': null, 'Tournament regulations': 'tournaments', 'Bracket': 'tournaments', 'Entry form': 'tournaments',
  'Governance': 'documents', 'Leadership': 'documents', 'Award': 'documents', 'Other': 'documents',
};
const schoolYearLabel = year => year ? year.replace('-', '–') : 'Year not recorded';
// Fall and winter belong to the school year that starts that calendar year; spring to the one that ends in it.
function schoolYearOf(season, year) {
  const start = season === 'Spring' ? year - 1 : year;
  return start + '-' + String((start + 1) % 100).padStart(2, '0');
}
// Two files are editions of one document when their titles match once the years are taken out.
function documentSeries(record) {
  return [record.sport || '', record.title.toLowerCase().replace(/\b(19|20)\d{2}([-–/]\d{2,4})?\b/g, '')
    .replace(/[^a-z]+/g, ' ').trim()].join('|');
}

// One title for division lists saved in the same file: the words they share, with the words that differ
// joined by "and". "2026-27 Boys’ Swimming Divisions" and "2026-27 Girls’ Swimming Divisions" make
// "2026-27 Boys’ and Girls’ Swimming Divisions".
function sharedTitle(titles) {
  const words = [...new Set(titles)].map(title => title.split(' '));
  if (words.length === 1) return titles[0];
  const shortest = Math.min(...words.map(list => list.length));
  let start = 0, end = 0;
  while (start < shortest && words.every(list => list[start] === words[0][start])) start++;
  while (end < shortest - start && words.every(list => list.at(-1 - end) === words[0].at(-1 - end))) end++;
  const middles = words.map(list => list.slice(start, list.length - end).join(' ')).filter(Boolean);
  return [...words[0].slice(0, start), middles.join(' and '), ...words[0].slice(words[0].length - end)].filter(Boolean).join(' ');
}

// Every saved file as one list: files added with the import tool, the older document and tournament
// records, and the division lists. Each address appears once; division lists saved in one file (boys'
// and girls' swimming) share a record that keeps every list.
function allDocuments(archive, publicResources, divisionLists) {
  const records = archive.uploads.map(upload => ({ ...upload, url: 'assets/documents/' + upload.school_year + '/' + upload.file,
    schoolYear: upload.school_year, uploaded: true }));
  for (const [tab, list] of Object.entries(publicResources)) {
    for (const record of list) {
      records.push({ title: record.title, url: record.url, type: record.category, sport: record.sport || '',
        schoolYear: archive.legacyYears[record.url] || null, tab });
    }
  }
  const byFile = new Map();
  for (const list of divisionLists) byFile.set(list.url, [...(byFile.get(list.url) || []), list]);
  for (const [url, lists] of byFile) {
    records.push({ title: sharedTitle(lists.map(list => list.title)), url, type: 'Alignment',
      sport: [...new Set(lists.flatMap(list => list.sports))].join(', '),
      schoolYear: schoolYearOf(lists[0].season, lists[0].year), lists });
  }
  const seen = new Set();
  return records.filter(record => !seen.has(record.url) && seen.add(record.url));
}

// The divisions a saved file lists, as readers see them: one set per division list in the file, each
// division with its schools by name ("Brick Township / Brick Memorial" for an entry naming both).
function documentDivisionSets(record, schools) {
  return (record?.lists || []).filter(list => list.complete && list.divisions).map(list => ({
    title: list.title,
    divisions: Object.entries(list.divisions).map(([name, entries]) => ({
      name, members: entries.map(entry => divisionEntryName(entry, schools)) })),
  }));
}

// School years, newest first, each with its files grouped by type.
function archiveGroups(records) {
  const years = [...new Set(records.map(record => record.schoolYear || ''))].sort().reverse();
  return years.map(year => {
    const inYear = records.filter(record => (record.schoolYear || '') === year);
    const types = [...new Set(inYear.map(record => record.type))].sort();
    return { label: schoolYearLabel(year), types: types.map(type => ({ type,
      records: inYear.filter(record => record.type === type).sort((first, second) => first.title.localeCompare(second.title)) })) };
  }).sort((first, second) => (first.label === 'Year not recorded') - (second.label === 'Year not recorded'));
}

// Puts each added file on its tab when it is the newest edition, and takes the edition it replaces off.
function applyUploads(publicResources, records) {
  const newest = new Map();
  for (const record of records) {
    const key = documentSeries(record);
    if (!newest.has(key) || (record.schoolYear || '') > (newest.get(key).schoolYear || '')) newest.set(key, record);
  }
  for (const record of records) {
    const current = newest.get(documentSeries(record));
    if (!current.uploaded) continue;
    if (record !== current && record.tab) {
      publicResources[record.tab] = publicResources[record.tab].filter(item => item.url !== record.url);
    }
    const tab = documentTypeTabs[record.type];
    if (record === current && tab) {
      publicResources[tab].push({ title: record.title, url: record.url, description: record.description, category: record.type,
        version: schoolYearLabel(record.schoolYear), format: 'PDF', reviewed: record.added, ...(record.note ? { note: record.note } : {}) });
    }
  }
  return publicResources;
}

// On the Information page: add the new files before the tabs are drawn, then list everything by year.
if (typeof document !== 'undefined' && document.getElementById('archive-list')) {
  const records = allDocuments(shoreDocumentArchive, shorePublicResources, shoreConferenceResources.divisionLists);
  applyUploads(shorePublicResources, records);
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  document.getElementById('archive-list').replaceChildren(...archiveGroups(records).flatMap(group => {
    const list = node('ul', '', 'doc-list');
    for (const { type, records: files } of group.types) {
      for (const file of files) {
        const item = node('li');
        const link = node('a', file.title);
        link.href = file.url;
        item.append(link, node('span', [type, file.sport].filter(Boolean).join(' · '), 'doc-meta'));
        list.append(item);
      }
    }
    return [node('h3', group.label, 'eyebrow'), list];
  }));
}
