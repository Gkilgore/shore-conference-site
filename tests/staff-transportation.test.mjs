// Checks the AD dashboard invokes automatic transportation delivery without a confirmation step.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

function controllerFor(invoke) {
  const elements = new Map();
  const getElementById = id => {
    if (!elements.has(id)) elements.set(id, {
      hidden: true, value: '', textContent: '', open: false, reset() {}, showModal() {}, close() {},
      querySelector() { return { disabled: false }; },
    });
    return elements.get(id);
  };
  const context = vm.createContext({ document: { getElementById } });
  vm.runInContext(readFileSync(new URL('../js/staff-transportation.js', import.meta.url), 'utf8'), context);
  const client = { functions: { invoke } };
  const controller = context.startStaffTransportation(client, { role: 'ad', email: 'ad@example.org' },
    () => ({ slug: 'marlboro', name: 'Marlboro' }), game => game.title);
  return { controller, elements };
}

test('dashboard sends only the saved game ID to the authenticated email function', async () => {
  const calls = [];
  const { controller } = controllerFor(async (...args) => {
    calls.push(args);
    return { data: { sent: true }, error: null };
  });
  assert.equal((await controller.sendForSavedGame('saved-game')).ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'transportation-email');
  assert.equal(calls[0][1].body.game_id, 'saved-game');
  controller.stop();
});

test('dashboard surfaces delivery failures without pretending the email was sent', async () => {
  const { controller } = controllerFor(async () => ({
    data: null, error: { message: 'Function returned an error', context: Response.json({ error: 'Contact is missing.' }) },
  }));
  const result = await controller.sendForSavedGame('saved-game');
  assert.equal(result.ok, false);
  assert.equal(result.message, 'Contact is missing.');
  controller.stop();
});
