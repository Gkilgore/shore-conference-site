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
  assert.match(home, /class="hero-copy">High school athletics grounded in education, sportsmanship and fair competition\.<\/p>/);
  assert.doesNotMatch(home, /home-history/);
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
test('About explains the revised constitution without treating the directory as membership', () => {
  for (const heading of ['Our mission', 'Guiding principles', 'Member schools', 'How the conference works', 'Official documents']) {
    assert.match(about, new RegExp(heading, 'i'));
  }
  assert.match(about, /full and affiliate/i);
  assert.match(about, /sport-specific/i);
  assert.match(about, /Revised June 2024/);
  assert.match(about, /assets\/documents\/SC_Constitution_2024_\.pdf/);
});
test('History is a short sourced list with the original record linked', () => {
  assert.match(history, /assets\/documents\/HISTORY_OF_THE_SHORE_CONFERENCE\.pdf/);
  assert.match(history, /class="archive-table history-athletes"/);
  assert.match(history, /<th scope="col">School<\/th>.*<th scope="col">Sport<\/th>/);
  assert.match(history, /class="history-timeline"/);
  assert.match(history, /<summary>Sources<\/summary>/);
  for (const name of ['Christie Pearce Rampone', 'Al Leiter', 'Frank Molinaro']) assert.ok(history.includes(name), name);
  assert.ok(!history.includes('Bob Verga'), 'St. Rose was not a member during his school years');
});
test('Information pages show no photos except the conference logo', () => {
  assert.doesNotMatch(about + history, /<figure/i);
  assert.equal((about + history).match(/<img /g).length, 1, 'only the conference logo');
});
test('History keeps its key verified milestones', () => {
  for (const fact of ['February 1936', 'girls’ sports', 'Four divisions', '27 schools']) {
    assert.match(history, new RegExp(fact, 'i'));
  }
});
test('History distinguishes founding from incorporation', () => {
  assert.match(history, /February 1936/);
  assert.match(history, /October 29, 1938/);
  assert.match(history, /SC_Constitution_2024_\.pdf/);
});
test('Information layouts use the shared design system', () => {
  const css = read('css/site.css');
  const rules = css.slice(css.indexOf('/* Information stories'), css.indexOf('/* End of Information stories'));
  for (const name of ['about-story', 'about-logo', 'about-facts', 'about-next', 'history-athletes', 'history-timeline']) {
    assert.ok(rules.includes('.' + name), name + ' is styled');
    assert.ok(page.includes(name), name + ' is used');
  }
  for (const variable of ['--red', '--steel', '--paper', '--frame']) assert.ok(rules.includes('var(' + variable + ')'), variable);
  assert.doesNotMatch(rules, /border-radius|box-shadow|border-(left|right|top|bottom)|#[0-9a-f]{3,6}\b|::(before|after)/i);
  for (const old of ['about-top', 'about-links', 'photo-slot', 'spread']) {
    assert.doesNotMatch(css + page + read('index.html'), new RegExp('\\.' + old + '\\b|class="[^"]*' + old), old + ' is gone');
  }
});
