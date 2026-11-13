// Ensures scheduled-bus visibility no longer depends on a transportation confirmation.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor() { this.children = []; this.hidden = false; this.textContent = ''; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
}

const elements = new Map();
const context = vm.createContext({
  document: {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); },
  },
});
vm.runInContext(readFileSync(new URL('../js/staff-overview.js', import.meta.url), 'utf8'), context);

test('transportation list shows scheduled away buses without a confirmation step', () => {
  const overview = context.startStaffOverview({}, {
    currentSchool: () => ({ slug: 'marlboro' }), gameTitle: game => game.title,
    canEdit: () => true, openEditor() {},
  });
  overview.render([
    { id: 'bus-set', title: 'Girls Varsity Soccer', game_date: '2099-09-01', start_time: '15:00:00',
      home_away: 'Away', status: 'Scheduled', transportation: { bus_departure: '14:00:00', bus_confirmed: false } },
    { id: 'no-bus', title: 'Boys Varsity Soccer', game_date: '2099-09-02', start_time: '15:00:00',
      home_away: 'Away', status: 'Scheduled', transportation: { bus_departure: null, bus_confirmed: true } },
    { id: 'canceled', title: 'Girls JV Soccer', game_date: '2099-09-03', start_time: '15:00:00',
      home_away: 'Away', status: 'Canceled', transportation: { bus_departure: '14:00:00' } },
  ]);
  const [row] = elements.get('bus-list').children;
  assert.equal(row.children[1].textContent, 'Girls Varsity Soccer');
  assert.match(row.children[2].children[0].textContent, /Bus departure 2:00 PM/);
  assert.doesNotMatch(JSON.stringify(elements.get('bus-list')), /confirm/i);
});
