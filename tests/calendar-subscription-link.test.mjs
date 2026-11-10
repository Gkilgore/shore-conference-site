// Checks that the subscribe link follows the calendar's filters and never narrows by season.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('the subscription link carries the chosen filters and no season',()=>{
  const events=new Map(),link={};
  const filters={elements:{season:{value:'Winter'},sport:{value:'Soccer'},gender:{value:''},level:{value:''},search:{value:''}},
    addEventListener:(type,fn)=>events.set(type,fn)};
  const context=vm.createContext({URL,URLSearchParams,location:{search:''},setTimeout:fn=>fn(),
    document:{getElementById:id=>id==='subscribe-calendar'?link:filters},window:{addEventListener:(type,fn)=>events.set(type,fn)}});
  vm.runInContext(readFileSync(new URL('../js/public-calendar.js',import.meta.url),'utf8'),context);
  context.setSubscriptionLink({scope:'school',school:'marlboro'});
  const params=()=>new URL(link.href,'https://example.org').searchParams;
  assert.equal(params().get('season'),null);
  assert.equal(params().get('sport'),'Soccer');
  filters.elements.sport.value='Basketball';
  events.get('input')();
  assert.equal(params().get('sport'),'Basketball');
});
