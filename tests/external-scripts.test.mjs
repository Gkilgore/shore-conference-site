// Keeps fixed outside scripts integrity-checked on every public and staff page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const digests = new Map([
  ['https://cdn.jsdelivr.net/npm/fullcalendar@6.1.22/index.global.min.js',
    'sha384-a9qx08ufzJ+0qbHzdqA+GYiSayQQB5BK2YGS/HQT9cxhQm+GhiXFj1ByVXa93ZRR'],
  ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js',
    'sha384-uteMfOloLDGt042uDz+xHGF3ym63/WQ6rFq7murQRG8Ih7QrXGEGNtWd8688sb4O'],
  ['https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e'],
]);

test('fixed CDN scripts use their verified hashes and anonymous CORS', () => {
  let checked = 0;
  for (const name of readdirSync(root).filter(name => name.endsWith('.html'))) {
    const html = readFileSync(new URL(name, root), 'utf8');
    for (const [tag] of html.matchAll(/<script\b[^>]*\bsrc="https:\/\/cdn\.jsdelivr\.net\/[^\"]+"[^>]*><\/script>/g)) {
      const url = tag.match(/\bsrc="([^"]+)"/)?.[1];
      assert.ok(digests.has(url), `${name}: review new CDN script ${url}`);
      assert.ok(tag.includes(`integrity="${digests.get(url)}"`), `${name}: wrong or missing integrity for ${url}`);
      assert.match(tag, /\bcrossorigin="anonymous"/, `${name}: anonymous CORS required for ${url}`);
      checked++;
    }
  }
  assert.ok(checked >= 4, 'expected fixed CDN scripts on staff and calendar pages');
  const admin = readFileSync(new URL('admin.html', root), 'utf8');
  assert.match(admin, /pdfjs-dist@3\.11\.174\/build\/pdf\.min\.js/, 'staff PDF import needs the browser PDF.js script');
});
