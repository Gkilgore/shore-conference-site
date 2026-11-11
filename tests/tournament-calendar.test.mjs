// Verifies one approved tournament match across public calendars, feeds and bracket data.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import { publicSchedule, buildCalendar } from '../supabase/functions/public-calendar/calendar.mjs';
import { createHandler } from '../supabase/functions/public-calendar/handler.mjs';

const schools = [
  { slug: 'marlboro', name: 'Marlboro', schedule_published: false },
  { slug: 'colts-neck', name: 'Colts Neck', schedule_published: false },
  { slug: 'shore-regional', name: 'Shore Regional', schedule_published: false },
];
const match = {
  id: 'tournament-7f2d23ed-3c84-4ba7-854c-41dd7b834c53-r1m1',
  tournament_id: '7f2d23ed-3c84-4ba7-854c-41dd7b834c53', tournament_name: 'Spring Cup',
  match_id: 'r1m1', match_label: 'Semifinal 1', round: 1,
  game_date: '2027-04-10', start_time: '09:00', location: 'Main field', status: 'Scheduled',
  home_side: 'neutral', duration_minutes: 90, revision: 1, updated_at: '2027-04-01T12:00:00Z',
  a: { id: 'p1', name: 'Marlboro', school_id: 'marlboro' },
  b: { id: 'p2', name: 'Colts Neck', school_id: 'colts-neck' },
  teams: { sport: 'Softball', gender: 'Girls', level: 'Varsity', season: 'Spring' },
  transportation: { school_id: 'marlboro', bus_departure: '08:00', pickup_location: 'Marlboro lot',
    return_time: '12:00', notes: 'PRIVATE', bus_confirmed: true },
};
const conference = { scope: 'conference' };
const school = slug => ({ scope: 'school', school: slug });
const project = (matches = [match], options = conference) => publicSchedule(schools, [], options, matches);

test('one canonical match appears once on conference and both participating school calendars', () => {
  for (const options of [conference, school('marlboro'), school('colts-neck')]) {
    const result = project([match, structuredClone(match)], options);
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0].id, match.id);
    assert.equal(result.events[0].tournament_id, match.tournament_id);
    assert.equal(result.events[0].match_id, 'r1m1');
    assert.equal(result.published, true);
    assert.equal((buildCalendar(result).match(/BEGIN:VEVENT/g) || []).length, 1);
  }
  assert.equal(project([match], school('shore-regional')).events.length, 0);
});

test('school projection uses current confirmed participants and leaves TBD matches on conference calendar', () => {
  const changed = { ...match, b: { id: 'p3', name: 'Shore Regional', school_id: 'shore-regional' } };
  assert.equal(project([changed], school('colts-neck')).events.length, 0);
  assert.equal(project([changed], school('shore-regional')).events.length, 1);
  const unknown = { ...match, a: { id: null, name: 'Winner of Semifinal 1', school_id: null },
    b: { id: null, name: 'Winner of Semifinal 2', school_id: null } };
  assert.equal(project([unknown]).events.length, 1);
  assert.equal(project([unknown], school('marlboro')).events.length, 0);
  const partial = { ...unknown, a: match.a };
  assert.equal(project([partial], school('marlboro')).events.length, 1);
  assert.equal(project([partial], { ...conference, school: 'colts-neck' }).events.length, 0);
});

test('tournament team filters compare all fields exactly', () => {
  const exact = { ...conference, sport: 'Softball', gender: 'Girls', level: 'Varsity', season: 'Spring' };
  assert.equal(project([match], exact).events.length, 1);
  for (const [field, wrong] of Object.entries({ sport: 'softball', gender: 'Boys', level: 'JV', season: 'Fall' })) {
    assert.equal(project([match], { ...exact, [field]: wrong }).events.length, 0);
  }
});

test('tournament bus details stay on the owning school calendar and never expose staff fields', () => {
  const own = JSON.stringify(project([match], school('marlboro')));
  assert.match(own, /Marlboro lot/);
  assert.doesNotMatch(own, /PRIVATE|bus_confirmed|school_id/);
  for (const options of [conference, school('colts-neck')]) {
    const projected = project([match], options);
    assert.equal(projected.events.length, 1);
    assert.doesNotMatch(JSON.stringify(projected), /Marlboro lot|transportation|08:00/);
    assert.doesNotMatch(buildCalendar(projected), /Marlboro lot|Bus departure|Pickup|Return/);
  }
  assert.match(buildCalendar(project([match], school('marlboro'))), /Bus departure: 8:00 AM ET/);
});

test('tournament edits preserve feed UID and increase revision for school and conference subscriptions', () => {
  for (const options of [conference, school('marlboro')]) {
    const before = buildCalendar(project([match], options));
    const after = buildCalendar(project([{ ...match, revision: 3, game_date: '2027-04-12',
      updated_at: '2027-04-02T12:00:00Z' }], options));
    const uid = text => text.replace(/\r\n /g, '').match(/^UID:(.+)$/m)?.[1];
    assert.ok(uid(before));
    assert.equal(uid(before), uid(after));
    assert.match(after, /SEQUENCE:3\r\n/);
    assert.match(after, /DTSTART;TZID=America\/New_York:20270412T090000/);
  }
});

test('repeated Eastern hour uses the checked absolute instant in school and conference ICS', () => {
  const repeated = { ...match, game_date: '2027-11-07', start_time: '01:30', ics_start_utc: '20271107T063000Z' };
  for (const options of [conference, school('marlboro')]) {
    const calendar = buildCalendar(project([repeated], options));
    assert.match(calendar, /DTSTART:20271107T063000Z\r\n/);
    assert.doesNotMatch(calendar, /DTSTART;TZID=America\/New_York:20271107T013000/);
    assert.equal(project([repeated], options).events[0].start, '2027-11-07T01:30');
  }
});

test('canceled, postponed and completed tournament matches retain identity and public status', () => {
  for (const [status, icsStatus] of [['Canceled', 'CANCELLED'], ['Postponed', 'TENTATIVE'],
    ['Final', 'CONFIRMED'], ['Forfeit', 'CONFIRMED']]) {
    const schedule = project([{ ...match, status }]);
    assert.equal(schedule.events.length, 1);
    assert.equal(schedule.events[0].status, status);
    assert.equal(schedule.events[0].id, match.id);
    assert.match(buildCalendar(schedule), new RegExp('STATUS:' + icsStatus));
  }
});

test('public JSON includes approved bracket documents while ICS includes only scheduled event fields', async () => {
  const document = { name: 'Approved cup', matches: [{ id: 'r1m1' }, { id: 'other-root' }] };
  const handle = createHandler(async () => ({ schools, games: [], tournament_games: [match],
    tournaments: [{ id: match.tournament_id, document }] }));
  const response = await handle(new Request('https://example.org/?format=json'));
  const body = await response.json();
  assert.equal(body.events.length, 1);
  assert.deepEqual(body.tournaments, [{ id: match.tournament_id, document }]);
  const feed = await (await handle(new Request('https://example.org/'))).text();
  assert.doesNotMatch(feed, /other-root|Approved cup/);
});

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  set innerHTML(value) { throw new Error('Unsafe HTML insertion ' + value); }
}

function bracketContext() {
  const source = new URL('../js/tournament-public.js', import.meta.url);
  const context = vm.createContext({ document: { getElementById: () => null, createElement: tag => new Element(tag) } });
  if (existsSync(source)) vm.runInContext(readFileSync(source, 'utf8'), context);
  return context;
}

test('public bracket renders every approved root and result through safe DOM text', () => {
  const context = bracketContext();
  assert.equal(typeof context.renderPublicTournament, 'function');
  const target = new Element();
  context.renderPublicTournament({
    participants: [
      { id: 'p1', name: '<img src=x onerror=bad()>', school_id: 'marlboro', seed: 1 },
      { id: 'p2', name: 'Guest', seed: 2 },
    ],
    matches: [
      { id: 'one', round: 1, label: 'Semifinal', a: { participant_id: 'p1' }, b: { participant_id: 'p2' },
        status: 'Final', winner_id: 'p1', score_a: 3, score_b: 1, game_date: '2027-04-10', start_time: '09:00', venue: '<script>venue()</script>' },
      { id: 'separate-root', round: 1, label: 'Other branch', a: { participant_id: 'p1' }, b: { participant_id: 'p2' }, status: 'Postponed' },
      { id: 'final', round: 2, label: 'Championship', a: { winner_of: 'one' }, b: { winner_of: 'separate-root' },
        status: 'Scheduled', resolved_a: 'p1', resolved_b: null },
    ],
  }, target);
  const output = JSON.stringify(target);
  assert.match(output, /match-one/);
  assert.match(output, /match-separate-root/);
  assert.match(output, /match-final/);
  assert.match(output, /<img src=x onerror=bad\(\)>/);
  assert.match(output, /<script>venue\(\)<\/script>/);
  assert.match(output, /Winner of Other branch/);
  assert.match(output, /school\.html\?school=marlboro/);
  assert.match(output, /Winner/);
  assert.doesNotMatch(output, /transportation|bus_confirmed/);
});

test('public bracket has a clear empty state', () => {
  const context = bracketContext();
  assert.equal(typeof context.renderPublicTournament, 'function');
  const target = new Element();
  context.renderPublicTournament({ matches: [], participants: [] }, target);
  assert.match(JSON.stringify(target), /No matches have been published/);
});

// The bracket link is switched off for now. When it comes back, the first assertion goes back to false.
test('calendar game details keep the bracket link hidden while tournament pages are switched off', () => {
  const link = new Element('a');
  const heading = new Element('h2');
  const list = new Element('dl');
  const dialog = new Element('dialog');
  Object.defineProperty(dialog, 'innerHTML', { set() {} });
  dialog.querySelector = selector => selector === 'h2' ? heading : selector === 'dl' ? list : link;
  dialog.showModal = () => {};
  const context = vm.createContext({
    document: { createElement: tag => tag === 'dialog' ? dialog : new Element(tag) },
    matchMedia: () => ({ matches: false }),
  });
  vm.runInContext(readFileSync(new URL('../js/calendar.js', import.meta.url), 'utf8'), context);
  const show = context.createGameDetails({ after() {} });
  show({ title: 'Spring Cup', start: new Date('2027-04-10T13:00:00Z'),
    extendedProps: { tournament_id: match.tournament_id, match_id: 'r1m1' } });
  assert.equal(link.hidden, true);
  assert.equal(link.href, 'tournament.html?id=' + match.tournament_id + '#match-r1m1');
  show({ title: 'Regular game', extendedProps: {} });
  assert.equal(link.hidden, true);
});

test('bracket page reads only the published conference response and opens the requested match', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  let request, scrolled = false;
  element('match-r1m1').scrollIntoView = () => { scrolled = true; };
  const context = vm.createContext({
    document: { title: '', getElementById: element, createElement: tag => new Element(tag) },
    location: { search: '?id=' + match.tournament_id, hash: '#match-r1m1' }, URLSearchParams,
    loadPublicCalendar: async options => {
      request = options;
      return { tournaments: [{ id: match.tournament_id, document: { name: 'Approved Cup',
        sport: 'Softball', gender: 'Girls', level: 'Varsity', season: 'Spring', season_year: 2027, matches: [], participants: [] } }] };
    },
  });
  vm.runInContext(readFileSync(new URL('../js/tournament-public.js', import.meta.url), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.scope, 'conference');
  assert.equal(element('tournament-title').textContent, 'Approved Cup');
  assert.equal(context.document.title, 'Approved Cup | The Shore Conference');
  assert.equal(scrolled, true);
});
