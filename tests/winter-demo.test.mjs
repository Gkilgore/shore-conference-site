// Checks the fictional winter season before any records are written to the test database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWinterDemo, winterDemoSql, winterDemoCleanupSql } from '../tools/winter-demo.mjs';

test('winter demo spans six schools, ten programs, and a full set of games', () => {
  const { teams, games } = buildWinterDemo();
  assert.equal(teams.length, 60);
  assert.equal(games.length, 696);
  assert.equal(new Set(teams.map(team => team.school_id)).size, 6);
  assert.equal(games.filter(game => game.kind === 'league').length, 600);
  assert.equal(games.filter(game => game.kind === 'nonleague').length, 96);
  assert.ok(games.every(game => game.season === 'Winter' && game.notes.startsWith('DEMO ONLY:')));
  assert.ok(games.every(game => game.game_date >= '2026-12-01' && game.game_date <= '2027-02-28'));
});

test('every league entry has an exact reciprocal entry and no team date is reused', () => {
  const { games } = buildWinterDemo();
  const matches = Map.groupBy(games.filter(game => game.kind === 'league'), game => game.match_id);
  assert.equal(matches.size, 300);
  for (const pair of matches.values()) {
    assert.equal(pair.length, 2);
    const [first, second] = pair;
    assert.equal(first.school_id, second.opponent_school_id);
    assert.equal(second.school_id, first.opponent_school_id);
    assert.notEqual(first.home_away, second.home_away);
    for (const field of ['sport', 'gender', 'level', 'game_date', 'start_time', 'location', 'status']) {
      assert.equal(first[field], second[field]);
    }
  }
  const slots = games.map(game => [game.school_id, game.sport, game.gender, game.level, game.game_date].join('|'));
  assert.equal(new Set(slots).size, slots.length);
  assert.ok(games.every(game => game.game_date !== '2026-12-10'));
});

test('reruns keep stable IDs and cleanup addresses only demo IDs', () => {
  const first = buildWinterDemo();
  const second = buildWinterDemo();
  assert.deepEqual(first, second);
  assert.equal(new Set(first.games.map(game => game.id)).size, 696);
  assert.ok(first.games.filter(game => game.kind === 'nonleague').every(game =>
    game.level === 'Varsity' && game.sport === 'Basketball' && game.opponent_name.startsWith('Demo Academy')));
  const seed = winterDemoSql(first);
  const cleanup = winterDemoCleanupSql(first);
  assert.match(seed, /^begin;/i);
  assert.match(seed, /on conflict \(id\) do nothing/i);
  assert.match(seed, /DEMO ONLY:/);
  assert.match(cleanup, /^begin;/i);
  assert.match(cleanup, /delete from public\.games/i);
  assert.ok(cleanup.includes(first.games[0].id));
  assert.doesNotMatch(cleanup, /2026-12-10/);
});
