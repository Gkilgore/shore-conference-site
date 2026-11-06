// Verifies invited-access reviews, permissions, revisions, and cleanup with the real browser controller.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.value = ''; this.open = false; this.disabled = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  querySelectorAll(selector) {
    const all = this.children.flatMap(child => typeof child === 'object' ? [child, ...child.querySelectorAll('*')] : []);
    return selector === '*' ? all : all.filter(child => child.tag === selector);
  }
  showModal() { this.open = true; }
  close() { this.open = false; if (this.onclose) this.onclose(); }
  focus() {}
  setAttribute(key, value) { this[key] = value; }
}

const schoolList = [{slug: 'marlboro', name: 'Marlboro'}, {slug: 'colts-neck', name: 'Colts Neck'}, {slug: 'shore-regional', name: 'Shore Regional'}];
const ad = (email = 'ad@school.org', revision = 4) => ({email, name: 'School AD', role: 'ad', school_id: 'marlboro', access_revision: revision});
const office = {email: 'office@conference.org', name: 'Office', role: 'conference_office', school_id: null, access_revision: 2};
const site = {email: 'admin@conference.org', name: 'Admin', role: 'site_admin', school_id: null, access_revision: 1};

function mount(rpc, invite = {role: 'site_admin', email: site.email}) {
  const elements = new Map();
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement(tag) { return new Element(tag); },
  };
  const context = vm.createContext({document});
  vm.runInContext(readFileSync(new URL('../js/staff-access.js', import.meta.url), 'utf8'), context);
  const controller = context.startStaffAccess({rpc}, invite, () => schoolList);
  const element = id => document.getElementById('staff-access-' + id);
  const fill = (email, role = 'ad', school = 'marlboro') => {
    element('email').value = email; element('name').value = 'New Person';
    element('role').value = role; element('school').value = school;
  };
  const review = () => element('form').onsubmit({preventDefault() {}});
  const buttons = () => element('list').querySelectorAll('button');
  return {controller, element, fill, review, buttons};
}

test('AD users never load or see invited-access controls', async () => {
  let calls = 0;
  const ui = mount(async () => { calls++; }, {role: 'ad'});
  assert.equal(await ui.controller.load(), false);
  assert.equal(ui.element('panel').hidden, true);
  assert.equal(calls, 0);
});

test('verified conference role limits stale site-admin hint to AD access', async () => {
  const ui = mount(async () => ({data: {actor_role: 'conference_office', accounts: [ad(), office, site]}}));
  await ui.controller.load();
  assert.deepEqual(ui.element('role').children.map(option => option.value), ['ad']);
  assert.equal(ui.buttons().length, 2);
  ui.fill('new@conference.org', 'conference_office', '');
  await ui.review();
  assert.equal(ui.element('review').open, false);
  assert.match(ui.element('status').textContent, /AD access/i);
});

test('creates another AD for the same school only after a review and sends no revision', async () => {
  const mutations = [];
  const ui = mount(async (name, args) => {
    if (name === 'list_staff_access') return {data: {actor_role: 'site_admin', accounts: [ad()]}};
    mutations.push(args); return {data: ad(args.p_email)};
  });
  await ui.controller.load();
  ui.fill(' NEW@SCHOOL.ORG ');
  await ui.review();
  assert.equal(mutations.length, 0);
  assert.equal(ui.element('review').open, true);
  assert.match(ui.element('review-summary').textContent, /new@school.org[\s\S]*Marlboro/);
  await ui.element('review-confirm').onclick();
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].p_expected_revision, null);
  assert.equal(mutations[0].p_school, 'marlboro');
  assert.equal(mutations[0].p_remove, false);
  assert.equal(ui.element('review').open, false);
});

test('duplicate email cannot turn a new invitation into an update', async () => {
  let mutations = 0;
  const ui = mount(async name => name === 'list_staff_access'
    ? {data: {actor_role: 'site_admin', accounts: [ad()]}} : (mutations++, {data: {}}));
  await ui.controller.load(); ui.fill('AD@school.org'); await ui.review();
  assert.equal(ui.element('review').open, false);
  assert.match(ui.element('status').textContent, /already.*Edit/i);
  assert.equal(mutations, 0);
});

test('reviewed reassignment keeps the selected record revision and old assignment', async () => {
  const mutations = [];
  const ui = mount(async (name, args) => name === 'list_staff_access'
    ? {data: {actor_role: 'site_admin', accounts: [ad()]}} : (mutations.push(args), {data: ad()}));
  await ui.controller.load(); ui.buttons()[0].onclick();
  assert.equal(ui.element('email').disabled, true);
  ui.element('school').value = 'colts-neck'; await ui.review();
  assert.match(ui.element('review-summary').textContent, /Marlboro[\s\S]*Colts Neck/);
  await ui.element('review-confirm').onclick();
  assert.equal(mutations[0].p_expected_revision, 4);
  assert.equal(mutations[0].p_school, 'colts-neck');
});

test('remove reviews current assignment and carries revision', async () => {
  const mutations = [];
  const ui = mount(async (name, args) => name === 'list_staff_access'
    ? {data: {actor_role: 'site_admin', accounts: [ad()]}} : (mutations.push(args), {data: {removed: true}}));
  await ui.controller.load(); ui.buttons()[1].onclick();
  assert.match(ui.element('review-summary').textContent, /ad@school.org[\s\S]*Marlboro/);
  assert.equal(mutations.length, 0);
  await ui.element('review-confirm').onclick();
  assert.equal(mutations[0].p_expected_revision, 4);
  assert.equal(mutations[0].p_remove, true);
});

test('site admins may invite several conference admins and never assign site admin', async () => {
  const mutations = [];
  const ui = mount(async (name, args) => name === 'list_staff_access'
    ? {data: {actor_role: 'site_admin', accounts: [office, site]}} : (mutations.push(args), {data: office}));
  await ui.controller.load();
  assert.deepEqual(ui.element('role').children.map(option => option.value), ['ad', 'conference_office']);
  assert.equal(ui.buttons().length, 2);
  ui.fill('second@conference.org', 'conference_office'); await ui.review();
  await ui.element('review-confirm').onclick();
  assert.equal(mutations[0].p_role, 'conference_office');
  assert.equal(mutations[0].p_school, null);
  ui.fill('new@conference.org', 'site_admin'); await ui.review();
  assert.equal(ui.element('review').open, false);
});

test('stale rejection refreshes records and demands a new review with a fresh revision', async () => {
  let revision = 4, calls = 0;
  const revisions = [];
  const ui = mount(async (name, args) => {
    if (name === 'list_staff_access') { calls++; return {data: {actor_role: 'site_admin', accounts: [ad('ad@school.org', revision)]}}; }
    revisions.push(args.p_expected_revision);
    if (revision === 4) { revision = 7; return {error: {code: '40001'}}; }
    return {data: ad()};
  });
  await ui.controller.load(); ui.buttons()[0].onclick(); await ui.review();
  await ui.element('review-confirm').onclick();
  assert.equal(calls, 2);
  assert.equal(ui.element('review').open, false);
  assert.equal(ui.element('email').value, '');
  await ui.element('review-confirm').onclick();
  assert.deepEqual(revisions, [4]);
  ui.buttons()[0].onclick(); await ui.review(); await ui.element('review-confirm').onclick();
  assert.deepEqual(revisions, [4, 7]);
});

test('revoked actor access hides and clears records, drafts, and pending review', async () => {
  let revoked = false;
  const ui = mount(async () => revoked ? {error: {code: '42501'}} : {data: {actor_role: 'site_admin', accounts: [ad()]}});
  await ui.controller.load(); ui.buttons()[0].onclick(); await ui.review();
  revoked = true; await ui.controller.load();
  assert.equal(ui.element('panel').hidden, true);
  assert.equal(ui.element('list').children.length, 0);
  assert.equal(ui.element('email').value, '');
  assert.equal(ui.element('review').open, false);
});

test('late loads after reset or stop cannot repaint access', async () => {
  let complete;
  const ui = mount(() => new Promise(resolve => complete = resolve));
  const loading = ui.controller.load(); ui.controller.reset();
  complete({data: {actor_role: 'site_admin', accounts: [ad()]}}); await loading;
  assert.equal(ui.element('panel').hidden, true);
  assert.equal(ui.element('list').children.length, 0);
  ui.controller.stop();
  assert.equal(ui.element('form').onsubmit, null);
  assert.equal(await ui.controller.load(), false);
});

test('invalid schools, email, and name cannot be reviewed', async () => {
  const ui = mount(async () => ({data: {actor_role: 'site_admin', accounts: []}}));
  await ui.controller.load();
  for (const values of [['bad', 'ad', 'marlboro'], ['ad@example.org', 'ad', 'unknown']]) {
    ui.fill(...values); await ui.review(); assert.equal(ui.element('review').open, false);
  }
  ui.fill('ad@example.org'); ui.element('name').value = '  '; await ui.review();
  assert.equal(ui.element('review').open, false);
  ui.element('name').value = 'x'.repeat(101); await ui.review();
  assert.equal(ui.element('review').open, false);
});

test('double confirmation sends one write and reset restores usable controls after a late save', async () => {
  let finish, writes = 0;
  const ui = mount(async name => {
    if (name === 'list_staff_access') return {data: {actor_role: 'site_admin', accounts: []}};
    writes++; return await new Promise(resolve => finish = resolve);
  });
  await ui.controller.load(); ui.fill('ad@example.org'); await ui.review();
  const saving = ui.element('review-confirm').onclick();
  await ui.element('review-confirm').onclick();
  assert.equal(writes, 1);
  ui.controller.reset(); finish({data: ad()}); await saving;
  assert.equal(ui.element('panel').hidden, true);
  assert.equal(ui.element('list').children.length, 0);
  await ui.controller.load(); ui.fill('other@example.org'); await ui.review();
  assert.equal(ui.element('review-cancel').disabled, false);
});

test('denied save reloads permission and clears everything when the actor has been revoked', async () => {
  let revoked = false;
  const ui = mount(async name => {
    if (name === 'manage_staff_access') { revoked = true; return {error: {code: '42501'}}; }
    return revoked ? {error: {code: '42501'}} : {data: {actor_role: 'site_admin', accounts: [ad()]}};
  });
  await ui.controller.load(); ui.buttons()[1].onclick(); await ui.element('review-confirm').onclick();
  assert.equal(ui.element('panel').hidden, true);
  assert.equal(ui.element('list').children.length, 0);
  assert.equal(ui.element('review').open, false);
  assert.match(ui.element('status').textContent, /cannot manage staff access/);
});

test('unreachable list fails closed and can be retried', async () => {
  let offline = true;
  const ui = mount(async () => {
    if (offline) throw new Error('offline');
    return {data: {actor_role: 'conference_office', accounts: []}};
  });
  assert.equal(await ui.controller.load(), false);
  assert.equal(ui.element('panel').hidden, true);
  assert.match(ui.element('status').textContent, /could not load/);
  offline = false;
  assert.equal(await ui.controller.load(), true);
});
