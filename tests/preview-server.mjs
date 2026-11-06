// Local-only visual QA server: uses fictional games and never connects to Supabase.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import vm from 'node:vm';
import { createHandler } from '../supabase/functions/public-calendar/handler.mjs';

const root = resolve(import.meta.dirname, '..');
const port = Number(process.env.SHORE_PREVIEW_PORT || 8001);
const origin = 'http://127.0.0.1:' + port;
const sandbox = vm.createContext({});
vm.runInContext(await readFile(resolve(root, 'data/sample-data.js'), 'utf8'), sandbox);
vm.runInContext(await readFile(resolve(root, 'data/school-directory.js'), 'utf8'), sandbox);
const data = vm.runInContext('({ schools: shoreSchools, games: sampleGames })', sandbox);
const schools = Object.entries(data.schools).map(([slug, school]) => ({ slug, name: school.name,
  is_conference_member: true, schedule_published: ['colts-neck', 'marlboro'].includes(slug) }));
const games = data.games.map((game, index) => ({ ...game, id: 'preview-' + index,
  school_id: game.school, updated_at: '2026-11-06T12:00:00Z', revision: 1,
  teams: { sport: game.sport, gender: game.gender, level: game.level, season: game.season } }));
const handle = createHandler(async () => ({ schools, games }));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    if (url.pathname === '/functions/v1/public-calendar') {
      const response = await handle(new Request(url, { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (url.pathname === '/js/supabase-config.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('const shoreSupabase = ' + JSON.stringify({ url: origin }) + ';');
      return;
    }
    const path = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep)) { res.writeHead(403); res.end(); return; }
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log('Fictional calendar preview: ' + origin + '/subscribe.html?school=marlboro'));
