const test = require('node:test');
const assert = require('node:assert');
const B = require('./belly.js');

const SKY = 288; // 9 tiles: needs a real pressure blast to get above this

function run(strategy, seed) {
  const rng = B.mulberry(seed);
  const b = B.create({ rng });
  let maxReach = 0, wobSum = 0, wobN = 0;
  const dt = 1 / 60;
  const events = { blowout: 0 };
  let nextFood = 3, nextFeel = 12;
  for (let step = 0; step < 150 * 60; step++) {
    const t = step * dt;
    if (t >= nextFood) { nextFood += 6; strategy.food(b, rng); }
    if (t >= nextFeel) { nextFeel += 20; strategy.feel(b, rng); }
    const breathing = strategy.breathe(b);
    B.tick(b, dt, { breathing });
    if (strategy.blast(b)) { b.pres = Math.max(0, b.pres - 25 * dt * 6); }
    for (const e of b.events) if (e.name === 'blowout') events.blowout++;
    b.events.length = 0;
    if (step % 30 === 0) {
      maxReach = Math.max(maxReach, B.reach(b));
      wobSum += B.stats(b).wobble; wobN++;
    }
  }
  return { blowouts: events.blowout, maxReach, wobble: wobSum / wobN, vit: b.vit };
}

const pick = (rng, a) => a[Math.floor(rng() * a.length)];

const healthy = {
  food: (b, rng) => B.eat(b, pick(rng, ['broccoli', 'carrot', 'banana', 'apple', 'water', 'fish', 'blueberries'])),
  feel: (b) => B.feeling(b, 'small'),
  breathe: (b) => b.pres > 10,
  blast: () => false
};
const junk = {
  food: (b, rng) => B.eat(b, pick(rng, ['coney', 'soda', 'candy', 'paczki', 'pizza', 'chili'])),
  feel: (b, rng) => B.feeling(b, pick(rng, ['small', 'medium', 'big'])),
  breathe: () => false,
  blast: () => false
};
const mixed = {
  food: (b, rng) => {
    if (b.vit < 60) B.eat(b, pick(rng, ['broccoli', 'banana', 'carrot']));
    else B.eat(b, pick(rng, ['soda', 'candy', 'coney', 'broccoli']));
  },
  feel: (b) => B.feeling(b, 'small'),
  breathe: (b) => b.pres > 80,
  blast: (b) => b.pres > 60
};

test('healthy-only play never blows out and cannot reach the sky', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const r = run(healthy, seed);
    assert.strictEqual(r.blowouts, 0, 'blowouts seed ' + seed);
    assert.ok(r.maxReach < SKY, 'reach ' + r.maxReach);
  }
});

test('healthy-only jumps alone stay under the sky wall', () => {
  const b = B.create({ vit: 100, pres: 0 });
  const s = B.stats(b);
  assert.ok(s.jumpH < SKY, 'jump height ' + s.jumpH);
  assert.ok(B.reach(b) < SKY, 'no-pressure reach ' + B.reach(b));
});

test('junk-only play without breathing blows out at least twice', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const r = run(junk, seed);
    assert.ok(r.blowouts >= 2, 'blowouts ' + r.blowouts + ' seed ' + seed);
  }
});

test('mixed play: no blowouts, can reach the sky, steadier than junk', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const m = run(mixed, seed);
    const j = run(junk, seed);
    assert.strictEqual(m.blowouts, 0, 'mixed blowouts seed ' + seed);
    assert.ok(m.maxReach > SKY, 'mixed reach ' + m.maxReach + ' seed ' + seed);
    assert.ok(m.wobble < j.wobble, 'wobble ' + m.wobble + ' vs ' + j.wobble);
  }
});

test('eating well makes pressure fill slower', () => {
  const a = B.create({ vit: 90, pres: 10 });
  const c = B.create({ vit: 10, pres: 10 });
  B.eat(a, 'coney'); B.eat(c, 'coney');
  assert.ok(a.pres < c.pres, a.pres + ' vs ' + c.pres);
});

test('no single food or feeling takes pressure from 10 to 100', () => {
  for (const id of Object.keys(B.FOODS)) {
    const b = B.create({ vit: 15, pres: 10 });
    B.eat(b, id, 2); // worst case: direct face hit at low vitality
    assert.ok(b.pres < 100, id + ' -> ' + b.pres);
  }
  for (const sz of ['small', 'medium', 'big']) {
    const b = B.create({ vit: 15, pres: 10 });
    B.feeling(b, sz);
    assert.ok(b.pres < 100, sz);
  }
});

test('banana then candy is a clean blast, no crash', () => {
  const b = B.create({ pres: 10 });
  B.eat(b, 'banana'); B.tick(b, 1, {});
  const r = B.eat(b, 'candy');
  assert.strictEqual(r.combo, 'clean');
  for (let i = 0; i < 600; i++) B.tick(b, 1 / 60, {});
  assert.strictEqual(b.crashT, 0);
});

test('candy alone crashes after the dash', () => {
  const b = B.create({ pres: 10 });
  B.eat(b, 'candy');
  let crashed = false;
  for (let i = 0; i < 60 * 8; i++) { B.tick(b, 1 / 60, {}); if (b.crashT > 0) crashed = true; }
  assert.ok(crashed);
});

test('breathing lowers pressure and lets butterflies out', () => {
  const b = B.create({ pres: 60 });
  B.addButterflies(b, 2);
  for (let i = 0; i < 60 * 2; i++) B.tick(b, 1 / 60, { breathing: true });
  assert.ok(b.pres < 20);
  assert.strictEqual(b.butterflies, 0);
});

test('overfilling blows out and resets, never game over', () => {
  const b = B.create({ pres: 95 });
  B.addButterflies(b, 3);
  B.eat(b, 'coney'); B.eat(b, 'coney');
  B.tick(b, 0.016, {});
  assert.strictEqual(b.blowouts, 1);
  assert.ok(b.pres <= 30);
});

test('jump stays at least 2.5 tiles even with very low vitality', () => {
  const b = B.create({ vit: 0 });
  assert.ok(B.stats(b).jumpH >= 80);
});
