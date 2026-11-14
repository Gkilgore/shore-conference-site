// Reads and checks the two template sheets in templates/. No page or file access here, so tests can run it.

export const documentTypes = ['Alignment', 'Tournament regulations', 'Bracket', 'Entry form', 'Governance', 'Leadership', 'Award', 'Other'];
export const seasons = ['Fall', 'Winter', 'Spring'];

// A CSV file as a list of rows keyed by the header row. Handles quoted cells, commas and line breaks inside quotes.
export function parseCsv(text) {
  const rows = [[]];
  let cell = '', quoted = false;
  const source = text.replace(/^﻿/, '');
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { rows.at(-1).push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      rows.at(-1).push(cell); cell = ''; rows.push([]);
    } else cell += char;
  }
  rows.at(-1).push(cell);
  const [header, ...body] = rows.filter(row => row.some(value => value.trim()));
  if (!header) return [];
  const keys = header.map(key => key.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map((row, index) => Object.fromEntries([['line', index + 2], ...keys.map((key, column) => [key, (row[column] || '').trim()])]));
}

const validSchoolYear = value => /^\d{4}-\d{2}$/.test(value) && Number(value.slice(5)) === (Number(value.slice(0, 4)) + 1) % 100;

// Problems in a filled document sheet, one sentence each. files: the PDF names found in the upload folder.
// existing: addresses already on the site.
export function checkDocuments(rows, files, existing = []) {
  const problems = [];
  const seen = new Set();
  if (!rows.length) problems.push('The sheet has no rows.');
  for (const row of rows) {
    const say = text => problems.push('Row ' + row.line + ': ' + text);
    for (const key of ['title', 'type', 'school_year', 'file', 'description']) if (!row[key]) say(key + ' is empty.');
    if (row.type && !documentTypes.includes(row.type)) say('type "' + row.type + '" is not one of: ' + documentTypes.join(', ') + '.');
    if (row.school_year && !validSchoolYear(row.school_year)) say('school_year "' + row.school_year + '" should look like 2027-28.');
    if (row.file) {
      if (!/^[\w.-]+\.pdf$/.test(row.file) || row.file.includes('..')) say('file "' + row.file + '" must be a PDF named with only letters, numbers, dots, dashes and underscores.');
      else if (!files.includes(row.file)) say('file "' + row.file + '" is not in the folder.');
      const url = 'assets/documents/' + row.school_year + '/' + row.file;
      if (seen.has(url)) say('file "' + row.file + '" is listed twice for ' + row.school_year + '.');
      if (existing.includes(url)) say('file "' + row.file + '" is already on the site for ' + row.school_year + '.');
      seen.add(url);
    }
  }
  return problems;
}

// Problems in a filled alignment sheet. schools: directory slug -> school name.
export function checkAlignment(rows, schools) {
  const problems = [];
  const names = new Map(Object.entries(schools).flatMap(([slug, name]) => [[slug, slug], [name.toLowerCase(), slug]]));
  const placed = new Map();
  if (!rows.length) problems.push('The sheet has no rows.');
  for (const row of rows) {
    const say = text => problems.push('Row ' + row.line + ': ' + text);
    for (const key of ['school_year', 'season', 'sport', 'division', 'school']) if (!row[key]) say(key + ' is empty.');
    if (row.school_year && !validSchoolYear(row.school_year)) say('school_year "' + row.school_year + '" should look like 2027-28.');
    if (row.season && !seasons.includes(row.season)) say('season "' + row.season + '" should be Fall, Winter or Spring.');
    if (row.gender && !['Boys', 'Girls'].includes(row.gender)) say('gender "' + row.gender + '" should be Boys, Girls or blank.');
    const slug = names.get((row.school || '').toLowerCase());
    if (row.school && !slug) say('school "' + row.school + '" is not in the school directory.');
    if (slug) {
      const team = [row.school_year, row.season, row.sport, row.gender].join(' ');
      const key = team + '|' + slug;
      if (placed.has(key)) say(schools[slug] + ' is already in ' + placed.get(key) + ' for ' + team.trim() + '.');
      else placed.set(key, row.division);
    }
  }
  return problems;
}

// The checked alignment as teams, each with its divisions and school slugs, for the preview.
export function alignmentTeams(rows, schools) {
  const names = new Map(Object.entries(schools).flatMap(([slug, name]) => [[slug, slug], [name.toLowerCase(), slug]]));
  const teams = new Map();
  for (const row of rows) {
    const label = [row.school_year, row.season, row.gender, row.sport].filter(Boolean).join(' ');
    if (!teams.has(label)) teams.set(label, {});
    (teams.get(label)[row.division] ||= []).push(names.get(row.school.toLowerCase()));
  }
  return [...teams].map(([label, divisions]) => ({ label, divisions }));
}
