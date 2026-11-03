/* GUTS text view: a plain-words description of what is happening, for screen readers, for people who
   want to read along, and for AI assistants that can read the page but not see the picture.
   GUTS.ai.state() / describe() only read. GUTS.ai.press() plays one button for a moment (the same
   thing a key press, a click on an on-screen button or Tap mode does). Nothing is sent anywhere. */
(function (root) {
  'use strict';
  var G = root.GUTS, Game = G.Game, In = G.Input, D = G.Data, B = G.Belly, T = 32;
  var ACTIONS = ['left', 'right', 'runLeft', 'runRight', 'jump', 'jumpLeft', 'jumpRight', 'blast', 'breathe', 'wait'];

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
    if (st.lanItem && !st.lanItem.taken) { var lx = (st.lanItem.x - g.x) / T; if (Math.abs(lx) <= 14) list.push({ kind: 'lantern', name: 'Popo’s lantern', dx: lx, dy: (st.lanItem.y - 20 - (g.y - 24)) / T }); }
    if (st.cat) { var c = st.cat; list.push({ kind: 'cat', name: 'Mimi the cat (' + (c.bao ? 'carrying the bao' : 'no bao') + ', ' + (c.state === 'sleep' ? 'asleep: breathe calmly nearby' : c.state) + ')', dx: (c.x - g.x) / T, dy: (c.y - g.y) / T }); }
    st.reacts.forEach(function (r) { var dx = (r.x + r.w / 2 - g.x / T); if (Math.abs(dx) > 12) return; var nm = r.type === 'basket' ? (r.state === 'idle' ? 'a laundry basket full of socks on a shelf (touch it: it tips over and becomes a step)' : 'the tipped laundry basket') : r.type === 'hanger' ? (r.spent ? 'an empty hanging fruit basket' : 'a hanging fruit basket (jump up and bump it: fruit falls)') : (r.done ? 'a spinning pinwheel' : 'a pinwheel (blast near it to spin it)'); list.push({ kind: 'thing', name: nm, dx: dx, dy: (r.y + r.h / 2 - g.y / T) }); });
    st.patches.forEach(function (p) { var dx = (p.cx - g.x) / T; if (Math.abs(dx) <= 10) list.push({ kind: 'dirt', name: p.growth ? 'a bounce flower (size ' + p.growth + ')' : 'a patch of dirt (blast over it to grow a bounce flower)', dx: dx, dy: 0 }); });
    list.sort(function (a, b) { return Math.abs(a.dx) - Math.abs(b.dx); });
    return list;
  }


  /* ---------- where can Gus stand, and what is the next hop on the way to the gate ---------- */
  function standable(L, x, y) { return !solid(L, x, y) && !solid(L, x, y - 1) && (solid(L, x, y + 1) || L.get(x, y + 1) === '='); }
  /* the cell Gus is standing in; if he is balanced on an edge, the column that actually holds him up */
  function gusCell(st) {
    var L = st.L, row = Math.round(st.g.y / T) - 1, xs = [Math.floor(st.g.x / T), Math.floor((st.g.x + 12) / T), Math.floor((st.g.x - 12) / T)];
    for (var i = 0; i < xs.length; i++) if (standable(L, xs[i], row)) return [xs[i], row];
    return [xs[0], row];
  }
  function plan(st) {
    var L = st.L, c = gusCell(st), goal = st.goal ? [Math.floor(st.goal.x / T), Math.round(st.goal.y / T) - 1] : null;
    if (!goal || !standable(L, c[0], c[1])) return null;
    var key = function (x, y) { return x + ',' + y; }, par = {}, q = [c]; par[key(c[0], c[1])] = null; var end = null;
    while (q.length) {
      var n = q.shift(), x = n[0], y = n[1];
      if (Math.abs(x - goal[0]) <= 1 && Math.abs(y - goal[1]) <= 1) { end = n; break; }
      for (var dx = -6; dx <= 6; dx++) for (var ty = y - 2; ty <= y + 16; ty++) {
        var tx = x + dx; if (tx < 0 || tx >= L.w || ty < 0 || ty >= L.h || par[key(tx, ty)] !== undefined || !standable(L, tx, ty)) continue;
        var rise = y - ty, ad = Math.abs(dx), md = rise > 2 ? 0 : rise === 2 ? 3 : rise === 1 ? 4 : rise === 0 ? 5 : 6; if (ad > md) continue;
        var sg = Math.sign(dx), bad = false, top = Math.min(y, ty);
        for (var cx = x + sg; cx !== tx && sg !== 0; cx += sg) if (solid(L, cx, top - 1) || solid(L, cx, top - 2)) { bad = true; break; }
        if (bad) continue; par[key(tx, ty)] = n; q.push([tx, ty]);
      }
    }
    if (!end) return null;
    var path = []; for (var m = end; m; m = par[key(m[0], m[1])]) path.unshift(m);
    return path;
  }
  /* the next thing to do: walk some tiles, then maybe jump to a spot */
  function contiguous(L, A, B) {   // flat walk with floor all the way: no jump needed
    if (A[1] !== B[1]) return false;
    var a = Math.min(A[0], B[0]), b = Math.max(A[0], B[0]);
    for (var x = a; x <= b; x++) { if (!(solid(L, x, A[1] + 1) || L.get(x, A[1] + 1) === '=') || solid(L, x, A[1])) return false; }
    return true;
  }
  function nextHop() {
    var st = Game.st; if (!st || Game.view !== 'stage' || st.status !== 'play') return null;
    var path = plan(st); if (!path) return null;
    var gx = st.g.x / T, start = path[0], L = st.L;
    for (var i = 0; i + 1 < path.length; i++) {
      var A = path[i], B = path[i + 1], rise = A[1] - B[1], dx = B[0] - A[0];
      var walk = contiguous(L, A, B) || (Math.abs(dx) <= 1 && rise === 0);
      if (!walk) {
        return { walkTiles: Math.round((A[0] + 0.5 - gx) * 10) / 10, jump: { dir: Math.sign(dx), rise: rise, dx: dx, takeoff: A, target: B }, goalFar: Math.abs(path[path.length - 1][0] - start[0]) };
      }
    }
    var last = path[path.length - 1];
    return { walkTiles: Math.round((last[0] + 0.5 - gx) * 10) / 10, jump: null, goalFar: Math.abs(last[0] - start[0]) };
  }
  function hopText(h) {
    if (!h) return null;
    var dirWord = function (d) { return d > 0 ? 'right' : 'left'; };
    var parts = [];
    if (Math.abs(h.walkTiles) >= 0.6) parts.push('walk ' + tiles(Math.abs(h.walkTiles)) + ' ' + dirWord(h.walkTiles));
    if (h.jump) {
      var j = h.jump, what = j.rise > 0 ? 'up ' + tiles(j.rise) : j.rise < 0 ? 'down ' + tiles(-j.rise) : 'across';
      var ad = Math.abs(j.dx), size = ad <= 1 ? 'small (key 1)' : ad <= 3 ? 'medium (key 2)' : 'large (key 3)';
      var way = j.dx === 0 ? 'jump straight up' : 'jump ' + dirWord(j.dir) + ' with distance ' + size + ' (' + tiles(ad) + ' ' + dirWord(j.dir) + ', ' + what + ')';
      parts.push(way);
    } else parts.push('then keep going to the gate');
    return parts.join(', then ');
  }
  function platforms(st) {
    var L = st.L, c = gusCell(st), out = [];
    for (var y = c[1] - 9; y <= c[1] + 3; y++) {
      var x = c[0] - 10;
      while (x <= c[0] + 12) {
        if (standable(L, x, y)) {
          var x0 = x; while (standable(L, x + 1, y) && x < c[0] + 12) x++;
          var shelf = L.get(x0, y + 1) === '=';
          var rise = c[1] - y, gap = x0 > c[0] ? x0 - c[0] - 0 : (x < c[0] ? c[0] - x : 0);
          if (rise > 0 && rise <= 6) out.push({ name: shelf ? 'a shelf' : 'a ledge', width: x - x0 + 1, dx: x0 > c[0] ? x0 - c[0] : (x < c[0] ? x - c[0] : 0), rise: rise, ok: rise <= 2 && gap <= 3, d: gap + rise });
        }
        x++;
      }
    }
    out.sort(function (a, b) { return a.d - b.d; });
    return out.slice(0, 4);
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
      route: hopText(nextHop()), platforms: platforms(st).map(function (p) { return p.name + ' ' + p.width + ' wide, ' + (p.dx === 0 ? 'right above' : tiles(Math.abs(p.dx)) + (p.dx > 0 ? ' to the right' : ' to the left')) + ', ' + tiles(p.rise) + ' up' + (p.ok ? ' (a jump reaches it)' : ''); }),
      stepMode: !!In.stepMode, waiting: !!Game.waiting, paused: !!Game.paused
    };
  }

  function describe() {
    var st = Game.st;
    if (G.UI && G.UI.screen === 'results') { var rt = document.getElementById('results'); return 'GUTS results screen: ' + (rt ? rt.innerText.replace(/\s+/g, ' ') : '') + ' Buttons: Next, Play again, Title.'; }
    if (!st || Game.view !== 'stage') return 'GUTS: ' + (G.UI ? 'you are on the "' + G.UI.screen + '" screen.' : 'loading.');
    var s = state(), t = [];
    if (Game.st.moment) { t.push('A short scene is playing (' + (Game.st.moment.type === 'heist' ? 'Mimi the cat steals Gus’s breakfast bao' : 'Gus and Mimi share the bao') + '). It ends by itself in a few seconds, or press jump or blast to skip it.'); return t.join(' '); }
    t.push('GUTS text view. Level: ' + s.level + ' (' + s.mode + ' mode).' + (s.stepMode ? ' Step mode: the game waits between button presses' + (s.waiting ? ' (waiting now).' : '.') : ''));
    if (s.status === 'clear') { t.push('The level is complete! The celebration plays, then the results screen appears by itself.'); t.push('Gus is at tile ' + s.x + '. Bites found: ' + s.bites + '.'); return t.join(' '); }
    t.push('Gus is at tile ' + s.x + ' of ' + s.levelWidth + (s.goalX ? ' (the exit gate is at tile ' + s.goalX + ', ' + tiles(Math.abs(s.goalX - s.x)) + ' away)' : '') + ', ' + (s.onGround ? 'standing' : 'in the air') + ', facing ' + s.facing + '.');
    t.push('Belly: ' + s.belly + ' (pressure ' + s.pressure + '%, vitality ' + s.vitality + '%)' + (s.butterflies ? ', ' + s.butterflies + ' butterflies' : '') + (s.heavy ? ', heavy' : '') + '. ' + (s.pressure < 8 ? 'Not much pressure to blast with: fizzy drinks, sweets and big feelings build it. ' : s.pressure > 85 ? 'About to blow out: breathe or blast now. ' : ''));
    if (s.wall) t.push('Ahead: a wall ' + tiles(s.wall.height) + ' high, ' + tiles(s.wall.dist) + ' away' + (s.wall.height <= 3 ? ' (a jump gets over it).' : s.wall.height <= 5 ? ' (jump from a step, or blast).' : ' (look for steps or shelves, or blast over it).'));
    if (s.gap) t.push('Ahead: a ' + tiles(s.gap.width) + '-wide gap in the floor, ' + tiles(s.gap.dist) + ' away.');
    if (s.platforms && s.platforms.length) t.push('Platforms above: ' + s.platforms.join('; ') + '.');
    if (s.route) t.push('Route hint: ' + s.route + '.');
    var n = s.nearby; if (n.length) t.push('Nearby: ' + n.map(function (o) { return o.name + ' ' + rel(o.dx, o.dy); }).join('; ') + '.');
    if (s.hint) t.push('Hint on screen: "' + s.hint + '"');
    else if (s.nextHint) t.push('Next hint, in about ' + tiles(s.nextHint.inTiles) + ': "' + s.nextHint.line + '"');
    t.push('Lantern: ' + (s.lantern ? 'carried' + (s.lanternTears ? ' (' + s.lanternTears + ' tears)' : '') : 'not picked up yet') + '. Gut Bugs freed: ' + s.bugsFreed + '. Bites found: ' + s.bites + ' of 80.');
    t.push('Buttons: left / right = one small step; runLeft / runRight (A / D) = a long run; jump; jumpLeft / jumpRight (Q / E) = a jump with a step in that direction (its distance follows the tap distance: keys 1 small, 2 medium, 3 large); blast (tap to hop, hold to rocket); breathe (stand still); wait (N).');
    return t.join(' ');
  }

  G.ai = {
    actions: ACTIONS, state: state, describe: describe, nextHop: nextHop, platforms: function () { return platforms(Game.st); },
    setDistance: function (size) { if (['small', 'medium', 'large', 'auto'].indexOf(size) < 0) throw new Error('use small, medium, large or auto'); In.setStepSize(size, true); return size; },
    press: function (name, seconds) { if (ACTIONS.indexOf(name) < 0) throw new Error('unknown action ' + name + '; use ' + ACTIONS.join(', ')); In.press(name, seconds || 0.5); return true; }
  };
})(typeof window !== 'undefined' ? window : this);
