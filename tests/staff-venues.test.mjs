// Covers the school venue editor's setup and permission states.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor() {
    this.children = [];
    this.hidden = false;
    this.value = '';
    this.dataset = {};
    this.classList = { add() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this[name] = value; }
  addEventListener() {}
  removeEventListener() {}
  focus() {}
}

function mount(result) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); },
  };
  const fields = {
    location: new Element(),
    home_away: Object.assign(new Element(), { value: 'Home' }),
    opponent_school_id: new Element(),
  };
  const addForm = document.getElementById('venue-add');
  addForm.elements = { venue_name: new Element(), venue_address: new Element() };
  document.getElementById('venue-pick').firstChild = { textContent: '' };
  const client = { from: () => ({ select: async () => result }) };
  const context = vm.createContext({ document, Option: class {}, });
  vm.runInContext(readFileSync(new URL('../js/staff-venues.js', import.meta.url), 'utf8'), context);
  const controller = context.startStaffVenues(client, {
    currentSchool: () => ({ slug: 'marlboro', name: 'Marlboro' }),
    schools: () => [],
    fields,
  });
  return { controller, document };
}

test('missing venue table explains the test-project setup and keeps edits disabled', async () => {
  const { controller, document } = mount({ data: null, error: { code: 'PGRST205' } });
  await controller.load();
  assert.match(document.getElementById('venue-status').textContent, /apply the venue migration in the test project/);
  assert.equal(document.getElementById('venue-add').hidden, true);
});

test('other venue load errors are not mislabeled as missing database setup', async () => {
  const { controller, document } = mount({ data: null, error: { code: '42501' } });
  await controller.load();
  assert.match(document.getElementById('venue-status').textContent, /could not load/);
  assert.doesNotMatch(document.getElementById('venue-status').textContent, /apply the venue migration/);
});

test('a successful venue load enables the add form and row editing controls', async () => {
  const { controller, document } = mount({
    data: [{ id: 'venue-1', school_id: 'marlboro', name: 'Main Gym', address: null }],
    error: null,
  });
  await controller.load();
  assert.equal(document.getElementById('venue-add').hidden, false);
  const [venue] = document.getElementById('venue-list').children;
  assert.equal(venue.children[0].disabled, false);
  assert.equal(venue.children[2].textContent, 'Save');
  assert.equal(venue.children[3].hidden, false);
});
