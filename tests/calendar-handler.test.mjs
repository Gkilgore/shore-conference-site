// Checks the public endpoint at its data boundary without contacting a live database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, readRows } from '../supabase/functions/public-calendar/handler.mjs';

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

test('database reads paginate rather than silently truncating a calendar at 1000 rows', async () => {
  const pages = [];
  const fetchPage = async url => {
    pages.push(url.searchParams.get('offset'));
    return new Response(JSON.stringify(url.searchParams.get('offset') === '0'
      ? Array.from({ length: 1000 }, (_, id) => ({ id })) : url.searchParams.get('offset') === '1000' ? [{ id: 1000 }] : []));
  };
  const rows = await readRows('https://example.org', 'server-only', 'games', 'id', {}, fetchPage);
  assert.equal(rows.length, 1001);
  assert.deepEqual(pages, ['0', '1000', '1001']);
});

test('a project row limit below 1000 does not truncate subscriptions', async () => {
  const fetchPage = async url => new Response(JSON.stringify(Number(url.searchParams.get('offset')) < 600
    ? Array.from({ length: 300 }, (_, id) => ({ id })) : []));
  assert.equal((await readRows('https://example.org', 'server-only', 'games', 'id', {}, fetchPage)).length, 600);
});
