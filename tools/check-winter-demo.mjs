// Checks the fictional winter season on the public test calendar and subscription feeds.
import assert from 'node:assert/strict';

const base = process.argv[2];
if (!base || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/functions\/v1\/public-calendar$/.test(base)) {
  throw new Error('Pass the test project public-calendar URL.');
}
const schools = ['marlboro', 'colts-neck', 'howell', 'manalapan', 'freehold-township', 'freehold-boro'];

async function get(query) {
  const response = await fetch(base + '?' + query, { signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200, `${query}: HTTP ${response.status}`);
  return response;
}

for (const school of [...schools, 'conference']) {
  const query = school === 'conference' ? 'scope=conference' : 'school=' + school;
  const data = await (await get(query + '&format=json')).json();
  const demo = data.events.filter(event => event.title.startsWith('[DEMO] '));
  assert.equal(demo.length, school === 'conference' ? 300 : 116, school);
  assert.ok(demo.every(event => event.notes.startsWith('DEMO ONLY:')), school);
  if (school === 'conference') assert.ok(demo.every(event => !event.transportation));
  const ics = await (await get(query + '&format=ics')).text();
  assert.equal((ics.match(/SUMMARY:\[DEMO\] /g) || []).length, demo.length, school + ' ICS');
  console.log(`${school}: ${data.events.length} events, ${demo.length} labeled demo events`);
}
