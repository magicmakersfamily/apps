// Persona bots: four ways of playing "Morning at Home", each a simple behaviour policy (not a child, not an LLM).
//   james        Little Guts on a PlayStation pad: mashes jump in bursts, random blasts, wanders back, gets distracted
//   explorer     Standard on the keyboard: roams the whole level, pokes at things, heads for the gate late
//   speedrunner  Standard on the keyboard: holds right, jumps at every wall and gap, blasts over tall walls
//   cautious     Standard on a pad: short steps, stops at edges, breathes when the belly fills, backs off when stuck
// Every run is one fixed-timestep simulation inside the real page (GUTS.Game.step at 60 fps, Math.random seeded),
// so the same persona + seed + browser replays the same run. Checks on every frame:
//   failures (broken): page errors, an exception from the game, NaN position, Gus outside the level, Gus stuck inside
//                      a wall, belly numbers out of range (pressure over 100 for more than 3 frames), a scene that never ends
//   findings (design data, never fail): stalls (no progress for 20 s), falls, blowouts, no finish, helper snacks
// Usage: node guts/tools/personas.mjs [--persona james,cautious] [--seeds 3 | --seed 7] [--browser chromium,firefox,webkit | all]
import path from 'node:path';
import { launch, gutsUrl } from './cdp.mjs';
import { fileURLToPath } from 'node:url';
import { record, outDir, BROWSERS } from '../../tools/play/harness.mjs';
const WATCH = fileURLToPath(new URL('./watch.js', import.meta.url));

export const PERSONAS = {
  james: { mode: 'little', input: 'pad', limit: 240 },
  explorer: { mode: 'standard', input: 'keys', limit: 180 },
  speedrunner: { mode: 'standard', input: 'keys', limit: 120 },
  cautious: { mode: 'standard', input: 'pad', limit: 240 }
};

/* runs inside the page */
function play(cfg) {
  var G = GUTS, Game = G.Game, D = G.Data, In = G.Input, T = 32, FPS = 60, dt = 1 / FPS;
  var a = (cfg.seed * 7919 + cfg.salt) >>> 0;
  function rand() { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  function chance(perSecond) { return rand() < perSecond * dt; }
  function between(lo, hi) { return lo + rand() * (hi - lo); }

  Game.save.mode = cfg.mode; Game.save.seenIntro = true;
  window.__guts.startLevel();
  Game.paused = true;   // the page's own animation loop stops updating; only this loop moves the game
  var st = Game.st, g = st.g, L = st.L;
  var goalX = st.goal ? st.goal.x : L.w * T;
  function solid(x, y) { return D.SOLID.indexOf(L.get(x, y)) >= 0; }
  function floorAt(x, y) { var c = L.get(x, y); return D.SOLID.indexOf(c) >= 0 || D.ONEWAY.indexOf(c) >= 0; }
  /* what is ahead in direction d: the nearest wall (distance, height) and the nearest gap in the floor */
  function look(d) {
    var gx = Math.floor(g.x / T), row = Math.round(g.y / T), o = { wall: 99, wallH: 0, gap: 99 };
    for (var i = 1; i <= 6; i++) { var x = gx + d * i; if (solid(x, row - 1)) { var top = row - 1; while (top > 0 && solid(x, top - 1)) top--; o.wall = i; o.wallH = row - top; break; } }
    for (var j = 1; j <= 5; j++) { var xx = gx + d * j, f = false; for (var y = row; y <= row + 2; y++) if (floorAt(xx, y)) { f = true; break; } if (!f) { o.gap = j; break; } }
    return o;
  }

  /* ---------- input: the same five actions through the keyboard or the stub PlayStation pad ---------- */
  var K = In._keys;
  function send(act) {
    if (cfg.input === 'pad') window.__padSet({ lx: act.left ? -1 : act.right ? 1 : 0, cross: act.jump, square: act.blast, circle: act.breathe });
    else { K.ArrowLeft = !!act.left; K.ArrowRight = !!act.right; K.Space = !!act.jump; K.KeyX = !!act.blast; K.KeyB = !!act.breathe; }
  }

  /* ---------- the four policies: each returns this frame's actions ---------- */
  var m = { phase: 'go', t: 0, hold: {}, target: null, stuckT: 0, lastX: g.x, idle: 0, burst: 0 };
  function held(name, on, secs) { if (on) m.hold[name] = secs; var v = (m.hold[name] || 0) > 0; m.hold[name] = (m.hold[name] || 0) - dt; return v; }
  var policies = {
    james: function () {
      var act = {};
      if (m.idle > 0) { m.idle -= dt; return act; }                         // distracted
      if (chance(0.08)) { m.idle = between(1, 3); return act; }
      if (chance(0.6)) m.burst = between(0.6, 2.2);                         // a burst of jump mashing
      if (m.burst > 0) { m.burst -= dt; act.jump = (Math.floor(st.t * between(5, 9)) % 2) === 0; }
      else act.jump = held('j', chance(0.4), between(0.05, 0.3));
      act.blast = held('b', chance(0.35), rand() < 0.3 ? between(0.5, 1.5) : 0.1);
      act.left = held('l', chance(0.12), between(0.3, 1.2));                // Little Guts runs by itself; left walks back
      act.breathe = held('br', chance(0.05), between(0.5, 2));
      return act;
    },
    explorer: function () {
      var act = {}, endPhase = st.t > cfg.limit * 0.6;
      if (!m.target || Math.abs(g.x - m.target) < T || chance(0.08)) m.target = endPhase ? goalX : between(1, L.w - 1) * T;
      var d = m.target > g.x ? 1 : -1, ah = look(d);
      act.right = d > 0; act.left = d < 0;
      act.jump = held('j', (ah.wall <= 2 && ah.wallH <= 3) || ah.gap <= 1 || chance(0.6), between(0.15, 0.4));
      act.blast = held('b', (ah.wall <= 2 && ah.wallH > 3 && st.b.pres > 12) || chance(0.15), between(0.2, 1));
      if (st.b.pres > 70 && g.grounded && chance(1)) { m.hold.br = 1.2; }
      act.breathe = held('br', false, 0); if (act.breathe) { act.left = act.right = act.jump = false; }
      return act;
    },
    speedrunner: function () {
      var ah = look(1), act = { right: true };
      act.jump = held('j', ah.wall <= 2 || ah.gap <= 1, 0.4);
      act.blast = held('b', ah.wall <= 2 && ah.wallH > 3 && st.b.pres > 10, 0.6);
      return act;
    },
    cautious: function () {
      var act = {};
      if (Math.abs(g.x - m.lastX) > T) { m.lastX = g.x; m.stuckT = 0; } else m.stuckT += dt;
      if (st.b.pres > 50 && g.grounded && !m.hold.br) m.hold.br = 2.5;
      if (held('br', false, 0)) return { breathe: true };
      if (m.stuckT > 6) { m.stuckT = 0; m.hold.back = between(0.4, 1.2); }
      if (held('back', false, 0)) return { left: true, jump: chance(2) };
      var ah = look(1);
      if (m.t > 0) m.t -= dt; else { m.walking = !m.walking; m.t = m.walking ? between(0.3, 0.9) : between(0.4, 1.5); }
      if (ah.gap <= 1 && g.grounded) { act.jump = held('j', !m.hold.j || m.hold.j < -0.6, 0.4); act.right = true; return act; }
      act.right = m.walking;
      act.jump = held('j', ah.wall <= 1 && ah.wallH <= 3 && g.grounded, 0.4);
      return act;
    }
  };
  var policy = policies[cfg.persona];

  /* ---------- the run (checks shared with replay.mjs live in watch.js) ---------- */
  var w = GUTSWatch({ render: true }), frames = Math.round(cfg.limit * FPS);
  for (var f = 0; f < frames; f++) {
    send(policy());
    var t0 = performance.now();
    try { Game.step(dt); } catch (e) { w.fail('exception', 'Game.step threw: ' + e.message); break; }
    w.timeUpdate(performance.now() - t0);
    if (w.frame(dt) === 'stop') break;
    st = Game.st; g = st.g;
    if (st.status === 'clear' && st.clearT > 1) break;
  }
  send({});
  Game.render();
  return w.result('did not reach the gate in ' + cfg.limit + ' s (furthest point)');
}

export async function runPersona({ persona, seed, browser }) {
  const cfg = { ...PERSONAS[persona], persona, seed, salt: Object.keys(PERSONAS).indexOf(persona) + 1 };
  const t0 = Date.now();
  const p = await launch({ url: await gutsUrl(), browser, seed, pad: cfg.input === 'pad' ? 'standard' : false });
  let res;
  try {
    if (!(await p.ready())) throw new Error('the game never finished loading');
    await p.page.addScriptTag({ path: WATCH });
    res = await p.page.evaluate(play, cfg);
  } catch (e) {
    res = { status: 'error', failures: [{ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }], findings: [] };
  }
  res.failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
  const rec = { game: 'guts', scenario: 'persona', persona, browser: p.browserName, seed, mode: cfg.mode, input: cfg.input, wallSeconds: Math.round((Date.now() - t0) / 100) / 10, ...res };
  if (res.failures.length) rec.screenshot = await p.shot(path.join(outDir(), 'shots', ['guts', persona, p.browserName, seed].join('_') + '.png')).catch(() => null);
  record(rec);
  await p.close();
  return rec;
}

/* ---------- command line ---------- */
if (import.meta.url === 'file://' + process.argv[1]) {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const personas = arg('persona', Object.keys(PERSONAS).join(',')).split(',');
  const seeds = arg('seed') ? [Number(arg('seed'))] : Array.from({ length: Number(arg('seeds', 3)) }, (_, i) => i + 1);
  const bl = arg('browser', process.env.BROWSER || 'chromium'); const browsers = bl === 'all' ? BROWSERS : bl.split(',');
  const jobs = []; for (const b of browsers) for (const pe of personas) for (const s of seeds) jobs.push({ persona: pe, seed: s, browser: b });
  let bad = 0; const par = Number(arg('parallel', 3)); let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const j = jobs[next++], r = await runPersona(j);
      if (r.failures.length) bad++;
      console.log([j.browser.padEnd(8), j.persona.padEnd(11), 'seed ' + String(j.seed).padEnd(3), String(r.status).padEnd(5), (r.gameSeconds + 's').padEnd(7), 'tile ' + r.furthestTile + '/' + r.levelTiles, 'falls ' + r.falls, 'stalls ' + r.findings.filter((x) => x.type === 'stall').length, 'upd p95 ' + (r.updateMs && r.updateMs.p95) + 'ms', r.failures.length ? 'FAIL: ' + r.failures.map((x) => x.text).join('; ') : 'ok'].join('  '));
    }
  }
  await Promise.all(Array.from({ length: Math.min(par, jobs.length) }, worker));
  console.log('PERSONAS', bad ? bad + ' of ' + jobs.length + ' runs FAILED' : 'OK: ' + jobs.length + ' runs, no failures', '| records in', outDir());
  process.exitCode = bad ? 1 : 0;
}
