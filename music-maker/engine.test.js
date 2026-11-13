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
