const test = require('node:test');
const assert = require('node:assert');
const D = require('./data.js');

/* Conservative walkability check: from the start, using only walks and jumps a
   low-vitality Gus can make (rise 2, gaps up to 4 cells), can the player reach the goal?
   Blast zones (marked in the level) allow big climbs, because those are taught, fed and fair. */

function solid(L, x, y) { return D.SOLID.indexOf(L.get(x, y)) >= 0; }

function build(id) {
  const L = D.STAGES[id].build();
  // mover tops at both extremes act as standable ground
  const extra = new Set();
  for (const m of L.movers) {
    for (let k = 0; k <= 8; k++) for (let i = 0; i < m.w; i++) extra.add((m.x + Math.round(m.dx * k / 8) + i) + ',' + (m.y + Math.round(m.dy * k / 8)));
  }
  L.extra = extra;
  return L;
}
function floorAt(L, x, y) {
  // cell (x,y) is standable if it is free (and has head room) and the cell below is solid/one-way/mover
  if (solid(L, x, y) || solid(L, x, y - 1)) return false;
  const below = L.get(x, y + 1);
  const ok = D.SOLID.indexOf(below) >= 0 || D.ONEWAY.indexOf(below) >= 0 || L.extra.has(x + ',' + (y + 1));
  return ok && y + 1 < L.h + 1;
}
function reach(L) {
  const key = (x, y) => x + ',' + y;
  const seen = new Set();
  const q = [[L.start.x, L.start.y]];
  seen.add(key(L.start.x, L.start.y));
  const inBlast = (x) => L.blastZones.some(z => x >= z[0] && x <= z[1]);
  while (q.length) {
    const [x, y] = q.shift();
    const up = inBlast(x) ? 14 : 2;
    for (let dx = -7; dx <= 7; dx++) {
      const tx = x + dx;
      if (tx < 0 || tx >= L.w) continue;
      for (let ty = y - up; ty <= y + 16; ty++) {
        if (ty < 0 || ty >= L.h) continue;
        if (seen.has(key(tx, ty)) || !floorAt(L, tx, ty)) continue;
        const rise = y - ty;
        const adx = Math.abs(dx);
        let maxDx;
        if (rise > 2) maxDx = 6;
        else if (rise === 2) maxDx = 3;
        else if (rise === 1) maxDx = 4;
        else if (rise === 0) maxDx = 5;
        else maxDx = 6;
        if (adx > maxDx) continue;
        // clearance: the arc passes above the higher end; intermediate columns must be open there
        const topRow = Math.min(y, ty);
        let blocked = false;
        const s = Math.sign(dx);
        for (let cx = x + s; cx !== tx && s !== 0; cx += s) {
          if (rise > 2) break;
          if (solid(L, cx, topRow - 1) || solid(L, cx, topRow - 2)) { blocked = true; break; }
        }
        if (blocked) continue;
        seen.add(key(tx, ty)); q.push([tx, ty]);
      }
    }
  }
  return seen;
}

for (const id of D.ORDER) {
  test('stage ' + id + ': the goal is reachable by a conservative player', () => {
    const L = build(id);
    const seen = reach(L);
    const g = L.goal;
    let ok = false;
    for (let dx = -3; dx <= 3 && !ok; dx++) for (let dy = -4; dy <= 4; dy++) if (seen.has((g.x + dx) + ',' + (g.y + dy))) { ok = true; break; }
    let mx = 0, at = ''; for (const k of seen) { const x = +k.split(',')[0]; if (x > mx) { mx = x; at = k; } }
    assert.ok(ok, id + ': no path from start to goal at ' + g.x + ',' + g.y + ' (furthest reachable cell ' + at + ')');
  });
  test('stage ' + id + ': checkpoints and start sit on solid ground', () => {
    const L = build(id);
    const pts = [L.start].concat(L.checks);
    for (const p of pts) assert.ok(floorAt(L, p.x, p.y), id + ' checkpoint ' + p.x + ',' + p.y + ' not standable');
  });
  test('stage ' + id + ': no food is buried inside solid tiles', () => {
    const L = build(id);
    for (const f of L.foods) assert.ok(!solid(L, f.x, f.y), id + ' food ' + f.id + ' at ' + f.x + ',' + f.y + ' is in a wall');
    for (const b of L.bugs) assert.ok(!solid(L, b.x, b.y), id + ' bug ' + b.id + ' is in a wall');
  });
}
test('every food id used by a level exists in the belly table', () => {
  const B = require('./belly.js');
  for (const id of D.ORDER) {
    const L = D.STAGES[id].build();
    for (const f of L.foods) assert.ok(B.FOODS[f.id], id + ' unknown food ' + f.id);
    for (const k of Object.keys(L.crates)) assert.ok(B.FOODS[L.crates[k]], 'crate food ' + L.crates[k]);
  }
});
test('every findable food has a Dex card with Traditional Chinese and jyutping per character', () => {
  for (const id of Object.keys(D.DEX)) {
    const e = D.DEX[id];
    const chars = Array.from(e.zh).length;
    const syl = e.jp.split(' ').length;
    assert.strictEqual(chars, syl, id + ' zh has ' + chars + ' chars but jyutping has ' + syl);
    assert.ok(/[a-z]+[1-6]$/.test(e.jp.split(' ')[0]), id + ' jyutping format');
  }
});
