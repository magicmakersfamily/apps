// Run with: node --test sequence-flow/
const test = require('node:test');
const assert = require('node:assert');
const L = require('./logic.js');

test('uniqueTitle: no clash is unchanged, clash takes the first free number', () => {
  assert.strictEqual(L.uniqueTitle('Evening', ['Morning']), 'Evening');
  assert.strictEqual(L.uniqueTitle('Morning', ['Morning', 'morning (2)']), 'Morning (3)');
  assert.strictEqual(L.uniqueTitle(' morning ', ['Morning']), 'morning (2)');
});

test('asNewRoutine: new id, unique title, input untouched', () => {
  const r = { id: 'routine_1', title: 'Morning', items: [{ id: 'a', title: 'x' }] };
  const snap = JSON.parse(JSON.stringify(r));
  const n = L.asNewRoutine(r, ['Morning'], 1000);
  assert.notStrictEqual(n.id, r.id);
  assert.strictEqual(n.id, 'routine_1000');
  assert.strictEqual(n.title, 'Morning (2)');
  assert.deepStrictEqual(r, snap);
  n.items[0].title = 'changed';
  assert.strictEqual(r.items[0].title, 'x');
  assert.strictEqual(L.asNewRoutine(r, [], 1).title, 'Morning');
  assert.notStrictEqual(L.asNewRoutine(r, [], 1).id, r.id);
});

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

test('repairStarterIds gives saved copies of starters their own id', () => {
  const ids = ['starter_pomodoro', 'starter_other'];
  const copy = { id: 'starter_pomodoro', title: 'My focus', items: [timer('a', 10), { id: 's', isSection: true, title: 'S', repeatCount: 2 }] };
  const r = L.repairStarterIds([copy], ids, null, 1000);
  assert.notStrictEqual(r.routines[0].id, 'starter_pomodoro');
  assert.ok(!ids.includes(r.routines[0].id) && !r.routines[0].id.startsWith('starter_'));
  assert.strictEqual(r.routines[0].title, 'My focus');
  assert.deepStrictEqual(r.routines[0].items, copy.items);
  assert.deepStrictEqual(r.renamed, { starter_pomodoro: r.routines[0].id });
});

test('repairStarterIds gives two copies two different ids', () => {
  const r = L.repairStarterIds([{ id: 'starter_pomodoro', items: [] }, { id: 'starter_other', items: [] }], ['starter_pomodoro', 'starter_other'], null, 1000);
  assert.notStrictEqual(r.routines[0].id, r.routines[1].id);
});

test('repairStarterIds leaves ordinary ids alone and avoids clashes', () => {
  const saved = [{ id: 'routine_1000', title: 'Mine', items: [] }, { id: 'starter_x', items: [] }];
  const r = L.repairStarterIds(saved, [], null, 1000);
  assert.strictEqual(r.routines[0], saved[0]);
  assert.notStrictEqual(r.routines[1].id, 'routine_1000');
  assert.deepStrictEqual(L.repairStarterIds([saved[0]], ['starter_pomodoro'], null, 5).renamed, {});
});

test('repairStarterIds moves lastId only when its copy was renamed', () => {
  const ids = ['starter_pomodoro'];
  const r = L.repairStarterIds([{ id: 'starter_pomodoro', items: [] }], ids, 'starter_pomodoro', 2000);
  assert.strictEqual(r.lastId, r.routines[0].id);
  assert.strictEqual(L.repairStarterIds([], ids, 'starter_pomodoro', 2000).lastId, 'starter_pomodoro');
  assert.strictEqual(L.repairStarterIds([{ id: 'routine_9', items: [] }], ids, 'routine_9', 2000).lastId, 'routine_9');
});

test('repairStarterIds is idempotent and does not modify its input', () => {
  const saved = [{ id: 'starter_pomodoro', title: 'T', items: [timer('a', 10)] }, { id: 'routine_5', items: [] }];
  const snap = JSON.parse(JSON.stringify(saved));
  const ids = ['starter_pomodoro'];
  const once = L.repairStarterIds(saved, ids, 'starter_pomodoro', 3000);
  assert.deepStrictEqual(saved, snap);
  const twice = L.repairStarterIds(once.routines, ids, once.lastId, 4000);
  assert.deepStrictEqual(twice.routines, once.routines);
  assert.strictEqual(twice.lastId, once.lastId);
  assert.deepStrictEqual(twice.renamed, {});
});

test('v14 blocks get the kind they already behaved as', () => {
  assert.strictEqual(L.blockKind({ timerEnabled: true }), 'timer');
  assert.strictEqual(L.blockKind({ timerEnabled: false }), 'tap');
  assert.strictEqual(L.blockKind({ kind: 'checklist', timerEnabled: false }), 'checklist');
});

test('box breathing 4-4-4-4 x 12 is 192s and cycles through the four phases', () => {
  const b = { kind: 'pacer', pattern: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }, cycles: 12 };
  assert.strictEqual(L.blockSeconds(b, 0), 192);
  const names = [0, 4000, 8000, 12000, 16000].map(ms => L.pacerPhase(b.pattern, ms).phase);
  assert.deepStrictEqual(names, ['inhale', 'hold1', 'exhale', 'hold2', 'inhale']);
  const mid = L.pacerPhase(b.pattern, 6500);
  assert.strictEqual(mid.phase, 'hold1');
  assert.strictEqual(mid.leftSecs, 2);
  assert.strictEqual(L.pacerPhase(b.pattern, 191999).cycle, 12);
});

test('zero-length holds are skipped (4-0-6-0 breathing)', () => {
  const p = { inhale: 4, hold1: 0, exhale: 6, hold2: 0 };
  assert.strictEqual(L.pacerPhase(p, 3999).phase, 'inhale');
  assert.strictEqual(L.pacerPhase(p, 4000).phase, 'exhale');
  assert.strictEqual(L.pacerPhase(p, 10000).phase, 'inhale');
});

test('a pacer step expands to a timed step and counts in totals', () => {
  const steps = L.expandRoutine({ items: [{ id: 'p', kind: 'pacer', pattern: { inhale: 4, hold1: 4, exhale: 4, hold2: 4 }, cycles: 12, timerEnabled: false }] });
  assert.strictEqual(steps[0].timerEnabled, true);
  assert.strictEqual(L.totals(steps.map(s => Object.assign({}, s, { status: 'pending' })), 0).secs, 192);
});

const at = (h, m, d) => new Date(2026, 9, d || 18, h, m, 0, 0).getTime();
const dl = (id, hhmm) => ({ id, isSection: false, type: 'activity', title: id, timerEnabled: true, timerType: 'endtime', targetEndTime: hhmm });

test('chained clock deadlines project to the last deadline, not a sum from now', () => {
  const steps = [dl('workout', '10:00'), dl('buffer', '10:05'), dl('sauna', '10:25'), dl('shower', '10:45'), dl('breakfast', '11:45'), dl('ready', '12:45')];
  const plan = L.projectSteps(steps, at(9, 0));
  assert.strictEqual(plan[0].secs, 3600);
  assert.strictEqual(plan[1].secs, 300);
  assert.strictEqual(plan[5].endMs, at(12, 45));
  assert.strictEqual(plan[5].endMs - at(9, 0), 3 * 3600 * 1000 + 45 * 60 * 1000);
});

test('a passed deadline is late, gets no time, and is never moved to tomorrow', () => {
  const plan = L.projectSteps([dl('a', '10:00'), dl('b', '09:00')], at(9, 30));
  assert.strictEqual(plan[0].endMs, at(10, 0));
  assert.strictEqual(plan[1].late, true);
  assert.strictEqual(plan[1].secs, 0);
  assert.strictEqual(plan[1].lateBySecs, 3600);
  assert.strictEqual(plan[1].endMs, at(10, 0));
});

test('blockSeconds: a passed deadline is 0 seconds, not 22 hours; nextDay is explicit', () => {
  assert.strictEqual(L.blockSeconds(dl('x', '10:25'), at(11, 10)), 0);
  assert.strictEqual(L.blockSeconds(dl('x', '12:25'), at(11, 10)), 75 * 60);
  const tom = Object.assign(dl('x', '08:30'), { nextDay: true });
  assert.strictEqual(L.blockSeconds(tom, at(22, 30)), 10 * 3600);
});

test('nextDay lets a chain cross midnight on purpose', () => {
  const plan = L.projectSteps([dl('a', '23:30'), Object.assign(dl('b', '00:30'), { nextDay: true })], at(23, 0));
  assert.strictEqual(plan[1].late, false);
  assert.strictEqual(plan[1].secs, 3600);
  assert.strictEqual(plan[1].endMs, at(0, 30, 19));
});

// The reported case: Stretching 10, Bike 10, Strength 40, then deadline blocks, started at 11:10.
const sunday = () => [timer('Stretching', 600), timer('Bike', 600), timer('Strength', 2400),
  dl('Sauna', '10:25'), dl('Shower', '10:45'), dl('Breakfast', '11:45'), dl('Ready', '12:45')];

test('late start: sauna, shower and breakfast are conflicts, ready is not', () => {
  const c = L.findConflicts(sunday(), at(11, 10));
  assert.deepStrictEqual(c.map(x => x.step.id), ['Sauna', 'Shower', 'Breakfast']);
  assert.strictEqual(c[0].lateBySecs, (12 * 60 + 10 - (10 * 60 + 25)) * 60);   // 12:10 start vs 10:25
  assert.deepStrictEqual(L.findConflicts(sunday(), at(8, 0)), []);
});

test('inferPlanned reads lengths off the original plan, null when the start is unknown', () => {
  const s = sunday();
  const noStart = L.inferPlanned(s, { dayMs: at(11, 10) });
  assert.strictEqual(noStart.Sauna, null);               // first deadline, nothing to measure from
  assert.strictEqual(noStart.Shower, 20 * 60);
  assert.strictEqual(noStart.Breakfast, 60 * 60);
  const withStart = L.inferPlanned([dl('A', '10:00'), dl('B', '10:05')], { dayMs: at(8, 0), refStartMs: at(9, 0) });
  assert.strictEqual(withStart.A, 3600); assert.strictEqual(withStart.B, 300);
  const recorded = L.inferPlanned([Object.assign(dl('A', '10:00'), { plannedSecs: 900 })], { dayMs: at(8, 0) });
  assert.strictEqual(recorded.A, 900);
});

test('shiftSteps keeps each intended length and reports the new finish', () => {
  const planned = { Sauna: 20 * 60, Shower: 20 * 60, Breakfast: 60 * 60, Ready: 60 * 60 };
  const r = L.shiftSteps(sunday(), at(11, 10), planned);
  assert.strictEqual(r.steps[3].timerType, 'duration');
  assert.strictEqual(r.steps[3].durationValue, 1200);
  assert.strictEqual(r.steps[6].shiftedSecs, 3600);
  assert.strictEqual(r.steps[0], sunday()[0] && r.steps[0]);          // earlier steps untouched
  assert.strictEqual(r.endMs, at(11, 10) + (60 + 20 + 20 + 60 + 60) * 60 * 1000);   // 14:50
  assert.deepStrictEqual(L.findConflicts(r.steps, at(11, 10)), []);
});

test('shiftSteps with no conflict changes nothing', () => {
  const r = L.shiftSteps(sunday(), at(8, 0), {});
  assert.strictEqual(r.steps[3].timerType, 'endtime');
  assert.strictEqual(r.endMs, at(12, 45));
});

test('anchorInstant: today within the grace window, else the next one', () => {
  assert.strictEqual(L.anchorInstant('09:00', at(8, 50), 3600), at(9, 0));
  assert.strictEqual(L.anchorInstant('09:00', at(9, 20), 3600), at(9, 0));
  assert.strictEqual(L.anchorInstant('09:00', at(10, 30), 3600), at(9, 0, 19));
  assert.strictEqual(L.anchorInstant('09:00', at(9, 20), 0), at(9, 0, 19));
});

test('backPlan: 20 minutes of steps finishing at 8:15 starts at 7:55', () => {
  const r = L.backPlan([timer('a', 600), timer('b', 600)], at(8, 15));
  assert.strictEqual(r.startMs, at(7, 55));
  assert.strictEqual(r.plan[1].endMs, at(8, 15));
});

test('untimed steps use the estimate only when asked', () => {
  const tap = { id: 't', isSection: false, type: 'activity', title: 't', timerEnabled: false };
  assert.strictEqual(L.projectSteps([tap], 0)[0].secs, 0);
  const p = L.projectSteps([tap], 0, { untimedSecs: 120 })[0];
  assert.strictEqual(p.secs, 120);
  assert.strictEqual(p.estimated, true);
});

test('paceBehind: positive when the projected end is later than planned', () => {
  assert.strictEqual(L.paceBehind(at(8, 15), at(8, 19)), 240);
  assert.strictEqual(L.paceBehind(at(8, 15), at(8, 9)), -360);
});

test('squeezeSavings: no skippable steps saves nothing', () => {
  const steps = [timer('a', 300), timer('b', 60)];
  assert.deepStrictEqual(L.squeezeSavings(steps, L.projectSteps(steps, 0)), { ids: [], savedSecs: 0 });
});

test('squeezeSavings: sums skippable steps, ignores skippable false, leaves inputs alone', () => {
  const steps = [timer('a', 600), timer('b', 300, { skippable: true }), timer('c', 240, { skippable: false }), timer('d', 180, { skippable: true })];
  const plan = L.projectSteps(steps, 1000000);
  const before = JSON.stringify([steps, plan]);
  assert.deepStrictEqual(L.squeezeSavings(steps, plan), { ids: ['b', 'd'], savedSecs: 480 });
  assert.strictEqual(JSON.stringify([steps, plan]), before);
});
