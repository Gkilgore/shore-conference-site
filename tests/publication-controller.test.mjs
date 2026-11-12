// Exercises review-refresh and request cancellation using a small DOM fixture and the real controller.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.open=false; this.checked=false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=items; }
  querySelectorAll(selector) {
    const descendants=this.children.flatMap(child=>typeof child==='object'?[child,...child.querySelectorAll('*')]:[]);
    return selector==='*'?descendants:descendants.filter(child=>child.tag==='input'&&(selector!=='input:checked'||child.checked));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0]??null; }
  showModal() { this.open=true; }
  close() { this.open=false; }
}

function mount(rpc) {
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(tag){return new Element(tag);}};
  const context=vm.createContext({document});
  for(const file of ['publication-review.js','staff-publication.js']) vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
  const controller=context.startStaffPublication({rpc},()=>({slug:'marlboro'}),{});
  return {controller,element:id=>document.getElementById(id)};
}

const payload={id:'game',game_date:'2031-09-01',start_time:'15:00:00',location:'Field',status:'Scheduled',home_away:'Home',opponent_name:'Visitor'};
const group=token=>({team_id:'team',season_year:2031,season:'Fall',sport:'Soccer',gender:'Girls',level:'Varsity',
  token,status:'Not published',published_at:null,pending_count:1,games:[{id:'game',draft:payload,published:null}]});

test('review reloads current data and recovers after a stale-token rejection',async()=>{
  let token='first',reject=true;
  const published=[];
  const {controller,element}=mount(async(name,args)=>{
    if(name==='review_schedule_publication')return {data:[group(token)]};
    published.push(args.selections[0].token);
    return reject?{error:{code:'40001'}}:{data:1};
  });
  await controller.load();
  element('publication-teams').querySelector('input').checked=true;
  await element('publication-form').onsubmit({preventDefault(){}});
  await element('publication-confirm').onclick();
  assert.equal(element('publication-confirm').disabled,true);
  element('publication-dialog').close();
  token='latest';reject=false;
  await element('publication-form').onsubmit({preventDefault(){}});
  await element('publication-confirm').onclick();
  assert.deepEqual(published,['first','latest']);
  assert.equal(element('publication-dialog').open,false);
});

test('a late response after school reset cannot repaint the previous school',async()=>{
  let complete;
  const {controller,element}=mount(()=>new Promise(resolve=>complete=resolve));
  const loading=controller.load();
  controller.reset();
  complete({data:[group('old')]});
  await loading;
  assert.equal(element('publication-teams').children.length,0);
  assert.equal(element('publication-section').hidden,true);
});

test('a team review from the Teams tab sends only that team, with a fresh token, and reports the outcome',async()=>{
  const other={...group('other-token'),team_id:'other',sport:'Tennis'};
  const sent=[],outcomes=[];
  let token='stale';
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(tag){return new Element(tag);}};
  const context=vm.createContext({document});
  for(const file of ['publication-review.js','staff-publication.js']) vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
  const controller=context.startStaffPublication({rpc:async(name,args)=>{
    if(name==='review_schedule_publication')return {data:[group(token),other]};
    sent.push(args);return {data:1};
  }},()=>({slug:'marlboro'}),{onPublished:withdrawn=>outcomes.push(withdrawn)});
  await controller.load();
  assert.deepEqual(controller.groups().map(item=>item.team_id),['team','other']);
  token='fresh';
  await controller.reviewTeam('team|2031');
  assert.equal(document.getElementById('publication-dialog').open,true);
  assert.equal(outcomes.length,0,'nothing is confirmed before the server answers');
  await document.getElementById('publication-confirm').onclick();
  assert.equal(sent.length,1);
  assert.equal(sent[0].withdraw,false);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0].selections)),[{team_id:'team',season_year:2031,token:'fresh'}]);
  assert.deepEqual(outcomes,[false]);
});

test('unpublishing from the Teams tab does nothing for a team that was never published',async()=>{
  const sent=[];
  const {controller,element}=mount(async(name,args)=>{
    if(name==='review_schedule_publication')return {data:[group('t')]};
    sent.push(args);return {data:1};
  });
  await controller.reviewTeam('team|2031',true);
  assert.equal(element('publication-dialog').open,false);
  await controller.reviewTeam('missing|2031');
  assert.equal(element('publication-dialog').open,false);
  assert.equal(sent.length,0);
});
