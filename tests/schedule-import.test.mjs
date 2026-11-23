// Verifies multiple-file CSV preview preserves source rows and shared duplicate tracking.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/staff-import.js',import.meta.url),'utf8'), context);
const header='date,start_time,sport,gender,level,home_away,opponent,location';
const row='2031-09-01,3:00 PM,Soccer,Girls,Varsity,Home,Visitor,Field';

function mountImport(existingGames = [], client = {}, sendTransportationEmail, directory = [], schoolList = [], post) {
  const elements = new Map();
  const makeElement = tag => ({
    tag, children: [], hidden: false, disabled: false, textContent: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  });
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      const element = elements.get(id);
      if (id === 'import-preview') element.tBodies ??= [{ replaceChildren(...children) { this.children = children; } }];
      return element;
    },
    createElement: makeElement,
  };
  const context = vm.createContext({document, seasonOf: () => 'Fall', crypto: {randomUUID: () => 'import-batch'}});
  vm.runInContext(readFileSync(new URL('../js/seasons.js',import.meta.url),'utf8'), context);
  vm.runInContext(readFileSync(new URL('../js/staff-import.js',import.meta.url),'utf8'), context);
  const controller = context.startStaffImport(client, {
    currentSchool: () => ({slug:'marlboro'}), schools: () => schoolList, opponents: () => directory,
    existingGames: () => existingGames,
    onImported() {}, sendTransportationEmail, ...(post ? {post} : {}),
  });
  return {controller, elements};
}

test('multiple files retain file and original row numbers and share duplicate detection', async () => {
  assert.equal(typeof context.previewScheduleFiles,'function');
  const result=await context.previewScheduleFiles([
    new File([header+'\n'+row+'\n'],'varsity.csv'),new File([header+'\n'+row+'\n'],'other.csv'),
  ], (cells, columns, seen) => {
    const key=cells.join('|'),duplicate=seen.has(key); seen.add(key);
    return {state:duplicate?'duplicate':'ready',game:{},raw:{},problems:[]};
  });
  assert.equal(result.rows.length,2);
  assert.equal(result.rows[0].source.file,'varsity.csv');
  assert.equal(result.rows[1].source.row,2);
  assert.equal(result.rows[1].state,'duplicate');
});

test('TBD start times are valid import rows and display as TBD', async () => {
  const {controller, elements} = mountImport();
  const input = elements.get('import-file');
  input.files = [new File([header+'\n2031-09-01,TBD,Soccer,Girls,Varsity,Home,Visitor,Field'],'tbd.csv')];
  await input.onchange();
  const [row] = elements.get('import-preview').tBodies[0].children;
  assert.equal(row.className, 'is-ready');
  // Columns: status, date, time, home/away, opponent and location.
  const timeCell = row.children[2];
  assert.ok(timeCell.children && timeCell.children.length > 0, 'Time cell should contain input element');
  controller.stop();
});

test('TBD rows are compared safely with games already saved without a time', async () => {
  const saved = {teams:{sport:'Soccer',gender:'Girls',level:'Varsity'},game_date:'2031-09-01',start_time:null};
  const {controller, elements} = mountImport([saved]);
  const input = elements.get('import-file');
  input.files = [new File([header+'\n2031-09-01,TBD,Soccer,Girls,Varsity,Home,Visitor,Field'],'duplicate.csv')];
  await input.onchange();
  const [row] = elements.get('import-preview').tBodies[0].children;
  assert.equal(row.className, 'is-duplicate');
  controller.stop();
});

test('CSV import drops schedule-format text from the opponent', async () => {
  const saved = [];
  const {controller, elements} = mountImport([], {
    async rpc(_name, {input}) { saved.push(input); return {data:'saved-game',error:null}; },
  });
  const input = elements.get('import-file');
  input.files = [new File([header+'\n2031-09-01,4:00 PM,Basketball,Girls,Varsity,Away,@ Wall / VS/JV 6 quarters,North Gym'], 'wall.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].opponent_name, 'Wall');
  assert.equal(saved[0].notes, null);
  assert.equal(saved[0].home_away, 'Away');
  controller.stop();
});

test('CSV import saves an optional early-dismissal time and flags an invalid one', async () => {
  const saved = [];
  const {controller, elements} = mountImport([], {
    async rpc(name, {input}) {
      assert.equal(name, 'save_staff_game');
      saved.push(input);
      return {data: 'saved-game', error: null};
    },
  });
  const input = elements.get('import-file');
  const columns = header + ',early_dismissal_time';
  input.files = [new File([
    columns + '\n' + row + ',1:30 PM\n' +
    '2031-09-02,4:00 PM,Tennis,Boys,Varsity,Home,Visitor,Courts,5:75 PM',
  ], 'dismissal.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].early_dismissal_time, '13:30');
  assert.ok(elements.get('import-preview').tBodies[0].children.some(item => item.className === 'is-problem'));
  controller.stop();
});

test('CSV opponents from the AD list retain a directory key without becoming a school identity', async () => {
  const saved = [];
  const {controller, elements} = mountImport([], {
    async rpc(name, {input}) { assert.equal(name, 'save_staff_game'); saved.push(input); return {data: 'saved'}; },
  }, undefined, [{slug: 'north-harbor', name: 'North Harbor High School'}]);
  const input = elements.get('import-file');
  input.files = [new File([header + '\n2031-09-01,3:00 PM,Soccer,Girls,Varsity,Home,North Harbor High School,Field'], 'directory.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.equal(saved[0].opponent_school_id, null);
  assert.equal(saved[0].opponent_directory_slug, 'north-harbor');
  assert.equal(saved[0].opponent_name, 'North Harbor High School');
  controller.stop();
});

test('CSV opponents with a nonmember school profile remain nonconference identities', async () => {
  const saved = [];
  const school = {slug: 'north-harbor', name: 'North Harbor High School', is_conference_member: false};
  const {controller, elements} = mountImport([], {
    async rpc(name, {input}) { assert.equal(name, 'save_staff_game'); saved.push(input); return {data: 'saved'}; },
  }, undefined, [school], [school]);
  const input = elements.get('import-file');
  input.files = [new File([header + '\n2031-09-01,3:00 PM,Soccer,Girls,Varsity,Home,North Harbor High School,Field'], 'nonmember.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.equal(saved[0].opponent_school_id, null);
  assert.equal(saved[0].opponent_directory_slug, 'north-harbor');
  assert.equal(saved[0].opponent_name, 'North Harbor High School');
  controller.stop();
});

test('CSV import emails a scheduled bus and reports delivery failure without losing the saved game', async () => {
  const {controller, elements} = mountImport([], {
    async rpc() { return {data:'saved-game',error:null}; },
  }, async id => {
    assert.equal(id, 'saved-game');
    return {ok:false,message:'Transportation contact is missing.'};
  });
  const input = elements.get('import-file');
  input.files = [new File([header + ',bus_departure\n' + row + ',2:00 PM'], 'bus.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.match(elements.get('import-summary').textContent, /transportation email was not sent/i);
  // Problems sit on their own line under the game row.
  assert.match(elements.get('import-preview').tBodies[0].children[1].children[0].textContent,
    /Transportation email not sent: Transportation contact is missing/);
  assert.match(elements.get('import-preview').tBodies[0].children[0].children[0].children[0].textContent, /Posted/);
  controller.stop();
});

test('invalid file reports its name while valid files remain available for preview', async () => {
  assert.equal(typeof context.previewScheduleFiles,'function');
  const result=await context.previewScheduleFiles([
    new File(['wrong,columns\n1,2'],'broken.csv'),new File([header+'\n'+row],'ready.csv'),
  ],()=>({state:'ready',game:{},raw:{},problems:[]}));
  assert.equal(result.rows.length,1);
  assert.match(result.errors[0],/broken.csv.*missing columns/i);
});

test('combined preview over 500 rows is rejected without a partial import batch', async () => {
  assert.equal(typeof context.previewScheduleFiles,'function');
  const result=await context.previewScheduleFiles([
    new File([header+'\n'+(row+'\n').repeat(300)],'first.csv'),
    new File([header+'\n'+(row+'\n').repeat(300)],'second.csv'),
  ],()=>({state:'ready',game:{},raw:{},problems:[]}));
  assert.equal(result.rows.length,0);
  assert.match(result.errors.at(-1),/500/);
});

test('PDF file triggers appropriate error message', async () => {
  assert.equal(typeof context.previewScheduleFiles, 'function');
  const result = await context.previewScheduleFiles([
    new File(['fake pdf content'], 'schedule.pdf'),
  ], () => ({ state: 'ready', game: {}, raw: {}, problems: [] }));
  assert.equal(result.rows.length, 0);
  assert.match(result.errors[0], /schedule.pdf.*PDF could not be converted/i);
});

test('mixed CSV and other files show helpful error', async () => {
  assert.equal(typeof context.previewScheduleFiles, 'function');
  const result = await context.previewScheduleFiles([
    new File([header + '\n' + row], 'valid.csv'),
    new File(['data'], 'invalid.txt'),
  ], () => ({ state: 'ready', game: {}, raw: {}, problems: [] }));
  assert.equal(result.rows.length, 1);
  assert.match(result.errors[0], /invalid.txt.*choose a CSV or PDF file/i);
});

// A "Sports Schedule Report" export: a title line above the columns, Start Date, time zones, doubled opponents and event titles.
const scheduleReport = [
  'Sports Schedule Report: Example High SchoolDate Range: 11/22/2031-Gender: BOYSLevel: varsitySport: BASKETBALL,,,Print Time: 7:26:33 PM',
  'Number,Start Date,Start Time,Sport,H/A,Opponents/Title,Type,Facility',
  '1,12/8/2031 ,4:00 PM EST ,BOYS VARSITY BASKETBALL ,H , vs Visitor  vs Visitor ,SCRIMMAGE ,"Main Gym"',
  '2,12/11/2031 ,6:45 PM  ,BOYS VARSITY BASKETBALL ,A ,  vs Host  @ Host ,GAME ,"Host Gym"',
  '3,12/15/2031 ,10:00 AM  ,BOYS VARSITY BASKETBALL ,H , vs TBD / Holiday Tournament ,GAME ,"Main Gym"',
].join('\n');

test('schedule report exports import without editing: title line, Start Date, time zone, doubled opponent, event title', async () => {
  const saved = [];
  const {controller, elements} = mountImport([], {
    async rpc(_name, {input}) { saved.push(input); return {data:'saved-game',error:null}; },
  });
  const input = elements.get('import-file');
  input.files = [new File([scheduleReport], 'report.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.equal(saved.length, 3);
  assert.deepEqual(saved.map(game => [game.game_date, game.start_time, game.home_away, game.opponent_name, game.location]), [
    ['2031-12-08', '16:00', 'Home', 'Visitor', 'Main Gym'],
    ['2031-12-11', '18:45', 'Away', 'Host', 'Host Gym'],
    ['2031-12-15', '10:00', 'Home', 'TBD', 'Main Gym'],
  ]);
  assert.equal(saved[2].notes, 'Holiday Tournament');
  assert.deepEqual([saved[0].sport, saved[0].gender, saved[0].level, saved[0].season], ['Basketball', 'Boys', 'Varsity', 'Winter']);
  controller.stop();
});

test('schedule report row numbers count the title line', async () => {
  const result = await context.previewScheduleFiles([new File([scheduleReport], 'report.csv')], (cells) => ({cells}), null);
  assert.equal(result.errors.length, 0);
  assert.equal(JSON.stringify(result.rows.map(row => row.source.row)), '[3,4,5]');
});

test('a combined boys and girls sport reads as coed with its core sport', () => {
  const sports = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../js/seasons.js',import.meta.url),'utf8'), sports);
  vm.runInContext(readFileSync(new URL('../js/staff-import.js',import.meta.url),'utf8'), sports);
  const parts = sports.sportParts('Boys and Girls VARSITY SWIMMING');
  assert.deepEqual([parts.gender, parts.level, parts.core], ['Coed', 'Varsity', 'SWIMMING']);
  assert.equal(sports.matchSport(parts.core, null), 'Swimming');
});

test('a file with no recognizable header row still names the missing columns', async () => {
  const result = await context.previewScheduleFiles([new File(['Title only\nfoo,bar\n1,2'], 'odd.csv')], () => ({}), null);
  assert.match(result.errors[0], /missing columns: date, start_time, sport, home_away, opponent, location/);
});

test('after saving, a result box says what was saved and that it is on the public schedule', async () => {
  const {controller, elements} = mountImport([], {
    async rpc() { return {data:'saved-game',error:null}; },
  });
  const input = elements.get('import-file');
  input.files = [new File([header + '\n' + row], 'one.csv')];
  await input.onchange();
  assert.equal(elements.get('import-result').hidden, true);
  await elements.get('import-save').onclick();
  assert.equal(elements.get('import-result').hidden, false);
  assert.equal(elements.get('import-result').className, 'import-result is-success');
  assert.equal(elements.get('import-result-title').textContent,
    'Import complete. 1 game was saved and posted to the public schedule.');
  assert.match(elements.get('import-result-list').children[0].textContent, /^Soccer: 1 game posted on the public calendar$/);
  assert.equal(elements.get('import-result-public').hidden, false);
  assert.equal(elements.get('import-save').hidden, true);
  elements.get('import-result-done').onclick();
  assert.equal(elements.get('import-result').hidden, true);
  controller.stop();
});

test('games saved but held back from posting show a warning naming the team to post', async () => {
  const {controller, elements} = mountImport([], {
    async rpc() { return {data:'held-game',error:null}; },
  }, undefined, [], [], async ids => ({ok:true, held:['Girls Varsity Soccer'], heldIds:new Set(ids)}));
  const input = elements.get('import-file');
  input.files = [new File([header + '\n' + row], 'one.csv')];
  await input.onchange();
  await elements.get('import-save').onclick();
  assert.equal(elements.get('import-result').className, 'import-result is-warning');
  assert.equal(elements.get('import-result-title').textContent,
    '1 game was saved. 1 game is not on the public schedule yet.');
  assert.ok(elements.get('import-result-list').children.some(item => /choose Post schedule for Girls Varsity Soccer/.test(item.textContent)));
  assert.equal(elements.get('import-result-public').hidden, true);
  controller.stop();
});
