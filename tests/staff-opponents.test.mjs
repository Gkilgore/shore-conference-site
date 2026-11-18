// Verifies saved-school add, rename, delete and school-specific staff views.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function element() {
  return {
    value: '', children: [], hidden: false, disabled: false,
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    setAttribute() {}, focus() {}, reset() { this.resetCount = (this.resetCount ?? 0) + 1; },
    showModal() { this.open = true; }, close() { this.open = false; },
  };
}

function setup() {
  const ids = ['opponents-status', 'opponent-add-form', 'opponent-list', 'opponent-name',
    'opponent-address', 'delete-opponent-dialog', 'delete-opponent-summary',
    'delete-opponent-confirm'];
  const nodes = new Map(ids.map(id => [id, element()]));
  let school = { slug: 'marlboro', name: 'Marlboro' };
  let rows = [{ slug: 'colts-neck', name: 'Colts Neck', source: 'conference' }];
  const calls = [];
  const client = {
    from(table) {
      assert.equal(table, 'opponent_directory');
      return { select: () => ({ order: async () => ({
        data: rows.filter(row => row.source !== 'custom'
          || row.added_by_school === school.slug), error: null,
      }) }) };
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === 'save_custom_opponent') {
        const existing = rows.find(row => row.added_by_school === args.p_school
          && row.name.toLowerCase() === args.p_name.toLowerCase());
        const item = existing ?? { slug: args.p_school + '-saved', name: args.p_name,
          address: args.p_address, source: 'custom', added_by_school: args.p_school };
        if (!existing) rows.push(item);
        return { data: { ...item, added: !existing }, error: null };
      }
      if (name === 'rename_custom_opponent') {
        const item = rows.find(row => row.slug === args.p_slug);
        item.name = args.p_name;
        item.address = args.p_address;
        return { data: item, error: null };
      }
      if (name === 'delete_custom_opponent') {
        rows = rows.filter(row => row.slug !== args.p_slug);
        return { data: null, error: null };
      }
      throw Error('Unexpected RPC ' + name);
    },
  };
  const context = vm.createContext({ document: {
    getElementById: id => nodes.get(id),
    createElement: element,
  } });
  vm.runInContext(readFileSync(new URL('../js/staff-opponents.js', import.meta.url), 'utf8'), context);
  const controller = context.startStaffOpponents(client, { currentSchool: () => school });
  return { nodes, controller, calls, setSchool: value => { school = value; } };
}

test('AD adds, renames and deletes only a private saved school', async () => {
  const { nodes, controller, calls } = setup();
  await controller.load();
  assert.match(nodes.get('opponent-list').children[0].textContent, /Schools you add/);
  nodes.get('opponent-name').value = '  Eastview School  ';
  nodes.get('opponent-address').value = '1 Main Street';
  await nodes.get('opponent-add-form').onsubmit({ preventDefault() {} });
  assert.equal(calls[0].name, 'save_custom_opponent');
  assert.deepEqual({ ...calls[0].args }, {
    p_school: 'marlboro', p_name: 'Eastview School', p_address: '1 Main Street',
  });
  let row = nodes.get('opponent-list').children[0];
  assert.equal(row.children[0].children[0].textContent, 'Eastview School');
  row.children[1].onclick();
  const editForm = row.children[0];
  editForm.children[0].value = 'New Eastview';
  await editForm.onsubmit({ preventDefault() {} });
  assert.equal(calls.at(-1).name, 'rename_custom_opponent');
  row = nodes.get('opponent-list').children[0];
  row.children[2].onclick();
  assert.match(nodes.get('delete-opponent-summary').textContent, /Games already saved keep/);
  await nodes.get('delete-opponent-confirm').onclick();
  assert.equal(calls.at(-1).name, 'delete_custom_opponent');
  assert.match(nodes.get('opponent-list').children[0].textContent, /Schools you add/);
  controller.stop();
});

test('site admin view switches saved schools with the selected school', async () => {
  const { controller, setSchool } = setup();
  await controller.load();
  await controller.saveSchool('Eastview', '');
  assert.equal(controller.entries().length, 1);
  setSchool({ slug: 'colts-neck', name: 'Colts Neck' });
  controller.reset();
  await controller.load();
  assert.equal(controller.entries().length, 0);
  await controller.saveSchool('Eastview', '');
  assert.equal(controller.entries().length, 1);
  controller.stop();
});
