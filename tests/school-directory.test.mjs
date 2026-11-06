// Checks the verified member roster, working directory links and safe branding defaults.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';

const roster = [
  'Asbury Park', 'Barnegat', 'Brick Memorial', 'Brick Township', 'Central Regional',
  'Christian Brothers Academy', 'Colts Neck', 'Donovan Catholic', 'Freehold Boro',
  'Freehold Township', 'Henry Hudson Regional', 'Holmdel', 'Howell', 'Jackson Township',
  'Keansburg', 'Keyport', 'Lacey Township', 'Lakewood', 'Long Branch', 'Manalapan',
  'Manasquan', 'Manchester Township', 'Marlboro', 'Matawan Regional', 'Middletown North',
  'Middletown South', 'Monmouth Regional', 'Neptune', 'New Egypt', 'Ocean Academy',
  'Ocean Township', 'Pinelands Regional', 'Point Pleasant Beach', 'Point Pleasant Borough',
  'Ranney School', 'Raritan', 'Red Bank Catholic', 'Red Bank Regional',
  'Rumson-Fair Haven Regional', 'Saint John Vianney', 'Saint Rose', 'Shore Regional',
  'Southern Regional', 'Toms River East', 'Toms River North', 'Toms River South',
  'Trinity Hall', 'Wall Township',
];
const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
function schools() {
  const context = vm.createContext({});
  const path = new URL('../data/school-directory.js', import.meta.url);
  assert.ok(existsSync(path), 'the shared school directory must exist');
  vm.runInContext(readFileSync(path, 'utf8'), context);
  return JSON.parse(vm.runInContext('JSON.stringify(shoreSchools)', context));
}

test('the shared directory contains all 48 approved schools with unique safe slugs', () => {
  const entries = Object.entries(schools());
  assert.equal(entries.length, 48);
  assert.deepEqual(entries.map(([, school]) => school.name).sort(), [...roster].sort());
  assert.equal(new Set(entries.map(([, school]) => school.name)).size, 48);
  for (const [slug] of entries) assert.match(slug, /^[a-z]+(?:-[a-z]+)*$/);
});

test('every school has its own local logo and colors while the three test-school brands survive', () => {
  const directory = schools();
  const verified = {
    'colts-neck': ['Colts Neck', '#2f4a29', '#dad8d9'],
    marlboro: ['Marlboro', '#183366', '#ffcc00'],
    'shore-regional': ['Shore Regional', '#004990', '#d4e0ec'],
  };
  for (const [slug, school] of Object.entries(directory)) {
    if (verified[slug]) {
      assert.deepEqual([school.name, school.color, school.accent], verified[slug]);
      assert.equal(school.logo, 'assets/logos/' + slug + '.png');
    } else {
      assert.match(school.color, /^#[0-9a-f]{6}$/);
      assert.match(school.accent, /^#[0-9a-f]{6}$/);
      assert.notEqual(school.color, school.accent);
      assert.match(school.logo, new RegExp('^assets/logos/' + slug + '\\.(?:png|jpe?g|webp|gif|svg)$'));
    }
    assert.ok(existsSync(new URL('../' + school.logo, import.meta.url)), school.logo);
  }
});

test('school buttons retain normal-text contrast on bright school red', () => {
  const context = vm.createContext({document:{querySelectorAll:()=>[],getElementById:()=>null}});
  vm.runInContext(source('js/site.js'), context);
  const luminance = hex => [1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255)
    .map(channel=>channel<=0.04045?channel/12.92:((channel+0.055)/1.055)**2.4)
    .reduce((sum,channel,index)=>sum+channel*[0.2126,0.7152,0.0722][index],0);
  const background = '#ee1f25';
  const values = [luminance(background),luminance(context.readableInk(background))].sort((a,b)=>a-b);
  assert.ok((values[1]+0.05)/(values[0]+0.05)>=4.5, 'Keyport red requires at least 4.5:1 for button text');
});

function renderDirectory(includeRoster = true) {
  const elements = new Map();
  const element = () => ({ children: [], value: '', style: { setProperty() {} },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    addEventListener(type, callback) { this[type] = callback; } });
  for (const id of ['school-directory', 'school-search', 'directory-count']) elements.set(id, element());
  const context = vm.createContext({ document: {
    getElementById: id => elements.get(id), querySelectorAll: () => [], createElement: element,
  } });
  vm.runInContext(source('data/sample-data.js'), context);
  if (includeRoster) vm.runInContext(source('data/school-directory.js'), context);
  vm.runInContext(source('js/site.js'), context);
  return elements;
}

test('directory links all members to the reusable school page and searches the full roster', () => {
  const elements = renderDirectory();
  const directory = elements.get('school-directory');
  assert.equal(directory.children.length, 48);
  const links = directory.children.map(item => item.children[0]);
  for (const link of links) {
    assert.match(link.href, /^school\.html\?school=[a-z]+(?:-[a-z]+)*$/);
    const logo = link.children[0];
    assert.ok(existsSync(new URL('../' + logo.src, import.meta.url)), logo.src);
  }
  const search = elements.get('school-search');
  search.value = ' ocean ';
  search.input();
  assert.equal(directory.children.length, 2);
  assert.equal(elements.get('directory-count').textContent, '2 schools');
  assert.deepEqual(directory.children.map(item => item.children[0].href), [
    'school.html?school=ocean-academy', 'school.html?school=ocean-township',
  ]);
  search.value = 'no such school';
  search.input();
  assert.equal(directory.children.length, 0);
});

test('directory retains the three-school prototype fallback when the roster is absent', () => {
  assert.equal(renderDirectory(false).get('school-directory').children.length, 3);
});

function renderConferenceCalendar() {
  const element = () => ({ children: [], value: '',
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    get options() { return this.children.flatMap(child => child.label ? child.children : child); },
    add(option) { this.children.push(option); },
    setAttribute() {}, after() {}, addEventListener() {},
  });
  const fields = Object.fromEntries(['school', 'season', 'sport', 'level', 'gender', 'search'].map(id => [id, element()]));
  fields.gender.value = 'Girls';
  const elements = { calendar: element(), 'calendar-filters': { ...element(), elements: fields }, 'filter-count': element() };
  const listeners = {}, calendar = { render() {}, changeView() {},
    gotoDate(date) { this.date = date; }, refetchEvents() { this.refreshes = (this.refreshes || 0) + 1; } };
  const context = vm.createContext({
    document: { getElementById: id => elements[id], createElement: element },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    Option: function(text, value) { this.text = text; this.value = value; },
    FullCalendar: { Calendar: function() { return calendar; } },
    window: { FullCalendar: true, addEventListener(type, callback) { listeners[type] = callback; } },
  });
  vm.runInContext(source('data/school-directory.js'), context);
  vm.runInContext(source('js/seasons.js'), context);
  vm.runInContext(source('js/calendar.js'), context);
  vm.runInContext(`renderCalendar([
    { season: 'Fall', sport: 'Soccer', level: 'Varsity' },
    { season: 'Spring', sport: 'Softball', level: 'Varsity' },
  ])`, context);
  return { fields, calendar, listeners };
}

test('conference school filter offers the same 48 members', () => {
  const { fields } = renderConferenceCalendar();
  assert.equal(fields.school.options.length, 48);
  assert.deepEqual(fields.school.options.map(option => option.text), [...roster].sort((a, b) => a.localeCompare(b)));
  assert.equal(new Set(fields.school.options.map(option => option.value)).size, 48);
});

test('season selection navigates to its year and refreshes sports while preserving gender', () => {
  const { fields, calendar, listeners } = renderConferenceCalendar();
  fields.sport.value = 'Soccer';
  assert.equal(typeof listeners['shore:season-selected'], 'function');
  listeners['shore:season-selected']({ detail: { season: 'Spring', season_year: 2027, date: '2027-03-01' } });
  assert.equal(fields.season.value, 'Spring');
  assert.equal(fields.gender.value, 'Girls');
  assert.equal(fields.sport.value, '');
  assert.equal(fields.sport.options[1].value, 'Softball');
  assert.equal(calendar.date, '2027-03-01');
  assert.equal(calendar.refreshes, 1);
});
