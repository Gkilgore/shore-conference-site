// Verifies multiple-file CSV preview preserves source rows and shared duplicate tracking.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../js/staff-import.js',import.meta.url),'utf8'), context);
const header='date,start_time,sport,gender,level,home_away,opponent,location';
const row='2031-09-01,3:00 PM,Soccer,Girls,Varsity,Home,Visitor,Field';

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
