// Run with: node --test sequence-flow/
const test = require('node:test');
const assert = require('node:assert');
const A = require('./builder.js');
const L = require('./logic.js');

const sample = {
  title: 'Sunday Morning', startAt: '9:00',
  items: [
    { title: 'Workout', durationSecs: 3600 },
    { title: 'Rest', rest: true, durationSecs: 300 },
    { section: true, title: 'Intervals', repeatCount: 4 },
    { title: 'Hard', durationSecs: 45, sets: 3, restSecs: 15 },
    { title: 'Breathe', kind: 'pacer', pacer: { inhale: 4, exhale: 6, hold1: 0, hold2: 0, cycles: 10 } },
    { title: 'Pack bag', kind: 'checklist', checklist: ['Water', 'Keys'] },
    { title: 'Stretch', kind: 'tap', target: '2 minutes each side', notes: ['Slow'] },
    { title: 'Until ten', deadline: '10:00' }
  ]
};

test('fromAI builds app blocks the engine understands', () => {
  const { routine, warnings } = A.fromAI(sample, null, { stamp: 1 });
  assert.deepStrictEqual(warnings, []);
  assert.strictEqual(routine.startAt, '09:00');
  const steps = L.expandRoutine(routine);
  const w = steps[0];
  assert.strictEqual(w.durationValue, 60); assert.strictEqual(w.durationUnit, 'mins');
  assert.strictEqual(w.timerEnabled, true);
  assert.strictEqual(steps[1].type, 'gap');
  // 4 rounds x (3 sets of Hard with 2 rests + Breathe + Pack bag + Stretch + Until ten)
  assert.strictEqual(steps.length, 2 + 4 * (5 + 4));
  const pacer = routine.items.find(i => i.kind === 'pacer');
  assert.strictEqual(pacer.durationValue, 100);
  assert.strictEqual(L.blockKind(routine.items.find(i => i.title === 'Stretch')), 'tap');
  assert.strictEqual(routine.items.find(i => i.title === 'Until ten').timerType, 'endtime');
  assert.deepStrictEqual(routine.items.find(i => i.title === 'Pack bag').checklist, [{ text: 'Water' }, { text: 'Keys' }]);
});

test('fromAI survives junk without throwing and clamps values', () => {
  const { routine, warnings } = A.fromAI({ title: 5, items: [null, 'x', { title: 'A', kind: 'timer' }, { title: 'B', sets: 5000, durationSecs: 99999999 },
    { section: true, repeatCount: 500 }, { title: 'C', deadline: '25:99' }], startAt: 'soon' }, null, { stamp: 2 });
  assert.strictEqual(routine.startAt, undefined);
  assert.strictEqual(routine.items.length, 4);
  assert.ok(warnings.some(w => /no length/.test(w)));
  assert.strictEqual(routine.items[1].sets, 99);
  assert.strictEqual(routine.items[2].repeatCount, 99);
  assert.strictEqual(routine.items[3].kind, 'tap');
  assert.doesNotThrow(() => L.expandRoutine(routine));
  assert.strictEqual(A.fromAI(null, null).routine.items.length, 0);
});

test('only existing ids survive from the model; new ones are made unique', () => {
  const prev = { id: 'r1', folder: 'Mornings', items: [{ id: 'keep', isSection: false, title: 'Old' }] };
  const { routine } = A.fromAI({ title: 'T', items: [{ id: 'keep', title: 'Old', durationSecs: 60 }, { id: 'keep', title: 'Dup', durationSecs: 60 }, { id: 'made-up', title: 'New', durationSecs: 60 }] }, prev, { stamp: 3 });
  assert.strictEqual(routine.id, 'r1'); assert.strictEqual(routine.folder, 'Mornings');
  const ids = routine.items.map(i => i.id);
  assert.strictEqual(ids[0], 'keep');
  assert.strictEqual(new Set(ids).size, 3);
  assert.ok(!ids.slice(1).includes('made-up'));
});

test('toAI then fromAI round-trips the shape and diff is empty', () => {
  const first = A.fromAI(sample, null, { stamp: 4 }).routine;
  const again = A.fromAI(A.toAI(first), first, { stamp: 5 }).routine;
  assert.deepStrictEqual(A.diffRoutines(first, again), []);
  assert.deepStrictEqual(L.expandRoutine(first).map(s => s.title), L.expandRoutine(again).map(s => s.title));
});

test('diffRoutines reports added, changed and removed blocks', () => {
  const first = A.fromAI(sample, null, { stamp: 6 }).routine;
  const ai = A.toAI(first);
  ai.items = ai.items.filter(i => i.title !== 'Stretch');
  ai.items[0].durationSecs = 1800;
  ai.items.push({ title: 'Sauna', durationSecs: 1200 });
  const next = A.fromAI(ai, first, { stamp: 7 }).routine;
  const d = A.diffRoutines(first, next);
  assert.deepStrictEqual(d.map(x => x.type + ':' + x.text).sort(), ['added:Sauna', 'changed:Workout', 'removed:Stretch']);
});

test('default model is the cheap one', () => { assert.strictEqual(A.DEFAULT_MODEL, 'claude-haiku-5-5'); assert.ok(A.MODELS[A.DEFAULT_MODEL]); });

test('buildRequest sends the routine only in the last turn and never forces a tool', () => {
  const r = A.fromAI(sample, null, { stamp: 8 }).routine;
  const req = A.buildRequest('claude-haiku-5-5', [{ role: 'user', text: 'hi' }, { role: 'assistant', text: 'hello' }], 'make it shorter', r);
  assert.strictEqual(req.messages.length, 3);
  assert.ok(!/Routine on screen/.test(req.messages[0].content));
  assert.ok(/Routine on screen/.test(req.messages[2].content));
  assert.deepStrictEqual(req.tool_choice, { type: 'auto' });
  assert.strictEqual(req.temperature, undefined);
  assert.strictEqual(req.thinking, undefined);
});

test('parseResponse reads text and the set_routine call, ignores thinking', () => {
  const p = A.parseResponse({ stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Done.' }, { type: 'tool_use', name: 'set_routine', input: sample }] });
  assert.strictEqual(p.text, 'Done.'); assert.strictEqual(p.ai.title, 'Sunday Morning');
  assert.strictEqual(A.parseResponse({ content: [{ type: 'text', text: 'How long?' }] }).ai, null);
  assert.strictEqual(A.parseResponse({ stop_reason: 'refusal', content: [] }).refused, true);
});

test('ask sends the key headers and turns failures into plain messages', async () => {
  let seen;
  const ok = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'ok' }] }) }; };
  const r = await A.ask({ key: 'k', text: 'hi', routine: { items: [] }, fetchFn: ok });
  assert.strictEqual(r.text, 'ok');
  assert.strictEqual(seen.url, 'https://api.anthropic.com/v1/messages');
  assert.strictEqual(seen.init.headers['x-api-key'], 'k');
  assert.strictEqual(seen.init.headers['anthropic-dangerous-direct-browser-access'], 'true');
  const bad = async () => ({ ok: false, status: 401, json: async () => ({}) });
  await assert.rejects(A.ask({ key: 'k', text: 'hi', routine: { items: [] }, fetchFn: bad }), /not accepted/);
  const down = async () => { throw new Error('x'); };
  await assert.rejects(A.ask({ key: 'k', text: 'hi', routine: { items: [] }, fetchFn: down }), /Could not reach/);
});
