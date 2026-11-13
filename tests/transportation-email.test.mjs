// Checks authorization, saved bus details, and safe email delivery at the Edge Function boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/transportation-email/handler.mjs';

const config = {
  supabaseUrl: 'https://example.supabase.co',
  publishableKey: 'sb_publishable_test',
  resendApiKey: 're_test',
  fromAddress: 'schedules@example.org',
};
const game = {
  id: '497f6eca-6276-4993-bfeb-53cbbbba6f08', school_id: 'marlboro',
  team_id: 'c58c5dd0-0058-4a14-9de6-e1eb48e5a80a', game_date: '2031-09-01',
  start_time: '15:00:00', home_away: 'Away', status: 'Scheduled',
  location: 'Marlboro field', opponent_name: 'Visitor',
};

function request(body = { game_id: game.id }, token = 'staff-token') {
  return new Request('https://example.org/functions/v1/transportation-email', {
    method: 'POST',
    headers: token ? { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function backend(overrides = {}) {
  const sent = [];
  const calls = [];
  const fetcher = async (input, options = {}) => {
    const url = new URL(input);
    calls.push(url.pathname);
    if (url.pathname === '/auth/v1/user') return Response.json({ email: 'ad@marlboro.example.org', email_confirmed_at: '2031-01-01' });
    if (url.pathname === '/rest/v1/users') return Response.json([{ role: 'ad', school_id: 'marlboro' }]);
    if (url.pathname === '/rest/v1/games') return Response.json([overrides.game ?? game]);
    if (url.pathname === '/rest/v1/transportation') return Response.json([overrides.transport ?? {
      bus_departure: '14:00:00', pickup_location: 'Gym lot', return_time: '19:00:00',
      early_dismissal_time: '13:15:00', notes: 'Use the north entrance.',
    }]);
    if (url.pathname === '/rest/v1/teams') return Response.json([{ sport: 'Soccer', gender: 'Girls', level: 'Varsity' }]);
    if (url.pathname === '/rest/v1/schools') return Response.json([{ name: 'Marlboro' }]);
    if (url.pathname === '/rest/v1/school_transportation_contacts') {
      return Response.json(overrides.contacts ?? [{ email: 'dispatch@bus.example.org' }]);
    }
    if (url.hostname === 'api.resend.com') {
      sent.push({ headers: options.headers, body: JSON.parse(options.body) });
      return overrides.resendResponse ?? Response.json({ id: 'email-1' });
    }
    throw new Error('Unexpected request to ' + url.href);
  };
  return { handler: createHandler({ ...config, ...overrides, fetcher }), calls, sent };
}

test('a saved scheduled bus emails the saved contact and copies the verified AD', async () => {
  const { handler, sent } = backend();
  const response = await handler(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { sent: true });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].body.to, ['dispatch@bus.example.org']);
  assert.deepEqual(sent[0].body.cc, ['ad@marlboro.example.org']);
  assert.match(sent[0].body.text, /Bus departure: 2:00 PM ET/);
  assert.match(sent[0].body.text, /Early dismissal: 1:15 PM ET/);
  assert.match(sent[0].body.text, /no confirmation is needed/i);
});

test('repeat sends use the same provider idempotency key', async () => {
  const { handler, sent } = backend();
  await handler(request());
  await handler(request());
  assert.equal(sent.length, 2);
  assert.equal(sent[0].headers['Idempotency-Key'], sent[1].headers['Idempotency-Key']);
});

test('postponed games and games without a bus departure are skipped', async () => {
  const noBus = backend({ transport: { bus_departure: null } });
  assert.deepEqual(await (await noBus.handler(request())).json(), { sent: false, skipped: true });
  assert.equal(noBus.sent.length, 0);

  const postponed = backend({ game: { ...game, status: 'Postponed' } });
  assert.deepEqual(await (await postponed.handler(request())).json(), { sent: false, skipped: true });
  assert.equal(postponed.sent.length, 0);
});

test('ADs cannot email another school and recipients cannot be supplied by the browser', async () => {
  const otherSchool = backend({ game: { ...game, school_id: 'colts-neck' } });
  assert.equal((await otherSchool.handler(request())).status, 403);
  const forgedRecipient = backend();
  assert.equal((await forgedRecipient.handler(request({ game_id: game.id, to: 'attacker@example.org' }))).status, 400);
  assert.equal(forgedRecipient.sent.length, 0);
});

test('missing contact and delivery configuration are reported without sending', async () => {
  const missingContact = backend({ contacts: [] });
  assert.equal((await missingContact.handler(request())).status, 409);
  assert.equal(missingContact.sent.length, 0);

  const missingConfig = createHandler({ ...config, resendApiKey: '', fetcher: async () => { throw new Error('unexpected'); } });
  assert.equal((await missingConfig(request())).status, 503);
});

test('authentication, method and email-provider failures are explicit', async () => {
  const { handler } = backend();
  assert.equal((await handler(request({}, null))).status, 401);
  assert.equal((await handler(new Request('https://example.org', { method: 'GET' }))).status, 405);

  const providerFailure = backend({ resendResponse: new Response('provider detail', { status: 500 }) });
  const response = await providerFailure.handler(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Save the game again to retry/);
});
