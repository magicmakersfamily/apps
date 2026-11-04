// Regression checks for the 1.7 team playtest findings (guts/TEAM-REPORT-1.7.md): one check per finding, frame-exact.
// Usage: node guts/tools/regress.mjs [--browser chromium|firefox|webkit]
import { launch, gutsUrl } from './cdp.mjs';
import { record } from '../../tools/play/harness.mjs';
const i = process.argv.indexOf('--browser'), browser = i > 0 ? process.argv[i + 1] : (process.env.BROWSER || 'chromium');
const p = await launch({ url: await gutsUrl(), browser, seed: 4 }); const failures = [], m = {};
try {
  if (!(await p.ready())) throw new Error('the game never finished loading');
  await p.page.click('#b-gym'); await p.sleep(300);
  const r = await p.eval(`(function () {
    var G = GUTS, Game = G.Game, K = G.Input._keys, T = 32, st = Game.st, g = st.g, out = {};
    Game.paused = true;
    function keys(o) { ['ArrowLeft','ArrowRight','Space'].forEach(function (k) { K[k] = !!(o && o[k]); }); }
    function step(n, o) { for (var i = 0; i < n; i++) { keys(o); Game.step(1 / 60); } keys(); }
    function place(tx, ty) { st = Game.st; g = st.g; g.x = (tx + 0.5) * T; g.y = (ty + 1) * T; g.vx = g.vy = 0; g.lockT = 0; step(10); }
    function peak(gas) { place(20, 13); st.b.pres = gas; var y0 = g.y, hi = y0; step(1, { Space: true }); for (var f = 0; f < 70; f++) { step(1, { Space: f < 14 }); hi = Math.min(hi, g.y); } return Math.round(y0 - hi); }
    // 1. a full belly does not change gravity: the same jump with 0 and 100 gas (a held jump with no second press)
    out.jumpEmpty = peak(0); out.jumpFull = peak(100);
    // 2. an early jump press (3 frames before landing) still jumps with no gas, and does not boost
    place(20, 13); st.b.pres = 0; step(1, { Space: true }); step(10); while (g.vy < 250 && !g.grounded) step(1);
    var fr = 0; while (!g.grounded && !(g.vy > 0 && Math.abs(g.y - 14 * T) < g.vy / 60 * 3.2) && fr++ < 120) step(1);
    var j0 = st.stats.jumps; keys({ Space: true }); Game.step(1 / 60); keys(); step(12); out.earlyPress = { jumped: st.stats.jumps - j0, boosts: 0 };
    // 3. a walker who lets go briefly and presses again does not run
    place(5, 13); step(30, { ArrowRight: true }); step(5); step(40, { ArrowRight: true }); out.walkerRepress = Math.round(g.vx) + ' vs walk ' + Math.round(G.Belly.stats(st.b).speed);
    out.walkerOk = g.vx <= G.Belly.stats(st.b).speed * 1.05;
    // 4. spoken lines never mention BLAST with the new controls
    var said = []; var hs = Game.hooks.say; Game.hooks.say = function (t) { said.push(t); };
    Game.st.L.prompts.length = 0; Game.st.L.prompts.push({ x: 20, icon: 'blast', line: 'Hop up the shelves, or hold BLAST to rocket over the fridge!' });
    st.ps = {}; place(20, 13); step(200); Game.hooks.say = hs; out.said = said.slice(0, 2);
    return out; })()`);
  Object.assign(m, r);
  const want = (ok, where, text) => { if (!ok) failures.push({ type: 'input', where, text }); };
  want(Math.abs(r.jumpFull - r.jumpEmpty) <= 6, 'gravity', `a full belly changed jump height (${r.jumpEmpty} px empty, ${r.jumpFull} px full)`);
  want(r.earlyPress.jumped >= 1, 'buffer', 'a jump pressed just before landing should still jump: ' + JSON.stringify(r.earlyPress));
  want(r.walkerOk, 'run', 'walking, letting go briefly and pressing again should not run: ' + r.walkerRepress);
  want(r.said.length && !r.said.some((t) => /BLAST/.test(t)) && /jump again/.test(r.said.join(' ')), 'words', 'spoken hints should not say BLAST: ' + JSON.stringify(r.said));
  // 5. the gate: flying past it still finishes the level (Home, no scene)
  await p.eval('__guts.startLevel("home")'); await p.sleep(300);
  const gate = await p.eval(`(function () { var G = GUTS, Game = G.Game, K = G.Input._keys, T = 32; Game.paused = true; Game.begin('home', { noHeist: true });
    var st = Game.st, g = st.g; g.x = st.goal.x + 90; g.y = st.goal.y; g.vx = g.vy = 0; st.cat.dropped = true; st.baoEaten = true;
    for (var f = 0; f < 120 && st.status === 'play'; f++) { K.ArrowRight = true; Game.step(1 / 60); } K.ArrowRight = false; return { status: st.status, pastGate: Math.round(g.x - st.goal.x) }; })()`);
  m.gate = gate; want(gate.status === 'clear', 'gate', 'landing past the gate should finish the level: ' + JSON.stringify(gate));
} catch (e) { failures.push({ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }); }
failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
await p.close();
record({ game: 'guts', scenario: 'regress', browser, ...m, failures });
console.log(JSON.stringify(m));
console.log('REGRESS', failures.length ? 'FAILED: ' + failures.map((f) => f.text).join('; ') : 'OK: gravity steady at full belly, early press jumps, no accidental run, no BLAST words, gate catches overshoot');
process.exitCode = failures.length ? 1 : 0;
