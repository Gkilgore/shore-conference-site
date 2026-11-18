// Refreshes the NJSIAA school snapshot and a site-admin import file by hand.
import { writeFile } from 'node:fs/promises';

const base = 'https://www.njsiaa.org/schools/member-information';
const entity = text => text.replace(/&(#\d+|#x[0-9a-f]+|amp|quot|apos|lt|gt|nbsp);/gi, (_, value) => {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.startsWith('#x') ? String.fromCodePoint(parseInt(value.slice(2), 16))
    : value.startsWith('#') ? String.fromCodePoint(Number(value.slice(1)))
      : named[value.toLowerCase()] ?? _;
});
const plain = html => entity(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
const field = (html, className) => plain(html.match(new RegExp(
  '<span class="' + className + '">([\\s\\S]*?)<\\/span>'))?.[1] ?? '');
const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const rows = [];

for (let page = 0; page < 100; page++) {
  const response = await fetch(base + (page ? '?page=' + page : ''));
  if (!response.ok) throw new Error('NJSIAA page ' + (page + 1) + ': HTTP ' + response.status);
  const html = await response.text();
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1];
  if (!body) throw new Error('NJSIAA table missing on page ' + (page + 1));
  const items = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) => {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(match => match[1]);
    const name = plain(cells[0] ?? '');
    const addressCell = cells[1] ?? '';
    const street = [field(addressCell, 'address-line1'), field(addressCell, 'address-line2')]
      .filter(Boolean).join(', ');
    const city = field(addressCell, 'locality');
    const region = field(addressCell, 'administrative-area');
    const postal = field(addressCell, 'postal-code');
    const address = [street, [city, region, postal].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return { name, address };
  }).filter(item => item.name);
  if (!items.length) throw new Error('NJSIAA page ' + (page + 1) + ' had no schools');
  rows.push(...items);
  if (!/rel="next"/.test(html)) break;
  if (page === 99) throw new Error('NJSIAA pagination exceeded 100 pages');
}

const unique = new Set();
for (const item of rows) {
  if (!item.address || !slug(item.name) || unique.has(slug(item.name))) {
    throw new Error('Missing address or duplicate school: ' + item.name);
  }
  unique.add(slug(item.name));
}
rows.sort((a, b) => a.name.localeCompare(b.name));
const importRows = rows.map(item => ({ ...item, slug: slug(item.name) }));
await writeFile(new URL('../data/njsiaa-schools.json', import.meta.url),
  JSON.stringify(rows, null, 2) + '\n');
await writeFile(new URL('../data/njsiaa-import.json', import.meta.url),
  JSON.stringify(importRows, null, 2) + '\n');
console.log('Saved ' + rows.length + ' NJSIAA schools and import rows.');
