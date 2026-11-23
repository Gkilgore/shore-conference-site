// Checks that saved schedule text renders as a readable team and matchup.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ matchMedia: () => ({ matches: false }) });
vm.runInContext(readFileSync(new URL('../js/calendar.js', import.meta.url), 'utf8'), context);

test('calendar card removes repeated gender and away markers from saved game text', () => {
  const parts = context.splitTeamTitle('Girls Varsity Girls Basketball at @ Wall / VS/JV 6 quarters',
    { gender: 'Girls', level: 'Varsity', sport: 'Girls Basketball' });
  assert.equal(parts.team, 'Girls Varsity Basketball');
  assert.equal(parts.matchup, '@ Wall');
});

test('game details show the opponent once and keep the extra format text as a note', () => {
  const slots = new Map();
  const element = name => {
    if (!slots.has(name)) slots.set(name, {
      textContent: '', hidden: false, children: [], setAttribute() {},
      append(...children) { this.children.push(...children); },
      replaceChildren(...children) { this.children = children; },
    });
    return slots.get(name);
  };
  const dialog = element('dialog');
  dialog.querySelector = element;
  dialog.showModal = () => {};
  const screen = vm.createContext({
    matchMedia: () => ({ matches: false }),
    document: { createElement: tag => tag === 'dialog' ? dialog : element(tag + '-' + slots.size) },
  });
  vm.runInContext(readFileSync(new URL('../js/calendar.js', import.meta.url), 'utf8'), screen);
  const show = screen.createGameDetails({ after() {} });
  show({ title: 'Girls Varsity Girls Basketball at @ Wall / VS/JV 6 quarters',
    extendedProps: { gender: 'Girls', level: 'Varsity', sport: 'Girls Basketball', status: 'Scheduled' } });
  assert.equal(element('.game-card-team').textContent, 'Girls Varsity Basketball');
  assert.equal(element('h2').textContent, '@ Wall');
  assert.ok(element('dl').children.some(child => child.textContent === 'VS/JV 6 quarters'));
});
