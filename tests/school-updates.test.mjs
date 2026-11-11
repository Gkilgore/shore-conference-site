// Checks public season notices and change summaries without a browser or external packages.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
const context = vm.createContext({});
const source = new URL('../js/school-updates.js', import.meta.url);
if (existsSync(source)) vm.runInContext(readFileSync(source, 'utf8'), context);

const team = { team_id: 'baseball-v', sport: 'Baseball', gender: 'Boys', level: 'Varsity', published_at: '2027-02-01T12:00:00Z' };
test('season notices identify the year and only the teams actually posted', () => {
  const notices = context.schoolSeasonNotices({ seasons: [
    { season: 'Spring', season_year: 2027, published_at: team.published_at, teams: [team] },
    { season: 'Spring', season_year: 2028, published_at: '2028-02-01T12:00:00Z', teams: [{...team, team_id:'baseball-jv', level:'JV'}] },
  ], events: [{sport:'Softball', gender:'Girls', level:'Varsity'}], drafts: [{sport:'Lacrosse'}] });
  assert.equal(notices.length, 2);
  assert.equal(notices[1].headline, 'Spring 2027 schedules are now posted');
  assert.equal(notices[1].detail, '1 team posted: Boys Varsity Baseball.');
  assert.ok(!JSON.stringify(notices).includes('Softball'));
  assert.ok(!JSON.stringify(notices).includes('Lacrosse'));
});

test('winter labels span both years, deduplicate team IDs and skip empty seasons', () => {
  const notices = context.schoolSeasonNotices({ seasons: [
    {season:'Winter',season_year:2027,published_at:team.published_at,teams:[team,{...team}]},
    {season:'Fall',season_year:2027,teams:[]},
  ] });
  assert.equal(notices.length, 1);
  assert.equal(notices[0].headline, 'Winter 2027–28 schedules are now posted');
  assert.equal(notices[0].teams.length, 1);
  assert.equal(context.schoolSeasonNotices({events:[team],drafts:[team]}).length, 0);
});

test('posted season links open a month containing an approved game, including winter across years', () => {
  const notices = context.schoolSeasonNotices({seasons:[
    {season:'Spring',season_year:2027,teams:[team]},
    {season:'Winter',season_year:2027,teams:[team]},
  ],events:[
    {season:'Spring',start:'2028-03-20T15:00:00'},
    {season:'Spring',start:'2027-04-15T15:00:00'},
    {season:'Spring',start:'2027-04-02T15:00:00'},
    {season:'Winter',start:'2028-01-10T15:00:00'},
  ]});
  assert.equal(notices.find(item=>item.season==='Spring').date,'2027-04-02');
  assert.equal(notices.find(item=>item.season==='Winter').date,'2028-01-10');
});

test('public updates name approved changes and ignore private fields and drafts', () => {
  const before = {game_date:'2027-04-02',start_time:'15:00:00',location:'Main field',status:'Scheduled',
    transportation:{bus_departure:'14:00:00',pickup_location:'Gym',return_time:'18:00:00',notes:'Private',bus_confirmed:false}};
  const after = {...before,start_time:'16:00:00',location:'West field',notes:'Do not show notes',
    transportation:{...before.transportation,bus_departure:'15:00:00',notes:'New private note',bus_confirmed:true}};
  const updates = context.schoolPublicUpdates({updates:[{id:'change-1',kind:'game_changed',season:'Spring',season_year:2027,
    sport:'Baseball',gender:'Boys',level:'Varsity',occurred_at:'2027-04-01T12:00:00Z',before,after,
    draft:{location:'Draft field'},actor_email:'private@example.com'}]});
  assert.equal(updates[0].team, 'Boys Varsity Baseball · Spring 2027');
  assert.equal(updates[0].headline, 'Game updated');
  assert.deepEqual(Array.from(updates[0].changes), ['Start time: 3:00 PM → 4:00 PM', 'Venue: Main field → West field', 'Bus departure: 2:00 PM → 3:00 PM']);
  const output = JSON.stringify(updates);
  for (const privateValue of ['Private','private@','Draft field','Do not show notes','bus_confirmed']) assert.ok(!output.includes(privateValue));
});

test('update list is newest first, limited to 20, and accepts only public update kinds', () => {
  const updates = Array.from({length:23},(_,i)=>({id:String(i),kind:'team_posted',...team,season:'Spring',season_year:2027,
    occurred_at:'2027-02-' + String(i+1).padStart(2,'0') + 'T12:00:00Z'}));
  updates.push({kind:'draft_saved',occurred_at:'2027-03-01T12:00:00Z'});
  updates.push({kind:'game_changed',occurred_at:'bad date'});
  const result = context.schoolPublicUpdates({updates});
  assert.equal(result.length,20);
  assert.equal(result[0].id,'22');
  assert.equal(result[0].headline,'Team schedule posted');
});

test('withdrawal, cancellation, postponement and new games have clear public labels', () => {
  for (const [kind,expected] of [['team_unpublished','Team schedule withdrawn'],['game_canceled','Game canceled'],
    ['game_postponed','Game postponed'],['game_added','Game added']]) {
    const [update] = context.schoolPublicUpdates({updates:[{kind,occurred_at:'2027-02-01T12:00:00Z',...team,
      season:'Spring',season_year:2027,after:{game_date:'2027-04-02',start_time:'15:00:00',location:'Home field'}}]});
    assert.equal(update.headline,expected);
    assert.ok(update.team.includes('Spring 2027'));
  }
});

test('rendered text uses DOM text properties for school/team/update values', () => {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.textContent = ''; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(name,value) { this[name]=value; }
    set innerHTML(value) { throw new Error('Untrusted HTML was inserted: ' + value); }
  }
  context.document = {createElement:tag=>new Element(tag)};
  const seasons = new Element('div'), updates = new Element('ul');
  context.renderSchoolSeasons(seasons, {seasons:[{season:'Spring',season_year:2027,published_at:team.published_at,
    teams:[{...team,sport:'<img src=x onerror=alert(1)>'}]}]});
  context.renderSchoolUpdates(updates, {updates:[{kind:'game_changed',...team,season:'Spring',season_year:2027,
    occurred_at:team.published_at,before:{location:'Field'},after:{location:'<script>bad()</script>'}}]});
  assert.ok(JSON.stringify(seasons).includes('<img src=x onerror=alert(1)>'));
  assert.ok(JSON.stringify(updates).includes('<script>bad()</script>'));
  context.renderSchoolUpdates(updates, {});
  assert.ok(JSON.stringify(updates).includes('Published changes will appear here.'));
});

function subscriptionContext(schedule, search = '?school=asbury-park&season=Spring') {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{hidden:false,textContent:'',value:'',firstChild:{textContent:''},addEventListener(){}});
    return elements.get(id);
  };
  const select = () => ({value:'',options:[{value:'',textContent:''}],add(option){this.options.push(option);},addEventListener(){}});
  const fields = Object.fromEntries(['scope','school','sport','gender','level','search'].map(name=>[name,select()]));
  element('subscription-filters').elements = fields;
  const requests = [];
  const sandbox = vm.createContext({
    document:{getElementById:element},shoreSchools:{'asbury-park':{name:'Asbury Park'}},sportSeasons:{Spring:['Baseball']},
    location:{search},URLSearchParams,history:{replaceState(){}},setTimeout,clearTimeout,
    Option:class {constructor(text,value){this.textContent=text;this.value=value;}},
    loadPublicCalendar:async options=>{requests.push(options);return schedule;},
    calendarFeedUrl:options=>'https://calendar.example/feed?' + new URLSearchParams(options),
  });
  return {sandbox,element,requests};
}

test('families can subscribe before the first team is posted, with stable URLs', async () => {
  const fixture = subscriptionContext({published:false,name:'Asbury Park',events:[],seasons:[],updates:[]});
  vm.runInContext(readFileSync(new URL('../js/subscribe.js',import.meta.url),'utf8'),fixture.sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.element('subscription-actions').hidden,false);
  assert.equal(fixture.element('subscription-url').value,'https://calendar.example/feed?scope=school&school=asbury-park');
  assert.equal(fixture.element('subscribe-apple').href,'webcal://calendar.example/feed?scope=school&school=asbury-park');
  assert.match(fixture.element('subscription-status').textContent,/More are added as the school publishes them/);
});

test('unknown-school subscriptions show a clear error and expose no subscription actions', async () => {
  const fixture = subscriptionContext({published:false,name:'Unknown',events:[]},'?school=unknown');
  vm.runInContext(readFileSync(new URL('../js/subscribe.js',import.meta.url),'utf8'),fixture.sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fixture.element('subscription-actions').hidden,true);
  assert.equal(fixture.requests.length,0);
  assert.match(fixture.element('subscription-status').textContent,/School not found/);
});

test('production school pages use the complete directory and never read fictional games', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{hidden:false,textContent:'',replaceChildren(){}});
    return elements.get(id);
  };
  let fetchedSchool;
  const sandbox = vm.createContext({
    location:{search:'?school=asbury-park',hostname:'example.github.io'},URLSearchParams,
    shoreSchools:{'asbury-park':{name:'Asbury Park',color:'#000000',accent:'#ffffff'}},
    document:{title:'',getElementById:element,createElement:()=>({textContent:''}),querySelector:()=>({}),
      documentElement:{style:{setProperty(){}}}},
    buildLogoWall(){},readableInk:()=> '#ffffff',schoolSite:()=>null,renderTeamInfo(){},window:{addEventListener(){}},
    loadPublicCalendar:async options=>{fetchedSchool=options.school;return {events:[],published:false,seasons:[],updates:[]};},
    publicCalendarEvents:schedule=>schedule.events,renderSchoolSeasons(){},renderSchoolUpdates(){},renderUpcoming(){},renderCalendar(){},
    setSubscriptionLink(){element('subscribe-calendar').hidden=false;},
  });
  Object.defineProperty(sandbox,'sampleGames',{get(){throw new Error('Production accessed fictional games');}});
  vm.runInContext(readFileSync(new URL('../js/school.js',import.meta.url),'utf8'),sandbox);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(fetchedSchool,'asbury-park');
  assert.equal(element('school-logo').src,'assets/logos/shore-conference.svg');
  assert.equal(element('subscribe-calendar').hidden,false);
  assert.equal(element('public-schedule-status').textContent,'All times Eastern');
  assert.equal(element('school-postings').hidden,true);
  assert.equal(element('recent-updates').hidden,true);
});
