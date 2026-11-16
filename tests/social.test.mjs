// Tests the social media link checks, the school picker's order, the staff tab and where the public sections sit.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = vm.createContext({ URL });
vm.runInContext(read('js/social-links.js') +
  ';globalThis.api = { socialPlatforms, socialAccount, socialAccountsFor, socialSchools, socialSchoolOfTheDay };', context);
const { socialPlatforms, socialAccount, socialAccountsFor, socialSchools, socialSchoolOfTheDay } = context.api;
const url = (platform, input) => socialAccount(platform, input).url;

test('account links are tidied into one form per platform', () => {
  assert.equal(url('instagram', 'https://www.instagram.com/marlboro.athletics/'), 'https://www.instagram.com/marlboro.athletics/');
  assert.equal(url('instagram', ' instagram.com/Marlboro_AD?igsh=abc123 '), 'https://www.instagram.com/Marlboro_AD/');
  assert.equal(url('instagram', 'http://m.instagram.com/marlboro#top'), 'https://www.instagram.com/marlboro/');
  assert.equal(socialAccount('instagram', 'instagram.com/marlboro').handle, '@marlboro');
  assert.equal(url('facebook', 'https://m.facebook.com/MarlboroMustangs/'), 'https://www.facebook.com/MarlboroMustangs');
  assert.equal(url('facebook', 'https://www.facebook.com/profile.php?id=100064812345678&sk=about'), 'https://www.facebook.com/profile.php?id=100064812345678');
  assert.equal(url('facebook', 'https://www.facebook.com/people/Marlboro-Athletics/100064812345678/'), 'https://www.facebook.com/profile.php?id=100064812345678');
  assert.equal(socialAccount('facebook', 'facebook.com/MarlboroMustangs').handle, 'MarlboroMustangs');
  assert.equal(url('x', 'https://twitter.com/MarlboroAD'), 'https://x.com/MarlboroAD');
  assert.equal(url('x', 'https://x.com/MarlboroAD?s=20'), 'https://x.com/MarlboroAD');
  assert.equal(socialAccount('x', 'mobile.twitter.com/MarlboroAD').handle, '@MarlboroAD');
});

test('links to other sites, posts and odd addresses are refused with a plain sentence', () => {
  const refused = [
    ['instagram', ''], ['instagram', 'marlboro'], ['instagram', 'https://example.org/marlboro'],
    ['instagram', 'https://www.instagram.com.example.org/marlboro'], ['instagram', 'https://example.org/?https://www.instagram.com/marlboro'],
    ['instagram', 'https://user:pass@www.instagram.com/marlboro'], ['instagram', 'https://www.instagram.com:8443/marlboro'],
    ['instagram', 'javascript:alert(1)'], ['instagram', 'ftp://www.instagram.com/marlboro'], ['instagram', 'https://www.instagram.com/'],
    ['instagram', 'https://www.instagram.com/explore/'], ['instagram', 'https://www.instagram.com/marlboro/reels/'],
    ['instagram', 'https://www.instagram.com/mar lboro'], ['instagram', 'https://www.instagram.com/' + 'a'.repeat(31)],
    ['instagram', 'https://www.facebook.com/marlboro'], ['facebook', 'https://www.instagram.com/marlboro'],
    ['facebook', 'https://www.facebook.com/profile.php?id=abc'], ['facebook', 'https://www.facebook.com/pages/Marlboro/123456'],
    ['x', 'https://x.com/home'], ['x', 'https://x.com/this_name_is_too_long'], ['x', 'https://x.com/marlboro.ad'],
    ['tiktok', 'https://www.tiktok.com/@marlboro'], ['__proto__', 'https://x.com/marlboro'],
  ];
  for (const [platform, input] of refused) {
    const result = socialAccount(platform, input);
    assert.equal(result.url, undefined, platform + ' ' + input);
    assert.match(result.problem, /\.$/, platform + ' ' + input);
  }
  for (const [platform, input] of [['instagram', 'https://www.instagram.com/p/DAbc123/'], ['instagram', 'https://www.instagram.com/reel/DAbc123/'],
    ['x', 'https://x.com/MarlboroAD/status/1234567890'], ['facebook', 'https://www.facebook.com/watch/?v=123']]) {
    assert.match(socialAccount(platform, input).problem, /goes to a post/, input);
  }
});

test('the database accepts exactly the form the link check writes', () => {
  const sql = read('supabase/migrations/20261202000100_school_social_accounts.sql');
  const patterns = Object.fromEntries([...sql.matchAll(/platform = '(\w+)' and url ~ '([^']+)'/g)].map(match => [match[1], new RegExp(match[2])]));
  assert.deepEqual(Object.keys(patterns).sort(), Object.keys(socialPlatforms).sort());
  const good = { instagram: ['instagram.com/marlboro.athletics', 'https://www.instagram.com/a/'],
    facebook: ['facebook.com/MarlboroMustangs/', 'facebook.com/profile.php?id=100064812345678', 'facebook.com/people/M-A/100064812345678'],
    x: ['twitter.com/MarlboroAD', 'x.com/a_1'] };
  for (const [platform, inputs] of Object.entries(good)) for (const input of inputs) assert.match(url(platform, input), patterns[platform]);
  for (const bad of ['http://www.instagram.com/marlboro/', 'https://www.instagram.com/marlboro', 'https://www.instagram.com/p/DAbc/x/',
    'https://www.instagram.com.example.org/marlboro/', 'https://example.org/https://www.instagram.com/marlboro/', 'javascript:alert(1)']) {
    assert.doesNotMatch(bad, patterns.instagram);
  }
  assert.doesNotMatch('https://x.com/MarlboroAD/status/1', patterns.x);
  assert.doesNotMatch('https://www.facebook.com/a/b', patterns.facebook);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /grant update \(url\) on public\.school_social_accounts/);
});

const rows = [
  { school_id: 'marlboro', platform: 'x', url: 'https://x.com/MarlboroAD' },
  { school_id: 'marlboro', platform: 'instagram', url: 'https://www.instagram.com/marlboro/' },
  { school_id: 'colts-neck', platform: 'facebook', url: 'https://www.facebook.com/ColtsNeck' },
  { school_id: 'shore-regional', platform: 'instagram', url: 'https://www.instagram.com/shoreregional/' },
  { school_id: 'shore-regional', platform: 'x', url: 'https://example.org/not-x' },
  { school_id: 'closed-school', platform: 'instagram', url: 'https://www.instagram.com/closed/' },
];
const directory = { marlboro: { name: 'Marlboro' }, 'colts-neck': { name: 'Colts Neck' }, 'shore-regional': { name: 'Shore Regional' }, holmdel: { name: 'Holmdel' } };

test('each school gets its own accounts, Instagram first, and a bad saved link is left out', () => {
  assert.equal(socialAccountsFor(rows, 'marlboro').map(account => account.platform).join(), 'instagram,x');
  assert.equal(socialAccountsFor(rows, 'shore-regional').map(account => account.label + ' ' + account.handle).join(), 'Instagram @shoreregional');
  assert.equal(socialAccountsFor(rows, 'holmdel').length, 0);
});

test('the home page lists only directory schools with an account and rotates the first school daily', () => {
  const schools = socialSchools(rows, directory);
  assert.equal(schools.map(school => school.name).join(), 'Colts Neck,Marlboro,Shore Regional');
  const first = socialSchoolOfTheDay(schools, new Date(2026, 10, 15));
  const next = socialSchoolOfTheDay(schools, new Date(2026, 10, 16));
  assert.ok(['marlboro', 'shore-regional'].includes(first.slug), 'starts on a school with Instagram');
  assert.notEqual(first.slug, next.slug);
  assert.equal(socialSchoolOfTheDay(socialSchools([rows[2]], directory)).slug, 'colts-neck');
  assert.equal(socialSchoolOfTheDay([]), null);
});

test('the social sections sit directly beneath the upcoming games and load no platform script up front', () => {
  for (const page of ['school.html', 'index.html']) {
    const html = read(page);
    assert.match(html, /id="upcoming"><\/ul>\s*<\/section>\s*<!--[^>]*-->\s*<section id="social"[^>]*\shidden>/, page);
    assert.ok(html.indexOf('js/social-links.js') < html.indexOf('js/social.js'), page);
    assert.doesNotMatch(html, /instagram\.com|facebook\.net|platform\.twitter\.com/, page);
  }
  assert.match(read('index.html'), /<h2 id="social-title">Around the Shore<\/h2>/);
  assert.ok(read('school.html').indexOf('js/school.js') < read('school.html').indexOf('js/social.js'));
});

// ----- Staff tab -----
class Element {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.hidden = false; this.value = ''; this.textContent = ''; this.attributes = {}; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { this.focused = true; }
  find(check) { return this.children.flatMap(child => child instanceof Element ? [child, ...child.find(() => true)] : []).filter(check); }
}
function mountStaff({ saved = [], error = null, writeError = null } = {}) {
  const elements = new Map();
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); },
    createElement: tag => new Element(tag),
  };
  const calls = [];
  let table = saved.map(row => ({ ...row }));
  const client = { from(name) {
    let action = 'select', values = null; const filters = {};
    const query = {
      select() { return query; }, insert(row) { action = 'insert'; values = row; return query; },
      update(row) { action = 'update'; values = row; return query; }, delete() { action = 'delete'; return query; },
      eq(field, value) { filters[field] = value; return query; },
      then(resolve) {
        const match = row => Object.entries(filters).every(([field, value]) => row[field] === value);
        calls.push({ name, action, values, filters });
        const failure = action === 'select' ? error : writeError;
        if (failure) return Promise.resolve({ data: null, error: failure }).then(resolve);
        if (action === 'insert') table.push({ id: 'new-' + table.length, ...values });
        if (action === 'update') table = table.map(row => match(row) ? { ...row, ...values } : row);
        if (action === 'delete') table = table.filter(row => !match(row));
        return Promise.resolve({ data: action === 'select' ? table.filter(match) : null, error: null }).then(resolve);
      },
    };
    return query;
  } };
  const staff = vm.createContext({ document, URL });
  vm.runInContext(read('js/social-links.js') + read('js/staff-social.js') + ';globalThis.start = startStaffSocial;', staff);
  const controller = staff.start(client, { currentSchool: () => ({ slug: 'marlboro', name: 'Marlboro' }) });
  const el = id => document.getElementById(id);
  const row = label => el('social-list').children.find(item => item.children[0].textContent.trim() === label);
  const input = label => row(label).find(child => child.tag === 'input')[0];
  const press = (label, text) => row(label).find(child => child.tag === 'button' && child.textContent === text)[0];
  const settle = () => new Promise(resolve => setImmediate(resolve));
  return { controller, el, row, input, press, calls, settle, rows: () => table };
}
const writes = calls => calls.filter(call => call.action !== 'select');

test('the staff tab loads one school and refuses a bad link before anything is sent', async () => {
  const staff = mountStaff({ saved: [{ id: 'a', school_id: 'marlboro', platform: 'instagram', url: 'https://www.instagram.com/marlboro/' },
    { id: 'b', school_id: 'colts-neck', platform: 'x', url: 'https://x.com/ColtsNeck' }] });
  await staff.controller.load();
  assert.deepEqual(staff.calls[0].filters, { school_id: 'marlboro' });
  assert.equal(staff.el('social-list').children.length, 3);
  assert.equal(staff.input('Instagram').value, 'https://www.instagram.com/marlboro/');
  assert.equal(staff.input('X').value, '', 'another school’s link is not shown');
  assert.equal(staff.press('X', 'Remove'), undefined);
  staff.input('X').value = 'https://example.org/marlboro';
  await staff.press('X', 'Save').onclick();
  assert.match(staff.el('social-status').textContent, /^Paste the link to the school’s X account/);
  assert.equal(staff.input('X').attributes['aria-invalid'], 'true');
  assert.equal(writes(staff.calls).length, 0);
});

test('the staff tab adds, changes and removes a link for the selected school only', async () => {
  const staff = mountStaff({ saved: [{ id: 'a', school_id: 'marlboro', platform: 'instagram', url: 'https://www.instagram.com/marlboro/' }] });
  await staff.controller.load();
  staff.input('Facebook').value = 'm.facebook.com/MarlboroMustangs/';
  await staff.press('Facebook', 'Save').onclick();
  await staff.settle();
  assert.deepEqual({ ...writes(staff.calls)[0].values }, { school_id: 'marlboro', platform: 'facebook', url: 'https://www.facebook.com/MarlboroMustangs' });
  assert.equal(staff.el('social-status').textContent, 'Facebook saved. It is on the public site now.');
  staff.input('Instagram').value = 'instagram.com/marlboro.athletics';
  await staff.press('Instagram', 'Save').onclick();
  await staff.settle();
  const change = writes(staff.calls)[1];
  assert.equal(change.action, 'update');
  assert.deepEqual({ ...change.values }, { url: 'https://www.instagram.com/marlboro.athletics/' });
  assert.deepEqual(change.filters, { id: 'a' });
  await staff.press('Instagram', 'Remove').onclick();
  await staff.settle();
  assert.equal(writes(staff.calls)[2].action, 'delete');
  assert.deepEqual(writes(staff.calls)[2].filters, { id: 'a' });
  assert.equal(staff.el('social-status').textContent, 'Instagram removed. It is off the public site.');
  assert.deepEqual(staff.rows().map(item => item.platform), ['facebook']);
  assert.equal(staff.input('Instagram').value, '');
});

test('the staff tab says so when the table is missing or the database refuses a save', async () => {
  const missing = mountStaff({ error: { code: 'PGRST205' } });
  await missing.controller.load();
  assert.match(missing.el('social-status').textContent, /apply the social accounts migration/);
  assert.equal(missing.el('social-list').children.length, 0);
  // The database refuses the write, as it does for an AD reaching for another school.
  const refused = mountStaff({ writeError: { code: '42501' } });
  await refused.controller.load();
  refused.input('X').value = 'x.com/MarlboroAD';
  await refused.press('X', 'Save').onclick();
  await refused.settle();
  assert.equal(refused.el('social-status').textContent, 'That link could not be saved. Try again.');
  assert.equal(refused.rows().length, 0);
});
