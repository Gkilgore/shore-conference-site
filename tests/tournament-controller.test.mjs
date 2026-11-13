// Exercises tournament permissions, checked saves and asynchronous workspace lifecycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';

class Element {
  constructor(tag, registry) { this.tagName=tag.toUpperCase(); this.registry=registry; this.children=[]; this.value=''; this.hidden=false; this.checked=false; this.disabled=false; this.dataset={}; this.classList={toggle(){},add(){},remove(){}}; }
  set id(value) { this._id=value; this.registry.set(value,this); }
  get id() { return this._id; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  setAttribute(name,value) { this[name]=value; }
  removeAttribute(name) { delete this[name]; }
  querySelectorAll(selector) {
    const all=this.children.flatMap(item=>item instanceof Element?[item,...item.querySelectorAll('*')]:[]);
    if(selector==='*')return all;
    if(selector==='input:checked')return all.filter(item=>item.tagName==='INPUT'&&item.checked);
    return all.filter(item=>selector.split(',').includes(item.tagName.toLowerCase()));
  }
  focus() {}
  showModal() { this.open=true; }
  close() { this.open=false; this.onclose?.(); }
  click() { return this.onclick?.({preventDefault(){}}); }
}
const doc=()=>({name:'Cup',sport:'Softball',gender:'Girls',level:'Varsity',season:'Spring',season_year:2027,duration_minutes:90,turnaround_minutes:15,rest_minutes:60,windows:[],participants:[{id:'p1',name:'Marlboro',school_id:'marlboro',seed:1},{id:'p2',name:'Guest',seed:2}],matches:[{id:'m1',round:1,label:'Final',a:{participant_id:'p1'},b:{participant_id:'p2'},game_date:'2027-04-10',start_time:'09:00',venue:'Field',home_side:'neutral',status:'Scheduled',winner_id:null,score_a:null,score_b:null}]});
const record=(revision=1)=>({id:'11111111-1111-4111-8111-111111111111',revision,published_revision:null,draft:doc(),published:null,issues:[]});
const listing=(role='conference_office',records=[record()])=>({actor_role:role,school_id:role==='ad'?'marlboro':null,tournaments:records,conflicts:[],transportation:[]});
function mount(rpc, realEngine = false) {
  const registry=new Map();
  const downloads=[];
  const document={getElementById(id){ if(!registry.has(id)){const el=new Element('div',registry);el.id=id;}return registry.get(id);},createElement(tag){return new Element(tag,registry);}};
  const engine={validate:()=>[],resolve:value=>({...value,matches:value.matches.map(match=>({...match,resolved_a:match.a.participant_id??null,resolved_b:match.b.participant_id??null}))}),csvHeaders:['match_id'],exportCsv:()=>'',participantsFromText:()=>({participants:doc().participants,errors:[]}),generateBracket:()=>doc().matches,schedule:value=>({document:value,issues:[]})};
  engine.cleanInfo=info=>({rules_url:'',director:'',director_confirmed:false,reviewed_on:'',...(info||{}),dates:(info?.dates||[]).map(row=>({...row}))});
  engine.hasInfo=info=>Boolean(info&&(info.rules_url||info.director||info.reviewed_on||info.dates?.length));
  const context=vm.createContext({document,TournamentEngine:engine,crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},URL:{createObjectURL(blob){downloads.push(blob);return 'blob:preview';},revokeObjectURL(){}},Blob,console});
  if(realEngine)for(const file of ['staff-import.js','tournament-engine.js'])vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('../js/tournament-public.js',import.meta.url),'utf8').split('(async () => {')[0],context);
  const path=new URL('../js/staff-tournaments.js',import.meta.url);
  if(existsSync(path))vm.runInContext(readFileSync(path,'utf8'),context);
  assert.equal(typeof context.startStaffTournaments,'function','tournament controller is available');
  const controller=context.startStaffTournaments({rpc},{schools:()=>[{slug:'marlboro',name:'Marlboro'}]});
  return {controller,el:id=>document.getElementById(id),engine:context.TournamentEngine,downloads};
}

test('verified RPC role controls manager tools independently of view-as hints',async()=>{
  const {controller,el}=mount(async()=>({data:listing('ad',[{...record(),draft:undefined,published:doc(),published_revision:1}])}));
  await controller.load();
  assert.equal(el('tournament-manager').hidden,true);
  assert.equal(el('tournament-transport').hidden,false);
  assert.equal(el('tournament-bus-school').textContent,'Marlboro');
  assert.equal(el('tournament-bus-match').children.length,1);
});

test('a late load after reset cannot repaint or authorize the hidden workspace',async()=>{
  let complete;
  const {controller,el}=mount(()=>new Promise(resolve=>complete=resolve));
  const request=controller.load();controller.reset();complete({data:listing()});await request;
  assert.equal(el('tournament-manager').hidden,true);
  assert.equal(el('tournament-select').children.length,0);
});

test('new drafts use client UUID and revision zero and suppress duplicate saves',async()=>{
  let finish;const calls=[];
  const {controller,el}=mount(async(name,args)=>{
    calls.push({name,args});
    if(name==='list_tournaments')return {data:listing('conference_office',[])};
    return new Promise(resolve=>finish=resolve);
  });
  await controller.load();el('tournament-new').click();
  const saving=el('tournament-save').click();await el('tournament-save').click();
  assert.equal(calls.length,2);
  assert.equal(calls[1].args.p_expected_revision,0);
  assert.equal(calls[1].args.p_id,'22222222-2222-4222-8222-222222222222');
  finish({data:{...record(1),id:calls[1].args.p_id,draft:calls[1].args.p_document}});await saving;
  assert.match(el('tournament-status').textContent,/Draft saved/);
});

test('review fetches current saved changes and initial publication always uses full scope',async()=>{
  const calls=[];
  const {controller,el}=mount(async(name,args)=>{
    calls.push({name,args});
    if(name==='list_tournaments')return {data:listing()};
    if(name==='review_tournament')return {data:{...record(),token:'checked-token',changes:[{id:'m1',before:null,after:doc().matches[0]}],issues:[],affected_schools:['marlboro']}};
    return {data:{...record(2),published:doc(),published_revision:2}};
  });
  await controller.load();await el('tournament-review').click();
  assert.equal(el('tournament-review-dialog').open,true);
  assert.match(el('tournament-review-schools').textContent,/Marlboro/);
  await el('tournament-publish').click();
  assert.equal(calls.at(-1).name,'publish_tournament');
  assert.equal(calls.at(-1).args.p_token,'checked-token');
  assert.equal(calls.at(-1).args.p_match_ids,null);
});

test('stale publication token requires a fresh review',async()=>{
  let publishes=0;
  const {controller,el}=mount(async(name)=>{
    if(name==='list_tournaments')return {data:listing()};
    if(name==='review_tournament')return {data:{...record(),token:'old',changes:[],issues:[],affected_schools:[]}};
    publishes++;return {error:{code:'40001'}};
  });
  await controller.load();await el('tournament-review').click();await el('tournament-publish').click();await el('tournament-publish').click();
  assert.equal(publishes,1);
  assert.equal(el('tournament-publish').disabled,true);
  assert.match(el('tournament-review-status').textContent,/changed/);
});

test('AD transportation writes always use verified school and existing row revision',async()=>{
  const saved=[];const published={...record(),published:doc(),draft:undefined,published_revision:1};
  const {controller,el}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:{...listing('ad',[published]),transportation:[{tournament_id:published.id,match_id:'m1',school_id:'marlboro',revision:4,bus_departure:'08:00'}]}};
    saved.push(args);return {data:{tournament_id:published.id,match_id:'m1',school_id:'marlboro',revision:5,...args.p_transport}};
  });
  await controller.load();el('tournament-bus-departure').value='07:45';
  await el('tournament-bus-form').onsubmit({preventDefault(){}});
  assert.equal(saved[0].p_school,'marlboro');
  assert.equal(saved[0].p_expected_revision,4);
  assert.equal(saved[0].p_transport.bus_departure,'07:45');
});

test('dirty draft survives tab hide and is cleared after verified actor changes',async()=>{
  let role='conference_office';
  const {controller,el}=mount(async()=>({data:listing(role)}));
  await controller.load();
  el('tournament-name').value='Unsaved cup';el('tournament-name').onchange();
  controller.reset();await controller.load();
  assert.equal(el('tournament-name').value,'Unsaved cup');
  assert.equal(el('tournament-review').disabled,true);
  controller.reset();role='ad';await controller.load();
  assert.equal(el('tournament-manager').hidden,true);
  assert.equal(el('tournament-discard').hidden,true);
});

test('late save after stop cannot restore private tournament content',async()=>{
  let complete;
  const {controller,el}=mount(async(name)=>name==='list_tournaments'?{data:listing()}:new Promise(resolve=>complete=resolve));
  await controller.load();const saving=el('tournament-save').click();controller.stop();complete({data:record(2)});await saving;
  assert.equal(el('tournament-manager').hidden,true);
  assert.equal(el('tournament-select').children.length,0);
  assert.equal(el('tournament-new').onclick,null);
});

test('later publication sends only selected changed match IDs',async()=>{
  let args;
  const published={...record(3),published:doc(),published_revision:2};
  const {controller,el}=mount(async(name,input)=>{
    if(name==='list_tournaments')return {data:listing('site_admin',[published])};
    if(name==='review_tournament')return {data:{...published,token:'subset',changes:[{id:'m1',before:doc().matches[0],after:doc().matches[0]}],issues:[],affected_schools:[]}};
    args=input;return {data:published};
  });
  await controller.load();await el('tournament-review').click();
  el('tournament-publish-scope').value='selected';el('tournament-publish-scope').onchange();
  assert.equal(el('tournament-review-selection').hidden,false);
  await el('tournament-publish').click();
  assert.equal(JSON.stringify(args.p_match_ids),'["m1"]');
});

test('bracket replacement waits for explicit application and clears prior result fields',async()=>{
  let saved;
  const original=record();original.draft.matches[0].winner_id='p1';original.draft.matches[0].status='Final';
  const {controller,el}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:listing('conference_office',[original])};
    saved=args.p_document;return {data:{...record(2),draft:saved}};
  });
  await controller.load();el('tournament-generate').click();
  assert.equal(el('tournament-proposal').hidden,false);
  assert.equal(el('tournament-dirty').textContent,'Saved draft.');
  assert.match(el('tournament-proposal-summary').textContent,/Replaces all 1 existing matches/);
  el('tournament-proposal-apply').click();await el('tournament-save').click();
  assert.equal(saved.matches[0].winner_id,null);
});

test('explicit Clear result resets winner and scores while retaining match identity and time',async()=>{
  let saved;const original=record();Object.assign(original.draft.matches[0],{winner_id:'p1',status:'Final',score_a:3,score_b:1});
  const {controller,el}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:listing('conference_office',[original])};
    saved=args.p_document;return {data:{...record(2),draft:saved}};
  });
  await controller.load();el('tournament-match-m1-clear').click();await el('tournament-save').click();
  assert.equal(saved.matches[0].id,'m1');assert.equal(saved.matches[0].start_time,'09:00');
  assert.equal(saved.matches[0].winner_id,null);assert.equal(saved.matches[0].score_a,null);assert.equal(saved.matches[0].status,'Scheduled');
});

test('permission rejection clears draft and blocks writes until access is checked again',async()=>{
  let writes=0;
  const {controller,el}=mount(async(name)=>{
    if(name==='list_tournaments')return {data:listing()};
    writes++;return {error:{code:'42501'}};
  });
  await controller.load();await el('tournament-save').click();await el('tournament-save').click();
  assert.equal(writes,1);assert.equal(el('tournament-manager').hidden,true);assert.equal(el('tournament-select').children.length,0);
});

test('AD cannot send a bus update for an unconfirmed school participant',async()=>{
  const unrelated=doc();unrelated.matches.push({...unrelated.matches[0],id:'guest-match',a:{participant_id:'p2'},b:{participant_id:'p2'}});
  let writes=0;
  const {controller,el}=mount(async(name)=>{
    if(name==='list_tournaments')return {data:listing('ad',[{...record(),draft:undefined,published:unrelated,published_revision:1}])};
    writes++;return {data:{}};
  });
  await controller.load();el('tournament-bus-match').value='guest-match';await el('tournament-bus-form').onsubmit({preventDefault(){}});
  assert.equal(writes,0);
});

test('real-engine master CSV import previews an ID-preserving upsert before saving',async()=>{
  let saved;
  const {controller,el,engine}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:listing()};
    saved=args.p_document;return {data:{...record(2),draft:saved}};
  },true);
  await controller.load();const incoming=doc();incoming.matches[0].venue='Updated field';
  el('tournament-import-file').files=[{size:1000,text:async()=>engine.exportCsv(incoming,record().id)}];
  await el('tournament-import-file').onchange();el('tournament-import-preview').click();
  assert.equal(el('tournament-proposal').hidden,false);
  assert.match(el('tournament-proposal-summary').textContent,/0 new matches. 1 existing matches updated/);
  assert.equal(el('tournament-dirty').textContent,'Saved draft.');
  el('tournament-proposal-apply').click();await el('tournament-save').click();
  assert.equal(saved.matches.length,1);assert.equal(saved.matches[0].id,'m1');assert.equal(saved.matches[0].venue,'Updated field');
});

test('real-engine mapped CSV previews new guest teams and retains unmapped existing matches',async()=>{
  let saved;
  const {controller,el}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:listing()};
    saved=args.p_document;return {data:{...record(2),draft:saved}};
  },true);
  await controller.load();
  el('tournament-import-file').files=[{size:100,text:async()=> 'Game,Round,Host,Visitor\nguest-final,1,Guest Alpha,Guest Beta'}];
  await el('tournament-import-file').onchange();
  for(const [column,header] of Object.entries({match_id:'Game',round:'Round',a_name:'Host',b_name:'Visitor'}))el('tournament-map-'+column).value=header;
  el('tournament-import-preview').click();
  assert.equal(el('tournament-proposal').hidden,false);
  assert.match(el('tournament-proposal-summary').textContent,/1 new matches. 0 existing matches updated. 1 other matches kept/);
  el('tournament-proposal-apply').click();await el('tournament-save').click();
  assert.deepEqual(Array.from(saved.matches,match=>match.id).sort(),['guest-final','m1']);
  assert.ok(saved.participants.some(team=>team.name==='Guest Alpha'));
  assert.equal(saved.name,'Cup');assert.equal(saved.sport,'Softball');
  assert.equal(saved.participants.find(team=>team.id==='p1').name,'Marlboro');
  assert.notEqual(saved.matches.find(match=>match.id==='guest-final').a.participant_id,'p1');
  assert.equal(new Set(saved.participants.map(team=>team.seed)).size,saved.participants.length);
});

test('a CSV parsing error shows its problems without replacing the draft',async()=>{
  const {controller,el}=mount(async()=>({data:listing()}),true);
  await controller.load();el('tournament-import-file').files=[{size:40,text:async()=> 'match_id,round,a_name,b_name\n"broken,1,A,B'}];
  await el('tournament-import-file').onchange();el('tournament-import-preview').click();
  assert.equal(el('tournament-proposal').hidden,true);
  assert.match(el('tournament-status').textContent,/quot/i);
  assert.equal(el('tournament-dirty').textContent,'Saved draft.');
});

test('scheduler preview preserves working match times until explicitly applied',async()=>{
  let saved;
  const {controller,el}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:listing()};
    saved=args.p_document;return {data:{...record(2),draft:saved}};
  },true);
  await controller.load();el('tournament-add-window').click();
  el('tournament-window-0-date').value='2027-04-11';el('tournament-window-0-date').onchange();
  el('tournament-window-0-venue').value='New field';el('tournament-window-0-venue').onchange();
  await el('tournament-propose-schedule').click();
  assert.equal(el('tournament-proposal').hidden,false);
  assert.equal(el('tournament-match-m1-game_date').value,'2027-04-10');
  el('tournament-proposal-apply').click();await el('tournament-save').click();
  assert.equal(saved.matches[0].game_date,'2027-04-11');assert.equal(saved.matches[0].venue,'New field');
});

test('Escape cannot dismiss a publication while its checked write is in flight',async()=>{
  let complete;
  const {controller,el}=mount(async(name)=>{
    if(name==='list_tournaments')return {data:listing()};
    if(name==='review_tournament')return {data:{...record(),token:'checked',changes:[],issues:[],affected_schools:[]}};
    return new Promise(resolve=>complete=resolve);
  });
  await controller.load();await el('tournament-review').click();const publishing=el('tournament-publish').click();
  let prevented=false;el('tournament-review-dialog').oncancel({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);assert.equal(el('tournament-review-dialog').open,true);
  complete({data:{...record(2),published:doc(),published_revision:2}});await publishing;
  assert.equal(el('tournament-review-dialog').open,false);
});


const allText = element => [element.textContent ?? '',...element.children.map(child => typeof child === 'object' ? allText(child) : String(child))].join(' ');

test('publication review names changed teams, dates, times, venue and result without raw fields',async()=>{
  const before=doc();const after=doc();Object.assign(after.matches[0],{game_date:'2027-04-11',start_time:'10:30',venue:'Main Gym',status:'Final',winner_id:'p1',score_a:3,score_b:1});
  after.name='Renamed cup';
  const saved={...record(3),draft:after,published:before,published_revision:2};
  const {controller,el}=mount(async(name)=>name==='list_tournaments'?{data:listing('conference_office',[saved])}:{data:{...saved,token:'reviewed',changes:[{id:'m1',before:before.matches[0],after:after.matches[0]}],issues:[],affected_schools:['marlboro']}});
  await controller.load();await el('tournament-review').click();
  const text=allText(el('tournament-review-changes'));
  assert.match(text,/Renamed cup/);assert.match(text,/Apr 11, 2027/);assert.match(text,/10:30 AM/);assert.match(text,/Main Gym/);assert.match(text,/Winner.*Marlboro/);assert.match(text,/Score A.*3/);
  assert.doesNotMatch(text,/winner_id|participant_id|score_a|\{[\s\S]*\}/);
  assert.equal(el('tournament-review-changes').querySelectorAll('pre').length,0);
});

test('draft and proposal show separate round-card brackets with named teams and advancements',async()=>{
  const {controller,el}=mount(async()=>({data:listing()}),true);
  await controller.load();
  assert.match(allText(el('tournament-draft-bracket')),/Round 1/);
  assert.match(allText(el('tournament-draft-bracket')),/Marlboro/);
  assert.match(allText(el('tournament-draft-bracket')),/Apr 10, 2027/);
  assert.equal(el('tournament-draft-bracket').querySelectorAll('a').length,0);
  el('tournament-participants').value='1. Marlboro\n2. Guest';el('tournament-generate').click();
  assert.match(allText(el('tournament-proposal-bracket')),/Marlboro/);
  const draftIds=el('tournament-draft-bracket').querySelectorAll('*').map(item=>item.id).filter(Boolean);
  const proposalIds=el('tournament-proposal-bracket').querySelectorAll('*').map(item=>item.id).filter(Boolean);
  assert.equal(draftIds.some(id=>proposalIds.includes(id)),false);
});


test('manager can download a valid canonical example CSV template before creating a tournament',async()=>{
  const {controller,el,engine,downloads}=mount(async()=>({data:listing('conference_office',[])}),true);
  await controller.load();await el('tournament-template').click();
  assert.equal(downloads.length,1);
  const csv=await downloads[0].text();
  assert.equal(csv.split('\r\n')[0],engine.csvHeaders.join(','));
  const parsed=engine.parseCsv(csv,{},[{slug:'marlboro',name:'Marlboro'},{slug:'colts-neck',name:'Colts Neck'}]);
  assert.equal(parsed.errors.length,0);assert.equal(parsed.tournament_id,null);
  assert.deepEqual(Array.from(parsed.document.participants,team=>team.name).sort(),['Colts Neck','Marlboro']);
  assert.match(parsed.document.name,/example/i);assert.equal(parsed.document.matches.length,1);
  assert.equal(engine.validate(parsed.document).length,0);
});

test('own published matches are excluded from draft checks and scheduling while other games still conflict',async()=>{
  const saved=record();saved.draft.windows=[{date:'2027-04-10',start:'09:00',end:'18:00',venue:'Field'}];
  const own={id:'tournament-'+saved.id+'-m1',school_ids:['marlboro'],game_date:'2027-04-10',start_time:'09:00',duration_minutes:90,venue:'Field'};
  const unrelated={...own,id:'other-school-game',school_ids:['other-school']};
  const {controller,el}=mount(async()=>({data:{...listing('conference_office',[saved]),conflicts:[own,unrelated]}}),true);
  await controller.load();
  assert.equal(el('tournament-issues').children.length,1);
  assert.match(allText(el('tournament-issues')),/other-school-game/);
  assert.doesNotMatch(allText(el('tournament-issues')),/tournament-11111111/);
  await el('tournament-propose-schedule').click();el('tournament-proposal-apply').click();
  assert.equal(el('tournament-match-m1-start_time').value,'10:45');
});

test('import proposal excludes the target tournament snapshots while preserving the currently selected tournament conflicts',async()=>{
  const selected=record();const target={...record(),id:'33333333-3333-4333-8333-333333333333'};
  const own={id:'tournament-'+target.id+'-m1',school_ids:['marlboro'],game_date:'2027-04-10',start_time:'09:00',duration_minutes:90,venue:'Field'};
  const other={...own,id:'tournament-'+selected.id+'-m1'};
  const {controller,el,engine}=mount(async()=>({data:{...listing('conference_office',[selected,target]),conflicts:[own,other]}}),true);
  await controller.load();el('tournament-import-file').files=[{size:500,text:async()=>engine.exportCsv(target.draft,target.id)}];
  await el('tournament-import-file').onchange();el('tournament-import-preview').click();
  assert.equal(el('tournament-proposal-issues').children.length,2);
  assert.match(allText(el('tournament-proposal-issues')),/tournament-11111111/);
  assert.doesNotMatch(allText(el('tournament-proposal-issues')),/tournament-33333333/);
});

test('metadata offers supported gender, level and season choices and limits tournament names',async()=>{
  const {controller,el}=mount(async()=>({data:listing()}));await controller.load();
  for(const [name,values] of Object.entries({gender:['Boys','Girls','Coed'],level:['Varsity','JV','Freshman'],season:['Fall','Winter','Spring']})){
    const select=el('tournament-'+name);assert.equal(select.tagName,'SELECT');
    assert.deepEqual(select.children.map(item=>item.value),values);
  }
  assert.equal(el('tournament-name').maxLength,120);
});


test('scheduling a new cup refreshes other published games after publishing the first cup in the same session',async()=>{
  let published=false;let lists=0;const cup=record();
  const {controller,el}=mount(async(name)=>{
    if(name==='list_tournaments'){
      lists++;
      return {data:{...listing('conference_office',[published?{...cup,published:doc(),published_revision:1}:cup]),conflicts:published?[{id:'tournament-'+cup.id+'-m1',school_ids:['marlboro'],game_date:'2027-04-10',start_time:'09:00',duration_minutes:90,venue:'Field'}]:[]}};
    }
    if(name==='review_tournament')return {data:{...cup,token:'checked',changes:[],issues:[],affected_schools:[]}};
    published=true;return {data:{...cup,published:doc(),published_revision:1}};
  },true);
  await controller.load();await el('tournament-review').click();await el('tournament-publish').click();
  el('tournament-new').click();el('tournament-name').value='Second cup';el('tournament-name').onchange();el('tournament-sport').value='Softball';el('tournament-sport').onchange();
  el('tournament-participants').value='1. Marlboro\n2. Guest';el('tournament-generate').click();el('tournament-proposal-apply').click();
  el('tournament-add-window').click();el('tournament-window-0-date').value='2027-04-10';el('tournament-window-0-date').onchange();el('tournament-window-0-venue').value='Field';el('tournament-window-0-venue').onchange();
  await el('tournament-propose-schedule').click();
  assert.equal(lists,2);assert.match(allText(el('tournament-proposal-bracket')),/11:30 AM/);
});

test('a late schedule refresh cannot show a proposal after leaving the tab',async()=>{
  let lists=0,complete;
  const {controller,el}=mount(async()=>++lists===1?{data:listing()}:new Promise(resolve=>complete=resolve),true);
  await controller.load();const scheduling=el('tournament-propose-schedule').click();controller.reset();complete({data:listing()});await scheduling;
  assert.equal(el('tournament-proposal').hidden,true);assert.equal(el('tournament-manager').hidden,true);
});

test('schedule refresh rechecks changed actor permissions before using private drafts',async()=>{
  let lists=0;
  const {controller,el}=mount(async()=>({data:++lists===1?listing():listing('ad',[{...record(),draft:undefined,published:doc(),published_revision:1}])}),true);
  await controller.load();await el('tournament-propose-schedule').click();
  assert.equal(el('tournament-proposal').hidden,true);assert.equal(el('tournament-manager').hidden,true);
  assert.equal(el('tournament-transport').hidden,false);assert.match(el('tournament-status').textContent,/access changed/);
});

test('failed conflict refresh keeps the published record and gives no schedule proposal',async()=>{
  let lists=0;
  const posted={...record(),published:doc(),published_revision:1};
  const {controller,el}=mount(async()=>++lists===1?{data:listing('conference_office',[posted])}:{error:{message:'Network failure'}},true);
  await controller.load();await el('tournament-propose-schedule').click();
  assert.equal(el('tournament-proposal').hidden,true);assert.equal(el('tournament-select').children.length,1);
  assert.equal(el('tournament-review').disabled,false);assert.match(el('tournament-status').textContent,/no schedule was proposed.*Posted games stay unchanged/);
});

test('CSV null window is rejected with an understandable error while the existing draft stays usable',async()=>{
  const {controller,el}=mount(async()=>({data:listing()}),true);
  await controller.load();
  el('tournament-import-file').files=[{size:90,text:async()=> 'match_id,round,a_name,b_name,windows\nm1,1,Guest A,Guest B,"[null]"'}];
  await el('tournament-import-file').onchange();el('tournament-import-preview').click();
  assert.match(el('tournament-status').textContent,/playing window.*Remove empty or invalid entries/i);
  assert.equal(el('tournament-proposal').hidden,true);
  assert.equal(el('tournament-name').value,'Cup');
  assert.equal(el('tournament-match-m1-venue').value,'Field');
  el('tournament-name').value='Still editable';el('tournament-name').onchange();
  assert.match(el('tournament-dirty').textContent,/Unsaved draft/);
});

function mountStaffSchedule(role) {
  const registry=new Map();
  const document={
    getElementById(id){
      if(!registry.has(id)){
        const element=new Element('div',registry);element.id=id;
        element.parentElement=new Element('div',registry);
        element.parentElement.querySelector=()=>null;
        registry.set(id,element);
      }
      return registry.get(id);
    },
    createElement(tag){return new Element(tag,registry);},
  };
  const el=id=>document.getElementById(id);
  const makeSelect=id=>{
    const element=el(id);element.tagName='SELECT';
    element.replaceChildren=function(...children){this.children=children;this.value=children[0]?.value??'';};
    element.add=option=>element.append(option);
    Object.defineProperty(element,'options',{get:()=>element.children});
    Object.defineProperty(element,'selectedOptions',{get:()=>element.children.filter(option=>option.value===element.value)});
    return element;
  };
  makeSelect('schedule-school');makeSelect('view-as');
  const gameForm=el('game-form');
  const gameNames=['sport','gender','level','season','game_date','start_time','home_away','status','opponent_school_id','opponent_name','location','notes','bus_departure','pickup_location','early_dismissal_time','return_time','transport_notes'];
  gameForm.elements=gameNames.map(name=>{
    const item=name==='opponent_school_id'?makeSelect('game-'+name):new Element('input',registry);
    item.name=name;return item;
  });
  for(const item of gameForm.elements)gameForm.elements[item.name]=item;
  gameForm.reset=()=>{for(const item of gameForm.elements)item.value='';};
  const saveButton=new Element('button',registry);
  gameForm.querySelector=()=>saveButton;
  const filters=el('staff-filters');
  filters.elements=Object.fromEntries(['season','sport','level','gender'].map(name=>[name,new Element('select',registry)]));
  filters.reset=()=>{for(const item of Object.values(filters.elements))item.value='';};
  el('workspace-account').textContent='Invited test account';
  for(const id of ['staff-transportation-panel','staff-settings-panel','staff-overview-panel','staff-coaches-panel','staff-access-workspace','staff-tournaments-panel'])el(id).hidden=true;
  const schools=[{slug:'marlboro',name:'Marlboro'},{slug:'colts-neck',name:'Colts Neck'}];
  const calls=[];
  const rpc=async(name,args)=>{
    calls.push({name,args});
    return {data:listing(role,role==='ad'?[{...record(),draft:undefined,published:doc(),published_revision:1}]:[record()])};
  };
  const client={rpc,from(table){
    const query={select(){return query;},eq(){return query;},order(){return query;},then(resolve,reject){return Promise.resolve({data:table==='schools'?schools:[]}).then(resolve,reject);}};
    return query;
  }};
  const stub=()=>({reset(){},load:async()=>{},render(){},stop(){},setPreview(){},sync(){},showSettings(){},coaches:()=>[],states:()=>({map:new Map(),removed:0}),groups:()=>[],links:()=>null,setStatus(){}});
  const context=vm.createContext({document,window:{},console,crypto:{randomUUID:()=> '22222222-2222-4222-8222-222222222222'},
    Option:function(text,value){const option=new Element('option',registry);option.textContent=text;option.text=text;option.value=value;return option;},
    workspaceTitles:{site_admin:'Site admin workspace',conference_office:'Conference admin workspace',ad:'Athletic Director workspace'},
    applySchoolTheme(){},fillSeasonFilters(){},fillSportOptions(){},setTimeout,
  });
  for(const file of ['staff-import.js','tournament-engine.js'])vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
  vm.runInContext(readFileSync(new URL('../js/tournament-public.js',import.meta.url),'utf8').split('(async () => {')[0],context);
  for(const name of ['startStaffAccess','startStaffOverview','startStaffCoaches','startCoachImport','startStaffImport','startStaffSettings','startStaffPublication','startStaffTransportation','startStaffVenues','startStaffTeams'])context[name]=stub;
  for(const file of ['staff-tournaments.js','staff-schedule.js'])vm.runInContext(readFileSync(new URL('../js/'+file,import.meta.url),'utf8'),context);
  let tournamentStarts=0;
  const realTournamentController=context.startStaffTournaments;
  context.startStaffTournaments=(...args)=>{tournamentStarts++;return realTournamentController(...args);};
  const stop=context.startStaffSchedule(client,{role,school_id:role==='ad'?'marlboro':null});
  return {el,stop,calls,starts:()=>tournamentStarts,settle:()=>new Promise(resolve=>setImmediate(resolve))};
}

for(const role of ['conference_office','site_admin','ad'])test('normal staff entrypoint routes '+role+' through the Tournaments tab and cleans up',async()=>{
  const {el,stop,calls,starts,settle}=mountStaffSchedule(role);await settle();
  assert.equal(el('staff-tournaments-panel').hidden,true);
  await el('staff-tournaments-tab').click();await settle();
  assert.equal(el('staff-tournaments-panel').hidden,false);
  assert.equal(el('staff-tournaments-tab')['aria-current'],'true');
  assert.equal(el('schedule-school').parentElement.hidden,true);
  assert.equal(el('add-calendar-game').hidden,true);
  assert.equal(el('tournament-manager').hidden,role==='ad');
  assert.equal(el('tournament-transport').hidden,role!=='ad');
  if(role!=='ad'){
    el('tournament-name').value='Private unsaved cup';el('tournament-name').onchange();
  }
  el('staff-schedule-tab').click();
  assert.equal(el('staff-tournaments-panel').hidden,true);
  assert.equal(el('schedule-school').parentElement.hidden,false);
  assert.equal(el('add-calendar-game').hidden,role==='conference_office');
  await el('staff-tournaments-tab').click();await settle();
  if(role!=='ad')assert.equal(el('tournament-name').value,'Private unsaved cup');
  assert.equal(starts(),1);
  assert.equal(calls.filter(call=>call.name==='list_tournaments').length,2);
  stop();
  assert.equal(el('staff-tournaments-tab').onclick,null);
  assert.equal(el('tournament-manager').hidden,true);
  assert.equal(el('tournament-select').children.length,0);
  assert.equal(el('tournament-metadata').children.length,0);
});

test('a rules and dates edit marks the draft unsaved and is sent with the save',async()=>{
  const calls=[];
  const {controller,el}=mount(async(name,args)=>{
    calls.push({name,args});
    if(name==='list_tournaments')return {data:listing()};
    return {data:{...record(2),draft:args.p_document}};
  });
  await controller.load();
  assert.equal(el('tournament-discard').hidden,true);
  const link=el('tournament-info-rules-url');link.value='https://theshoreconference.com/rules.pdf';link.onchange();
  assert.equal(el('tournament-discard').hidden,false);
  el('tournament-add-date').click();
  const label=el('tournament-date-0-label');label.value='Qualification cutoff';label.onchange();
  assert.equal(el('tournament-info-dates').children[0].children.some(item=>item.textContent==='Needs date confirmation'),true);
  await el('tournament-save').click();
  const sent=calls.at(-1).args.p_document;
  assert.equal(sent.info.rules_url,'https://theshoreconference.com/rules.pdf');
  assert.deepEqual(JSON.parse(JSON.stringify(sent.info.dates)),[{label:'Qualification cutoff',date:'',confirmed:false,note:''}]);
  assert.equal(sent.matches.length,doc().matches.length);
  assert.match(el('tournament-status').textContent,/^Draft saved\. /);
});

test('a save that comes back without rules and dates says so and keeps them',async()=>{
  const {controller,el}=mount(async(name,args)=>{
    if(name==='list_tournaments')return {data:listing()};
    const draft={...args.p_document};delete draft.info;
    return {data:{...record(2),draft}};
  });
  await controller.load();
  const director=el('tournament-info-director');director.value='Pat Example';director.onchange();
  await el('tournament-save').click();
  assert.match(el('tournament-status').textContent,/Rules and dates were not/);
  assert.equal(el('tournament-info-director').value,'Pat Example');
  assert.equal(el('tournament-discard').hidden,false);
});

test('clearing every rules and dates field removes the section from the draft',async()=>{
  const calls=[];
  const withInfo={...record(),draft:{...doc(),info:{rules_url:'',director:'Pat Example',director_confirmed:false,reviewed_on:'',dates:[]}}};
  const {controller,el}=mount(async(name,args)=>{
    calls.push({name,args});
    if(name==='list_tournaments')return {data:listing('conference_office',[withInfo])};
    return {data:{...record(2),draft:args.p_document}};
  });
  await controller.load();
  const director=el('tournament-info-director');director.value='';director.onchange();
  await el('tournament-save').click();
  assert.equal('info' in calls.at(-1).args.p_document,false);
});
