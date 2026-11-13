// Covers school-team creation, duplicate prevention and safe removal in the AD Teams tab.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

class Element {
  constructor(tag = 'div') {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.classList = { add: name => { this.className = [this.className, name].filter(Boolean).join(' '); } };
  }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {}
  querySelectorAll(selector) {
    if (this.id === 'team-form' && selector === '[name="level"]:checked') return this.levels.filter(level => level.checked);
    if (selector === '.team-row') return descendants(this).filter(item => item.className === 'team-row');
    return [];
  }
}

function descendants(element) {
  return element.children.flatMap(child => child instanceof Element ? [child, ...descendants(child)] : []);
}

function mount({ records = [], games = [] } = {}) {
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement(tag) { return new Element(tag); },
  };
  const form = document.getElementById('team-form');
  form.id = 'team-form';
  form.elements = {
    sport: { value: 'Soccer' },
    gender: { value: 'Girls' },
    season: { value: 'Fall' },
  };
  form.levels = ['Varsity', 'JV', 'Freshman'].map(value => ({ value, checked: false }));
  form.reset = () => {
    form.elements.sport.value = '';
    form.levels.forEach(level => { level.checked = false; });
  };

  const writes = [];
  const client = {
    from(table) {
      assert.equal(table, 'teams');
      const query = { filters: {}, mode: 'read' };
      query.select = () => query;
      query.eq = (field, value) => { query.filters[field] = value; return query; };
      query.order = () => query;
      query.insert = values => {
        writes.push({ type: 'insert', values });
        records.push(...values.map((value, index) => ({ ...value, id: 'new-' + writes.length + '-' + index })));
        return Promise.resolve({ error: null });
      };
      query.delete = () => { query.mode = 'delete'; return query; };
      query.then = (resolve, reject) => Promise.resolve().then(() => {
        if (query.mode === 'delete') {
          const before = records.length;
          records = records.filter(record => record.id !== query.filters.id || record.school_id !== query.filters.school_id);
          const deleted = before !== records.length ? [{ id: query.filters.id }] : [];
          writes.push({ type: 'delete', filters: query.filters });
          return { data: deleted, error: null };
        }
        return { data: records.filter(record => record.school_id === query.filters.school_id), error: null };
      }).then(resolve, reject);
      return query;
    },
  };
  const context = vm.createContext({ document });
  vm.runInContext(readFileSync(new URL('../js/staff-teams.js', import.meta.url), 'utf8'), context);
  const controller = context.startStaffTeams(client, {
    currentSchool: () => ({ slug: 'marlboro' }),
    games: () => games,
    groups: () => [],
    states: () => ({ map: new Map() }),
    links: () => new Map(),
    coaches: () => null,
    schoolName: () => '',
    filterValues: () => ({}),
    openGame() {}, addGame() {}, reviewTeam() {}, unpublishTeam() {}, editCoach() {}, addCoach() {},
  });
  return { controller, document, form, records: () => records, writes, status: document.getElementById('teams-status') };
}

function findButton(root, label) {
  return descendants(root).find(item => item.tag === 'button' && item.textContent === label);
}

test('AD can add multiple levels for one sport and season', async () => {
  const app = mount();
  await app.controller.load();
  app.form.levels[0].checked = true;
  app.form.levels[1].checked = true;
  await app.form.onsubmit({ preventDefault() {} });
  assert.deepEqual(Array.from(app.writes[0].values, team => team.level), ['Varsity', 'JV']);
  assert.ok(app.records().every(team => team.school_id === 'marlboro'));
  assert.equal(app.status.textContent, '2 teams added.');
});

test('AD cannot add a team level twice', async () => {
  const app = mount({ records: [
    { id: 'v1', school_id: 'marlboro', sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall' },
  ] });
  await app.controller.load();
  app.form.levels[0].checked = true;
  await app.form.onsubmit({ preventDefault() {} });
  assert.equal(app.writes.length, 0);
  assert.match(app.status.textContent, /already on the team list/i);
});

test('AD must confirm removing an unused team and cannot remove one with games', async () => {
  const unused = mount({ records: [
    { id: 'empty', school_id: 'marlboro', sport: 'Soccer', gender: 'Girls', level: 'JV', season: 'Fall' },
  ] });
  await unused.controller.load();
  unused.document.getElementById('team-list').children[0].children[0].onclick();
  const remove = findButton(unused.document.getElementById('team-detail'), 'Remove team');
  remove.onclick();
  assert.equal(unused.writes.length, 0);
  await remove.onclick();
  assert.deepEqual(unused.writes.map(write => write.type), ['delete']);
  assert.equal(unused.records().length, 0);

  const withGames = mount({
    records: [{ id: 'active', school_id: 'marlboro', sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall' }],
    games: [{ id: 'game-1', team_id: 'active', game_date: '2031-09-01', start_time: '15:00',
      home_away: 'Home', opponent_name: 'Opponent', location: 'Field', status: 'Scheduled',
      teams: { sport: 'Soccer', gender: 'Girls', level: 'Varsity', season: 'Fall' } }],
  });
  await withGames.controller.load();
  withGames.document.getElementById('team-list').children[0].children[0].onclick();
  assert.equal(findButton(withGames.document.getElementById('team-detail'), 'Remove team').disabled, true);
  assert.equal(withGames.writes.length, 0);
});
