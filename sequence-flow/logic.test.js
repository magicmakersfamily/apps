// Run with: node --test sequence-flow/
const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic.js');

const timer = (id, secs, extra) => Object.assign({ id, isSection: false, type: 'activity', title: id, timerEnabled: true, timerType: 'duration', durationValue: secs, durationUnit: 'secs' }, extra);
const secs = steps => steps.reduce((a, s) => a + L.blockSeconds(s, 0), 0);

test('section repeat unrolls its children in order', () => {
  const steps = L.expandRoutine({ items: [
    { id: 's', isSection: true, title: 'Rounds', repeatCount: 3 }, timer('a', 10), timer('b', 5, { type: 'gap' })] });
  assert.deepStrictEqual(steps.map(s => s.id), ['a', 'b', 'a', 'b', 'a', 'b']);
  assert.strictEqual(steps[2].currentSet, 2);
  assert.strictEqual(steps[2].totalSets, 3);
});

test('Tabata: 8 x 20s with 10s rest between is 230s, no trailing rest', () => {
  const steps = L.expandRoutine({ items: [timer('work', 20, { sets: 8, restBetween: 10 })] });
  assert.strictEqual(steps.length, 15);
  assert.strictEqual(secs(steps), 230);
  assert.strictEqual(steps[steps.length - 1].generated, undefined);
});

test('Norwegian 4x4: 3 min x 4 with 2 min rest is 18 min', () => {
  const steps = L.expandRoutine({ items: [timer('hard', 3, { durationUnit: 'mins', sets: 4, restBetween: 120 })] });
  assert.strictEqual(secs(steps), 18 * 60);
});

test('sets sit inside rounds', () => {
  const steps = L.expandRoutine({ items: [
    { id: 's', isSection: true, title: 'R', repeatCount: 2 }, timer('a', 10, { sets: 2, restBetween: 5 })] });
  assert.deepStrictEqual(steps.map(s => s.id), ['a', 'a__rest1', 'a', 'a', 'a__rest1', 'a']);
});

test('legacy v14 blocks (no sets, no rest) expand to themselves', () => {
  const steps = L.expandRoutine({ items: [timer('a', 5), { id: 'u', isSection: false, type: 'activity', title: 'u', timerEnabled: false, details: [] }] });
  assert.strictEqual(steps.length, 2);
});

test('totals count unfinished timed steps and untimed ones separately', () => {
  const steps = L.expandRoutine({ items: [timer('a', 60), timer('b', 30), { id: 'u', timerEnabled: false }] })
    .map((s, i) => Object.assign({}, s, { status: i === 0 ? 'completed' : 'pending' }));
  assert.deepStrictEqual(L.totals(steps, 0), { secs: 30, untimed: 1 });
});

test('remainingSecs is derived from the clock and never negative', () => {
  assert.strictEqual(L.remainingSecs(10000, 4000), 6);
  assert.strictEqual(L.remainingSecs(10000, 9999), 1);
  assert.strictEqual(L.remainingSecs(10000, 10000), 0);
  assert.strictEqual(L.remainingSecs(10000, 600000), 0);
});

test('summary uses the same expansion as Run mode and pluralizes', () => {
  assert.strictEqual(L.summarizeRoutine({ items: [timer('a', 90)] }, 0), '1 step · 1 min 30 sec');
  const r = { items: [{ id: 's', isSection: true, repeatCount: 2 }, timer('a', 60), timer('b', 60)] };
  assert.strictEqual(L.summarizeRoutine(r, 0), '2 steps (4 when repeated) · 4 min');
});

test('clock target rolls to tomorrow when already past', () => {
  const now = new Date(2026, 9, 16, 9, 0, 0).getTime();
  assert.strictEqual(L.secondsToTarget('08:30', now), 23.5 * 3600);
  assert.strictEqual(L.secondsToTarget('09:30', now), 1800);
});
