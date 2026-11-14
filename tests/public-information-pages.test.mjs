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

const page = read('resources.html');
const visible = html => html.replace(/<!--[\s\S]*?-->/g, ''); // Notes to editors are not content.
const about = visible(panel(page, 'about'));
const history = visible(panel(page, 'history'));
test('About identifies the conference without overclaiming membership', () => {
  assert.match(about, /assets\/logos\/shore-conference\.svg/);
  assert.match(about, /founded in 1936/i);
  assert.match(about, /48 schools in this scheduling directory/i);
  assert.match(about, /Monmouth and Ocean counties/);
  assert.doesNotMatch(about, /theshoreconference\.com/i);
});
test('About next steps use stable internal destinations', () => {
  for (const href of ['schools.html', 'calendar.html', 'subscribe.html', '#documents', '#history']) {
    assert.ok(about.includes('href="' + href + '"'), href);
  }
});
test('History states its source scope and links the saved record', () => {
  assert.match(history, /1936 through 1969/i);
  assert.match(history, /assets\/documents\/HISTORY_OF_THE_SHORE_CONFERENCE\.pdf/);
  for (const id of ['history-1936', 'history-1950', 'history-1960']) {
    assert.ok(history.includes('href="#' + id + '"') && history.includes('id="' + id + '"'), id);
  }
});
test('Information panels carry no placeholders or images waiting on permission', () => {
  assert.doesNotMatch(about + history, /Photo to come|Caption:|photo-slot|<figure/i);
  assert.equal((about + history).match(/<img /g).length, 1, 'only the conference logo');
});
test('History retains selected verified milestones', () => {
  for (const fact of ['February 1936', 'Convention Hall', 'girls’ programs', 'four-division', '27 schools']) {
    assert.match(history, new RegExp(fact, 'i'));
  }
});
test('Information layouts use the shared design system', () => {
  const css = read('css/site.css');
  const rules = css.slice(css.indexOf('/* Information stories'), css.indexOf('/* End of Information stories'));
  for (const name of ['about-story', 'about-logo', 'about-facts', 'about-next', 'history-era', 'history-timeline']) {
    assert.ok(rules.includes('.' + name), name + ' is styled');
    assert.ok(page.includes(name), name + ' is used');
  }
  for (const variable of ['--red', '--steel', '--paper', '--frame']) assert.ok(rules.includes('var(' + variable + ')'), variable);
  assert.doesNotMatch(rules, /border-radius|box-shadow|border-(left|right|top|bottom)|#[0-9a-f]{3,6}\b|::(before|after)/i);
  for (const old of ['about-top', 'about-links', 'photo-slot', 'spread']) {
    assert.doesNotMatch(css + page + read('index.html'), new RegExp('\\.' + old + '\\b|class="[^"]*' + old), old + ' is gone');
  }
});
