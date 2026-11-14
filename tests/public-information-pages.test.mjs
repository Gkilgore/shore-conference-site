// Tests Home and the Information page (resources.html): labels, old addresses, and the About and History copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const mastheadPages = ['index', 'resources', 'archive', 'calendar', 'admin', 'school', 'schools', 'subscribe', 'tournament'];
// One tab's markup: from its opening tag to the next panel.
const panel = (html, id) => {
  const start = html.indexOf('id="' + id + '"');
  assert.ok(start > 0, id + ' panel exists');
  const end = html.indexOf('<section class="panel', start);
  return html.slice(start, end < 0 ? undefined : end);
};

test('home stays focused on schools and schedules', () => {
  const home = read('index.html');
  assert.doesNotMatch(home, /Conference resources|id="resources-title"/);
  assert.match(home, /Find your school/);
  assert.match(home, /View calendar/);
  assert.match(home, /id="upcoming"/);
});
test('resources urls are labeled Information in every masthead', () => {
  for (const name of mastheadPages) {
    const page = read(name + '.html');
    assert.match(page, /href="resources\.html"[^>]*>Information<\/a>/, name);
    assert.doesNotMatch(page, /href="resources\.html"[^>]*>Resources<\/a>/, name);
  }
  const page = read('resources.html');
  assert.match(page, /<title>Information \| The Shore Conference<\/title>/);
  assert.match(page, /<h1>Information<\/h1>/);
  assert.match(page, /aria-label="Conference information"/);
});
test('old addresses keep their Information panel targets', () => {
  for (const [page, target] of [['about', 'resources.html'], ['divisions', 'resources.html#divisions'],
    ['tournaments', 'resources.html#tournaments'], ['inside', 'resources.html#documents']]) {
    const html = read(page + '.html');
    assert.ok(html.includes('url=' + target + '"'), page);
    assert.match(html, /is now under Information\./, page);
    assert.doesNotMatch(html, /Resources/, page);
  }
});
