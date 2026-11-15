// Verifies manually adding a non-conference opponent to a school's list.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function makeElement() {
  return {
    value: '',
    children: [],
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    setAttribute() {},
    querySelector() { return submit; },
  };
}

test('AD can add a named opponent and duplicate names do not make a second request', async () => {
  const nodes = new Map();
  const submit = makeElement();
  submit.disabled = false;
  for (const id of ['opponents-status', 'opponent-name', 'opponent-list']) nodes.set(id, makeElement());
  const form = makeElement();
  form.querySelector = () => submit;
  nodes.set('opponent-add-form', form);
  const input = nodes.get('opponent-name');
  let directory = [{ slug: 'marlboro', name: 'Marlboro' }];
  let shortlist = [];
  const calls = [];
  const client = {
    from(table) {
      if (table === 'opponent_directory') return {
        select: () => ({ order: async () => ({ data: directory, error: null }) }),
      };
      return {
        select: () => ({ eq: async () => ({ data: shortlist, error: null }) }),
      };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      directory = [...directory, { slug: 'north-harbor-high-school', name: args.p_name }];
      shortlist = [...shortlist, { opponent_slug: 'north-harbor-high-school' }];
      return { data: { slug: 'north-harbor-high-school', name: args.p_name, added: true }, error: null };
    },
  };
  const context = vm.createContext({
    document: {
      getElementById: id => nodes.get(id),
      createElement: makeElement,
    },
  });
  vm.runInContext(readFileSync(new URL('../js/staff-opponents.js', import.meta.url), 'utf8'), context);
  const controller = context.startStaffOpponents(client, {
    currentSchool: () => ({ slug: 'marlboro', name: 'Marlboro' }),
    activeSchools: () => [{ slug: 'marlboro', name: 'Marlboro' }],
  });
  await controller.load();
  input.value = '  North Harbor High School  ';
  let prevented = false;
  await form.onsubmit({ preventDefault: () => { prevented = true; } });

  assert.equal(prevented, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, 'add_school_opponent');
  assert.equal(calls[0].args.p_school, 'marlboro');
  assert.equal(calls[0].args.p_name, 'North Harbor High School');
  assert.deepEqual(nodes.get('opponent-list').children.map(row => row.children[0].textContent), [
    'North Harbor High School',
  ]);
  assert.match(nodes.get('opponents-status').textContent, /added to your opponent list/);

  input.value = 'north harbor high school';
  await form.onsubmit({ preventDefault() {} });
  assert.equal(calls.length, 1);
  assert.match(nodes.get('opponents-status').textContent, /already on your opponent list/);
  controller.stop();
});

test('AD cannot add an empty name or their own school', async () => {
  const nodes = new Map();
  const submit = makeElement();
  const form = makeElement();
  form.querySelector = () => submit;
  for (const id of ['opponents-status', 'opponent-name', 'opponent-list']) nodes.set(id, makeElement());
  nodes.set('opponent-add-form', form);
  const calls = [];
  const context = vm.createContext({
    document: {
      getElementById: id => nodes.get(id),
      createElement: makeElement,
    },
  });
  vm.runInContext(readFileSync(new URL('../js/staff-opponents.js', import.meta.url), 'utf8'), context);
  const controller = context.startStaffOpponents({
    from: () => ({ select: () => ({ order: async () => ({ data: [], error: null }) }) }),
    rpc: async (...args) => { calls.push(args); return { data: null, error: null }; },
  }, {
    currentSchool: () => ({ slug: 'marlboro', name: 'Marlboro' }),
    activeSchools: () => [{ slug: 'marlboro', name: 'Marlboro' }],
  });

  await form.onsubmit({ preventDefault() {} });
  assert.match(nodes.get('opponents-status').textContent, /Enter a school name/);
  nodes.get('opponent-name').value = 'Marlboro';
  await form.onsubmit({ preventDefault() {} });
  assert.match(nodes.get('opponents-status').textContent, /cannot be its own opponent/);
  assert.equal(calls.length, 0);
  controller.stop();
});
