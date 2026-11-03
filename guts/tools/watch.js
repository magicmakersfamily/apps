/* In-page watcher for GUTS test runs (dev only; injected by personas.mjs and replay.mjs, never loaded by the game).
   GUTSWatch(opts) is called once per game update and keeps two lists:
     failures: broken states (NaN, Gus outside the level or inside a wall, belly out of range, a scene that never ends)
     findings: design data (20 s without progress, falls, blowouts), never a failure
   plus a progress timeline (furthest tile each game second) and timings. */
(function () {
  'use strict';
  window.GUTSWatch = function (opts) {
    opts = opts || {};
    var Game = GUTS.Game, D = GUTS.Data, T = 32;
    var st = Game.st, L = st.L, stall = opts.stall || 20;
    var failures = [], findings = [], upd = [], rnd = [], timeline = [];
    var maxX = st.g.x, lastGain = st.t, falls0 = st.stats.falls, blow0 = st.stats.blowouts, momentT = 0, insideT = 0, overT = 0, visited = {}, nextSec = 0, f = 0;
    function solid(x, y) { return D.SOLID.indexOf(L.get(x, y)) >= 0; }
    function tile() { var g = Game.st.g; return 'tile ' + Math.round(g.x / T) + ',' + Math.round(g.y / T); }
    function fail(type, text) { failures.push({ type: type, where: tile(), text: text, t: Math.round(Game.st.t * 10) / 10, frame: f }); return 'stop'; }
    function pct(arr, p) { if (!arr.length) return 0; var s = arr.slice().sort(function (x, y) { return x - y; }); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 100) / 100; }
    return {
      fail: fail,
      findings: function () { return findings; },
      timeUpdate: function (ms) { upd.push(ms); },
      /* call after each update; returns 'stop' on a failure */
      frame: function (dt) {
        f++;
        st = Game.st; if (!st) return fail('flow', 'the level disappeared');
        var g = st.g, b = st.b;
        if (opts.render && f % 10 === 0) { var r0 = performance.now(); try { Game.render(); } catch (e) { return fail('exception', 'Game.render threw: ' + e.message); } rnd.push(performance.now() - r0); }
        if (!isFinite(g.x) || !isFinite(g.y) || !isFinite(g.vx) || !isFinite(g.vy)) return fail('invariant', 'Gus position or speed is not a number');
        if (g.x < -T || g.x > (L.w + 1) * T) return fail('invariant', 'Gus left the level sideways');
        // pressure may pass 100 for a frame after a big bite: the blowout fires on the next belly tick
        overT = b.pres > 100 ? overT + 1 : 0;
        if (!(b.vit >= 0 && b.vit <= 100 && b.pres >= 0 && b.pres <= 150) || overT > 3) return fail('invariant', 'belly out of range: vitality ' + Math.round(b.vit) + ', pressure ' + Math.round(b.pres) + (overT > 3 ? ' for ' + overT + ' frames' : ''));
        if (solid(Math.floor(g.x / T), Math.floor((g.y - 20) / T))) insideT += dt; else insideT = 0;
        if (insideT > 0.75) return fail('softlock', 'Gus is stuck inside a wall');
        if (st.moment) { momentT += dt; if (momentT > 25) return fail('softlock', 'a scene (' + st.moment.type + ') never ended'); } else momentT = 0;
        visited[Math.floor(g.x / T)] = 1;
        if (g.x > maxX + T / 2) { maxX = g.x; lastGain = st.t; }
        if (st.status === 'play' && !st.moment && st.t - lastGain > stall) { findings.push({ type: 'stall', where: 'tile ' + Math.round(maxX / T), text: 'no progress for ' + stall + ' s', t: Math.round(st.t), frame: f }); lastGain = st.t; }
        if (st.stats.falls > falls0) { falls0 = st.stats.falls; findings.push({ type: 'fall', where: tile(), text: 'fell off the level', t: Math.round(st.t), frame: f }); }
        if (st.stats.blowouts > blow0) { blow0 = st.stats.blowouts; findings.push({ type: 'blowout', where: tile(), text: 'belly blew out', t: Math.round(st.t), frame: f }); }
        if (st.t >= nextSec) { timeline.push(Math.round(g.x / T)); nextSec += 1; }
        return null;
      },
      result: function (limitText) {
        st = Game.st;
        if (st && st.status !== 'clear' && !failures.length && limitText) findings.push({ type: 'no-finish', where: 'tile ' + Math.round(maxX / T), text: limitText });
        return {
          status: st ? st.status : 'gone', gameSeconds: st ? Math.round(st.t * 10) / 10 : null, frames: f, furthestTile: Math.round(maxX / T), levelTiles: L.w,
          coverage: Math.round(Object.keys(visited).length / L.w * 100), falls: st ? st.stats.falls : 0, blowouts: st ? st.stats.blowouts : 0, jumps: st ? st.stats.jumps : 0, blasts: st ? st.stats.blasts : 0,
          helperSnacks: st ? st.stats.helped || 0 : 0, bao: !!(st && st.baoEaten), lantern: !!(st && st.lan.has), bugsFreed: st ? st.stats.bugs : 0, newBites: st ? st.stats.newBites : 0,
          updateMs: { p50: pct(upd, 0.5), p95: pct(upd, 0.95), max: pct(upd, 1) }, renderMs: { p50: pct(rnd, 0.5), p95: pct(rnd, 0.95), max: pct(rnd, 1) },
          timeline: timeline, failures: failures, findings: findings
        };
      }
    };
  };
})();
