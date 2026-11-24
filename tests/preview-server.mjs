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
  is_conference_member: true, schedule_published: ['colts-neck', 'marlboro'].includes(slug),
  // The three sample schools are on the platform; the rest stand in for schools that opted out.
  on_platform: ['colts-neck', 'marlboro', 'shore-regional'].includes(slug) }));
const games = data.games.map((game, index) => ({ ...game, id: 'preview-' + index,
  school_id: game.school, updated_at: '2026-11-06T12:00:00Z', revision: 1,
  teams: { sport: game.sport, gender: game.gender, level: game.level, season: game.season } }));
vm.runInContext(await readFile(resolve(root, 'js/tournament-engine.js'), 'utf8'), sandbox);
const tournamentId = '7f2d23ed-3c84-4ba7-854c-41dd7b834c53';
const participants = ['marlboro', 'colts-neck', 'shore-regional', null].map((school, index) => ({
  id: 'p' + (index + 1), name: data.schools[school]?.name || 'Guest Academy', school_id: school, seed: index + 1,
}));
const tournament = sandbox.TournamentEngine.resolve(sandbox.TournamentEngine.schedule({
  name: 'Spring Cup · fictional', sport: 'Softball', gender: 'Girls', level: 'Varsity', season: 'Spring', season_year: 2027,
  duration_minutes: 90, turnaround_minutes: 15, rest_minutes: 60, participants,
  matches: sandbox.TournamentEngine.generateBracket(participants), windows: [],
}, [{ date: '2027-04-10', start: '09:00', end: '18:00', venue: 'Main field' }]).document);
const tournamentGames = tournament.matches.map(match => ({ ...match,
  id: 'tournament-' + tournamentId + '-' + match.id, tournament_id: tournamentId, tournament_name: tournament.name,
  match_id: match.id, match_label: match.label, location: match.venue, revision: 1, updated_at: '2026-11-09T12:00:00Z',
  teams: { sport: tournament.sport, gender: tournament.gender, level: tournament.level, season: tournament.season },
  ...Object.fromEntries(['a', 'b'].map(side => [side, participants.find(participant => participant.id === match['resolved_' + side]) || {
    id: null, school_id: null, name: 'Winner of ' + tournament.matches.find(source => source.id === match[side].winner_of)?.label,
  }])),
}));
// A second fictional bracket that carries real "Rules and dates" from the curated official sources.
vm.runInContext(await readFile(resolve(root, 'data/conference-resources.js'), 'utf8'), sandbox);
const soccerSource = vm.runInContext('shoreConferenceResources.tournamentSources[0]', sandbox);
const soccerId = '2b0e1c7a-5d7e-4a43-9a51-6f0c7b1d2e90';
const soccer = sandbox.TournamentEngine.resolve({
  name: 'Boys Soccer SCT · fictional bracket', sport: 'Soccer', gender: 'Boys', level: 'Varsity', season: 'Fall', season_year: 2026,
  duration_minutes: 90, turnaround_minutes: 15, rest_minutes: 60, participants,
  matches: sandbox.TournamentEngine.generateBracket(participants), windows: [],
  info: { rules_url: soccerSource.rules_url, director: soccerSource.director, director_confirmed: true,
    reviewed_on: soccerSource.reviewed, dates: soccerSource.dates.Boys },
});
// One fictional matched game that was postponed three days and moved, to show the "Moved" note.
const movedGame = games.find(game => game.school_id === 'marlboro' && game.home_away === 'Home' &&
  game.opponent_school_id === 'colts-neck' && game.sport === 'Soccer' && game.level === 'Varsity');
const movedFromDate = movedGame && new Date(new Date(movedGame.game_date + 'T12:00:00Z').getTime() - 3 * 864e5).toISOString().slice(0, 10);
const moves = movedGame ? [{ game_id: movedGame.id, from_date: movedFromDate, from_time: '15:30:00' }] : [];
// A few fictional published changes so the school page's Schedule changes panel has rows.
const team = { season: 'Fall', season_year: 2026, sport: 'Soccer', gender: 'Boys', level: 'Varsity' };
const slot = (date, time, status = 'Scheduled') => ({ game_date: date, start_time: time, status, home_away: 'Away',
  opponent_school_id: 'colts-neck', location: 'Colts Neck Field 2', teams: { sport: 'Soccer', gender: 'Boys', level: 'Varsity', season: 'Fall' } });
const updates = [
  { id: 3, kind: 'game_canceled', ...team, occurred_at: '2026-11-14T15:00:00Z', game_id: 'u1', before: slot('2026-11-17', '16:00:00'), after: slot('2026-11-17', '16:00:00', 'Canceled') },
  { id: 2, kind: 'game_changed', ...team, occurred_at: '2026-11-12T15:00:00Z', game_id: 'u2', before: slot('2026-11-20', '15:30:00'), after: slot('2026-11-20', '16:00:00') },
  { id: 1, kind: 'game_added', ...team, occurred_at: '2026-11-10T15:00:00Z', game_id: 'u3', before: null, after: slot('2026-11-24', '15:45:00') },
];
const handle = createHandler(async options => ({ schools, games, tournament_games: tournamentGames, moves,
  updates: options.scope === 'school' ? updates : [],
  tournaments: [{ id: tournamentId, document: tournament }, { id: soccerId, document: soccer }] }));
const socialAccounts = [
  { school_id: 'marlboro', platform: 'instagram', url: 'https://www.instagram.com/instagram/' },
  { school_id: 'marlboro', platform: 'facebook', url: 'https://www.facebook.com/facebook' },
  { school_id: 'marlboro', platform: 'x', url: 'https://x.com/X' },
  { school_id: 'colts-neck', platform: 'instagram', url: 'https://www.instagram.com/nasa/' },
  { school_id: 'shore-regional', platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=1234567890' },
];
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
    // Social links for the preview. These are the platforms' own public accounts, standing in for school accounts.
    // Fictional addresses for a few sample venues, so the game pop-up can show one.
    if (url.pathname === '/rest/v1/school_venues') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([
        { school_id: 'marlboro', name: 'Marlboro Turf Field', address: '95 North Main Street, Marlboro, NJ 07746' },
        { school_id: 'marlboro', name: 'Marlboro Gym', address: '95 North Main Street, Marlboro, NJ 07746' },
        { school_id: 'colts-neck', name: 'Colts Neck Courts', address: '59 Five Points Road, Colts Neck, NJ 07722' },
      ]));
      return;
    }
    if (url.pathname === '/rest/v1/school_social_accounts') {
      const only = url.searchParams.get('school_id')?.replace(/^eq\./, '');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(socialAccounts.filter(row => !only || row.school_id === only)));
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
