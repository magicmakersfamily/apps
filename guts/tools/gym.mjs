// Checks the new controls (VISION.md phase A) in Gus's Gym, one mechanic at a time, with deterministic frames
// (GUTS.Game.step at 60 fps, keys held through GUTS.Input._keys), then a real click on the title's Gym button and a
// screenshot. Usage: node guts/tools/gym.mjs [--browser chromium|firefox|webkit]
import path from 'node:path';
import { launch, gutsUrl } from './cdp.mjs';
import { record, outDir } from '../../tools/play/harness.mjs';

const i = process.argv.indexOf('--browser'), browser = i > 0 ? process.argv[i + 1] : (process.env.BROWSER || 'chromium');
const p = await launch({ url: await gutsUrl(), browser, w: 1280, h: 800, seed: 5 });
const failures = [], m = {};
try {
  if (!(await p.ready())) throw new Error('the game never finished loading');
  await p.page.click('#b-gym');
  await p.sleep(400);
  m.started = await p.eval('({ stage: GUTS.Game.st && GUTS.Game.st.id, v2: GUTS.Game.st && GUTS.Game.st.v2, inputV2: GUTS.Input.v2, screen: __guts.UI.screen })');
  if (m.started.stage !== 'gym' || !m.started.v2 || !m.started.inputV2) failures.push({ type: 'flow', where: 'title', text: 'the Gym button did not start the Gym with the new controls: ' + JSON.stringify(m.started) });
  const r = await p.eval(`(function () {
    var G = GUTS, Game = G.Game, K = G.Input._keys, T = 32, st = Game.st, g = st.g, out = {};
    Game.paused = true;
    function keys(o) { ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyC', 'ShiftLeft'].forEach(function (k) { K[k] = !!(o && o[k]); }); }
    function step(n, o) { for (var i = 0; i < n; i++) { keys(o); Game.step(1 / 60); } keys(); }
    function tap(k, o) { var h = Object.assign({}, o || {}); h[k] = true; step(1, h); step(1, o); }
    function place(tx, ty) { st = Game.st; g = st.g; g.x = (tx + 0.5) * T; g.y = (ty + 1) * T; g.vx = g.vy = 0; step(10); }
    var speed = G.Belly.stats(st.b).speed;
    // 1. hold right: walk first, then a run
    place(3, 13); step(12, { ArrowRight: true }); out.walkVx = Math.round(g.vx);
    step(60, { ArrowRight: true }); out.runVx = Math.round(g.vx); out.speed = Math.round(speed);
    // 2. double-tap runs at once
    place(3, 13); step(3, { ArrowRight: true }); step(3); step(10, { ArrowRight: true }); out.doubleTapVx = Math.round(g.vx);
    // 3. jump, then jump again in the air: a boost (a note), with pressure
    place(10, 13); st.b.pres = 60; var bl0 = st.stats.blasts, notes0 = st.stats.notes || 0;
    tap('Space', {}); step(1, { Space: true }); step(14); var vyBefore = g.vy; tap('Space'); step(2);
    out.boost = { blasts: st.stats.blasts - bl0, notes: (st.stats.notes || 0) - notes0, liftedFrom: Math.round(vyBefore), vyAfter: Math.round(g.vy) };
    // 4. up and down step the note in the air
    var n0 = g.note; tap('ArrowUp'); var n1 = g.note; tap('ArrowDown'); tap('ArrowDown'); out.notes = [n0, n1, g.note];
    step(90);
    // 5. Gus's song (up one, then down three) in one flight: the secret bonus
    place(12, 13); st.b.pres = 95; g.note = 4; var band0 = st.stats.band || 0;   // pressure 95: 100 would blow out at once
    tap('Space'); step(10, { Space: true }); step(6);
    tap('Space'); step(4); tap('ArrowUp'); tap('Space'); step(4); tap('ArrowDown'); tap('Space'); step(4); tap('ArrowDown'); tap('Space'); step(4); tap('ArrowDown'); tap('Space');
    out.song = { flight: g.flight ? g.flight.notes.slice() : null, got: g.flight ? Object.keys(g.flight.got) : [], bandPoints: (st.stats.band || 0) - band0 };
    step(120);
    // 6. a jump that barely misses a pillar top slides onto it (feet 8 px below the top, moving into it)
    place(54, 13); g.x = 55 * T + 13 - 4; g.y = 11 * T + 8; g.vx = 120; g.vy = 10; g.grounded = false; step(6, { ArrowRight: true });
    out.nudge = { onTop: g.grounded && Math.abs(g.y - 11 * T) < 1, tileX: Math.floor(g.x / T), y: Math.round(g.y) };
    // 7. Little Guts: mashing jump right after take-off does not boost
    st.mode = 'little'; place(5, 13); st.b.pres = 60; var b1 = st.stats.blasts; tap('Space'); step(2); tap('Space'); step(2); tap('Space'); out.littleMash = st.stats.blasts - b1; st.mode = Game.save.mode;
    step(90);
    // 8. the finish arch times a lap and starts again
    place(100, 13); for (var lf = 0; lf < 60 && !st.laps.length; lf++) step(1, { ArrowRight: true }); out.lap = { laps: st.laps.slice(), backAtStart: Math.abs(g.x / T - (st.L.start.x + 0.5)) < 1 };
    // 9. let the boy fly: from the fizzy fountain, a pilot that taps a boost only when below the next can flies the
    //    sky trail and lands on the cloud; the flying song plays on the way
    st.foods.forEach(function (fd) { if (fd.respawn) { fd.taken = false; fd.timer = 0; } });   // earlier checks may have eaten the fizz
    place(36, 13); g.lockT = 0; g.spinV = 0; st.b.pres = 30; step(40, { ArrowRight: true }); step(13, { ArrowRight: true, Space: true });   // start before the fountain: settling at 40 would drink it
    var cans = st.foods.filter(function (fd) { return fd.respawn && fd.x > 43 * T && fd.y < 9 * T; }), tap = 0, flew = false, song = null, peak = 0, blow0 = st.stats.blowouts, ff;
    function target() { var nx = cans.filter(function (fd) { return fd.x > g.x + 8; })[0]; return nx ? Math.floor(nx.y / T) + 0.6 : 2.2; }
    for (ff = 0; ff < 60 * 12; ff++) {
      var jj = false;
      if (tap > 0) { tap--; jj = tap > 2; } else if (g.vy > 40 && st.b.pres >= 4 && !g.grounded && g.y > target() * T + 8) { tap = 5; jj = true; }
      step(1, { ArrowRight: g.x < 88 * T, Space: jj });
      if (st.flying) { flew = true; song = G.Audio.current() || song; } peak = Math.max(peak, st.b.pres);
      if (g.grounded && g.x > 84 * T && Math.abs(g.y - 3 * T) < 2) break;
    }
    out.fly = { onCloud: g.grounded && g.x > 84 * T && Math.abs(g.y - 3 * T) < 2, at: [Math.round(g.x / T), Math.round(g.y / T)], flew: flew, song: song, peakPressure: Math.round(peak), blowouts: st.stats.blowouts - blow0, seconds: Math.round(ff / 6) / 10 };
    return out;
  })()`);
  Object.assign(m, r);
  const want = (ok, where, text) => { if (!ok) failures.push({ type: 'input', where, text }); };
  want(r.walkVx > 0 && r.walkVx <= r.speed * 1.05, 'run', `a short hold should walk (vx ${r.walkVx}, walk speed ${r.speed})`);
  want(r.runVx > r.speed * 1.3, 'run', `holding right for a second should run (vx ${r.runVx}, walk speed ${r.speed})`);
  want(r.doubleTapVx > r.speed * 1.05, 'run', `a double-tap should start a run at once (vx ${r.doubleTapVx})`);
  want(r.boost.blasts === 1 && r.boost.notes === 1 && r.boost.vyAfter < r.boost.liftedFrom, 'boost', 'jump then jump again in the air should boost and play one note: ' + JSON.stringify(r.boost));
  want(r.notes[1] === r.notes[0] + 1 && r.notes[2] === r.notes[0] - 1, 'band', 'up and down should step the note: ' + r.notes.join(' -> '));
  want(r.song.got.includes('song') && r.song.bandPoints >= 500, 'band', 'Gus’s song should give the secret bonus: ' + JSON.stringify(r.song));
  want(r.nudge.onTop, 'nudge', 'a jump 8 px short of a pillar top should step onto it: ' + JSON.stringify(r.nudge));
  want(r.littleMash === 0, 'little', 'in Little Guts, mashing jump right after take-off should not boost (boosted ' + r.littleMash + ' times)');
  want(r.fly.onCloud && r.fly.flew && r.fly.blowouts === 0, 'fly', 'a tap-when-low pilot should fly the sky trail to the cloud: ' + JSON.stringify(r.fly));
  if (r.fly.song !== 'sky') m.flySongNote = 'flying song did not report (audio may be off in this browser): ' + r.fly.song;
  want(r.lap.laps.length === 1 && r.lap.backAtStart, 'lap', 'the finish arch should time a lap and go back to the start: ' + JSON.stringify(r.lap));
  // a picture mid-air with the ladder and notes showing
  await p.eval(`(function () { var Game = GUTS.Game, st = Game.st, g = st.g, K = GUTS.Input._keys; g.x = 47.5 * 32; g.y = 14 * 32; g.vx = g.vy = 0; st.b.pres = 60; Game.paused = false;
    function f(n, k) { for (var i = 0; i < n; i++) { K.Space = !!k; Game.step(1 / 60); } K.Space = false; }
    Game.paused = true; f(12); f(1, true); f(10, true); f(4); f(1, true); f(5); f(1, true); f(5); f(1, true); f(3); Game.render(); })()`);
  m.screenshot = await p.shot(path.join(outDir(), 'shots', 'guts_gym_' + browser + '.png'));
} catch (e) { failures.push({ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }); }
failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
await p.close();
record({ game: 'guts', scenario: 'gym', browser, ...m, failures });
console.log(JSON.stringify(m));
console.log('GYM', failures.length ? 'FAILED: ' + failures.map((f) => f.text).join('; ') : 'OK: run, boost, notes, Gus’s song, edge nudge, Little Guts guard, lap, flight to the cloud');
process.exitCode = failures.length ? 1 : 0;
