// Handles read-only public calendar requests and paginated server-side data access.
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
      const { schools, games } = await load(options);
      if (options.school && !schools.some(school => school.slug === options.school)) {
        return new Response('School not found.', { status: 404, headers: cors });
      }
      const schedule = publicSchedule(schools, games, options);
      const json = options.format === 'json';
      const body = json ? JSON.stringify(schedule) : buildCalendar(schedule);
      return new Response(request.method === 'HEAD' ? null : body, {
        headers: { ...cors, 'Content-Type': json ? 'application/json; charset=utf-8' : 'text/calendar; charset=utf-8',
          ...(!json ? { 'Content-Disposition': (options.download ? 'attachment' : 'inline') + '; filename="shore-calendar.ics"' } : {}) },
      });
    } catch {
      // Never return an empty success feed on failure: apps could delete their saved events.
      return new Response('The schedule could not be loaded. Please try again later.', { status: 503, headers: cors });
    }
  };
}

export async function readRows(base, key, table, select, filters = {}, fetchPage = fetch) {
  const rows = [];
  for (let offset = 0; ;) {
    const url = new URL('/rest/v1/' + table, base);
    url.search = new URLSearchParams({ select, order: table === 'schools' ? 'slug' : 'id', limit: '1000', offset: String(offset), ...filters }).toString();
    const response = await fetchPage(url, { headers: { apikey: key, Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Calendar data unavailable.');
    const page = await response.json();
    rows.push(...page);
    if (!page.length) return rows;
    offset += page.length;
  }
}

export function databaseLoader(base, key) {
  return async options => {
    const schools = await readRows(base, key, 'schools', 'slug,name,is_conference_member,schedule_published');
    const published = schools.filter(school => school.schedule_published &&
      (options.scope === 'conference' || school.slug === options.school)).map(school => school.slug);
    if (!published.length) return { schools, games: [] };
    const games = await readRows(base, key, 'games',
      'id,school_id,game_date,start_time,opponent_school_id,opponent_name,home_away,location,status,notes,revision,updated_at,' +
      'teams!inner(sport,gender,level,season)' +
      (options.scope === 'school' ? ',transportation(bus_departure,pickup_location,return_time)' : ''),
      { school_id: 'in.(' + published.map(slug => JSON.stringify(slug)).join(',') + ')' });
    return { schools, games };
  };
}
