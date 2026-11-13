// Sends a saved school's scheduled bus details to its transportation contact.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, apikey, Content-Type, x-client-info, x-supabase-api-version',
  'Cache-Control': 'no-store',
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function time(value) {
  if (!value) return 'Not specified';
  const [hour, minute] = value.split(':').map(Number);
  return (hour % 12 || 12) + ':' + String(minute).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM') + ' ET';
}

function date(value) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value + 'T12:00:00Z'));
}

async function idempotencyKey(message) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(message)));
  return 'shore-bus-' + [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export function createHandler({
  supabaseUrl, publishableKey, resendApiKey, fromAddress, fetcher = fetch,
}) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json(405, { error: 'Use POST to send a transportation email.' });

    const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!token) return json(401, { error: 'Sign in to send a transportation email.' });

    let body;
    try { body = await request.json(); }
    catch { return json(400, { error: 'Send a valid game ID.' }); }
    if (!body || Object.keys(body).some(key => key !== 'game_id') ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.game_id ?? '')) {
      return json(400, { error: 'Send a valid game ID.' });
    }

    if (!supabaseUrl || !publishableKey || !resendApiKey || !fromAddress) {
      return json(503, { error: 'Automatic transportation email is not configured yet.' });
    }

    const databaseHeaders = { apikey: publishableKey, Authorization: 'Bearer ' + token };
    async function readRows(table, filters, columns = '*') {
      const url = new URL('/rest/v1/' + table, supabaseUrl);
      url.searchParams.set('select', columns);
      for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
      const response = await fetcher(url, { headers: databaseHeaders, signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Schedule information could not be checked.');
      return response.json();
    }

    try {
      const authResponse = await fetcher(new URL('/auth/v1/user', supabaseUrl), {
        headers: databaseHeaders, signal: AbortSignal.timeout(10000),
      });
      if (!authResponse.ok) return json(401, { error: 'Your sign-in has expired. Sign in again.' });
      const user = await authResponse.json();
      if (!user.email || !user.email_confirmed_at) return json(403, { error: 'Use your verified staff email to send transportation details.' });

      const invitations = await readRows('users', { email: 'eq.' + user.email }, 'role,school_id');
      const invitation = invitations[0];
      if (!invitation || !['ad', 'site_admin'].includes(invitation.role)) {
        return json(403, { error: 'Only an AD or site admin can send the transportation email.' });
      }

      const games = await readRows('games', { id: 'eq.' + body.game_id }, 'id,school_id,team_id,game_date,start_time,home_away,status,location,opponent_school_id,opponent_name');
      const game = games[0];
      if (!game) return json(404, { error: 'This saved game could not be found.' });
      if (invitation.role === 'ad' && invitation.school_id !== game.school_id) {
        return json(403, { error: 'You cannot send another school’s transportation details.' });
      }
      if (game.status !== 'Scheduled') return json(200, { sent: false, skipped: true });

      const [transportRows, teams, schools, contacts] = await Promise.all([
        readRows('transportation', { game_id: 'eq.' + game.id }),
        readRows('teams', { id: 'eq.' + game.team_id }, 'sport,gender,level'),
        readRows('schools', { slug: 'eq.' + game.school_id }, 'name'),
        readRows('school_transportation_contacts', { school_id: 'eq.' + game.school_id }, 'email'),
      ]);
      const transport = transportRows[0];
      if (!transport?.bus_departure) return json(200, { sent: false, skipped: true });
      const contact = contacts[0]?.email;
      if (!contact) return json(409, { error: 'Add the school’s transportation contact email, then save the game again.' });
      if (!teams[0] || !schools[0]) throw new Error('School schedule information could not be checked.');

      const team = [teams[0].gender, teams[0].level, teams[0].sport].join(' ');
      const opponent = game.opponent_name || game.opponent_school_id || 'Opponent';
      const schoolName = schools[0].name;
      const subject = 'Scheduled bus · ' + schoolName + ' · ' + team + ' · ' + game.game_date;
      const message = {
        from: fromAddress,
        to: [contact],
        cc: [user.email],
        subject,
        text: [
          'Bus transportation details for ' + schoolName + '.',
          'This is an information email; no confirmation is needed.',
          '',
          'Game: ' + team + (game.home_away === 'Home' ? ' vs. ' : ' at ') + opponent,
          'Date: ' + date(game.game_date),
          'Start: ' + time(game.start_time),
          'Venue: ' + game.location,
          'Bus departure: ' + time(transport.bus_departure),
          'Pickup: ' + (transport.pickup_location || 'Not specified'),
          'Early dismissal: ' + time(transport.early_dismissal_time),
          'Return: ' + time(transport.return_time),
          ...(transport.notes ? ['Transportation notes: ' + transport.notes] : []),
        ].join('\n'),
      };
      const sent = await fetcher('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + resendApiKey, 'Content-Type': 'application/json',
          'Idempotency-Key': await idempotencyKey(message) },
        body: JSON.stringify(message),
        signal: AbortSignal.timeout(15000),
      });
      if (!sent.ok) return json(502, { error: 'The transportation email could not be sent. Save the game again to retry.' });
      return json(200, { sent: true });
    } catch {
      return json(503, { error: 'The transportation email could not be sent. Save the game again to retry.' });
    }
  };
}
