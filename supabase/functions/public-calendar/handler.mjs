// Handles read-only public calendar requests and one consistent server-side data projection.
import { parseOptions, publicSchedule, buildCalendar } from './calendar.mjs';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };

export function createHandler(load) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Calendar requests must use GET.', { status: 405, headers: { ...cors, Allow: 'GET, HEAD, OPTIONS' } });
    }
    let options;
    try { options = parseOptions(new URL(request.url)); }
    catch (error) { return new Response(error.message, { status: 400, headers: cors }); }
    try {
      const { schools, games, seasons = [], updates = [] } = await load(options);
      if (options.school && !schools.some(school => school.slug === options.school)) {
        return new Response('School not found.', { status: 404, headers: cors });
      }
      const schedule = { ...publicSchedule(schools, games, options), seasons, updates };
      const json = options.format === 'json';
      const body = json ? JSON.stringify(schedule) : buildCalendar(schedule);
      return new Response(request.method === 'HEAD' ? null : body, {
        headers: { ...cors, 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/calendar; charset=utf-8',
          ...(!json ? { 'Content-Disposition': (options.download ? 'attachment' : 'inline') + '; filename="shore-calendar.ics"' } : {}) },
      });
    } catch {
      return new Response('The schedule could not be loaded. Please try again later.', { status: 503, headers: cors });
    }
  };
}

export function databaseLoader(base, key) {
  return async options => {
    const url = new URL('/rest/v1/rpc/read_published_schedule', base);
    const response = await fetch(url, {
      method: 'POST',
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_school: options.scope === 'school' ? options.school : null }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Calendar data unavailable.');
    return response.json();
  };
}
