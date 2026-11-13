// Exercises posting right after a save: what is sent, what is held back, and what is reported.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.open=false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children=items; }
  showModal() { this.open=true; }
  close() { this.open=false; }
}

function mount(rpc, options = {}) {
  const elements=new Map();
  const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},createElement(tag){return new Element(tag);}};
  const context=vm.createContext({document});
  for(const file of ['publication-review.js','staff-publication.js']) vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
  const controller=context.startStaffPublication({rpc},()=>({slug:'marlboro'}),options);
  return {controller,element:id=>document.getElementById(id)};
}
const plain=value=>JSON.parse(JSON.stringify(value));
const game=(id,time='15:00:00')=>({id,game_date:'2031-09-01',start_time:time,location:'Field',status:'Scheduled',home_away:'Home',opponent_name:'Visitor'});
// posted: the public copy matches. draft: never posted. changed: posted, then edited. removed: deleted, still public.
const entry=(id,kind)=>kind==='posted'?{id,draft:game(id),published:game(id),changed:false}
  :kind==='draft'?{id,draft:game(id),published:null}
  :kind==='changed'?{id,draft:game(id,'16:00:00'),published:game(id),changed:true}
  :{id,draft:null,published:game(id)};
const group=(team,published,games,token='t1')=>({team_id:team,season_year:2031,season:'Fall',sport:team,gender:'Girls',level:'Varsity',
  token,published_at:published?'2031-08-01T12:00:00Z':null,pending_count:games.filter(item=>item.changed!==false).length,games});
// A server double: answers the review with `groups()` and records every publish.
function server(groups, publish = async()=>({data:1})) {
  const sent=[];
  return {sent,rpc:async(name,args)=>{
    if(name==='review_schedule_publication')return {data:groups()};
    sent.push(plain(args));return publish(args);
  }};
}

test('saving the first game of a new team posts that team',async()=>{
  const api=server(()=>[group('Soccer',false,[entry('g1','draft')])]);
  const result=await mount(api.rpc).controller.post(['g1']);
  assert.equal(result.ok,true);
  assert.deepEqual(plain(result.held),[]);
  assert.deepEqual(api.sent,[{p_school:'marlboro',withdraw:false,selections:[{team_id:'Soccer',season_year:2031,token:'t1'}]}]);
});

test('an edit to a posted team with nothing else waiting posts the team',async()=>{
  const api=server(()=>[group('Soccer',true,[entry('g1','changed'),entry('g2','posted')]),group('Tennis',true,[entry('g9','changed')])]);
  await mount(api.rpc).controller.post(['g1']);
  assert.deepEqual(api.sent[0].selections,[{team_id:'Soccer',season_year:2031,token:'t1'}],'other teams are never sent');
});

test('an edit beside another game that is waiting posts only the edited game',async()=>{
  const api=server(()=>[group('Soccer',true,[entry('g1','changed'),entry('g2','draft')])]);
  const result=await mount(api.rpc).controller.post(['g1']);
  assert.equal(result.ok,true);
  assert.deepEqual(api.sent[0].selections,[{team_id:'Soccer',season_year:2031,token:'t1',game_ids:['g1']}]);
});

test('a save into a team that was never posted and holds older private games posts nothing',async()=>{
  const api=server(()=>[group('Soccer',false,[entry('g1','draft'),entry('old','draft')])]);
  const result=await mount(api.rpc).controller.post(['g1']);
  assert.equal(api.sent.length,0,'older private games are not exposed');
  assert.equal(result.ok,true);
  assert.deepEqual(plain(result.held),['Girls Varsity Soccer · Fall 2031']);
  assert.equal(result.heldIds.has('g1'),true);
});

test('an import posts each clean team whole and holds a team with older private games',async()=>{
  const api=server(()=>[group('Soccer',false,[entry('a','draft'),entry('b','draft')]),
    group('Tennis',true,[entry('c','draft'),entry('d','draft'),entry('older','changed')]),
    group('Golf',true,[entry('untouched','posted')])]);
  const result=await mount(api.rpc).controller.post(['a','b','c','d']);
  assert.deepEqual(api.sent[0].selections,[{team_id:'Soccer',season_year:2031,token:'t1'}]);
  assert.deepEqual([...result.heldIds].sort(),['c','d']);
  assert.deepEqual(plain(result.held),['Girls Varsity Tennis · Fall 2031']);
});

test('a deleted game is taken off the public schedule',async()=>{
  const api=server(()=>[group('Soccer',true,[entry('gone','removed'),entry('g2','posted')])]);
  const result=await mount(api.rpc).controller.post(['gone']);
  assert.equal(result.ok,true);
  assert.deepEqual(api.sent[0].selections,[{team_id:'Soccer',season_year:2031,token:'t1'}]);
});

test('a deleted game that was never public needs nothing posted',async()=>{
  const api=server(()=>[group('Soccer',true,[entry('g2','posted')])]);
  const result=await mount(api.rpc).controller.post(['never-public']);
  assert.equal(result.ok,true);
  assert.equal(api.sent.length,0);
});

test('a game that changed team waits when either schedule holds other private games',async()=>{
  const moved={id:'m',draft:game('m'),published:null};
  const left={id:'m',draft:null,published:game('m')};
  const api=server(()=>[group('JV',true,[left,entry('x','posted')]),group('Varsity',false,[moved,entry('old','draft')])]);
  const result=await mount(api.rpc).controller.post(['m']);
  assert.equal(api.sent.length,0,'half a move is never posted');
  assert.equal(result.heldIds.has('m'),true);
});

test('a save that lands between review and post is retried once with the fresh token',async()=>{
  let token='stale',calls=0;
  const api=server(()=>[group('Soccer',true,[entry('g1','changed')],token)],async()=>{
    calls++;
    if(calls===1){token='fresh';return {error:{code:'40001'}};}
    return {data:1};
  });
  const result=await mount(api.rpc).controller.post(['g1']);
  assert.equal(result.ok,true);
  assert.deepEqual(api.sent.map(args=>args.selections[0].token),['stale','fresh']);
});

test('a failed post is reported as not posted, and the game still counts as waiting',async()=>{
  const api=server(()=>[group('Soccer',true,[entry('g1','changed')])],async()=>({error:{code:'XX000'}}));
  const {controller}=mount(api.rpc);
  const result=await controller.post(['g1']);
  assert.equal(result.ok,false);
  assert.equal(controller.states().map.get('g1'),'Changed');
  const twice=server(()=>[group('Soccer',true,[entry('g1','changed')])],async()=>({error:{code:'40001'}}));
  assert.equal((await mount(twice.rpc).controller.post(['g1'])).ok,false);
  assert.equal(twice.sent.length,2,'only one retry');
});

test('when the schedule cannot be read nothing is posted or reported as posted',async()=>{
  const sent=[];
  const {controller}=mount(async(name,args)=>{if(name==='review_schedule_publication')return {error:{code:'XX000'}};sent.push(args);return {data:1};});
  assert.equal((await controller.post(['g1'])).ok,false);
  assert.equal(sent.length,0);
});

test('states list only games the public does not see as saved',async()=>{
  const api=server(()=>[group('Soccer',true,[entry('ok','posted'),entry('new','draft'),entry('edit','changed'),entry('gone','removed')]),
    group('Tennis',false,[entry('private','draft')])]);
  const {controller}=mount(api.rpc);
  await controller.load();
  const {map,removed}=controller.states();
  assert.deepEqual(plain([...map]).sort(),[['edit','Changed'],['new','Draft'],['private','Draft']]);
  assert.equal(removed,1);
});

test('posting a held-back team from Teams is reviewed first and confirmed only after the server answers',async()=>{
  let token='stale';
  const outcomes=[];
  const api=server(()=>[group('Soccer',false,[entry('g1','draft'),entry('old','draft')],token),group('Tennis',true,[entry('t','posted')])]);
  const {controller,element}=mount(api.rpc,{onPublished:withdrawn=>outcomes.push(withdrawn)});
  await controller.load();
  token='fresh';
  await controller.reviewTeam('Soccer|2031');
  assert.equal(element('publication-dialog').open,true);
  assert.equal(api.sent.length,0);
  assert.equal(outcomes.length,0);
  await element('publication-confirm').onclick();
  assert.deepEqual(api.sent[0].selections,[{team_id:'Soccer',season_year:2031,token:'fresh'}]);
  assert.equal(api.sent[0].withdraw,false);
  assert.deepEqual(outcomes,[false]);
  assert.equal(element('publication-dialog').open,false);
});

test('taking a schedule down is reviewed, and does nothing for a team that was never posted',async()=>{
  const outcomes=[];
  const api=server(()=>[group('Soccer',false,[entry('g1','draft')]),group('Tennis',true,[entry('t','posted')])]);
  const {controller,element}=mount(api.rpc,{onPublished:withdrawn=>outcomes.push(withdrawn)});
  await controller.reviewTeam('Soccer|2031',true);
  assert.equal(element('publication-dialog').open,false);
  await controller.reviewTeam('Tennis|2031',true);
  assert.equal(element('publication-dialog').open,true);
  await element('publication-confirm').onclick();
  assert.equal(api.sent[0].withdraw,true);
  assert.deepEqual(outcomes,[true]);
});

test('a rejected review keeps the dialog open with the reason and confirms nothing',async()=>{
  const outcomes=[];
  const api=server(()=>[group('Soccer',false,[entry('g1','draft')])],async()=>({error:{code:'40001'}}));
  const {controller,element}=mount(api.rpc,{onPublished:withdrawn=>outcomes.push(withdrawn)});
  await controller.reviewTeam('Soccer|2031');
  await element('publication-confirm').onclick();
  assert.equal(element('publication-dialog').open,true);
  assert.match(element('publication-dialog-status').textContent,/changed while you were reviewing/);
  assert.equal(outcomes.length,0);
});

test('a late response after a school change is ignored',async()=>{
  let complete;
  const {controller}=mount(()=>new Promise(resolve=>complete=resolve));
  const loading=controller.load();
  controller.reset();
  complete({data:[group('Soccer',true,[entry('old','draft')])]});
  assert.equal(await loading,false);
  assert.equal(controller.groups().length,0);
});
