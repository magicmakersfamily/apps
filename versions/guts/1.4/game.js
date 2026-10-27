/* GUTS game engine: stage setup, physics, the belly in motion, compost gardens, feelings, rendering.
   The belly numbers live in belly.js; levels in data.js; drawing in art.js / art2.js. */
(function (root) {
  'use strict';
  var G = root.GUTS, B = G.Belly, D = G.Data, A = G.Art, Au = G.Audio, In = G.Input;
  var T = 32, PH = B.PHYS, TAU = Math.PI * 2;
  var cv, cx, dpr = 1, S = 1, VW = 640, VH = 576, W = 640, H = 576;
  var Game = G.Game = { st: null, view: 'none', save: null, hooks: {}, paused: false, override: null, panelT: 0 };
  var KEY = 'guts:1';
  var Sbase = 1, ZF = 1, ZT = 1;
  var NOIN = { mx: 0, my: 0, jump: false, blast: false, breathe: false, jumpP: false, blastP: false, breatheP: false, poundP: false, pound: false, breatheGround: false, aimX: 0, aimY: 0, hopP: 0, hopDist: 3 };
  function applyZoom() { S = Sbase * ZF; VW = W / S; VH = H / S; }

  /* ---------------- save and settings ---------------- */
  function defaults() {
    return { v: 1, cleared: {}, bugs: {}, dex: {}, gardens: {}, eaten: {}, snax: 0, fandom: 0, mode: 'standard', seenIntro: false, lanternDecor: [],
      set: { shake: true, flash: true, music: 70, sfx: 85, voice: true, meters: false, speed: 100, gross: 'medium', cb: false } };
  }
  function loadSave() {
    var d = defaults();
    try { var s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) { for (var k in s) if (k !== 'set') d[k] = s[k]; for (var q in s.set || {}) d.set[q] = s.set[q]; } } catch (e) {}
    return d;
  }
  Game.persist = function () { try { localStorage.setItem(KEY, JSON.stringify(Game.save)); } catch (e) {} };
  Game.resetSave = function () { try { localStorage.removeItem(KEY); } catch (e) {} Game.save = defaults(); Game.applySettings(); };
  Game.applySettings = function () { var s = Game.save.set; Au.setVolumes(s.music / 100, s.sfx / 100); Au.setGross(s.gross); };
  Game.bitesFound = function () { var n = 0; for (var k in Game.save.dex) if (k !== 'snax') n++; return n; };
  Game.bugsRescued = function () { return Object.keys(Game.save.bugs).length; };
  Game.residents = function () { return Object.keys(Game.save.bugs).map(function (id) { var bi = D.bugInfo(id); return { id: id, name: bi.name, job: bi.job, fam: A.famOf(id) }; }); };
  Game.save = loadSave();

  function say(text, who, o) { if (Game.hooks.say) Game.hooks.say(text, who || 'narrator', o || {}); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- canvas ---------------- */
  Game.init = function (canvas) {
    cv = canvas; cx = cv.getContext('2d');
    root.addEventListener('resize', resize); resize();
    Game.applySettings();
    requestAnimationFrame(loop);
  };
  function resize() {
    var r = cv.parentNode.getBoundingClientRect();
    W = Math.max(200, r.width); H = Math.max(160, r.height); dpr = Math.min(2, root.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var vm = { small: 0.82, normal: 1, large: 1.22 }[Game.save.set.view || 'normal'] || 1;
    Sbase = Math.min(H / 500, W / (W < H ? 460 : 640)) * vm; applyZoom();
  }
  Game.resize = resize;
  Game.viewSize = function () { return { w: VW, h: VH, W: W, H: H, S: S }; };

  /* ---------------- stage setup ---------------- */
  Game.begin = function (id, opts) {
    var def = D.STAGES[id], L = def.build(), sv = Game.save;
    var st = Game.st = {
      id: id, def: def, L: L, mode: sv.mode, t: 0, status: 'play', clearT: 0, b: B.create(),
      foods: [], bugs: [], checks: [], patches: [], particles: [], bubbles: [], persons: [], fired: {}, ps: {},
      stats: { blowouts: 0, controlled: 0, chants: 0, bugs: 0, bites: 0, newBites: 0, falls: 0, blasts: 0, breathes: 0, jumps: 0 },
      lan: { has: false, ang: 0, vel: 0, tears: 0 }, cam: { x: 0, y: 0 }, shake: 0, flash: 0, crowd: { cheer: 0, chant: 0, scatter: 0, tap: 0 },
      noteT: 0, ladT: 0, msgT: 0, restoredX: 0, lanItem: null, gate: { open: 0, nag: 0 }, goal: null, hungryT: 0, lastBlastFx: 0
    };
    st.g = { x: (L.start.x + 0.5) * T, y: (L.start.y + 1) * T, vx: 0, vy: 0, w: 26, h: 46, face: 1, grounded: false, coyote: 0, jbuf: 0, sx: 1, sy: 1, run: 0,
      blastT: 0, blastTotal: 0, blasting: false, blowDuring: false, pounding: false, lockT: 0, relief: 0, spin: 0, spinV: 0, slippery: false, breathing: false, safeX: (L.start.x + 0.5) * T, safeY: (L.start.y + 1) * T, hurtT: 0, scared: 0, chomp: 0, prevVx: 0 };
    st.respawn = { x: st.g.x, y: st.g.y };
    L.foods.forEach(function (f) { st.foods.push({ x: (f.x + 0.5) * T, y: (f.y + 0.5) * T, id: f.id, respawn: f.respawn, taken: false, timer: 0, ph: Math.random() * 6 }); });
    L.bugs.forEach(function (b) { st.bugs.push({ x: (b.x + 0.5) * T, y: (b.y + 0.5) * T, id: b.id, fam: A.famOf(b.id), state: sv.bugs[b.id] ? 'friend' : 'trapped', t: 0 }); });
    L.checks.forEach(function (c) { st.checks.push({ x: (c.x + 0.5) * T, y: (c.y + 1) * T, lit: false, anim: 0 }); });
    var saved = (sv.gardens[id] || []);
    L.patches.forEach(function (p, i) { st.patches.push({ x: p.x, y: p.y, w: p.w, kind: p.kind, growth: saved[i] || 0, anim: saved[i] ? 1 : 0, bumped: false, cx: (p.x + p.w / 2) * T }); });
    if (L.lantern) st.lanItem = { x: (L.lantern.x + 0.5) * T, y: (L.lantern.y + 1) * T, taken: false };
    else st.lan.has = false;
    if (L.goal) st.goal = { x: (L.goal.x + 0.5) * T, y: (L.goal.y + 1) * T, type: L.goal.type };
    st.reacts = (L.reacts || []).map(function (r) { return { type: r.type, x: r.x, y: r.y, w: r.w, h: r.h, state: 'idle', anim: 0, swing: 0, swingT: 0, spent: false, ang: 0, spin: 0, spun: 0, done: false, wobble: 0, landX: (r.x + 5) * T, landY: 13 * T + 10, fallH: (14 - r.y - r.h) * T - 10 }; });
    st.cat = L.cat ? { path: L.cat.path, i: 0, x: L.cat.path[0].x * T, y: L.cat.path[0].y * T, face: 1, state: L.cat.path[0].sleep ? 'sleep' : 'sit', t: 0, mv: null, to: 0, trust: 0, calm: 0, bao: true, startle: 0, wait: L.cat.path[0].wait || 0.4, meowT: 7, dropped: false } : null;
    ZF = 1; ZT = 1; applyZoom();
    st.sockT = 0; st.slow = null; st.firstBlastDone = false; st.baoEaten = false; st.vistaT = 0; st.vistaDone = false; st.wobT = 0; st.plateBao = false; st.moment = null; st.camFocus = null; st.hold = 0; st.fizzT = 0; st.hint = null; st.catCheer = 0;
    L.crowds.forEach(function (z) {
      var n = Math.max(2, Math.floor((z.x1 - z.x0) / 2.2));
      for (var i = 0; i < n; i++) st.persons.push({ x: (z.x0 + i * 2.2 + (i % 3) * 0.3) * T, y: (z.y) * T, c: (i * 5 + 1) % 6, s: (i * 3) % 5, h: (i % 4) * 2, ph: i * 1.7, ox: 0, vendor: false });
    });
    Game.paused = false; Game.view = 'stage';
    if (id === 'home' && st.cat && !(opts && opts.noHeist)) { st.plateBao = true; st.cat.x = 22 * T; st.cat.y = 14 * T; st.cat.bao = false; startMoment('heist', { skipAfter: Game.save.cleared[id] ? 0.4 : 1.2 }); } else st.plateBao = false;
    updateCam(0, true);
    Au.setLayers(0); Au.playSong(def.music);
    if (def.intro && !st.moment) say(def.intro, 'narrator', { intro: true });
  };
  Game.end = function () { Game.view = 'none'; Game.st = null; Au.blastOff(); Au.breatheOff(); };

  /* ---------------- tiles and collision ---------------- */
  function isSolidCh(ch) { return D.SOLID.indexOf(ch) >= 0; }
  function moveBody(e, dt, st) {
    var L = st.L, sight = st.b.sightT > 0;
    var l, r, t, b, tx, ty, tx0, tx1, ty0, ty1, ch;
    e.x += e.vx * dt;
    if (e.x < e.w / 2) { e.x = e.w / 2; e.vx = 0; } if (e.x > L.w * T - e.w / 2) { e.x = L.w * T - e.w / 2; e.vx = 0; }
    l = e.x - e.w / 2; r = e.x + e.w / 2; t = e.y - e.h; b = e.y;
    tx0 = Math.floor(l / T); tx1 = Math.floor((r - 0.001) / T); ty0 = Math.floor(t / T); ty1 = Math.floor((b - 0.001) / T);
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      ch = L.get(tx, ty);
      if (isSolidCh(ch)) {
        if (e.vx > 0) { e.x = tx * T - e.w / 2 - 0.001; } else if (e.vx < 0) { e.x = (tx + 1) * T + e.w / 2 + 0.001; } else { e.x += (e.x < tx * T + T / 2 ? -1 : 1) * 0.5; }
        e.vx = 0; e.wall = true;
      }
    }
    var prevB = e.y, prevT = e.y - e.h;
    e.y += e.vy * dt; e.grounded = false; e.head = false;
    l = e.x - e.w / 2; r = e.x + e.w / 2; t = e.y - e.h; b = e.y;
    tx0 = Math.floor(l / T); tx1 = Math.floor((r - 0.001) / T); ty0 = Math.floor(t / T); ty1 = Math.floor((b - 0.001) / T);
    e.groundCh = ' ';
    for (ty = ty0; ty <= ty1; ty++) for (tx = tx0; tx <= tx1; tx++) {
      ch = L.get(tx, ty);
      var oneway = ch === '=' || (ch === 'H' && sight);
      if (e.vy >= 0) {
        if ((isSolidCh(ch) && prevB <= ty * T + 6) || (oneway && prevB <= ty * T + 0.5)) {
          if (b > ty * T) { e.y = ty * T; e.vy = 0; e.grounded = true; e.groundCh = ch; b = e.y; }
        }
      } else if (isSolidCh(ch) && prevT >= (ty + 1) * T - 6) {
        e.y = (ty + 1) * T + e.h; e.vy = 0; e.head = true; t = e.y - e.h;
      }
    }
    if (e.grounded) e.surface = e.groundCh;
  }

  /* ---------------- particles ---------------- */
  function part(kind, x, y, vx, vy, life, size, col, grav) { var st = Game.st; if (st.particles.length > 700) st.particles.shift(); st.particles.push({ k: kind, x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, col: col, g: grav == null ? 500 : grav, rot: rnd(0, TAU) }); }
  function burst(n, x, y, spread, up, col, life, size, grav) { for (var i = 0; i < n; i++) part('spark', x, y, rnd(-spread, spread), rnd(-up, up * 0.3), life * rnd(0.6, 1), size * rnd(0.6, 1.2), col, grav); }
  function grossCol(i) {
    var m = Game.save.set.gross;
    if (m === 'mild') return ['#ff6b6b', '#ffd93d', '#6bdc8a', '#6aa7ff', '#c48bff'][i % 5];
    if (m === 'max') return ['#8a7a30', '#6b8a2a', '#7a5a2a'][i % 3];
    return ['#c8a06a', '#b98a55', '#d9b57e'][i % 3];
  }
  function updateParticles(dt) {
    var st = Game.st, L = st.L, ps = st.particles;
    for (var i = ps.length - 1; i >= 0; i--) {
      var p = ps[i]; p.life -= dt;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'ex' || p.k === 'splat') {
        var ch = L.get(Math.floor(p.x / T), Math.floor(p.y / T));
        if (isSolidCh(ch)) {
          if (ch === 'd') sproutAt(p.x, p.y);
          if (p.k === 'splat') part('decal', p.x, Math.floor(p.y / T) * T, 0, 0, 2.5, rnd(5, 9), grossCol(i), 0);
          ps.splice(i, 1);
        }
      }
    }
  }
  function sproutAt(x, y) {
    var st = Game.st;
    for (var i = 0; i < st.patches.length; i++) {
      var pt = st.patches[i];
      if (x >= pt.x * T - 28 && x <= (pt.x + pt.w) * T + 28 && y >= pt.y * T - 4 && y <= pt.y * T + T) {
        if (pt.growth === 0) { pt.growth = 1; pt.anim = 0; pt.bumped = true; }
        else if (!pt.bumped && pt.growth < 3) { pt.growth++; pt.anim = 0.35; pt.bumped = true; }
        else return;
        Au.sfx('bloom'); Au.sfx('bounce'); st.crowd.cheer = 2.2; st.hold = 0.4; st.shake = Game.save.set.shake ? 5 : 0; pt.pop = 0.5;
        for (var rg = 0; rg < 3; rg++) part('ring', pt.cx, pt.y * T - 10, 0, 0, 0.6 + rg * 0.15, 8 + rg * 12, rg % 2 ? '#ff9ec0' : '#7be07b', 0);
        say('Boing! A bounce flower! Jump into it.', 'narrator', { soft: true });
        for (var k = 0; k < 22; k++) part('petal', pt.cx + rnd(-30, 30), pt.y * T - rnd(0, 50), rnd(-110, 110), rnd(-220, -40), rnd(0.8, 1.6), rnd(3, 6), ['#ff7fa8', '#ffd84a', '#7be07b', '#fff'][k % 4], 220);
        var arr = Game.save.gardens[st.id] || (Game.save.gardens[st.id] = []);
        for (var j = 0; j < st.patches.length; j++) arr[j] = st.patches[j].growth;
        Game.persist();
        if (Game.hooks.event) Game.hooks.event('sprout', pt);
        return;
      }
    }
  }

  /* ---------------- belly events ---------------- */
  function blowout() {
    var st = Game.st, g = st.g, set = Game.save.set;
    st.stats.blowouts++; g.blowDuring = true;
    if (g.blasting) endBlast(true);
    g.lockT = 0.9; g.spinV = (Math.random() < 0.5 ? -1 : 1) * 14; g.vx = rnd(-320, 320); g.vy = -560; g.grounded = false;
    Au.sfx('blowout'); In.rumble(500, 1, 0.8);
    st.shake = set.shake ? 14 : 0; if (set.flash) st.flash = 0.35;
    var n = set.gross === 'max' ? 70 : 44;
    for (var i = 0; i < n; i++) { var a = rnd(0, TAU), sp = rnd(120, 520); part(i % 3 ? 'splat' : 'cloud', g.x, g.y - 20, Math.cos(a) * sp, Math.sin(a) * sp - 120, rnd(1, 2), i % 3 ? rnd(4, 8) : rnd(16, 30), grossCol(i), 600); }
    st.crowd.scatter = 3; st.crowd.cheer = 0; st.crowd.chant = 0;
    if (st.cat && !st.cat.mv && !st.cat.dropped && Math.abs(st.cat.x - g.x) < 14 * T) { st.cat.startle = 1.1; st.cat.t0 = st.t; }
    if (st.lan.has) { st.lan.tears = Math.min(3, st.lan.tears + 1); Au.sfx('tear'); st.lan.vel += 6; }
    Game.save.fandom = Math.max(0, Game.save.fandom - 4);
  }
  function endBlast(forced) {
    var st = Game.st, g = st.g;
    if (!g.blasting) { g.blastT = 0; return; }
    g.blasting = false; Au.blastOff();
    if (g.blastTotal >= 0.7 && !g.blowDuring && !forced) {
      st.stats.controlled++; g.relief = 0.9; if (st.cat && !st.cat.mv && Math.abs(st.cat.x - g.x) < 18 * T && st.cat.state !== 'sleep' && !st.cat.path[st.cat.i].final) { st.cat.cheerT = 1.1; Au.sfx('meow', { pitch: 1.35 }); } Game.save.fandom = Math.min(100, Game.save.fandom + 8);
      if (st.stats.controlled % 3 === 0 && st.persons.length) { st.crowd.chant = 4; st.stats.chants++; Au.sfx('chant'); } else if (st.persons.length) { st.crowd.cheer = 1.6; Au.sfx('cheer'); }
    }
    g.blastTotal = 0; g.blastT = 0;
  }
  function handleEvents() {
    var st = Game.st, b = st.b, ev = b.events; b.events = [];
    ev.forEach(function (e) {
      if (e.name === 'blowout') blowout();
      else if (e.name === 'butterfly-out') {
        for (var i = 0; i < 4; i++) part('fly', st.g.x + st.g.face * 10, st.g.y - 40, rnd(40, 90) * st.g.face, rnd(-90, -40), 1.8, 4, '#c48bff', -20);
      } else if (e.name === 'hungry') spawnBubble('hungry');
    });
  }

  /* ---------------- feelings ---------------- */
  function spawnBubble(kind) {
    var st = Game.st, F = D.FEELINGS[kind]; if (!F) return;
    st.bubbles.push({ kind: kind, size: F.size, x: st.cam.x + VW + 40, y: st.g.y - 70, t: 0, life: 16, a: 1 });
    say(F.line, 'narrator', { soft: true });
  }
  function updateBubbles(dt) {
    var st = Game.st, g = st.g, b = st.b;
    for (var i = st.bubbles.length - 1; i >= 0; i--) {
      var bu = st.bubbles[i]; bu.t += dt; bu.life -= dt;
      var dir = Math.sign((g.x - bu.x) || 1); bu.x += dir * 70 * dt;
      var r = bu.size === 'big' ? 34 : bu.size === 'medium' ? 28 : 23;
      var by = bu.y + Math.sin(bu.t * 3 + bu.x) * 3;
      if (Math.hypot(g.x - bu.x, (g.y - 24) - by) < r + 16 && st.status === 'play') {
        var before = b.pres; B.feeling(b, bu.size);
        if (g.breathing) b.pres = before + (b.pres - before) * 0.5;
        if (bu.kind === 'high') B.addButterflies(b, 2);
        if (bu.kind === 'excited') { b.boostT = Math.max(b.boostT, 3); g.relief = 0.7; Au.sfx('bounce'); } else g.scared = 0.9;
        Au.sfx('pop'); burst(10, bu.x, by, 120, 140, '#fff', 0.7, 4, 200);
        if (bu.size === 'big') st.shake = Math.max(st.shake, Game.save.set.shake ? 6 : 0);
        st.bubbles.splice(i, 1); continue;
      }
      if (bu.life <= 0) { bu.a -= dt * 2; if (bu.a <= 0) st.bubbles.splice(i, 1); }
    }
  }

  /* ---------------- eating ---------------- */
  function eatFood(f, mult) {
    var st = Game.st, id = f.id, g = st.g, sv = Game.save, F = B.FOODS[id];
    B.eat(st.b, id, mult || 1);
    var bad = F.kind === 'sugar' || F.kind === 'grease' || F.kind === 'snax' || F.kind === 'spice';
    Au.sfx(bad ? 'eatBad' : 'eat', { pitch: rnd(0.95, 1.1) });
    st.stats.bites++; g.chomp = 0.22; sv.eaten[id] = (sv.eaten[id] || 0) + 1;
    if (!sv.dex[id]) { sv.dex[id] = 1; st.stats.newBites++; if (Game.hooks.dex) Game.hooks.dex(id); Au.sfx('dex'); }
    Game.persist();
    if (id === 'soda' && !st.firstBlastDone && !st.slow && st.stats.blasts === 0 && st.b.pres >= 6 && st.id === 'home') {
      st.slow = { t: 0 }; Au.sfx('gurgle'); say('Your belly is rumbling! Tap BLAST!', 'narrator', { prompt: true });
    }
    if (id === 'bao') {
      st.baoEaten = true; Au.sfx('fed'); st.crowd.cheer = 4; st.b.boostT = Math.max(st.b.boostT, 4);
      for (var bi = 0; bi < 24; bi++) part('conf', f.x + rnd(-40, 40), f.y - rnd(0, 60), rnd(-90, 90), rnd(-120, -20), rnd(1.5, 2.6), rnd(4, 7), ['#ff6b6b', '#ffd93d', '#6bdc8a', '#6aa7ff', '#c48bff'][bi % 5], 120);
      if (!st.moment) { say('Bao! Gus shares a bite with Mimi. Purr, purr. Breakfast found!', 'narrator', {}); if (st.cat) { st.cat.state = 'purr'; st.cat.t0 = st.t; Au.sfx('purr'); } }
    }
    if (F.pres > 0) { st.fizzT = 1.4; g.tint = { k: 'orange', t: 0.8 }; if (F.kind === 'sugar' || F.kind === 'spice') Au.sfx('fizz'); }
    if (F.vit >= 10) g.tint = { k: 'green', t: 0.8 };
    var col = F.vit >= 10 ? '#7be07b' : F.pres > 0 ? '#ffb347' : '#6bc4ff';
    burst(12, f.x, f.y, 140, 200, col, 0.7, 4.5, 260);
    if (F.pres > 0) for (var i = 0; i < 4; i++) part('cloud', g.x, g.y - 22, rnd(-40, 40), rnd(-60, -10), 0.7, rnd(8, 14), 'rgba(255,200,120,.6)', -30);
  }

  /* ---------------- Gus ---------------- */
  function updateGus(dt) {
    var st = Game.st, g = st.g, b = st.b, p = st.moment ? NOIN : In.p1, L = st.L, set = Game.save.set, s = B.stats(b);
    var little = st.mode === 'little' && !st.def.noAuto, check = st.mode === 'check';
    var locked = g.lockT > 0; if (locked) g.lockT -= dt;
    var clear = st.status !== 'play';
    var wantX = clear ? 0 : p.mx;
    if (little && !clear) {
      wantX = (p.breatheGround && g.grounded) ? 0 : (p.mx < -0.3 ? -1 : 1);   // auto-runs forward; steer left to go back and try again
      // a safety rail: Little Guts stops at the edge of a drop of 2 or more tiles, so you choose when to jump
      if (g.grounded && wantX) { var ex = Math.floor((g.x + 22) / T), fr = Math.round(g.y / T), has = false; for (var er = fr; er <= fr + 1; er++) { var ec = L.get(ex, er); if (D.SOLID.indexOf(ec) >= 0 || ec === '=') { has = true; break; } } if (!has) wantX = 0; }
    }
    if (locked) wantX = 0;
    // a jump-left / jump-right (Tap and Step mode) steers Gus to a target distance, then lets him brake and land
    if (p.hopP && g.grounded && !clear) g.hop = { dir: p.hopP, x: g.x + p.hopP * p.hopDist * T, t: 1.4, air: false };
    if (g.hop) {
      g.hop.t -= dt; if (!g.grounded) g.hop.air = true;
      var rem = (g.hop.x - g.x) * g.hop.dir, stopD = g.vx * g.vx / (2 * 1500);
      if (g.hop.t <= 0 || (g.hop.air && g.grounded)) g.hop = null;
      else wantX = rem > stopD + 2 ? g.hop.dir : 0;
    }
    var breathing = !clear && p.breatheGround && g.grounded && Math.abs(g.vx) < 40 && Math.abs(wantX) < 0.2 && !locked && !p.blast;
    g.breathing = breathing; if (breathing) { Au.breatheOn(); if (!g.wasBreathing) st.stats.breathes++; } else Au.breatheOff();
    g.wasBreathing = breathing;

    g.slippery = g.grounded && g.surface === '~';
    var target = wantX * s.speed * (little ? (g.grounded ? 0.8 : 0.5) : 1), acc = g.grounded ? (g.slippery ? 240 : PH.groundAccel) : PH.airAccel * s.air;
    if (Math.abs(wantX) > 0.05) {
      var step = acc * dt, dv = target - g.vx; g.vx += clamp(dv, -step, step);
      g.face = wantX > 0 ? 1 : -1;
    } else {
      var f = (g.grounded ? (g.slippery ? 120 : PH.groundAccel * 0.9) : ((In.tap || In.stepMode) && !g.blasting ? 1500 : 140)) * dt;   // Tap and Step mode brake in the air, so a hop goes exactly as far as you steered
      if (Math.abs(g.vx) <= f) g.vx = 0; else g.vx -= Math.sign(g.vx) * f;
    }

    // jump with coyote time and a buffer
    g.coyote = g.grounded ? PH.coyote : Math.max(0, g.coyote - dt);
    g.jbuf = (p.jumpP && !clear) ? PH.jumpBuffer : Math.max(0, g.jbuf - dt);
    if (g.jbuf > 0 && g.coyote > 0 && !locked) {
      g.vy = -s.jumpV * (s.heavy ? 0.88 : 1); g.coyote = 0; g.jbuf = 0; g.grounded = false; g.sx = 0.8; g.sy = 1.25; st.stats.jumps++;
      Au.sfx('jump'); for (var d = 0; d < 6; d++) part('dust', g.x + rnd(-8, 8), g.y, rnd(-60, 60), rnd(-50, -10), 0.4, rnd(3, 6), 'rgba(235,225,205,.8)', 80);
    }

    // blast: tap = toot hop, hold = rocket
    var aim = 0;
    if (check) aim = clamp(p.aimX * 0.95, -1.05, 1.05);
    if (st.slow && p.blastP) { st.slow = null; st.firstBlastDone = true; }
    var holdBlast = p.blast && !clear && !locked;
    if (p.blastP && !clear && !locked) {
      g.blastT = 0; g.blastTotal = 0; g.blowDuring = false;
      if (b.pres >= 4) {
        var spent = Math.min(7, b.pres), v = b.vit / 100; b.pres -= spent;
        g.vy = Math.min(g.vy, -(380 + 120 * v) * spent / 7); g.grounded = false; g.coyote = 0; st.stats.blasts++;
        Au.sfx('toot', { pitch: rnd(0.9, 1.15) });
        for (var i = 0; i < 8; i++) part('ex', g.x + rnd(-5, 5), g.y - 4, rnd(-70, 70), rnd(120, 280), 0.5, rnd(4, 8), '#ffb347', 500);
        for (var j = 0; j < 3; j++) part('cloud', g.x - g.face * 8, g.y - 10, rnd(-50, 50), rnd(20, 70), 0.6, rnd(8, 13), grossCol(j), 40);
      } else { Au.sfx('puff'); for (var k = 0; k < 4; k++) part('cloud', g.x - g.face * 10, g.y - 14, rnd(-20, 20), rnd(-10, 20), 0.4, rnd(4, 7), 'rgba(220,210,190,.8)', 30); }
    }
    if (holdBlast) {
      g.blastT += dt;
      if (g.blastT > 0.18 && b.pres > 2) {
        if (!g.blasting) { g.blasting = true; Au.blastOn(); g.blowDuring = false; }
        var wn = Math.sin(st.t * 13.1) * 0.6 + Math.sin(st.t * 7.7 + 1.3) * 0.4;
        var ang = aim + wn * 0.6 * s.wobble, tx = Math.sin(ang), ty = -Math.cos(ang);
        g.vx += tx * s.thrust * dt * 0.7; g.vy += ty * s.thrust * dt;
        if (g.vy < -s.maxRise) g.vy = -s.maxRise;
        g.vx = clamp(g.vx, -s.speed * 1.7, s.speed * 1.7);
        b.pres = Math.max(0, b.pres - s.drain * dt); g.blastTotal += dt; g.grounded = false; g.coyote = 0;
        for (var e2 = 0; e2 < 2; e2++) part(e2 ? 'ex' : 'splat', g.x - tx * 6 + rnd(-6, 6), g.y - 2, -tx * rnd(80, 200) + rnd(-50, 50), rnd(180, 420), rnd(0.3, 0.6), rnd(4, 8), e2 ? '#ffd24a' : grossCol(e2), 700);
        if (Math.random() < 0.5) part('cloud', g.x - tx * 8, g.y, rnd(-30, 30), rnd(40, 120), 0.55, rnd(9, 15), grossCol(2), 30);
        if (set.shake) st.shake = Math.max(st.shake, 1.6);
        if (st.t - st.lastBlastFx > 0.12) { st.lastBlastFx = st.t; In.rumble(60, 0.2, 0.4); }
      } else if (g.blasting && b.pres <= 2) endBlast();
    } else if (g.blasting) endBlast();

    // gravity
    var up = g.vy < 0, gr;
    if (little && p.jumpP) g.jumpHold = 0.32; if (g.jumpHold > 0) g.jumpHold -= dt;      // Little Guts: any tap is a full jump
    if (up) gr = (p.jump || g.jumpHold > 0 || g.blasting || g.boost) ? PH.Grise : PH.G * 1.55; else gr = PH.G;
    if (!up || g.grounded) g.boost = false;
    gr *= s.gravMul;
    if (g.pounding) gr = 0;
    g.vy = Math.min(PH.maxFall, g.vy + gr * dt);
    // ground-pound
    if (s.heavy && !g.grounded && p.poundP && !clear && !locked && !g.pounding && g.vy > -200) { g.pounding = true; g.vy = 1300; g.vx *= 0.3; endBlast(); }

    var wasGround = g.grounded, preVy = g.vy;
    moveBody(g, dt, st);
    if (g.head && g.blasting) g.vy = 0;
    if (g.grounded && !wasGround) {
      if (g.pounding) {
        g.pounding = false; Au.sfx('pound'); In.rumble(300, 1, 0.5); st.shake = set.shake ? 10 : 0;
        for (var q = 0; q < 14; q++) part('dust', g.x + rnd(-14, 14), g.y, rnd(-220, 220), rnd(-120, -20), 0.6, rnd(4, 8), 'rgba(235,225,205,.9)', 300);
        if (Game.hooks.event) Game.hooks.event('pound', g);
      } else if (preVy > 300) { Au.sfx('land'); g.sx = 1.25; g.sy = 0.8; for (var m = 0; m < 4; m++) part('dust', g.x + rnd(-10, 10), g.y, rnd(-70, 70), rnd(-40, -5), 0.35, rnd(3, 5), 'rgba(235,225,205,.7)', 100); }
      st.lan.vel += preVy * 0.0035; if (g.surface === '=' && g.x > 45 * T && g.x < 58 * T) st.wobT = 0.9;
      if (g.surface === 'U') { g.vy = -900; g.boost = true; Au.sfx('bounce'); g.sx = 0.75; g.sy = 1.3; }
    }
    if (g.grounded && !g.pounding) { g.safeX = g.x; g.safeY = g.y; }
    // compost plants: a grown flower is a bounce pad. Step into it (or land on it) and it springs you up.
    st.patches.forEach(function (pt) {
      if (pt.cool > 0) pt.cool -= dt;
      if (pt.growth < 1 || pt.anim < 0.8 || pt.kind !== 'flower' || pt.cool > 0) return;
      var top = pt.y * T - 26 - 6 * pt.growth, hw = 36;
      if (g.vy >= -50 && Math.abs(g.x - pt.cx) < hw && g.y > top - 4 && g.y <= pt.y * T + 2) {
        g.y = Math.min(g.y, pt.y * T - 2); g.vy = -(760 + 95 * pt.growth); g.grounded = false; g.boost = true; g.coyote = 0; pt.cool = 0.45;
        Au.sfx('bounce'); g.sx = 0.75; g.sy = 1.3; pt.squash = 0.3;
        burst(8, pt.cx, pt.y * T - 20, 90, 140, '#ff9ec0', 0.6, 4, 200);
      }
    });
    // squash recovery, run cycle, spin
    var rec = Math.min(1, dt * 14); g.sx += (1 - g.sx) * rec; g.sy += (1 - g.sy) * rec;
    if (g.grounded) g.run += Math.abs(g.vx) * dt * 0.05;
    if (g.chomp > 0) { g.chomp -= dt; g.sx = 1 + Math.sin(g.chomp * 40) * 0.06; }
    if (g.relief > 0) g.relief -= dt; if (g.scared > 0) g.scared -= dt; if (g.tint) { g.tint.t -= dt; if (g.tint.t <= 0) g.tint = null; } if (st.fizzT > 0) st.fizzT -= dt;
    if (g.spinV) { g.spin += g.spinV * dt; g.spinV *= Math.pow(0.12, dt); if (Math.abs(g.spinV) < 0.4 || (g.grounded && g.lockT <= 0)) { g.spinV = 0; g.spin = 0; } }
    // lantern pendulum
    var ax = (g.vx - g.prevVx) / Math.max(dt, 0.001); g.prevVx = g.vx;
    var ln = st.lan; ln.vel += (-34 * Math.sin(ln.ang) - 2.4 * ln.vel - ax * 0.0012 * g.face) * dt; ln.ang = clamp(ln.ang + ln.vel * dt, -1.2, 1.2);
    // fell off the world
    if (g.y > (L.h + 4) * T) fall();
  }
  function fall() {
    var st = Game.st, g = st.g, L = st.L; st.stats.falls++;
    if (st.mode === 'little') { g.x = g.safeX; g.y = g.safeY - 4; g.vx = 0; g.vy = -760; Au.sfx('bounce'); return; }
    g.x = st.respawn.x; g.y = st.respawn.y; g.vx = g.vy = 0;
    if (st.lan.has) { st.lan.tears = Math.min(3, st.lan.tears + 1); Au.sfx('tear'); }
    st.b.pres = Math.min(st.b.pres, 20);
  }

  /* ---------------- pickups, checkpoints, goal ---------------- */
  function updatePickups(dt) {
    var st = Game.st, g = st.g, gcx = g.x, gcy = g.y - 24, f, i;
    for (i = 0; i < st.foods.length; i++) {
      f = st.foods[i];
      if (f.taken) { if (f.respawn) { f.timer -= dt; if (f.timer <= 0) f.taken = false; } continue; }
      if (Math.hypot(gcx - f.x, gcy - f.y) < 42) {
        var head = f.y < g.y - 30; eatFood(f, head ? 1.5 : 1); f.taken = true; f.timer = 6;
      }
    }
    st.bugs.forEach(function (bg) {
      bg.t += dt;
      if (bg.state === 'trapped' && Math.hypot(gcx - bg.x, gcy - bg.y) < 44) {
        bg.state = 'freeing'; bg.t = 0; st.stats.bugs++; Au.sfx('bug'); Game.save.bugs[bg.id] = 1; Game.persist();
        burst(16, bg.x, bg.y, 160, 180, '#8fd9ff', 0.9, 5, 160);
        for (var rg = 0; rg < 3; rg++) part('ring', bg.x, bg.y, 0, 0, 0.7 + rg * 0.18, 10 + rg * 14, rg % 2 ? '#8fd9ff' : '#ffd93d', 0);
        st.hold = 0.55; Au.sfx('friend'); In.rumble(120, 0.3, 0.5);
        if (Game.hooks.event) Game.hooks.event('bug', bg);
      } else if (bg.state === 'freeing' && bg.t > 0.9) bg.state = 'friend';
    });
    st.checks.forEach(function (c) {
      c.anim = Math.min(1, c.anim + (c.lit ? dt * 3 : 0));
      if (!c.lit && Math.abs(gcx - c.x) < 44 && Math.abs(g.y - c.y) < 70) {
        c.lit = true; Au.sfx('check'); st.respawn = { x: c.x, y: c.y }; burst(14, c.x, c.y - 50, 120, 160, '#ffd36b', 0.9, 4, 100);
        if (st.lan.tears > 0) { st.lan.tears = 0; say('Lantern patched!', 'narrator', { soft: true }); }
      }
    });
    if (st.lanItem && !st.lanItem.taken && Math.hypot(gcx - st.lanItem.x, gcy - (st.lanItem.y - 20)) < 62) {
      st.lanItem.taken = true; st.lan.has = true; Au.sfx('bug'); Au.sfx('friend'); st.hold = 0.45; for (var lr = 0; lr < 3; lr++) part('ring', st.lanItem.x, st.lanItem.y - 20, 0, 0, 0.7 + lr * 0.15, 10 + lr * 14, lr % 2 ? '#ffd36b' : '#ee4b3f', 0); burst(20, st.lanItem.x, st.lanItem.y - 20, 180, 200, '#ffd36b', 1, 5, 120);
      say('Popo’s lantern! Gus clips it to his backpack.', 'narrator', { soft: true });
    }
    if (st.goal && st.status === 'play') {
      var go = st.goal;
      if (Math.abs(gcx - go.x) < 40 && Math.abs(g.y - go.y) < 70) {
        if (go.type === 'gate' && !st.lan.has && st.lanItem && !st.lanItem.taken) { st.lanItem.taken = true; st.lan.has = true; say('Oops, Gus nearly forgot Popo’s lantern! A breeze brings it over.', 'narrator', {}); Au.sfx('bug'); }
        if (go.type === 'gate' && st.cat && !st.baoEaten && !st.moment) { st.cat.dropped = false; startMoment('reunion', { skipAfter: 2.4 }); return; }
        if (!st.moment) finish();
      }
      st.gate.nag -= dt;
    }
  }
  function finish() {
    var st = Game.st, sv = Game.save;
    st.status = 'clear'; st.clearT = 0; Au.endAll && Au.endAll(); Au.blastOff(); Au.breatheOff(); Au.sfx('clear');
    st.crowd.cheer = 6; if (Game.save.set.flash) st.flash = 0.2;
    for (var i = 0; i < 70; i++) part('conf', st.g.x + rnd(-200, 200), st.g.y - rnd(80, 300), rnd(-60, 60), rnd(20, 90), rnd(2, 3.5), rnd(4, 7), ['#ff6b6b', '#ffd93d', '#6bdc8a', '#6aa7ff', '#c48bff'][i % 5], 60);
    var res = { id: st.id, zen: st.stats.blowouts === 0, chaos: st.stats.controlled >= 3 && st.stats.chants >= 1, bugs: st.stats.bugs, bugsAll: Game.bugsRescued(), bugsHere: st.bugs.filter(function (b) { return b.state !== 'trapped'; }).length, bugsTotal: st.bugs.length,
      tears: st.lan.tears, bites: st.stats.bites, newBites: st.stats.newBites, blowouts: st.stats.blowouts, controlled: st.stats.controlled, lantern: st.lan.has, mimi: !!(st.cat && st.cat.trust), baoEaten: st.baoEaten };
    var old = sv.cleared[st.id] || {};
    sv.cleared[st.id] = { clear: true, zen: old.zen || res.zen, chaos: old.chaos || res.chaos, perfect: old.perfect || res.tears === 0 };
    Game.persist(); st.result = res;
  }

  /* ---------------- prompts ---------------- */
  function updatePrompts(dt) {
    var st = Game.st, g = st.g, L = st.L, kind = In.kind;
    for (var i = 0; i < L.prompts.length; i++) {
      var p = L.prompts[i], ps = st.ps[i] || (st.ps[i] = { t: 0, done: false, said: false, near: false, base: null });
      var near = Math.abs(g.x / T - p.x) < 4.2 && !ps.done;
      ps.near = near;
      if (!near) continue;
      ps.t += dt;
      if (!ps.said) { ps.said = true; ps.base = { b: st.stats.bites, bl: st.stats.blasts, br: st.stats.breathes, j: st.stats.jumps, x: g.x }; say(p.line, 'narrator', { prompt: true }); }
      var ic = p.icon, done = false;
      if (ps.t > 2.5) {
        if (ic === 'move') done = Math.abs(g.x - ps.base.x) > 2.5 * T;
        else if (ic === 'jump') done = st.stats.jumps > ps.base.j;
        else if (ic === 'blast') done = st.stats.blasts > ps.base.bl || g.blastTotal > 0.5;
        else if (ic === 'breathe') done = st.stats.breathes > ps.base.br;
        else if (ic.indexOf('eat') === 0) done = st.stats.bites > ps.base.b;
        else done = ps.t > 5;
      }
      if (done) ps.done = true;
    }
  }

  /* ---------------- crowd and feelings triggers ---------------- */
  function updateTriggers() {
    var st = Game.st, L = st.L, gx = st.g.x / T;
    for (var i = 0; i < L.feelings.length; i++) { var f = L.feelings[i]; if (!st.fired[i] && gx >= f.x) { st.fired[i] = true; spawnBubble(f.kind); } }
  }
  function updateCrowd(dt) {
    var c = Game.st.crowd; ['cheer', 'chant', 'scatter'].forEach(function (k) { if (c[k] > 0) c[k] -= dt; });
    Game.st.persons.forEach(function (p) {
      var tgt = c.scatter > 0 ? (p.x > Game.st.g.x ? 60 : -60) : 0; p.ox += (tgt - p.ox) * Math.min(1, dt * 3);
    });
  }
  function crowdMood() {
    var c = Game.st.crowd;
    if (c.scatter > 0) return 'scatter'; if (c.chant > 0) return 'chant'; if (c.cheer > 0) return 'cheer';
    return Game.save.fandom < 20 ? 'wary' : 'idle';
  }

  /* ---------------- camera ---------------- */
  function updateCam(dt, snap) {
    var st = Game.st, g = st.g, L = st.L, c = st.cam;
    var look = g.face * (Math.abs(g.vx) > 20 ? 80 : 30), tx = st.camFocus ? st.camFocus.x - VW / 2 : g.x - VW * 0.45 + look;
    var maxX = Math.max(0, L.w * T - VW); tx = clamp(tx, 0, maxX); if (L.w * T < VW) tx = -(VW - L.w * T) / 2;
    var ty = st.camFocus ? st.camFocus.y - VH * 0.6 : g.y - VH * 0.58, maxY = L.h * T - VH; ty = Math.max(-420, Math.min(maxY, ty));
    var k = snap ? 1 : Math.min(1, dt * 6);
    c.x += (tx - c.x) * k; c.y += (ty - c.y) * Math.min(1, snap ? 1 : dt * 5);
  }


  /* ---------------- Mimi the cat ---------------- */
  function catMove(c, to, speedMul, extraH) {
    var wp = c.path[to], x1 = wp.x * T, y1 = wp.y * T, dx = x1 - c.x, dy = y1 - c.y, len = Math.max(1, Math.hypot(dx, dy));
    c.mv = { x0: c.x, y0: c.y, x1: x1, y1: y1, s: 0, len: len, speed: 380 * (speedMul || 1), h: Math.min(150, 34 + len * 0.1 + Math.max(0, c.y - y1) * 0.35 + (extraH || 0)) };
    c.to = to; c.state = 'run'; c.face = dx >= 0 ? 1 : -1; c.hiding = false;
  }
  function heart(x, y) { part('heart', x, y, rnd(-30, 30), rnd(-90, -50), rnd(0.9, 1.4), rnd(5, 8), '#ff6b8a', -20); }
  function updateCat(dt) {
    var st = Game.st, c = st.cat; if (!c) return; c.t += dt;
    if (st.moment) return;
    if (c.sock > 0) c.sock -= dt;
    var g = st.g, gT = g.x / T, wp = c.path[c.i], next = c.path[c.i + 1];
    var follow = c.trusted;            // a friend walks with Gus: slower, and waits for him less far ahead
    if (c.startle > 0 && !c.mv) {
      c.startle -= dt; c.state = 'startle'; c.hiding = false;
      if (c.startle <= 0 && next && !wp.final) { Au.sfx('hiss'); Au.sfx('bounce'); catMove(c, c.i + 1, 1.6, 40); }
      return;
    }
    if (c.cheerT > 0) { c.cheerT -= dt; if (!c.mv) { c.state = 'cheer'; return; } }
    if (c.mv) {
      var m = c.mv; m.s = Math.min(1, m.s + dt * m.speed / m.len);
      c.x = m.x0 + (m.x1 - m.x0) * m.s; c.y = m.y0 + (m.y1 - m.y0) * m.s - 4 * m.h * m.s * (1 - m.s);
      c.glance = m.s > 0.5 && m.s < 0.72 && Math.abs(gT - c.x / T) > 5; c.face = c.glance ? (gT < c.x / T ? -1 : 1) : (m.x1 >= m.x0 ? 1 : -1);
      if (follow && Math.random() < dt * 2) heart(c.x, c.y - 30);
      if (m.s >= 1) {
        c.mv = null; c.i = c.to; wp = c.path[c.i]; c.x = m.x1; c.y = m.y1; c.wait = 0.5; c.calm = 0;
        c.state = wp.sleep ? 'sleep' : 'sit'; c.face = gT < wp.x ? -1 : 1;
        if (Math.abs(gT - wp.x) < 18) Au.sfx('meow', { pitch: rnd(0.95, 1.2) });
        if (wp.hide) { c.hiding = true; say('Mimi dives into the laundry basket! Only her ears show.', 'narrator', { soft: true }); }
        if (wp.sleep) say('Mimi curls up on the sofa. Shh! Gus’s belly is rumbling.', 'narrator', { soft: true });
        if (wp.final) say('Mimi is on the fence with the bao. Hop up the crates!', 'narrator', { soft: true });
      }
      return;
    }
    c.face = gT < c.x / T ? -1 : 1;
    if (wp.final) {
      c.state = c.dropped ? (st.baoEaten ? 'purr' : 'sit') : 'perch';
      if (!c.dropped && !st.moment && g.grounded && Math.abs(gT - c.x / T) < 3.6 && Math.abs(g.y - c.y) < 3 * T) startMoment('reunion', { skipAfter: 2.4 });
      return;
    }
    if (wp.hide) {
      c.state = 'sit'; c.hiding = true;
      var bk = st.reacts.filter(function (r) { return r.type === 'basket'; })[0];
      if ((bk && bk.state !== 'idle') || gT > wp.x + 7) {
        c.hiding = false; c.sock = 7; Au.sfx('meow', { pitch: 1.45 }); Au.sfx('sock');
        for (var q = 0; q < 6; q++) part('sock', c.x + rnd(-14, 14), c.y - 20, rnd(-120, 120), rnd(-420, -200), rnd(1.6, 2.4), rnd(7, 10), ['#e0584a', '#4a90d9', '#58b368', '#f0a53a', '#9b6bd1'][q % 5], 900);
        catMove(c, c.i + 1, 1.35, 60);
      }
      return;
    }
    if (wp.sleep) {
      c.state = 'sleep'; var d = Math.abs(gT - wp.x); c.alert = (st.b.pres > 40 || st.b.state === 'tight') && d < 9 && !c.trusted;
      if (d < 6.5 && g.breathing) { c.calm += dt; if (c.calm > 1.4 && !c.trusted) { c.trusted = true; st.cat.trust = 1; Au.sfx('purr'); c.state = 'purr'; c.purrT = 2.2; st.hold = 0.45; for (var h2 = 0; h2 < 7; h2++) heart(c.x + rnd(-20, 20), c.y - 24); say('Mimi purrs. She trusts Gus’s calm belly!', 'narrator', { soft: true }); } }
      if (c.purrT > 0) { c.purrT -= dt; c.state = 'purr'; if (Math.random() < dt * 4) heart(c.x + rnd(-16, 16), c.y - 24); if (c.purrT <= 0 && next) catMove(c, c.i + 1, 0.8); return; }
      var rude = g.blasting && d < 8, loud = st.b.state === 'critical' && d < 6;
      if ((rude || loud) && !c.trusted) { c.startle = 0.9; Au.sfx('hiss'); return; }
      if (gT > wp.x + 3.5 && next) catMove(c, c.i + 1, 1);
      return;
    }
    c.state = 'sit'; c.wait -= dt; c.meowT -= dt;
    var dGus = Math.abs(gT - c.x / T), radius = follow ? 8.5 : 4.6;
    c.tease = dGus > radius && dGus < 11;
    var near = dGus < radius, passed = gT > c.x / T + 6;
    if (c.wait <= 0 && next && (near || passed)) catMove(c, c.i + 1, follow ? 0.75 : 1);
    else if (c.meowT <= 0 && dGus > 10) { c.meowT = 9; Au.sfx('meow'); }
  }

  /* ---------------- little scenes: the bao heist at the start, the bao reunion at the end ---------------- */
  function startMoment(type, o) {
    var st = Game.st; st.moment = { type: type, t: 0, skipAfter: 1.5 }; for (var k in (o || {})) st.moment[k] = o[k];
    Au.blastOff(); Au.breatheOff(); st.g.vx = 0; st.g.breathing = false; In.rumble(0, 0, 0);
  }
  function finishMoment() {
    var st = Game.st, m = st.moment, c = st.cat, g = st.g; if (!m) return;
    if (m.type === 'heist') {
      st.plateBao = false; Au.duck(false);
      if (c) { c.bao = true; c.sneak = false; c.x = 8.6 * T; c.y = 14 * T; c.i = 0; c.wait = 0; Au.sfx('meow', { pitch: 1.3 }); catMove(c, 1, 1.7, 30); }
      st.moment = null; st.camFocus = null; spawnBubble('excited'); say('Hey! That’s my bao!', 'narrator', {});
    } else if (m.type === 'reunion') {
      Au.duck(false);
      if (!st.baoEaten) eatFood({ id: 'bao', x: g.x, y: g.y - 26 }, 1);
      if (c) { c.dropped = true; c.bao = false; c.state = 'purr'; if (m.tx) { c.x = m.tx; c.y = m.ty; } }
      st.moment = null; st.camFocus = null;
    }
  }
  function updateMoment(dt) {
    var st = Game.st, m = st.moment; if (!m) return; var c = st.cat, g = st.g; m.t += dt; var t = m.t;
    if (m.t > m.skipAfter && (In.p1.jumpP || In.p1.blastP || In.nav.ok || Math.abs(In.p1.mx) > 0.5)) { finishMoment(); return; }
    if (m.type === 'heist') {
      st.camFocus = { x: (g.x + c.x) / 2 - 30, y: 12.4 * T }; g.face = 1;
      if (t > 0.25 && !m.a) { m.a = 1; Au.sfx('gurgle'); say('Gus wakes up with a rumbling belly. Time for breakfast!', 'narrator', {}); }
      if (t > 0.9 && t < 2.5) { var s = (t - 0.9) / 1.6; c.x = (22 - 13.4 * s) * T; c.y = 14 * T; c.state = 'run'; c.face = -1; c.sneak = true; c.bao = false; }
      if (t >= 2.5 && !m.b) { m.b = 1; st.plateBao = false; c.bao = true; c.x = 8.6 * T; c.state = 'sit'; c.sneak = false; c.face = -1; Au.sfx('pop'); Au.duck(true); say('Mimi has Gus’s bao! They stare at each other…', 'narrator', {}); }
      if (t >= 3.9) finishMoment();
    } else if (m.type === 'reunion') {
      if (!m.init) {
        m.init = 1; m.side = c.x >= g.x ? 1 : -1; m.tx = g.x + m.side * 58; m.ty = g.y; m.sx = c.x; m.sy = c.y; m.far = Math.hypot(c.x - m.tx, c.y - m.ty); m.trust = !!c.trusted; c.mv = null; c.hiding = false; g.face = m.side; Au.duck(true);
        say(m.trust ? 'Mimi trots over with the bao.' : 'Mimi hops over with the bao.', 'narrator', {});
      }
      st.camFocus = { x: (g.x + m.tx) / 2, y: g.y - 120 };
      if (t < 0.8) { var a = t / 0.8; c.x = m.sx + (m.tx - m.sx) * a; c.y = m.sy + (m.ty - m.sy) * a - 4 * Math.min(70, 20 + m.far * 0.1) * a * (1 - a); c.state = 'run'; c.face = (m.tx - m.sx) >= 0 ? 1 : -1; }
      else if (t < 1.9) {
        c.x = m.tx; c.y = m.ty; c.face = -m.side; c.state = m.trust ? 'purr' : 'sit';
        if (!m.set) { m.set = 1; c.bao = false; m.baoX = (g.x + m.tx) / 2; Au.sfx(m.trust ? 'purr' : 'meow'); say(m.trust ? 'She sets the bao down for Gus.' : 'She looks away, then nudges the bao with her paw.', 'narrator', {}); }
        if (m.trust && Math.random() < dt * 5) heart(c.x, c.y - 30);
      }
      if (t >= 1.9 && !m.eat) { m.eat = 1; Au.sfx('eat'); eatFood({ id: 'bao', x: g.x, y: g.y - 26 }, 1); g.relief = 1.4; g.chomp = 0.35; }
      if (t >= 2.9 && !m.toss) { m.toss = 1; Au.sfx('bounce'); }
      if (t >= 3.4 && !m.fed) {
        m.fed = 1; Au.sfx('fed'); c.state = 'purr'; st.hold = 0.3;
        for (var h = 0; h < 10; h++) heart(c.x + rnd(-24, 24), c.y - 26); for (var i = 0; i < 40; i++) part('conf', g.x + rnd(-120, 120), g.y - rnd(60, 200), rnd(-60, 60), rnd(20, 90), rnd(2, 3.4), rnd(4, 7), ['#ff6b6b', '#ffd93d', '#6bdc8a', '#6aa7ff', '#c48bff'][i % 5], 60);
        say('Breakfast found!', 'narrator', {});
      }
      if (t >= 4.8) finishMoment();
    }
  }
  function drawBaoHalf(x, y, size, left) { cx.save(); cx.beginPath(); cx.rect(x - size / 2 + (left ? 0 : size / 2), y - size / 2 - 2, size / 2, size + 4); cx.clip(); A.drawFood(cx, 'bao', x, y, size); cx.restore(); }
  function drawMoment(t) {
    var st = Game.st, m = st.moment; if (!m) return; var c = st.cat, g = st.g;
    if (m.type === 'heist') {
      if (m.t > 2.5 && m.t < 3.6) { var pu = 1 + Math.sin(m.t * 14) * 0.12; cx.save(); cx.fillStyle = '#e22b2b'; cx.strokeStyle = '#2b1d14'; cx.lineWidth = 4; cx.font = '700 40px "Luckiest Guy", Fredoka, sans-serif'; cx.textAlign = 'center'; [[g.x, g.y - 84], [c.x, c.y - 66]].forEach(function (pt) { cx.save(); cx.translate(pt[0], pt[1]); cx.scale(pu, pu); cx.strokeText('!', 0, 0); cx.fillText('!', 0, 0); cx.restore(); }); cx.restore(); }
    } else if (m.type === 'reunion') {
      var gy = g.y - 14, tt = m.t;
      if (m.set && tt < 1.9) { var nudge = (!m.trust && tt > 1.5) ? (m.side < 0 ? 12 : -12) * Math.min(1, (tt - 1.5) / 0.3) : 0; var by = gy + Math.sin(tt * 5) * 3; cx.save(); cx.globalAlpha = 0.55; A.p.circ(cx, m.baoX + nudge, by, 26, '#ffe9a0', 0); cx.restore(); A.drawFood(cx, 'bao', m.baoX + nudge, by, 36); m.baoX2 = m.baoX + nudge; }
      if (m.eat) {
        var bx = m.baoX2 || m.baoX, mouthX = g.x + g.face * 12, mouthY = g.y - 38;
        if (tt < 2.25) { var k = (tt - 1.9) / 0.35; drawBaoHalf(bx + (mouthX - bx) * k, gy + (mouthY - gy) * k - Math.sin(k * Math.PI) * 24, 34, true); }
        if (tt < 2.9) drawBaoHalf(bx, gy, 34, false);
        else if (tt < 3.4) { var k2 = (tt - 2.9) / 0.5; drawBaoHalf(bx + (c.x - bx) * k2, gy + ((c.y - 28) - gy) * k2 - Math.sin(k2 * Math.PI) * 40, 34, false); }
      }
    }
  }
  function drawMomentOverlay() {
    var st = Game.st, m = st.moment; if (!m || m.type !== 'reunion' || m.t < 3.4) return;
    var k = Math.min(1, (m.t - 3.4) / 0.35), sc = 0.6 + 0.4 * k + Math.sin(Math.min(1, (m.t - 3.4) / 0.6) * Math.PI) * 0.12;
    cx.save(); cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.translate(W / 2, H * 0.3); cx.scale(sc, sc); cx.textAlign = 'center'; cx.lineJoin = 'round';
    var fz = Math.max(36, Math.min(W / 9, 84)); cx.font = '400 ' + fz + 'px "Luckiest Guy", Impact, sans-serif'; cx.lineWidth = fz * 0.16; cx.strokeStyle = '#2b1d14'; cx.strokeText('BREAKFAST FOUND!', 0, 0); cx.fillStyle = '#ffcb2f'; cx.fillText('BREAKFAST FOUND!', 0, 0); cx.restore();
  }

  /* ---------------- things that react to Gus ---------------- */
  function updateReacts(dt) {
    var st = Game.st, g = st.g, L = st.L;
    st.reacts.forEach(function (r) {
      var rx = r.x * T, ry = r.y * T, rw = r.w * T, rh = r.h * T;
      var touching = Math.abs(g.x - (rx + rw / 2)) < rw / 2 + 16 && g.y > ry && g.y - 46 < ry + rh;
      var exNear = false;
      for (var i = 0; i < st.particles.length; i++) { var q = st.particles[i]; if ((q.k === 'ex' || q.k === 'cloud') && q.x > rx - 40 && q.x < rx + rw + 40 && q.y > ry - 40 && q.y < ry + rh + 40) { exNear = true; break; } }
      if (r.type === 'basket') {
        if (r.state === 'idle' && (touching || exNear)) {
          r.state = 'tipping'; r.anim = 0; Au.sfx('sock'); st.shake = Game.save.set.shake ? 5 : 0;
          for (var k = 0; k < 18; k++) part('sock', rx + rw / 2 + rnd(-20, 20), ry + rh - 10, rnd(-170, 170), rnd(-520, -200), rnd(2, 3), rnd(7, 11), ['#e0584a', '#4a90d9', '#58b368', '#f0a53a', '#9b6bd1', '#fff'][k % 6], 900);
          say('Whoa! Socks everywhere!', 'narrator', { soft: true }); r.sockDelay = 0.5; st.hold = 0.35;
        } else if (r.state === 'tipping') {
          r.anim += dt / 0.95;
          if (r.sockDelay > 0) { r.sockDelay -= dt; if (r.sockDelay <= 0) { st.sockT = 6; Au.sfx('sock'); } }
          var lx = Math.floor(r.landX / T);
          if (r.anim >= 1 && !(Math.abs(g.x - r.landX) < 2.8 * T && g.y > 11 * T)) {
            r.state = 'landed'; st.L.put(lx - 1, 13, 'B'); st.L.put(lx, 13, 'B'); Au.sfx('stomp'); st.shake = Game.save.set.shake ? 6 : 0;
            for (var d = 0; d < 8; d++) part('dust', r.landX + rnd(-30, 30), 14 * T, rnd(-90, 90), rnd(-90, -20), 0.6, rnd(4, 8), 'rgba(235,225,205,.8)', 120);
          }
        }
      } else if (r.type === 'hanger') {
        if (!r.spent && (touching || exNear) && g.vy < 120) {
          r.spent = true; r.swing = 0.45; Au.sfx('pop'); st.shake = Game.save.set.shake ? 3 : 0;
          ['apple', 'banana', 'cherries'].forEach(function (id, i) { st.foods.push({ x: rx + rw / 2 + (i - 1) * 24, y: ry + rh, id: id, respawn: false, taken: false, timer: 0, ph: i, fall: true, vy: -80 - i * 40, vx: (i - 1) * 60, bounced: 0 }); });
          say('Fruit shakes loose!', 'narrator', { soft: true });
        }
        if (r.swing > 0.001) { r.swingT += dt; r.swing *= Math.pow(0.35, dt); }
      } else if (r.type === 'pinwheel') {
        var near = (g.blasting && Math.abs(g.x - (rx + rw / 2)) < 5 * T && g.y > ry - 4 * T) || exNear;
        r.spin += (near ? 22 : -6) * dt; r.spin = Math.max(0, Math.min(24, r.spin)); r.ang += r.spin * dt;
        if (r.spin > 8) { r.spun += dt; r.whirrT = (r.whirrT || 0) - dt; if (r.whirrT <= 0) { r.whirrT = 0.45; Au.sfx('whirr'); } }
        if (r.spun > 2 && !r.done) {
          r.done = true; Au.sfx('bloom'); st.crowd.cheer = 3;
          for (var q2 = 0; q2 < 30; q2++) part('conf', rx + rw / 2 + rnd(-30, 30), ry + 20, rnd(-120, 120), rnd(-300, -80), rnd(1.5, 2.6), rnd(4, 7), ['#ff6b6b', '#ffd93d', '#6bdc8a', '#6aa7ff', '#c48bff'][q2 % 5], 200);
          ['banana', 'blueberries'].forEach(function (id, i) { st.foods.push({ x: rx + rw / 2 + (i ? 30 : -30), y: ry + 20, id: id, respawn: false, taken: false, timer: 0, ph: i, fall: true, vy: -260, vx: i ? 80 : -80, bounced: 0 }); });
          say('The pinwheel pops out a snack!', 'narrator', { soft: true });
        }
      }
    });
    if (st.sockT > 0) st.sockT -= dt; if (st.wobT > 0) st.wobT -= dt;
  }
  function updateFalling(dt) {
    var st = Game.st, L = st.L;
    st.foods.forEach(function (f) {
      if (!f.fall || f.taken) return;
      f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt;
      var ty = Math.floor((f.y + 18) / T), tx = Math.floor(f.x / T), ch = L.get(tx, ty);
      if ((D.SOLID.indexOf(ch) >= 0 || ch === '=') && f.vy > 0) { f.y = ty * T - 18; if (f.bounced < 1) { f.vy = -f.vy * 0.35; f.bounced++; } else { f.fall = false; f.vy = 0; f.vx = 0; } }
    });
  }

  /* If Gus hasn't got anywhere for a while, a few snacks turn up next to him and a hint appears. Never a dead end. */
  function updateStuck(dt) {
    var st = Game.st, g = st.g, pr = st.prog || (st.prog = { x: g.x, t: 0, aided: 0 });
    if (Math.abs(g.x - pr.x) > 2.5 * T) { pr.x = g.x; pr.t = 0; return; }
    if (g.breathing || st.bubbles.length) return;
    pr.t += dt;
    if (pr.t > 22 && pr.aided < 4) {
      pr.aided++; pr.t = 8;
      var dir = g.face, ids = ['candy', 'soda', 'banana', 'broccoli'];
      for (var i = 0; i < 3; i++) st.foods.push({ x: g.x + dir * (60 + i * 46), y: g.y - 58 - i * 6, id: ids[(pr.aided + i) % 4], respawn: false, taken: false, timer: 0, ph: i });
      burst(14, g.x + dir * 90, g.y - 60, 120, 140, '#ffe9a0', 0.9, 4, 100); Au.sfx('bloom');
      say('Hungry? Some snacks floated by! Try the shelves, the crates, or a big blast.', 'narrator', { soft: true });
      st.stats.helped = (st.stats.helped || 0) + 1;
      var hp = G.ai && G.ai.nextHop(); if (hp) { var tg = hp.jump ? hp.jump.target : null; st.hint = tg ? { x: (tg[0] + 0.5) * T, y: (tg[1] + 1) * T, t: 10 } : null; }
    }
  }

  /* the first time Gus stands on top of the fridge, the camera pulls back so he can see how far he has come */
  function checkVista(dt) {
    var st = Game.st, g = st.g; if (st.vistaT > 0) st.vistaT -= dt;
    if (st.id === 'home' && !st.vistaDone && g.grounded && Math.abs(g.y - 4 * T) < 2 && g.x > 54 * T && g.x < 57 * T) {
      st.vistaDone = true; st.vistaT = 3.4; Au.sfx('whoosh'); say('What a view! The whole house, and Mimi far away.', 'narrator', {});
    }
  }

  /* ---------------- update loop ---------------- */
  Game.update = function (dt) {
    var st = Game.st; if (!st) return;
    dt = Math.min(dt, 0.05) * (Game.save.set.speed / 100); var rdt = dt;
    if (st.hold > 0) { st.hold -= dt; dt *= 0.18; }
    if (st.slow) { st.slow.t += dt; if (st.slow.t > 6) { st.slow = null; st.firstBlastDone = true; } else dt *= 0.3; }
    st.t += dt;
    var b = st.b;
    if (st.status === 'play') {
      updateGus(dt);
      B.tick(b, dt, { breathing: st.g.breathing });
      handleEvents();
      updatePickups(dt); if (!st.moment) { updatePrompts(dt); updateTriggers(); updateStuck(dt); } updateBubbles(dt); updateCat(dt); updateReacts(dt); updateFalling(dt); updateMoment(dt); checkVista(dt);
    } else if (st.status === 'clear') {
      st.clearT += dt; updateGus(dt); B.tick(b, dt, {}); b.events = [];
      updatePickups(dt);
      if (st.clearT > 2.4 && !st.reported) { st.reported = true; if (Game.hooks.clear) Game.hooks.clear(st.result); }
    }
    updateCrowd(dt); updateParticles(dt);
    st.noteT -= dt;
    Au.setBelly(b.vit, b.pres); Au.ladder(st.status === 'play' ? b.state : 'springy', dt);
    st.shake *= Math.pow(0.02, dt); if (st.flash > 0) st.flash -= dt;
    st.patches.forEach(function (p) { if (p.growth > 0 && p.anim < 1) p.anim = Math.min(1, p.anim + dt * 1.6); if (p.squash > 0) p.squash -= dt; if (p.pop > 0) p.pop -= dt; });
    ZT = st.moment ? (st.moment.type === 'reunion' ? 1.25 : 1.2) : st.slow ? 1.1 : st.vistaT > 0 ? 0.8 : 1;
    ZF += (ZT - ZF) * Math.min(1, rdt * 3.5); applyZoom();
    updateCam(dt, false);
  };

  /* ---------------- rendering ---------------- */
  function drawCheckpoint(c, t) {
    cx.save(); cx.translate(c.x, c.y);
    A.p.line(cx, 0, 0, 0, -78, '#6b4a2a', 6);
    A.p.line(cx, 0, -76, 14, -80, '#6b4a2a', 4);
    if (c.lit) { var gl = cx.createRadialGradient(14, -62, 4, 14, -62, 54); gl.addColorStop(0, 'rgba(255,214,107,.7)'); gl.addColorStop(1, 'rgba(255,214,107,0)'); cx.fillStyle = gl; cx.fillRect(-50, -120, 130, 120); }
    A.p.rr(cx, 4, -78, 20, 26, 8, c.lit ? '#ff6a4a' : '#a0988a', 2.5);
    if (c.lit) A.p.line(cx, 8, -66, 20, -66, '#ffe9a0', 2.5);
    cx.restore();
  }
  function drawGate(go, st) {
    var open = st.status === 'clear', t = st.t;
    cx.save(); cx.translate(go.x, go.y);
    A.p.rr(cx, -46, -108, 14, 108, 3, '#8a5a30', 3); A.p.rr(cx, 32, -108, 14, 108, 3, '#8a5a30', 3);
    cx.beginPath(); cx.arc(0, -104, 46, Math.PI, 0); cx.lineWidth = 12; cx.strokeStyle = INK; cx.stroke(); cx.lineWidth = 7; cx.strokeStyle = '#8a5a30'; cx.stroke();
    for (var i = 0; i < 8; i++) { var a = Math.PI + i / 7 * Math.PI; A.p.circ(cx, Math.cos(a) * 46, -104 + Math.sin(a) * 46, 7, ['#ff7fa8', '#ffd84a', '#7be07b'][i % 3], 2); }
    if (!open) { for (var k = -1; k <= 1; k += 2) A.p.rr(cx, k < 0 ? -32 : 2, -88, 30, 88, 3, '#c98b4f', 3); }
    else { A.p.rr(cx, -32, -88, 10, 88, 3, '#c98b4f', 3); A.p.rr(cx, 22, -88, 10, 88, 3, '#c98b4f', 3); }

    cx.restore();
  }
  var INK = '#2b1d14';
  function drawLanternItem(it, t) {
    if (it.taken) return;
    cx.save(); cx.translate(it.x, it.y - 18 + Math.sin(t * 3) * 3);
    var gl = cx.createRadialGradient(0, 0, 4, 0, 0, 44); gl.addColorStop(0, 'rgba(255,214,107,.6)'); gl.addColorStop(1, 'rgba(255,214,107,0)'); cx.fillStyle = gl; cx.fillRect(-44, -44, 88, 88);
    A.p.rr(cx, -12, -14, 24, 30, 9, '#ee4b3f', 3); A.p.line(cx, -6, -4, 6, -4, '#ffd36b', 2.5); A.p.line(cx, -6, 6, 6, 6, '#ffd36b', 2.5);
    A.p.rr(cx, -8, -19, 16, 6, 3, '#ffd36b', 2); for (var i = -1; i <= 1; i++) A.p.line(cx, i * 6, 16, i * 6, 24, '#ffd36b', 2);
    cx.restore();
  }
  function drawPatch(pt, st) {
    var t = st.t;
    if (pt.growth === 0) { // sleeping seed: a glint on the soil, and a target that says where the blast must land
      var x = pt.cx, near = Math.abs(st.g.x - x) < 14 * T; cx.save(); cx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3); A.p.circ(cx, x - 14, pt.y * T - 3, 3, '#ffe9a0', 0); A.p.circ(cx, x + 10, pt.y * T - 5, 2.4, '#ffe9a0', 0); cx.restore();
      if (near) {
        var bob = Math.sin(t * 4) * 5; cx.save(); cx.globalAlpha = 0.9; cx.strokeStyle = '#ffd93d'; cx.lineWidth = 4; cx.setLineDash([8, 7]); cx.beginPath(); cx.ellipse(x, pt.y * T - 2, pt.w * T / 2 + 6, 9, 0, 0, TAU); cx.stroke(); cx.setLineDash([]);
        A.p.poly(cx, [x - 12, pt.y * T - 56 + bob, x + 12, pt.y * T - 56 + bob, x + 12, pt.y * T - 44 + bob, x + 20, pt.y * T - 44 + bob, x, pt.y * T - 24 + bob, x - 20, pt.y * T - 44 + bob, x - 12, pt.y * T - 44 + bob], '#ffd93d', 2.5); cx.restore();
      }
      return;
    }
    var sq = pt.squash > 0 ? 1 - pt.squash * 0.5 : 1; if (pt.pop > 0) sq = 1 + Math.sin(pt.pop * 18) * 0.25 * pt.pop;
    cx.save(); cx.translate(pt.cx, pt.y * T); cx.scale(1, sq); A.plant(cx, pt.kind, 0, 0, pt.growth, t, pt.anim); cx.restore();
  }
  function drawFoodItem(f, t) {
    if (f.taken) return;
    var y = f.y + Math.sin(t * 3 + f.ph) * 4;
    cx.save(); cx.globalAlpha = 0.9; A.p.circ(cx, f.x, f.y + 22, 12, 'rgba(0,0,0,.14)', 0); cx.restore();
    A.drawFood(cx, f.id, f.x, y, 38, Math.sin(t * 2 + f.ph) * 0.1);
  }
  function drawHUD(st) {
    var b = st.b, set = Game.save.set;
    cx.save(); cx.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
    var x = 14, y = 14;
    // lantern and tears, bugs, bites
    A.p.rr(cx, x, y, 178, 40, 14, 'rgba(255,255,255,.88)', 2.5);
    cx.save(); cx.translate(x + 22, y + 20); A.p.rr(cx, -9, -12, 18, 24, 7, st.lan.has ? '#ee4b3f' : '#b8b0a0', 2.5); for (var i = 0; i < st.lan.tears; i++) A.p.line(cx, -6 + i * 5, -6 + i * 4, -1 + i * 5, 0 + i * 4, '#fff3d6', 2); cx.restore();
    for (var k = 0; k < 3; k++) { var got = st.bugs[k] && st.bugs[k].state !== 'trapped'; A.bug(cx, x + 62 + k * 26, y + 20, st.t + k, A.famOf(st.bugs[k] ? st.bugs[k].id : 'x'), { r: 8 }); if (!got) { cx.fillStyle = 'rgba(210,200,185,.75)'; cx.beginPath(); cx.arc(x + 62 + k * 26, y + 20, 12, 0, TAU); cx.fill(); } }
    A.drawFood(cx, 'apple', x + 148, y + 20, 22); cx.fillStyle = INK; cx.font = '700 15px Fredoka, sans-serif'; cx.textAlign = 'left'; cx.fillText(String(Game.bitesFound()), x + 161, y + 25);
    if (set.meters || st.mode === 'check') {
      var mx = 14, my = 62, mw = 120;
      A.p.rr(cx, mx, my, mw, 12, 6, 'rgba(255,255,255,.8)', 2); A.p.rr(cx, mx + 1, my + 1, Math.max(4, (mw - 2) * b.vit / 100), 10, 5, set.cb ? '#3b8de8' : '#44c46a', 0);
      A.p.rr(cx, mx, my + 18, mw, 12, 6, 'rgba(255,255,255,.8)', 2); A.p.rr(cx, mx + 1, my + 19, Math.max(4, (mw - 2) * b.pres / 100), 10, 5, set.cb ? '#e8a13b' : '#ee6a4a', 0);
    }
    cx.restore();
  }
  function drawPrompt(st) {
    var L = st.L; for (var i = 0; i < L.prompts.length; i++) {
      var ps = st.ps[i]; if (!ps || !ps.near) continue;
      var p = L.prompts[i], g = st.g, kind = In.kind, x = g.x, y = g.y - 96 - Math.sin(st.t * 4) * 3;
      var act = p.icon.indexOf('eat') === 0 ? 'eat' : p.icon;
      cx.save(); cx.globalAlpha = 0.95;
      if (act === 'eat') { var id = p.icon.split(':')[1]; A.p.rr(cx, x - 30, y - 22, 60, 44, 14, 'rgba(255,255,255,.92)', 2.5); A.drawFood(cx, id, x, y, 36); }
      else if (act === 'move') { A.p.rr(cx, x - 52, y - 22, 104, 44, 14, 'rgba(255,255,255,.92)', 2.5); A.glyph(cx, 'move', x, y, kind, 15); }
      else { A.p.rr(cx, x - 44, y - 22, 88, 44, 14, 'rgba(255,255,255,.92)', 2.5); A.glyph(cx, act, x, y, kind, 15); }
      cx.restore();
      return;
    }
  }
  var BACK_ONLY = true;
  Game.render = function () {
    var st = Game.st; if (!st || !cx) return;
    var L = st.L, t = st.t, g = st.g, b = st.b, cam = st.cam, def = st.def;
    var shx = st.shake > 0.3 ? rnd(-st.shake, st.shake) : 0, shy = st.shake > 0.3 ? rnd(-st.shake, st.shake) : 0;
    cx.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
    A.bg(def.theme, cx, { cx: cam.x, cy: cam.y, vw: VW, vh: VH, t: t, groundY: (L.groundRow || 14) * T, lvlW: L.w * T });
    cx.save(); cx.translate(-cam.x + shx, -cam.y + shy);
    // back decorations and crowd
    var mood = crowdMood(), i, d;
    var left = cam.x - 80, right = cam.x + VW + 80;
    for (i = 0; i < L.decor.length; i++) { d = L.decor[i]; if (!A.decorIsFront(d)) A.decor(cx, d, t, { machineOff: st.status === 'clear', tvOn: true, plateBao: st.plateBao }); }
    st.persons.forEach(function (p) { if (p.x > left && p.x < right) A.person(cx, p.x + p.ox, p.y, p, mood, t, Game.save.set.gross === 'max' && st.crowd.scatter > 0); });
    // tiles
    var tx0 = Math.max(0, Math.floor(cam.x / T)), tx1 = Math.min(L.w - 1, Math.ceil((cam.x + VW) / T)), ty0 = Math.max(0, Math.floor(cam.y / T)), ty1 = Math.min(L.h - 1, Math.ceil((cam.y + VH) / T));
    for (var ty = ty0; ty <= ty1; ty++) for (var tx = tx0; tx <= tx1; tx++) {
      var ch = L.g[ty][tx]; if (ch === ' ') continue;
      if (ch === 'H') { var vis = b.sightT > 0; cx.save(); cx.globalAlpha = vis ? 0.95 : 0.12; A.tile(cx, def.theme, '=', tx * T, ty * T, true, 0); if (vis) A.p.rr(cx, tx * T, ty * T, T, 10, 3, 'rgba(120,230,255,.5)', 0); cx.restore(); continue; }
      if (ch === 'v') { cx.fillStyle = 'rgba(190,230,255,.45)'; cx.fillRect(tx * T, ty * T, T, T); continue; }
      var above = L.get(tx, ty - 1), top = D.SOLID.indexOf(above) < 0;
      A.tile(cx, (def.id === 'home' && tx >= 92) ? 'commute' : def.theme, ch, tx * T, ty * T, top, (tx * 7 + ty * 3) & 3);
    }
    for (i = 0; i < L.decor.length; i++) { d = L.decor[i]; if (A.decorIsFront(d)) A.decor(cx, d, t, { wob: st.wobT > 0 ? st.wobT : 0 }); }
    // decals (splats) then plants
    st.particles.forEach(function (p) { if (p.k === 'decal') { cx.globalAlpha = Math.min(1, p.life / 1.2); cx.fillStyle = p.col; cx.beginPath(); cx.ellipse(p.x, p.y - 2, p.size * 1.6, p.size * 0.5, 0, 0, TAU); cx.fill(); cx.globalAlpha = 1; } });
    st.patches.forEach(function (p) { drawPatch(p, st); });
    st.checks.forEach(function (c) { drawCheckpoint(c, t); });
    if (st.goal) drawGate(st.goal, st);
    if (st.lanItem) drawLanternItem(st.lanItem, t);
    st.bugs.forEach(function (bg) {
      if (bg.state === 'trapped') A.bug(cx, bg.x, bg.y, t, bg.fam, { trapped: true });
      else if (bg.state === 'freeing') { var k = bg.t / 0.9; A.bug(cx, bg.x + (g.x - bg.x) * k, bg.y + (g.y - 24 - bg.y) * k - Math.sin(k * Math.PI) * 30, t, bg.fam, { hop: true, r: 13 * (1 - k * 0.5) }); }
      else A.bug(cx, bg.x, bg.y, t, bg.fam, { hop: Math.sin(t * 0.7 + bg.x) > 0.9 });
    });
    var cc = st.cat, catOpts = cc ? { face: cc.face, state: cc.state, bao: cc.bao, hop: cc.tease || cc.state === 'cheer', alert: cc.alert, sneak: cc.sneak, sock: cc.sock > 0, peek: cc.hiding } : null;
    if (cc && cc.hiding) A.cat(cx, cc.x, cc.y, t, catOpts);     // she is behind the basket
    st.reacts.forEach(function (r) { A.react(cx, r, t); });
    st.foods.forEach(function (f) { drawFoodItem(f, t); });
    if (cc && !cc.hiding) A.cat(cx, cc.x, cc.y, t, catOpts);
    // Gus
    A.gus(cx, { x: g.x, y: g.y, face: g.face, sx: g.sx, sy: g.sy, state: b.state, pres: b.pres, vit: b.vit, t: t, run: g.run, vy: g.vy, air: !g.grounded, moving: Math.abs(g.vx) > 20,
      grounded: g.grounded, lan: st.lan.ang, tears: st.lan.tears, hasLantern: st.lan.has, breathing: g.breathing, relief: g.relief > 0 || st.status === 'clear', butterflies: b.butterflies, spin: g.spin, glow: true, sock: st.sockT > 0, dizzy: g.lockT > 0, fizz: st.fizzT > 0, tint: g.tint ? g.tint.k : null, tintA: g.tint ? Math.min(1, g.tint.t / 0.5) : 0, buildup: !!st.slow || (g.blastT > 0.02 && g.blastT < 0.18 && !g.blasting) });
    // particles
    var gm = Game.save.set.gross;
    st.particles.forEach(function (p) {
      var a = Math.max(0, p.life / p.max);
      if (p.k === 'decal') return;
      cx.globalAlpha = p.k === 'cloud' ? a * 0.8 : a;
      if (p.k === 'conf') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot + p.life * 4); cx.fillStyle = p.col; cx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); cx.restore(); }
      else if (p.k === 'heart') { cx.save(); cx.translate(p.x, p.y); var hs = p.size / 8; cx.scale(hs, hs); cx.beginPath(); cx.moveTo(0, 3); cx.bezierCurveTo(-9, -4, -5, -11, 0, -5); cx.bezierCurveTo(5, -11, 9, -4, 0, 3); cx.closePath(); cx.fillStyle = p.col; cx.fill(); cx.lineWidth = 1.4; cx.strokeStyle = INK; cx.stroke(); cx.restore(); }
      else if (p.k === 'ring') { cx.strokeStyle = p.col; cx.lineWidth = 4 * a + 1; cx.beginPath(); cx.arc(p.x, p.y, p.size + (1 - a) * 70, 0, TAU); cx.stroke(); }
      else if (p.k === 'sock') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot + p.life * 7); A.p.rr(cx, -3.5, -9, 7, 16, 3, p.col, 1.8); cx.fillStyle = '#fff'; cx.fillRect(-3.5, -3, 7, 3); cx.restore(); }
      else if (p.k === 'petal') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot + p.life * 3); cx.fillStyle = p.col; cx.beginPath(); cx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, TAU); cx.fill(); cx.restore(); }
      else if (p.k === 'fly') { cx.save(); cx.translate(p.x, p.y); var wg = Math.sin(st.t * 30) * 0.6; A.p.ell(cx, -3, 0, 3.4, 2, p.col, 1, wg); A.p.ell(cx, 3, 0, 3.4, 2, p.col, 1, -wg); cx.restore(); }
      else if (p.k === 'cloud') { cx.fillStyle = p.col; cx.beginPath(); cx.arc(p.x, p.y, p.size * (1.3 - a * 0.5), 0, TAU); cx.fill(); }
      else { cx.fillStyle = p.col; cx.beginPath(); cx.arc(p.x, p.y, p.size * (p.k === 'splat' ? 1 : (0.4 + a * 0.6)), 0, TAU); cx.fill(); }
    });
    cx.globalAlpha = 1;
    st.bubbles.forEach(function (bu) { A.bubble(cx, D.FEELINGS[bu.kind].icon, bu.x, bu.y, bu.size, bu.t, bu.a); });
    drawMoment(t);
    drawPrompt(st);
    if (st.hint && st.hint.t > 0) { st.hint.t -= 1 / 60; var by = st.hint.y - 60 - Math.abs(Math.sin(t * 5)) * 14; cx.save(); cx.globalAlpha = Math.min(1, st.hint.t); A.p.poly(cx, [st.hint.x - 16, by - 26, st.hint.x + 16, by - 26, st.hint.x + 16, by - 8, st.hint.x + 26, by - 8, st.hint.x, by + 18, st.hint.x - 26, by - 8, st.hint.x - 16, by - 8], '#ffd93d', 3); cx.restore(); }
    if (st.slow) { var gl = Math.sin(t * 12) * 0.5 + 0.5; cx.save(); cx.globalAlpha = 0.96; A.p.rr(cx, g.x - 96, g.y - 150 - gl * 4, 192, 62, 18, '#fff3d6', 3.5); A.glyph(cx, 'blast', g.x - 52, g.y - 119 - gl * 4, In.kind, 19); cx.fillStyle = '#d9473f'; cx.font = '700 24px "Luckiest Guy", Fredoka, sans-serif'; cx.textAlign = 'left'; cx.fillText('BLAST!', g.x - 24, g.y - 110 - gl * 4); cx.restore(); }
    cx.restore();
    // screen effects
    cx.setTransform(dpr * S, 0, 0, dpr * S, 0, 0);
    if (b.state === 'critical' && st.status === 'play') { var vg = cx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.85); vg.addColorStop(0, 'rgba(255,60,60,0)'); vg.addColorStop(1, 'rgba(255,60,60,' + (0.25 + 0.12 * Math.sin(t * 8)) + ')'); cx.fillStyle = vg; cx.fillRect(0, 0, VW, VH); }
    if (st.flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + Math.min(0.5, st.flash) + ')'; cx.fillRect(0, 0, VW, VH); }
    drawMomentOverlay();
    if (!st.moment) drawHUD(st);
  };

  /* ---------------- main loop ---------------- */
  var last = 0;
  function loop(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
    In.frame(dt);
    if (Game.hooks.tick) Game.hooks.tick(dt);
    cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height);
    if (Game.override) { cx.setTransform(dpr, 0, 0, dpr, 0, 0); Game.panelT += dt; Game.override(cx, W, H, Game.panelT, dt); }
    else if (Game.view === 'stage' && Game.st) {
      // Step mode: between presses the world waits, but only once Gus has come to rest (never freeze him mid-air)
      var gs = Game.st.g, rest = Game.st.status !== 'play' || (gs.grounded && Math.abs(gs.vx) < 30 && Math.abs(gs.vy) < 20 && !(gs.lockT > 0));
      Game.unsettled = rest ? 0 : (Game.unsettled || 0) + dt;
      var wait = In.stepMode && In.frozen && Game.st.status === 'play' && !Game.st.moment && (rest || Game.unsettled > 5);
      Game.waiting = wait;
      if (wait) { Au.blastOff(); Au.breatheOff(); }
      if (!Game.paused && !wait) Game.update(dt);
      Game.render();
    }
    requestAnimationFrame(loop);
  }
  Game.step = function (dt, n) { for (var i = 0; i < (n || 1); i++) { In.frame(dt); Game.update(dt); } };
})(typeof window !== 'undefined' ? window : this);
