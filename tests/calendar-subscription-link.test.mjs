// Checks that notice-driven calendar navigation and subscription choices stay in sync.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('selecting a posted season updates the subscription to the displayed season',()=>{
  const events=new Map(),link={};
  const filters={elements:{season:{value:'Winter'},sport:{value:''},gender:{value:''},level:{value:''},search:{value:''}},addEventListener(){}};
  const context=vm.createContext({URL,URLSearchParams,location:{search:''},setTimeout:fn=>fn(),
    document:{getElementById:id=>id==='subscribe-calendar'?link:filters},window:{addEventListener:(type,fn)=>events.set(type,fn)}});
  vm.runInContext(readFileSync(new URL('../js/public-calendar.js',import.meta.url),'utf8'),context);
  context.setSubscriptionLink({scope:'school',school:'marlboro'});
  assert.equal(new URL(link.href,'https://example.org').searchParams.get('season'),'Winter');
  filters.elements.season.value='Spring';
  events.get('shore:season-selected')?.();
  assert.equal(new URL(link.href,'https://example.org').searchParams.get('season'),'Spring');
});
