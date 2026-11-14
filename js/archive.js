// Draws a saved conference page (tables and text) from data/archived-resources.js on archive.html.

// Clear typos in the saved pages, corrected when a page is shown. The saved text itself stays as captured.
const archiveTypoFixes = [
  ['TRINTIY HALL', 'TRINITY HALL'],
  ['Boy’s Lacrosse', 'Boys’ Lacrosse'],
  ['B/T Winter Track', 'B/G Winter Track'],
  ['B Soccer Josh Mehl', 'B Soccer – Josh Mehl'],
  ['Boys’ Volleyball- ', 'Boys’ Volleyball – '],
  ['Boys Basketball - ', 'Boys Basketball – '],
];
function fixArchivedText(text) {
  return archiveTypoFixes.reduce((out, [wrong, right]) => out.split(wrong).join(right), text);
}

(() => {
  const content = typeof document === 'undefined' ? null : document.getElementById('archive-content');
  if (!content) return;
  const key = new URLSearchParams(location.search).get('page') || '';
  const page = Object.hasOwn(archivedResources, key) ? archivedResources[key] : null;
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  if (!page) {
    content.replaceChildren(node('p', 'This saved list was not found. Browse the division lists instead.'));
    return;
  }
  let corrected = false;
  const fix = text => {
    const fixed = fixArchivedText(text);
    if (fixed !== text) corrected = true;
    return fixed;
  };

  const parts = [];
  for (const rows of page.tables) {
    const filled = rows.filter(row => row.some(cell => cell.text.trim()));
    if (!filled.length) continue;
    const table = node('table', '', 'archive-table');
    filled.forEach((row, index) => {
      const line = document.createElement('tr');
      for (const cell of row) {
        const item = node(index === 0 ? 'th' : 'td', fix(cell.text.trim()));
        if (cell.colspan > 1) item.colSpan = cell.colspan;
        line.append(item);
      }
      table.append(line);
    });
    const frame = node('div', '', 'archive-scroll');
    frame.append(table);
    parts.push(frame);
  }
  // Skip the old page's "PDF version" prompt and stray spreadsheet styles.
  const text = page.paragraphs.filter(line => line.trim() && !/PDF version/i.test(line) && !line.includes('{'));
  if (text.length) {
    const card = node('div', '', 'panel');
    card.append(...text.map(line => node('p', fix(line))));
    parts.push(card);
  }
  content.replaceChildren(...parts);

  // The page title comes from the resource record that links here.
  const href = 'archive.html?page=' + encodeURIComponent(key);
  const record = [...shoreConferenceResources.divisionLists, ...Object.values(shorePublicResources).flat()]
    .find(item => item.url === href);
  const title = record?.title || 'Saved list';
  document.getElementById('archive-title').textContent = title;
  document.title = title + ' | The Shore Conference';
  document.getElementById('archive-meta').textContent = 'Saved copy of the conference list' +
    (record?.reviewed ? ' · Checked ' + record.reviewed : '') + '.' + (corrected ? ' Typos corrected.' : '');
})();
