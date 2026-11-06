// Checks the public endpoint at its data boundary without contacting a live database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, databaseLoader } from '../supabase/functions/public-calendar/handler.mjs';
import { publicSchedule } from '../supabase/functions/public-calendar/calendar.mjs';

const schools = [{ slug: 'marlboro', name: 'Marlboro', schedule_published: false, is_conference_member: true }];
const request = query => new Request('https://example.org/public-calendar?' + query);

test('unpublished subscriptions are valid empty calendars, allowing clients to remove old events', async () => {
  const handle = createHandler(async () => ({ schools, games: [] }));
  const response = await handle(request('school=marlboro'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/calendar/);
  assert.doesNotMatch(await response.text(), /BEGIN:VEVENT/);
  const json = await handle(request('school=marlboro&format=json'));
  assert.equal((await json.json()).published, false);
});

test('bad selectors and write methods never reach the database', async () => {
  const handle = createHandler(() => { throw new Error('Must not read'); });
  assert.equal((await handle(request('scope=private'))).status, 400);
  assert.equal((await handle(new Request('https://example.org', { method: 'POST' }))).status, 405);
});

test('database failure returns an error, not an empty feed that would clear subscriptions', async () => {
  const handle = createHandler(() => { throw new Error('PRIVATE DATABASE DETAILS'); });
  const response = await handle(request('school=marlboro'));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE|BEGIN:VCALENDAR/);
});

test('download responses use an ICS attachment; unknown school returns 404', async () => {
  const handle = createHandler(async () => ({ schools, games: [] }));
  const response = await handle(request('school=marlboro&download=1'));
  assert.match(response.headers.get('content-disposition'), /attachment; filename="shore-calendar.ics"/);
  assert.equal((await handle(request('school=missing'))).status, 404);
});

test('the complete publication is read once without a 1000-row truncation', async t => {
  let calls=0;
  t.mock.method(globalThis,'fetch',async (url,request) => {
    calls++;
    assert.equal(url.pathname,'/rest/v1/rpc/read_published_schedule');
    assert.equal(request.method,'POST');
    assert.deepEqual(JSON.parse(request.body),{p_school:null});
    return Response.json({schools:[],games:Array.from({length:1500},(_,id)=>({id}))});
  });
  const data=await databaseLoader('https://example.org','server-only')({scope:'conference'});
  assert.equal(data.games.length,1500);
  assert.equal(calls,1);
});

test('public calendars use approved copies even when the working game is changed', async t => {
  const payload = { id: 'game-1', school_id: 'marlboro', team_id: 'team-1', game_date: '2031-09-01',
    start_time: '15:00:00', home_away: 'Home', opponent_name: 'Visitor', location: 'Main field',
    status: 'Scheduled', teams: { sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall' } };
  t.mock.method(globalThis, 'fetch', async url => {
    if (url.pathname.endsWith('/rpc/read_published_schedule')) return Response.json({
      schools:[{slug:'marlboro',name:'Marlboro',is_conference_member:true,schedule_published:true}],
      games:[{...payload,revision:2,updated_at:'2031-08-01T12:00:00Z'}],
    });
    if (Number(url.searchParams.get('offset'))) return Response.json([]);
    const table = url.pathname.split('/').at(-1);
    return Response.json({
      schools: [{ slug: 'marlboro', name: 'Marlboro', is_conference_member: true, schedule_published: false }],
      team_publications: [{ id: 'pub-1', school_id: 'marlboro', team_id: 'team-1', season_year: 2031 }],
      published_games: [{ id: 'game-1', school_id: 'marlboro', team_id: 'team-1', season_year: 2031,
        payload, revision: 2, updated_at: '2031-08-01T12:00:00Z' }],
      games: [{ ...payload, start_time: '18:00:00', revision: 3 }],
    }[table]);
  });
  const options = { scope: 'school', school: 'marlboro' };
  const data = await databaseLoader('https://example.org', 'server-only')(options);
  const calendar = publicSchedule(data.schools, data.games, options);
  assert.equal(calendar.published, true);
  assert.equal(calendar.events.length, 1);
  assert.equal(calendar.events[0].start, '2031-09-01T15:00:00');
  assert.equal(calendar.events[0].revision, 2);
});
