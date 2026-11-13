// Model tests for the Magic Music Maker engine (node --test). The engine hears a free-time recording and plans a band;
// these tests feed it a made-up hum (sharp of concert pitch, wobbly, tempo drifting, started late) and made-up taps.
const test = require('node:test'), assert = require('node:assert/strict');
const E = require('./engine.js'), { hum, taps } = require('./demo.js');
const SR = 16000;

test('a wobbly, sharp, late-starting hum is heard note for note', () => {
  const h = hum(SR), a = E.analyze(h.x);
  assert.equal(a.mode, 'melody');
  assert.ok(Math.abs(a.notes.length - h.notes.length) <= 2, 'note count ' + a.notes.length + ' vs ' + h.notes.length);
  assert.equal(a.keyName, 'G major');
  assert.ok(Math.abs(a.tune - 0.35) < 0.12, 'the singer’s own tuning (' + a.tune + ')');
  assert.ok(Math.abs(a.bpm - 107) < 12 || Math.abs(a.bpm - 54) < 6, 'tempo ' + a.bpm);
  assert.ok(Math.abs(a.B[a.d0] - a.notes[0].s) < 0.15, 'the first bar starts where the singing starts');
});

test('the hum gets chords that start and end at home', () => {
  const a = E.analyze(hum(SR).x);
  assert.equal(a.chords.length, a.nA);
  assert.equal(a.chords[a.chords.length - 1].name, 'I');
});

test('taps are heard as a rhythm and grow a tune', () => {
  const t = taps(SR), a = E.analyze(t.x);
  assert.equal(a.mode, 'rhythm');
  assert.ok(Math.abs(a.onsets.length - t.times.length) <= 1);
  assert.ok(Math.abs(a.bpm - 120) < 8 || Math.abs(a.bpm - 60) < 5, 'tempo ' + a.bpm);
  assert.ok(E.arrange(a, E.STYLES[6], {}).events.some((e) => e.k === 'lead'));
});

test('silence is never turned into a song', () => {
  assert.equal(E.analyze(new Float32Array(SR * 3)).mode, 'empty');
});

test('every band at every energy makes sane, in-range events', () => {
  const a = E.analyze(hum(SR).x);
  for (const st of E.STYLES) for (const en of [1, 2, 3]) {
    const ar = E.arrange(a, st, { energy: en, playback: true });
    assert.ok(ar.events.length > 40, st.id);
    assert.ok(ar.events.every((e) => isFinite(e.t) && e.t >= -0.01 && e.t < ar.len && isFinite(e.d)), st.id + ' event times');
    assert.ok(ar.events.every((e) => e.k !== 'lead' || (e.n > 30 && e.n < 100)), st.id + ' lead range');
  }
});

test('the band plays the tune back only when asked', () => {
  const a = E.analyze(hum(SR).x), on = E.arrange(a, E.STYLES[0], { playback: true }), off = E.arrange(a, E.STYLES[0], { playback: false });
  assert.ok(on.sections.some((s) => s.id === 'band'));
  assert.ok(!off.sections.some((s) => s.id === 'band'));
  assert.ok(on.len > off.len);
});

test('magic words pick the band, the energy and the voice', () => {
  const w = E.readWords('a sleepy dragon in space');
  assert.equal(w.style, 'lullaby'); assert.equal(w.energy, 1);
  assert.equal(E.readWords('a robot on a train').voice, 'robot');
  assert.deepEqual(E.readWords('   ').heard, []);
  assert.deepEqual(E.readWords('qwerty').heard, []);
});

/* ---------- 1.1: tuning the voice, a bigger song ---------- */
const SR2 = 48000;
const rmsOf = (x) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); };

test('scaleStep walks up and down the key, not the piano', () => {
  const key = { tonic: 7, mode: 'major' };            // G major: G A B C D E F#
  assert.equal(E.scaleStep(71, 2, key), 74);          // B up a third is D
  assert.equal(E.scaleStep(71, -2, key), 67);         // B down a third is G
  assert.equal(E.scaleStep(67, 4, key), 74);          // G up a fifth is D
});

test('tuning puts every sung note on the band’s note, keeps length and loudness, and calms the wobble', () => {
  const h = hum(SR2, { cents: -25, lead: 0.8 }), plan = E.analyze(E.toMono16k([h.x], SR2));
  const y = E.tuneVoice(h.x, SR2, plan, { amount: 1, speed: 0.025 }), a = E.analyze(E.toMono16k([y], SR2));
  assert.equal(y.length, h.x.length);
  assert.ok(Math.abs(rmsOf(y) / rmsOf(h.x) - 1) < 0.1, 'loudness kept');
  assert.ok(y.every(Number.isFinite), 'no NaN');
  let matched = 0;
  for (const n of a.notes) { const m = plan.notes.find((q) => Math.abs(q.s - n.s) < 0.2); if (!m) continue; matched++; assert.ok(Math.abs(n.p - (m.q + plan.tune)) < 0.12, 'note at ' + n.s.toFixed(2) + ' is ' + (n.p - m.q - plan.tune).toFixed(3) + ' off'); }
  assert.ok(matched >= plan.notes.length - 2, 'matched ' + matched);
  const wob = (p) => { let v = 0, c = 0; for (const n of p.notes) { const f0 = Math.round(n.s / E.DT + 8), f1 = Math.round(n.e / E.DT - 3), z = []; for (let t = f0; t < f1; t++) if (!isNaN(p.sm[t])) z.push(p.sm[t]); if (z.length > 4) { const mu = z.reduce((s, q) => s + q, 0) / z.length; v += Math.sqrt(z.reduce((s, q) => s + (q - mu) ** 2, 0) / z.length); c++; } } return v / c; };
  assert.ok(wob(a) < wob(plan) * 0.6, 'wobble ' + wob(plan).toFixed(3) + ' -> ' + wob(a).toFixed(3));
});

test('backing singers sit a third above and a third below, in the key', () => {
  const h = hum(SR2, { cents: -25, lead: 0.8 }), plan = E.analyze(E.toMono16k([h.x], SR2));
  for (const steps of [2, -2]) {
    const a = E.analyze(E.toMono16k([E.tuneVoice(h.x, SR2, plan, { amount: 1, speed: 0.04, steps })], SR2)); let ok = 0;
    for (const n of a.notes) { const m = plan.notes.find((q) => Math.abs(q.s - n.s) < 0.2); if (m && Math.abs(n.p - (E.scaleStep(m.q, steps, plan.key) + plan.tune)) < 0.2) ok++; }
    assert.ok(ok >= plan.notes.length - 2, 'harmony ' + steps + ': ' + ok + ' of ' + plan.notes.length);
  }
});

test('a clean, already in-tune voice is left alone, and taps are never "tuned"', () => {
  const h = hum(SR2, { cents: 0, lead: 0.8 }), plan = E.analyze(E.toMono16k([h.x], SR2));
  const sh = E.shiftTrack(plan, { amount: 1 }); let big = 0; for (const v of sh) big = Math.max(big, Math.abs(v));
  assert.ok(big < 1.2, 'largest move ' + big);
  const t = taps(SR2), tp = E.analyze(E.toMono16k([t.x], SR2));
  assert.equal(E.tuneVoice(t.x, SR2, tp, {}), t.x);
});

test('a pitch-tracker slip is never turned into a chipmunk', () => {
  const h = hum(SR2, { cents: -25, lead: 0.8 }), plan = E.analyze(E.toMono16k([h.x], SR2));
  for (const n of plan.notes) n.q += 7;                // pretend the band wants a fifth higher than was sung
  let big = 0; for (const v of E.shiftTrack(plan, { amount: 1 })) big = Math.max(big, Math.abs(v));
  assert.ok(big <= 2.2 + 1e-6, 'largest move ' + big);
});

test('Pop star: the voice sings the chorus too, with a riser and humanised drums', () => {
  const a = E.analyze(hum(SR).x), pop = E.arrange(a, E.STYLES[0], { voice: 'pop', playback: true, energy: 2 }), nat = E.arrange(a, E.STYLES[0], { voice: 'natural', playback: true, energy: 2 });
  assert.equal(pop.voice2, true); assert.equal(nat.voice2, false);
  assert.ok(pop.events.some((e) => e.k === 'riser'), 'riser into the chorus');
  assert.ok(pop.events.every((e) => isFinite(e.t) && e.t >= -0.01 && e.t < pop.len), 'times in range');
  for (let i = 1; i < pop.events.length; i++) assert.ok(pop.events[i].t >= pop.events[i - 1].t, 'events sorted');
  const kicks = pop.events.filter((e) => e.k === 'kick').map((e) => e.t), g = pop.G;
  assert.ok(kicks.some((t) => g.every((b) => Math.abs(b - t) > 0.002)), 'kicks are not all exactly on the grid');
  assert.deepEqual(E.arrange(a, E.STYLES[0], { voice: 'pop', playback: true, energy: 2 }).events, pop.events, 'same hum, same song');
  assert.equal(E.arrange(E.analyze(taps(SR).x), E.STYLES[0], { voice: 'pop', playback: true }).voice2, false, 'taps have no voice to sing again');
  assert.equal(E.readWords('a pop star on a stage').voice, 'pop');
});
