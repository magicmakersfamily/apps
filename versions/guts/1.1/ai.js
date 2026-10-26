/* GUTS text view: a plain-words description of what is happening, for screen readers, for people who
   want to read along, and for AI assistants that can read the page but not see the picture.
   GUTS.ai.state() / describe() only read. GUTS.ai.press() plays one button for a moment (the same
   thing a key press, a click on an on-screen button or Tap mode does). Nothing is sent anywhere. */
(function (root) {
  'use strict';
  var G = root.GUTS, Game = G.Game, In = G.Input, D = G.Data, B = G.Belly, T = 32;
  var ACTIONS = ['left', 'right', 'jump', 'blast', 'breathe', 'wait'];

  function solid(L, x, y) { return D.SOLID.indexOf(L.get(x, y)) >= 0; }
  function tiles(n) { n = Math.round(n * 10) / 10; return n + (n === 1 ? ' tile' : ' tiles'); }
  function rel(dx, dy) {
    var h = Math.abs(dx) < 1 ? 'right here' : tiles(Math.abs(dx)) + (dx > 0 ? ' ahead to the right' : ' behind to the left');
    var v = Math.abs(dy) < 1 ? '' : (dy < 0 ? ', ' + tiles(-dy) + ' up' : ', ' + tiles(dy) + ' down');
    return h + v;
  }

  function scan(st) {
    var L = st.L, g = st.g, gx = Math.floor(g.x / T), floorRow = Math.round(g.y / T), dir = g.face, out = {};
    // first wall in the way (within 8 tiles), and how tall it is
    for (var d = 1; d <= 8; d++) {
      var x = gx + dir * d;
      if (solid(L, x, floorRow - 1)) {
        var top = floorRow - 1; while (top > 0 && solid(L, x, top - 1)) top--;
        out.wall = { dist: d, height: floorRow - top }; break;
      }
    }
    // first gap in the floor ahead
    for (var e = 1; e <= 8; e++) {
      var xx = gx + dir * e, hasFloor = false;
      for (var yy = floorRow; yy <= floorRow + 6; yy++) if (solid(L, xx, yy) || L.get(xx, yy) === '=') { hasFloor = true; break; }
      if (!hasFloor) { var w = 0; while (w < 12) { var x2 = xx + dir * w, f2 = false; for (var y2 = floorRow; y2 <= floorRow + 6; y2++) if (solid(L, x2, y2) || L.get(x2, y2) === '=') { f2 = true; break; } if (f2) break; w++; } out.gap = { dist: e, width: w }; break; }
    }
    return out;
  }

  function nearby(st) {
    var g = st.g, list = [];
    st.foods.forEach(function (f) { if (f.taken) return; var dx = (f.x - g.x) / T, dy = (f.y - (g.y - 24)) / T; if (Math.abs(dx) <= 10 && Math.abs(dy) <= 8) list.push({ kind: 'food', name: f.id, dx: dx, dy: dy }); });
    st.bugs.forEach(function (b) { if (b.state !== 'trapped') return; var dx = (b.x - g.x) / T, dy = (b.y - (g.y - 24)) / T; if (Math.abs(dx) <= 12 && Math.abs(dy) <= 10) list.push({ kind: 'bug', name: 'a trapped Gut Bug', dx: dx, dy: dy }); });
    if (st.lanItem && !st.lanItem.taken) { var lx = (st.lanItem.x - g.x) / T; if (Math.abs(lx) <= 14) list.push({ kind: 'lantern', name: 'Po Po’s lantern', dx: lx, dy: (st.lanItem.y - 20 - (g.y - 24)) / T }); }
    st.patches.forEach(function (p) { var dx = (p.cx - g.x) / T; if (Math.abs(dx) <= 10) list.push({ kind: 'dirt', name: p.growth ? 'a bounce flower (size ' + p.growth + ')' : 'a patch of dirt (blast over it to grow a bounce flower)', dx: dx, dy: 0 }); });
    list.sort(function (a, b) { return Math.abs(a.dx) - Math.abs(b.dx); });
    return list;
  }

  function state() {
    var st = Game.st;
    if (!st || Game.view !== 'stage') return { screen: G.UI ? G.UI.screen : 'unknown' };
    var g = st.g, b = st.b, L = st.L, s = scan(st), pr = null;
    for (var i = 0; i < L.prompts.length; i++) if (st.ps[i] && st.ps[i].near) { pr = L.prompts[i].line; break; }
    var nextHint = null; L.prompts.forEach(function (p) { if (!nextHint && p.x * T > g.x + T && !(st.ps[L.prompts.indexOf(p)] && st.ps[L.prompts.indexOf(p)].done)) nextHint = { inTiles: Math.round(p.x - g.x / T), line: p.line }; });
    return {
      screen: 'play', level: st.def.name, mode: st.mode, status: st.status,
      x: Math.round(g.x / T * 10) / 10, y: Math.round(g.y / T * 10) / 10, levelWidth: L.w, goalX: st.goal ? Math.round(st.goal.x / T) : null,
      facing: g.face > 0 ? 'right' : 'left', onGround: !!g.grounded, moving: Math.abs(g.vx) > 20,
      belly: b.state, pressure: Math.round(b.pres), vitality: Math.round(b.vit), butterflies: b.butterflies, heavy: B.stats(b).heavy,
      lantern: st.lan.has, lanternTears: st.lan.tears, bugsFreed: st.stats.bugs, bites: Game.bitesFound(),
      wall: s.wall || null, gap: s.gap || null, nearby: nearby(st).slice(0, 8), hint: pr, nextHint: nextHint,
      stepMode: !!In.stepMode, waiting: !!Game.waiting, paused: !!Game.paused
    };
  }

  function describe() {
    var st = Game.st;
    if (!st || Game.view !== 'stage') return 'GUTS: ' + (G.UI ? 'you are on the "' + G.UI.screen + '" screen.' : 'loading.');
    var s = state(), t = [];
    t.push('GUTS text view. Level: ' + s.level + ' (' + s.mode + ' mode).' + (s.stepMode ? ' Step mode: the game waits between button presses' + (s.waiting ? ' (waiting now).' : '.') : ''));
    if (s.status === 'clear') t.push('The level is complete!');
    t.push('Gus is at tile ' + s.x + ' of ' + s.levelWidth + (s.goalX ? ' (the exit gate is at tile ' + s.goalX + ', ' + tiles(Math.abs(s.goalX - s.x)) + ' away)' : '') + ', ' + (s.onGround ? 'standing' : 'in the air') + ', facing ' + s.facing + '.');
    t.push('Belly: ' + s.belly + ' (pressure ' + s.pressure + '%, vitality ' + s.vitality + '%)' + (s.butterflies ? ', ' + s.butterflies + ' butterflies' : '') + (s.heavy ? ', heavy' : '') + '. ' + (s.pressure < 8 ? 'Not enough pressure to blast far: eat sugary food or feel something first. ' : s.pressure > 85 ? 'About to blow out: breathe or blast now. ' : ''));
    if (s.wall) t.push('Ahead: a wall ' + tiles(s.wall.height) + ' high, ' + tiles(s.wall.dist) + ' away' + (s.wall.height <= 3 ? ' (a jump gets over it).' : s.wall.height <= 5 ? ' (jump from a step, or blast).' : ' (look for steps or shelves, or blast over it).'));
    if (s.gap) t.push('Ahead: a ' + tiles(s.gap.width) + '-wide gap in the floor, ' + tiles(s.gap.dist) + ' away.');
    var n = s.nearby; if (n.length) t.push('Nearby: ' + n.map(function (o) { return o.name + ' ' + rel(o.dx, o.dy); }).join('; ') + '.');
    if (s.hint) t.push('Hint on screen: "' + s.hint + '"');
    else if (s.nextHint) t.push('Next hint, in about ' + tiles(s.nextHint.inTiles) + ': "' + s.nextHint.line + '"');
    t.push('Lantern: ' + (s.lantern ? 'carried' + (s.lanternTears ? ' (' + s.lanternTears + ' tears)' : '') : 'not picked up yet') + '. Gut Bugs freed: ' + s.bugsFreed + '. Bites found: ' + s.bites + ' of 80.');
    t.push('Buttons: left, right, jump, blast (tap to hop, hold to rocket), breathe (stand still), wait.');
    return t.join(' ');
  }

  G.ai = {
    actions: ACTIONS, state: state, describe: describe,
    press: function (name, seconds) { if (ACTIONS.indexOf(name) < 0) throw new Error('unknown action ' + name + '; use ' + ACTIONS.join(', ')); In.press(name, seconds || 0.5); return true; }
  };
})(typeof window !== 'undefined' ? window : this);
