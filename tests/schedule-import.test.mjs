// Verifies multiple-file CSV preview preserves source rows and shared duplicate tracking.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/staff-import.js',import.meta.url),'utf8'), context);
const header='date,start_time,sport,gender,level,home_away,opponent,location';
const row='2031-09-01,3:00 PM,Soccer,Girls,Varsity,Home,Visitor,Field';

function mountImport(existingGames = [], client = {}) {
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
  vm.runInContext(readFileSync(new URL('../js/staff-import.js',import.meta.url),'utf8'), context);
  const controller = context.startStaffImport(client, {
    currentSchool: () => ({slug:'marlboro'}), schools: () => [], existingGames: () => existingGames,
    onImported() {},
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
  assert.equal(row.children[4].textContent, 'TBD');
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
