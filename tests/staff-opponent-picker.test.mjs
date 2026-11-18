// Checks keyboard search and adding a school from the game editor.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function element() {
  const attrs = {};
  return {
    value: '', children: [], hidden: false, attrs,
    setAttribute(name, value) { attrs[name] = value; },
    removeAttribute(name) { delete attrs[name]; },
    replaceChildren(...children) { this.children = children; },
    append(...children) { this.children.push(...children); },
    focus() { this.focused = true; },
  };
}

function setup() {
  const ids = ['game-opponent-search','game-opponent-results','game-opponent-add',
    'game-opponent-new-name','game-opponent-new-address','game-opponent-add-save',
    'game-opponent-add-cancel','game-opponent-status'];
  const nodes = new Map(ids.map(id => [id, element()]));
  nodes.get('game-opponent-results').hidden = true;
  nodes.get('game-opponent-add').hidden = true;
  const selected = [];
  const context = vm.createContext({ document: {
    getElementById: id => nodes.get(id), createElement: element,
  }, setTimeout });
  for (const file of ['staff-opponent-search.js','staff-opponent-picker.js']) {
    vm.runInContext(readFileSync(new URL('../js/' + file, import.meta.url), 'utf8'), context);
  }
  const directory = [
    {slug:'marlboro',name:'Marlboro',source:'conference'},
    {slug:'colts-neck',name:'Colts Neck',source:'conference',address:'Colts Neck NJ 07722'},
    {slug:'eastview',name:'Eastview School',source:'custom',added_by_school:'marlboro'},
    {slug:'farview',name:'Farview School',source:'custom',added_by_school:'colts-neck'},
  ];
  const picker = context.startStaffOpponentPicker({
    currentSchool: () => ({slug:'marlboro'}), directory: () => directory,
    saveSchool: async (name, address) => ({slug:'new-school',name,address,
      source:'custom',added_by_school:'marlboro'}),
    onSelect: item => selected.push(item),
  });
  return { nodes, picker, selected };
}

test('arrow keys and Enter pick a result and set combobox state', () => {
  const {nodes,picker,selected} = setup();
  const input = nodes.get('game-opponent-search');
  input.value = 'Colts';
  input.oninput();
  assert.equal(input.attrs['aria-expanded'], 'true');
  assert.equal(nodes.get('game-opponent-results').children[1].attrs.role, 'option');
  input.onkeydown({key:'ArrowDown',preventDefault(){}});
  assert.equal(input.attrs['aria-activedescendant'], 'opponent-option-0');
  input.onkeydown({key:'Enter',preventDefault(){}});
  assert.equal(picker.selected().slug, 'colts-neck');
  assert.equal(input.attrs['aria-expanded'], 'false');
  assert.equal(selected.at(-1).slug, 'colts-neck');
});

test('last option opens inline add and selects the saved school', async () => {
  const {nodes,picker} = setup();
  const input = nodes.get('game-opponent-search');
  input.value = 'New School';
  input.oninput();
  const options = nodes.get('game-opponent-results').children;
  assert.match(options.at(-1).textContent, /Add “New School” as a new school/);
  options.at(-1).onclick();
  assert.equal(nodes.get('game-opponent-add').hidden, false);
  assert.equal(nodes.get('game-opponent-new-name').value, 'New School');
  nodes.get('game-opponent-new-address').value = '1 Main Street';
  await nodes.get('game-opponent-add-save').onclick();
  assert.equal(picker.selected().name, 'New School');
  assert.equal(picker.selected().address, '1 Main Street');
  input.onfocus();
  input.onkeydown({key:'Escape'});
  assert.equal(input.attrs['aria-expanded'], 'false');
});
