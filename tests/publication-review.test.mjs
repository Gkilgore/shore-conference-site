// Checks the plain-language review of public game changes.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({});
try { vm.runInContext(readFileSync(new URL('../js/publication-review.js', import.meta.url), 'utf8'), context); }
catch (error) { if (error.code !== 'ENOENT') throw error; }

test('review names the exact date, time, status and bus changes', () => {
  const before = { game_date:'2031-09-01',start_time:'15:00:00',status:'Scheduled',location:'Main field',
    transportation:{bus_departure:'14:00:00',pickup_location:'Gym',return_time:'18:00:00'} };
  const after = { ...before,start_time:'16:30:00',status:'Postponed',transportation:{...before.transportation,bus_departure:'15:00:00'} };
  assert.equal(typeof context.publicationChanges, 'function');
  const lines = Array.from(context.publicationChanges({ published:before,draft:after }));
  assert.deepEqual(lines, ['Start time: 3:00 PM → 4:30 PM','Status: Scheduled → Postponed','Bus departure: 2:00 PM → 3:00 PM']);
});

test('review distinguishes new and removed games and ignores private draft fields', () => {
  assert.equal(typeof context.publicationChanges, 'function');
  assert.deepEqual(Array.from(context.publicationChanges({published:null,draft:{status:'Scheduled'}})), ['New game']);
  assert.deepEqual(Array.from(context.publicationChanges({published:{status:'Scheduled'},draft:null})), ['Remove from the public calendar']);
  const before={transportation:{bus_departure:null,bus_confirmed:false,notes:'Private'}};
  const after={transportation:{bus_departure:null,bus_confirmed:true,notes:'Private update'}};
  assert.deepEqual(Array.from(context.publicationChanges({published:before,draft:after})), []);
});

test('winter team labels identify the season across two years', () => {
  assert.equal(typeof context.publicationTeamLabel, 'function');
  assert.equal(context.publicationTeamLabel({sport:'Basketball',gender:'Girls',level:'JV',season:'Winter',season_year:2031}), 'Girls JV Basketball · Winter 2031–32');
});

test('review flags a switch from a member school to the same typed opponent name', () => {
  const published={opponent_school_id:'marlboro',opponent_name:null};
  const draft={opponent_school_id:null,opponent_name:'Marlboro'};
  assert.ok(Array.from(context.publicationChanges({published,draft},{marlboro:'Marlboro'}))
    .some(line=>line.includes('Conference matching')));
});
