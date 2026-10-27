// Plays "Morning at Home" from start to the gate with the real physics at the lowest vitality (15), using
// only walking and jumping (no blasting), along a route found by the same walkability rules as levels.test.js.
// Every hop is tried with a few start positions and jump timings, so it proves a human has room to succeed.
import { launch } from './cdp.mjs';
const base = process.env.GUTS_URL || 'http://localhost:8765/guts/index.html';
const stage = process.env.STAGE || 'home';
const p = await launch({ url: base, w: 1280, h: 800 });
await p.ready();
const out = await p.eval(`(function(){
  var G = GUTS, Game = G.Game, D = G.Data, K = G.Input._keys, T = 32;
  Game.begin('${stage}', { noHeist: true }); var st = Game.st, g = st.g, L = D.STAGES['${stage}'].build();
  function solid(x, y) { return D.SOLID.indexOf(L.get(x, y)) >= 0; }
  function floorAt(x, y) { if (solid(x, y) || solid(x, y - 1)) return false; var b = L.get(x, y + 1); return D.SOLID.indexOf(b) >= 0 || D.ONEWAY.indexOf(b) >= 0; }
  // ---- plan: breadth-first search over standable cells
  var key = function (x, y) { return x + ',' + y; }, par = {}, q = [[L.start.x, L.start.y]]; par[key(L.start.x, L.start.y)] = null;
  var goal = null;
  while (q.length) {
    var c = q.shift(), x = c[0], y = c[1];
    if (Math.abs(x - L.goal.x) <= 1 && Math.abs(y - L.goal.y) <= 1) { goal = c; break; }
    for (var dx = -6; dx <= 6; dx++) for (var ty = y - 2; ty <= y + 16; ty++) {
      var tx = x + dx; if (tx < 0 || tx >= L.w || ty < 0 || ty >= L.h || par[key(tx, ty)] !== undefined || !floorAt(tx, ty)) continue;
      var rise = y - ty, ad = Math.abs(dx), md = rise > 2 ? 0 : rise === 2 ? 3 : rise === 1 ? 4 : rise === 0 ? 5 : 6; if (ad > md) continue;
      var s = Math.sign(dx), bad = false, top = Math.min(y, ty);
      for (var cx = x + s; cx !== tx && s !== 0; cx += s) if (solid(cx, top - 1) || solid(cx, top - 2)) { bad = true; break; }
      if (bad) continue; par[key(tx, ty)] = [x, y]; q.push([tx, ty]);
    }
  }
  if (!goal) return { ok: false, error: 'no route found' };
  var path = []; for (var n = goal; n; n = par[key(n[0], n[1])]) path.unshift(n);
  // ---- execute with real physics
  function clean() { st.b.vit = 15; st.b.pres = 0; st.b.boostT = 0; st.b.crashT = 0; st.bubbles.length = 0; g.lockT = 0; st.slow = null; st.b.butterflies = 0; }
  function step() { clean(); Game.step(1 / 60); }
  function snap() { return JSON.parse(JSON.stringify({ g: g, t: st.t })); }
  function restore(s) { Object.keys(s.g).forEach(function (k) { g[k] = s.g[k]; }); st.t = s.t; }
  function keys(l, r, j) { K.ArrowLeft = l; K.ArrowRight = r; K.Space = j; }
  function walkTo(tx) { for (var f = 0; f < 120 && Math.abs(g.x - tx) > 5; f++) { keys(g.x > tx, g.x < tx, false); step(); } keys(false, false, false); for (var i = 0; i < 8; i++) step(); }
  var log = [], fails = 0, hops = 0, t0 = st.t;
  for (var i = 0; i + 1 < path.length; i++) {
    var A = path[i], B = path[i + 1], dir = Math.sign(B[0] - A[0]) || 1, s0 = snap(), done = false;
    var easy = Math.abs(B[0] - A[0]) <= 1 && B[1] >= A[1] - 0;
    var delays = easy ? [999, 0, 6] : [0, 3, 6, 9, 12, 16, 20], fracs = [0.5, 0.15, 0.85, 0.3, 0.7, 0.02, 0.98];
    for (var fi = 0; fi < fracs.length && !done; fi++) for (var di = 0; di < delays.length && !done; di++) {
      restore(s0); var sx = (A[0] + (dir > 0 ? fracs[fi] : 1 - fracs[fi])) * T; walkTo(sx);
      for (var f = 0; f < 120; f++) {
        keys(dir < 0, dir > 0, f >= delays[di] && f < delays[di] + 30); step();
        if (g.grounded && Math.abs(g.y - (B[1] + 1) * T) < 2 && Math.abs(g.x - (B[0] + 0.5) * T) < (B[1] > A[1] ? 6 : 1) * T) { done = true; break; }   // a long drop may carry Gus a few tiles on
      }
      keys(false, false, false);
    }
    hops++;
    if (!done) { fails++; log.push('FAILED hop ' + A + ' -> ' + B); restore(s0); break; }
    for (var k = 0; k < 6; k++) step();
  }
  // walk through the gate
  for (var w = 0; w < 240 && st.status === 'play'; w++) { keys(false, true, false); step(); }
  keys(false, false, false);
  var c = st.cat; return { ok: fails === 0 && st.status === 'clear', cat: c ? { waypoint: c.i, dropped: c.dropped, trusted: !!c.trusted } : null, baoEaten: st.baoEaten, helpedBySnacks: st.stats.helped || 0, status: st.status, hops: hops, fails: fails, cells: path.length, gameSeconds: Math.round((st.t - t0) * 10) / 10, atTile: Math.round(g.x / T), log: log };
})()`);
console.log(JSON.stringify(out));
console.log('PLAYTHROUGH', out.ok ? 'OK: reached the gate with jumps only at vitality 15' : 'FAILED');
if (p.logs.length) console.log('page logs', JSON.stringify(p.logs));
p.close();
