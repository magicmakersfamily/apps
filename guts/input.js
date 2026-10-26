/* GUTS input: keyboard, PlayStation / standard gamepads (Gamepad API) and touch buttons,
   merged into one per-frame state for player 1 (Gus) and player 2 (Biffy), plus menu navigation. */
(function (root) {
  'use strict';
  var G = root.GUTS = root.GUTS || {};
  var keys = {}, edge = {}, touch = { left: 0, right: 0, jump: 0, blast: 0, breathe: 0, down: 0 };
  var last = 'kb', padSeen = false, dead = 0.3;
  var prev = {}, rep = {}, listeners = [];
  var I = {
    p1: { mx: 0, my: 0, jump: false, blast: false, breathe: false, jumpP: false, blastP: false, breatheP: false, poundP: false, aimX: 0, aimY: 0 },
    p2: { mx: 0, my: 0, feed: false, feedP: false, breathe: false },
    nav: { up: false, down: false, left: false, right: false, ok: false, back: false },
    pauseP: false, anyP: false, kind: 'kb', pads: 0, padName: '', capture: true
  };

  function isTextTarget(t) { return t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName); }
  function inStage(t) { return !t || t === document.body || (t.closest && t.closest('#stage')); }
  var BLOCK = { Space: 1, ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Enter: 1 };

  root.addEventListener('keydown', function (e) {
    if (isTextTarget(e.target)) return;
    if (BLOCK[e.code] && inStage(e.target) && I.capture) e.preventDefault();
    if (!keys[e.code]) edge[e.code] = true;
    keys[e.code] = true; last = 'kb';
  });
  root.addEventListener('keyup', function (e) { keys[e.code] = false; });
  root.addEventListener('blur', function () { keys = {}; touch.left = touch.right = touch.jump = touch.blast = touch.breathe = touch.down = 0; });
  root.addEventListener('gamepadconnected', function (e) { padSeen = true; I.padName = e.gamepad.id; listeners.forEach(function (f) { f('connect', e.gamepad); }); });
  root.addEventListener('gamepaddisconnected', function (e) { listeners.forEach(function (f) { f('disconnect', e.gamepad); }); });

  function k(c) { return !!keys[c]; }
  function anyK(list) { for (var i = 0; i < list.length; i++) if (keys[list[i]]) return true; return false; }

  /* Normalise a gamepad. Standard mapping (what Chrome and Safari give a PS4/PS5 pad):
     0 Cross, 1 Circle, 2 Square, 3 Triangle, 4 L1, 5 R1, 6 L2, 7 R2, 9 Options, 12-15 d-pad.
     Raw Sony mapping (no 'standard'): 0 Square, 1 Cross, 2 Circle, 3 Triangle, 9 Options, d-pad on axis 9. */
  function norm(gp) {
    var b = gp.buttons, ax = gp.axes, s = {};
    function pr(i) { return !!(b[i] && (b[i].pressed || b[i].value > 0.5)); }
    var raw = gp.mapping !== 'standard' && /054c|sony|dualshock|wireless controller/i.test(gp.id) && b.length < 16;
    if (!raw) {
      s.cross = pr(0); s.circle = pr(1); s.square = pr(2); s.tri = pr(3); s.l1 = pr(4); s.r1 = pr(5); s.l2 = pr(6); s.r2 = pr(7); s.options = pr(9);
      s.up = pr(12); s.down = pr(13); s.left = pr(14); s.right = pr(15);
    } else {
      s.square = pr(0); s.cross = pr(1); s.circle = pr(2); s.tri = pr(3); s.l1 = pr(4); s.r1 = pr(5); s.l2 = pr(6); s.r2 = pr(7); s.options = pr(9);
      var hat = ax[9]; s.up = s.down = s.left = s.right = false;
      if (hat !== undefined && hat <= 1.01) { var i = Math.round((hat + 1) * 3.5); s.up = i === 0 || i === 1 || i === 7; s.right = i >= 1 && i <= 3; s.down = i >= 3 && i <= 5; s.left = i >= 5 && i <= 7; }
    }
    s.lx = Math.abs(ax[0] || 0) > dead ? ax[0] : 0; s.ly = Math.abs(ax[1] || 0) > dead ? ax[1] : 0;
    if (s.left) s.lx = -1; if (s.right) s.lx = 1; if (s.up) s.ly = -1; if (s.down) s.ly = 1;
    s.any = s.cross || s.circle || s.square || s.tri || s.l1 || s.r1 || s.options || Math.abs(s.lx) > 0.5 || Math.abs(s.ly) > 0.5;
    return s;
  }
  function pads() {
    var out = []; try { var l = navigator.getGamepads ? navigator.getGamepads() : []; for (var i = 0; i < l.length; i++) if (l[i] && l[i].connected !== false) out.push(l[i]); } catch (e) {}
    return out;
  }

  /* call once per animation frame */
  I.frame = function (dt) {
    var pl = pads(), a = pl[0] ? norm(pl[0]) : null, b2 = pl[1] ? norm(pl[1]) : null;
    I.pads = pl.length; if (pl[0]) I.padName = pl[0].id;
    if (a && a.any && !prev.padAny) last = 'pad'; prev.padAny = a ? a.any : false;
    I.kind = last;

    // ----- player 1
    var p = I.p1, mx = 0, my = 0;
    if (anyK(['ArrowLeft', 'KeyA'])) mx -= 1; if (anyK(['ArrowRight', 'KeyD'])) mx += 1;
    if (anyK(['ArrowDown', 'KeyS'])) my += 1; if (anyK(['ArrowUp', 'KeyW'])) my -= 1;
    if (a) { mx += a.lx; my += a.ly; }
    mx += touch.right - touch.left;
    p.mx = Math.max(-1, Math.min(1, mx)); p.my = Math.max(-1, Math.min(1, my));
    p.aimX = a ? a.lx : p.mx; p.aimY = a ? a.ly : p.my;
    var jump = anyK(['Space', 'KeyZ', 'ArrowUp', 'KeyW']) || (a && a.cross) || touch.jump;
    var blast = anyK(['KeyX', 'ShiftLeft', 'ShiftRight', 'Period']) || (a && (a.square || a.r1 || a.r2)) || touch.blast;
    var breathe = anyK(['KeyB', 'KeyC', 'ArrowDown', 'KeyS']) || (a && (a.circle || a.l1)) || touch.breathe;
    var pound = (a && a.tri) || (a && a.ly > 0.6) || touch.breathe || k('ArrowDown') || k('KeyS');
    p.jumpP = jump && !prev.jump; p.blastP = blast && !prev.blast; p.breatheP = breathe && !prev.breathe;
    p.poundP = pound && !prev.pound; p.pound = !!pound;
    p.jump = !!jump; p.blast = !!blast; p.breathe = !!breathe;
    p.breatheGround = anyK(['KeyB', 'KeyC', 'ArrowDown', 'KeyS']) || (a && (a.circle || a.l1)) || !!touch.breathe;
    prev.jump = jump; prev.blast = blast; prev.breathe = breathe; prev.pound = pound;

    // ----- player 2 (Biffy): second pad, or IJKL + U feed + O breathe
    var q = I.p2, qx = 0, qy = 0;
    if (k('KeyJ')) qx -= 1; if (k('KeyL')) qx += 1; if (k('KeyI')) qy -= 1; if (k('KeyK')) qy += 1;
    if (b2) { qx += b2.lx; qy += b2.ly; }
    q.mx = Math.max(-1, Math.min(1, qx)); q.my = Math.max(-1, Math.min(1, qy));
    var feed = k('KeyU') || (b2 && b2.cross); q.feedP = feed && !prev.feed; q.feed = !!feed; prev.feed = feed;
    q.breathe = k('KeyO') || (b2 && (b2.circle || b2.l1)) || false;
    q.pad = !!b2; q.optionsP = b2 ? (b2.options && !prev.opt2) : false; prev.opt2 = b2 ? b2.options : false;

    // ----- pause and "press anything"
    var opt = a && a.options;
    I.pauseP = !!(edge.Escape || edge.KeyP || (opt && !prev.opt));
    I.optionsP = !!(opt && !prev.opt);
    I.anyP = !!(edge.Space || edge.Enter || edge.KeyZ || (a && a.cross && !prev.nCross));
    prev.opt = opt;

    // ----- menu navigation with auto-repeat
    var n = I.nav, st = {
      up: anyK(['ArrowUp']) || (a && (a.up || a.ly < -0.6)), down: anyK(['ArrowDown']) || (a && (a.down || a.ly > 0.6)),
      left: anyK(['ArrowLeft']) || (a && (a.left || a.lx < -0.6)), right: anyK(['ArrowRight']) || (a && (a.right || a.lx > 0.6)),
      ok: anyK(['Enter', 'Space']) || (a && a.cross), back: k('Escape') || (a && a.circle)
    };
    ['up', 'down', 'left', 'right', 'ok', 'back'].forEach(function (d) {
      var on = !!st[d]; n[d] = false;
      if (on && !prev['n' + d]) { n[d] = true; rep[d] = 0.4; }
      else if (on && d !== 'ok' && d !== 'back') { rep[d] -= dt; if (rep[d] <= 0) { n[d] = true; rep[d] = 0.12; } }
      prev['n' + d] = on;
    });
    prev.nCross = a && a.cross;
    edge = {};
  };

  I.touch = touch;
  I.setKind = function (kind) { last = kind; };
  I.onPad = function (fn) { listeners.push(fn); };
  I.rumble = function (ms, strong, weak) {
    try { var pl = pads()[0]; if (pl && pl.vibrationActuator && pl.vibrationActuator.playEffect) pl.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) {}
  };
  /* test hook: the headless smoke test sets keys and fake pads through these */
  I._keys = keys;
  G.Input = I;
})(typeof window !== 'undefined' ? window : this);
