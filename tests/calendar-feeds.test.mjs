// Exercises calendar feed identity, matching, publication and iCalendar interoperability.
import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSchedule, buildCalendar, parseOptions } from '../supabase/functions/public-calendar/calendar.mjs';

const schools = [
  { slug: 'marlboro', name: 'Marlboro', is_conference_member: true, schedule_published: true },
  { slug: 'colts-neck', name: 'Colts Neck', is_conference_member: true, schedule_published: true },
  { slug: 'shore-regional', name: 'Shore Regional', is_conference_member: true, schedule_published: false },
];
const home = {
  id: 'game-one', school_id: 'marlboro', team_id: 'team-one', game_date: '2026-11-09', start_time: '15:45:00',
  home_away: 'Home', opponent_school_id: 'colts-neck', opponent_name: null, location: 'Marlboro Turf',
  status: 'Scheduled', revision: 1, updated_at: '2026-11-06T12:00:00Z', notes: 'Arrive early.',
  teams: { sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall' },
  transportation: { bus_departure: '14:00:00', pickup_location: 'School lot', return_time: '19:00:00',
    early_dismissal_time: '13:15:00', notes: 'PRIVATE', bus_confirmed: false },
};
const away = { ...home, id: 'game-two', school_id: 'colts-neck', home_away: 'Away', opponent_school_id: 'marlboro' };
const options = { scope: 'school', school: 'marlboro' };
const project = (games, opts = options, directory = schools) => publicSchedule(directory, games, opts);

test('rescheduling updates the same UID and sequence, with Eastern daylight-saving timezone', () => {
  const before = buildCalendar(project([home]));
  const after = buildCalendar(project([{ ...home, revision: 2, game_date: '2027-03-15', start_time: '16:30:00' }]));
  assert.match(before, /UID:school-game-one@shore-calendar/);
  assert.match(after, /UID:school-game-one@shore-calendar/);
  assert.match(after, /SEQUENCE:2\r\n/);
  assert.match(before, /DTSTART;TZID=America\/New_York:20261109T154500/);
  assert.match(after, /DTSTART;TZID=America\/New_York:20270315T163000/);
  assert.match(after, /RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU/);
  assert.match(after, /RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU/);
});

test('early dismissal appears on the owning school calendar and feed only when entered', () => {
  const schoolSchedule = project([home]);
  assert.equal(schoolSchedule.events[0].transportation.early_dismissal_time, '13:15:00');
  assert.match(buildCalendar(schoolSchedule), /Early dismissal: 1:15 PM ET/);

  const noEarlyDismissal = project([{ ...home, transportation: { ...home.transportation, early_dismissal_time: null } }]);
  assert.equal(Object.hasOwn(noEarlyDismissal.events[0].transportation, 'early_dismissal_time'), false);
  assert.doesNotMatch(buildCalendar(noEarlyDismissal), /Early dismissal/);

  const conferenceSchedule = project([home, away], { scope: 'conference' });
  assert.equal(Object.hasOwn(conferenceSchedule.events[0], 'transportation'), false);
  assert.doesNotMatch(buildCalendar(conferenceSchedule), /Early dismissal/);
});

test('cancellation and postponement preserve event identity', () => {
  const canceled = buildCalendar(project([{ ...home, status: 'Canceled', revision: 3 }]));
  assert.match(canceled, /UID:school-game-one@shore-calendar/);
  assert.match(canceled, /STATUS:CANCELLED/);
  const postponed = buildCalendar(project([{ ...home, status: 'Postponed' }]));
  assert.match(postponed, /STATUS:TENTATIVE/);
  assert.match(postponed, /Postponed/);
});

test('TBD game times appear as all-day entries in school feeds', () => {
  const schedule = project([{ ...home, start_time: null }]);
  assert.equal(schedule.events[0].start, '2026-11-09');
  assert.doesNotMatch(schedule.events[0].title, / · TBD/);
  const ics = buildCalendar(schedule);
  assert.match(ics, /DTSTART;VALUE=DATE:20261109\r\nDTEND;VALUE=DATE:20261110/);
  assert.match(ics, /SUMMARY:Girls Varsity Soccer vs\. Colts Neck · TBD/);
  assert.doesNotMatch(ics, /DTSTART;TZID=America\/New_York:20261109T/);
});

test('unpublished school returns an empty calendar without leaking game or bus fields', () => {
  const result = project([{ ...home, school_id: 'shore-regional' }], { scope: 'school', school: 'shore-regional' });
  assert.equal(result.published, false);
  assert.deepEqual(result.events, []);
  assert.doesNotMatch(buildCalendar(result), /BEGIN:VEVENT|Arrive early|School lot/);
});

test('conference requires two published members and exact mirrored entries, and keeps changed games', () => {
  const opts = { scope: 'conference' };
  assert.equal(project([home, away], opts).events.length, 1);
  for (const change of [
    { start_time: '16:00:00' }, { location: 'Another field' }, { game_date: '2026-11-10' },
    { home_away: 'Home' },
    { opponent_school_id: 'shore-regional' }, { teams: { ...away.teams, gender: 'Boys' } },
    { teams: { ...away.teams, level: 'JV' } }, { teams: { ...away.teams, sport: 'Tennis' } },
  ]) assert.equal(project([home, { ...away, ...change }], opts).events.length, 0);
  for (const status of ['Canceled', 'Postponed']) {
    for (const pair of [[home, { ...away, status }], [{ ...home, status }, away]]) {
      const events = project(pair, opts).events;
      assert.equal(events.length, 1);
      assert.equal(events[0].status, status);
      assert.ok(events[0].title.endsWith(' · ' + status));
    }
  }
  assert.equal(project([{ ...home, status: 'Postponed' }, { ...away, status: 'Canceled' }], opts).events[0].status, 'Canceled');
  assert.equal(project([home], opts).events.length, 0);
  assert.equal(project([home, away], opts, schools.map(s => ({ ...s, schedule_published: false }))).events.length, 0);
  assert.equal(project([{ ...home, start_time: null }, { ...away, start_time: null }], opts).events.length, 0);
});

test('conference omits all transportation; school projection omits staff-only fields', () => {
  const conference = JSON.stringify(project([home, away], { scope: 'conference' }));
  assert.doesNotMatch(conference, /14:00|School lot|19:00|13:15|PRIVATE|bus_confirmed|transportation/);
  const own = JSON.stringify(project([home]));
  assert.match(own, /School lot|13:15/);
  assert.doesNotMatch(own, /PRIVATE|bus_confirmed/);
  assert.doesNotMatch(JSON.stringify(project([home], { ...options, school: 'colts-neck' })), /School lot/);
});

test('duplicate school entries produce one conference event with a deterministic UID', () => {
  const games = [home, { ...home, id: 'home-duplicate' }, away, { ...away, id: 'away-duplicate' }];
  const first = project(games, { scope: 'conference' });
  const reversed = project(games.toReversed(), { scope: 'conference' });
  assert.equal(first.events.length, 1);
  assert.equal(reversed.events.length, 1);
  assert.equal(first.events[0].id, reversed.events[0].id);
});

test('team filters combine sport, gender, level and season without limiting calendar dates', () => {
  const games = [home, { ...home, id: 'boys', teams: { ...home.teams, gender: 'Boys' } },
    { ...home, id: 'future', game_date: '2027-11-10' }];
  const result = project(games, { ...options, sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall' });
  assert.deepEqual(result.events.map(e => e.id), ['game-one', 'future']);
  assert.equal(project(games, { ...options, sport: 'Tennis' }).events.length, 0);
});

test('calendar text cannot inject properties and physical lines respect 75 UTF-8 octets', () => {
  const text = 'Field, 1; East\\West\r\nBEGIN:VEVENT\n' + 'é🏈'.repeat(80);
  const ics = buildCalendar(project([{ ...home, location: text }]));
  assert.equal((ics.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length, 1);
  assert.match(ics.replace(/\r\n /g, ''), /LOCATION:Field\\, 1\\; East\\\\West\\nBEGIN:VEVENT\\n/);
  for (const line of ics.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
});

test('invalid scopes, extra parameters and malformed selectors are rejected', () => {
  assert.throws(() => parseOptions(new URL('https://example.org/?scope=staff')));
  assert.throws(() => parseOptions(new URL('https://example.org/?scope=school')));
  assert.throws(() => parseOptions(new URL('https://example.org/?school=marlboro&select=*')));
  assert.throws(() => parseOptions(new URL('https://example.org/?school=marlboro&school=colts-neck')));
  assert.throws(() => parseOptions(new URL('https://example.org/?school=marlboro&gender=unknown')));
  assert.equal(parseOptions(new URL('https://example.org/?school=marlboro&sport=Ice%20Hockey')).sport, 'Ice Hockey');
});
