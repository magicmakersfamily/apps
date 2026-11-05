/* Ultimate Train Studio 2.0 — tabletop model.
   The page draws the board and plays sound. This file only decides where
   pieces snap, where the train may go, and that the camera is a ¾ view
   looking down at a board (never a side-view sky with floating track).
   Works in the browser (global TrainSim) and in node --test. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TrainSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var VEC = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
  var OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
  var LINKS = {
    'straight-h': ['E', 'W'],
    'straight-v': ['N', 'S'],
    station: ['E', 'W'],
    'curve-tl': ['E', 'S'],
    'curve-tr': ['W', 'S'],
    'curve-br': ['N', 'W'],
    'curve-bl': ['E', 'N']
  };

  /* Wooden baseboard in model units. y grows toward the camera (south).
     z grows up. Track sits on the top face (z = thick), not in the air. */
  var BOARD = { w: 1500, d: 1100, thick: 68 };
  var CELL = 250;
  var ORIGIN = { x: 150, y: 270 };
  var CAMERA = {
    kind: 'tabletop-three-quarter',
    sx: 0.72,
    shear: 0.34,
    sy: 0.42,
    sz: 0.78
  };

  /* 3×3 ring, center left open for the turntable. Eight chunky snaps. */
  var SLOTS = [
    { id: 'nw', c: 0, r: 0, type: 'curve-tl', tool: 'curve' },
    { id: 'fest', c: 1, r: 0, type: 'station', tool: 'station', role: 'festival', name: 'Lantern Festival' },
    { id: 'ne', c: 2, r: 0, type: 'curve-tr', tool: 'curve' },
    { id: 'east', c: 2, r: 1, type: 'straight-v', tool: 'straight' },
    { id: 'se', c: 2, r: 2, type: 'curve-br', tool: 'curve' },
    { id: 'home', c: 1, r: 2, type: 'station', tool: 'station', role: 'home', name: 'Home' },
    { id: 'sw', c: 0, r: 2, type: 'curve-bl', tool: 'curve' },
    { id: 'west', c: 0, r: 1, type: 'straight-v', tool: 'straight' }
  ];
  var GUIDE = ['home', 'sw', 'west', 'nw', 'fest', 'ne', 'east', 'se'];
  var TRAVEL = [
    { id: 'home', enter: 'E', exit: 'W' },
    { id: 'sw', enter: 'E', exit: 'N' },
    { id: 'west', enter: 'S', exit: 'N' },
    { id: 'nw', enter: 'S', exit: 'E' },
    { id: 'fest', enter: 'W', exit: 'E' },
    { id: 'ne', enter: 'W', exit: 'S' },
    { id: 'east', enter: 'N', exit: 'S' },
    { id: 'se', enter: 'N', exit: 'W' }
  ];

  /* Festival buildings and hills live ON the board, in the back-right corner. */
  var SCENERY = {
    hills: { x: 36, y: 16, w: 760, d: 188 },
    festival: { x: 700, y: 28, w: 760, d: 220 }
  };

  var STYLES = ['steam', 'bullet', 'city'];
  var COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'rainbow'];
  var COLOR_HEX = {
    red: '#dc2626',
    orange: '#ea580c',
    yellow: '#eab308',
    green: '#16a34a',
    blue: '#2563eb',
    purple: '#7c3aed',
    pink: '#db2777',
    rainbow: 'rainbow'
  };

  var CRUISE = 260;
  var ACCEL = 340;
  var BRAKE = 460;
  var CELEBRATE = 2.2;
  var FRIENDS = 4;
  var STOP_RADIUS = 34;

  var byId = {};
  SLOTS.forEach(function (s) { byId[s.id] = s; });

  function project(x, y, z) {
    z = z || 0;
    return {
      x: x * CAMERA.sx + y * CAMERA.shear,
      y: y * CAMERA.sy - z * CAMERA.sz
    };
  }

  function unproject(sx, sy, z) {
    z = z || 0;
    var y = (sy + z * CAMERA.sz) / CAMERA.sy;
    var x = (sx - y * CAMERA.shear) / CAMERA.sx;
    return { x: x, y: y };
  }

  function trackZ() { return BOARD.thick; }

  function cameraProof() {
    var z = trackZ();
    var back = project(BOARD.w / 2, 40, z);
    var front = project(BOARD.w / 2, BOARD.d - 40, z);
    var raised = project(BOARD.w / 2, BOARD.d / 2, z + 80);
    var flat = project(BOARD.w / 2, BOARD.d / 2, z);
    var left = project(40, BOARD.d / 2, z);
    var right = project(BOARD.w - 40, BOARD.d / 2, z);
    var threeQuarter = CAMERA.kind === 'tabletop-three-quarter' &&
      CAMERA.shear > 0.15 && CAMERA.sy > 0.2 && CAMERA.sy < CAMERA.sx && CAMERA.sz > 0.4;
    var sideView = CAMERA.sy < 0.08;
    var topDown = CAMERA.sz < 0.15 && Math.abs(CAMERA.sy - CAMERA.sx) < 0.08;
    var sky = z > BOARD.thick + 40;
    return {
      camera: CAMERA.kind,
      threeQuarter: threeQuarter,
      frontLowerThanBack: front.y > back.y + 40,
      heightGoesUp: raised.y < flat.y - 20,
      boardHasWidth: right.x > left.x + 40,
      trackOnBoard: z === BOARD.thick,
      boardThick: BOARD.thick > 40,
      skyFloat: !!(sky || sideView || topDown || !threeQuarter)
    };
  }

  function sceneryOnBoard() {
    function inside(b) {
      return b.x >= 0 && b.y >= 0 && b.x + b.w <= BOARD.w && b.y + b.d <= BOARD.d;
    }
    var fest = SCENERY.festival;
    var backRight = fest.x > BOARD.w * 0.35 && fest.y + fest.d < ORIGIN.y + 8;
    return inside(fest) && inside(SCENERY.hills) && backRight;
  }

  function cellRect(slot) {
    return {
      x: ORIGIN.x + slot.c * CELL,
      y: ORIGIN.y + slot.r * CELL,
      w: CELL,
      h: CELL
    };
  }

  function edgePoint(rect, dir) {
    var cx = rect.x + rect.w / 2;
    var cy = rect.y + rect.h / 2;
    if (dir === 'E') return { x: rect.x + rect.w, y: cy };
    if (dir === 'W') return { x: rect.x, y: cy };
    if (dir === 'S') return { x: cx, y: rect.y + rect.h };
    return { x: cx, y: rect.y };
  }

  function arcPoints(cx, cy, r, a0, a1, n) {
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var a = a0 + (a1 - a0) * (i / n);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
    return pts;
  }

  function piecePoints(slot, enter, exit) {
    var rect = cellRect(slot);
    var n = slot.type.indexOf('curve') === 0 ? 12 : 6;
    if (slot.type === 'curve-tl') {
      return arcPoints(rect.x + rect.w, rect.y + rect.h, CELL / 2, Math.PI, Math.PI * 1.5, n);
    }
    if (slot.type === 'curve-tr') {
      return arcPoints(rect.x, rect.y + rect.h, CELL / 2, -Math.PI / 2, 0, n);
    }
    if (slot.type === 'curve-br') {
      return arcPoints(rect.x, rect.y, CELL / 2, 0, Math.PI / 2, n);
    }
    if (slot.type === 'curve-bl') {
      return arcPoints(rect.x + rect.w, rect.y, CELL / 2, Math.PI / 2, Math.PI, n);
    }
    var a = edgePoint(rect, enter);
    var b = edgePoint(rect, exit);
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
    return pts;
  }

  function buildPath() {
    var pts = [];
    TRAVEL.forEach(function (leg) {
      var part = piecePoints(byId[leg.id], leg.enter, leg.exit);
      part.forEach(function (p) {
        var last = pts[pts.length - 1];
        if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.4) pts.push(p);
      });
    });
    var seg = [0];
    for (var i = 1; i < pts.length; i++) {
      seg.push(seg[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
    }
    return { pts: pts, seg: seg, length: seg[seg.length - 1] };
  }

  var PATH = buildPath();

  function wrapDist(d) {
    var L = PATH.length;
    d = d % L;
    if (d < 0) d += L;
    return d;
  }

  function pointAt(dist) {
    var L = PATH.length;
    dist = wrapDist(dist);
    var seg = PATH.seg;
    var pts = PATH.pts;
    var i = 1;
    while (i < seg.length - 1 && seg[i] < dist) i++;
    var span = seg[i] - seg[i - 1] || 1;
    var t = (dist - seg[i - 1]) / span;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var a = pts[i - 1];
    var b = pts[i];
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      dist: dist
    };
  }

  function nearestDist(x, y) {
    var best = 0;
    var bestD = Infinity;
    var step = 4;
    for (var d = 0; d <= PATH.length; d += step) {
      var p = pointAt(d);
      var dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
      if (dd < bestD) { bestD = dd; best = p.dist; }
    }
    return best;
  }

  function cellCenter(id) {
    var r = cellRect(byId[id]);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  var HOME_DIST = nearestDist(cellCenter('home').x, cellCenter('home').y);
  var FEST_DIST = nearestDist(cellCenter('fest').x, cellCenter('fest').y);

  function aheadDist(from, to) {
    var d = wrapDist(to - from);
    if (d < 1) d = PATH.length;
    return d;
  }

  function nearDist(dist, target) {
    var d = Math.abs(wrapDist(dist - target));
    if (d > PATH.length / 2) d = PATH.length - d;
    return d <= STOP_RADIUS;
  }

  function emptyPlaced() {
    var g = {};
    SLOTS.forEach(function (s) { g[s.id] = null; });
    return g;
  }

  function clonePlaced(placed) {
    var g = {};
    SLOTS.forEach(function (s) { g[s.id] = placed[s.id]; });
    return g;
  }

  function loopClosed(placed) {
    for (var i = 0; i < SLOTS.length; i++) if (!placed[SLOTS[i].id]) return false;
    var grid = toGrid(placed);
    var lapW = lap(grid, 1, 2, 'W');
    return lapW.closed && !lapW.reversed && lapW.steps === 8;
  }

  function toGrid(placed) {
    var grid = [];
    var r, c;
    for (r = 0; r < 3; r++) {
      var row = [];
      for (c = 0; c < 3; c++) row.push(null);
      grid.push(row);
    }
    SLOTS.forEach(function (s) {
      var tile = placed[s.id];
      if (!tile) return;
      grid[s.r][s.c] = { type: tile.type, role: tile.role || null, name: tile.name || '' };
    });
    return grid;
  }

  function exitDir(tile, dir) {
    if (!tile) return null;
    var links = LINKS[tile.type];
    if (!links) return null;
    var from = OPP[dir];
    if (links[0] === from) return links[1];
    if (links[1] === from) return links[0];
    return null;
  }

  function step(grid, col, row, dir) {
    var dc = VEC[dir][0], dr = VEC[dir][1];
    var nc = col + dc, nr = row + dr;
    if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) {
      return { col: col, row: row, dir: OPP[dir], event: 'reverse' };
    }
    var tile = grid[nr][nc];
    var next = exitDir(tile, dir);
    if (next == null) return { col: col, row: row, dir: OPP[dir], event: 'reverse', tile: tile };
    var event = tile && tile.type === 'station' ? 'station' : null;
    return { col: nc, row: nr, dir: next, event: event, tile: tile };
  }

  function lap(grid, col, row, dir) {
    var seen = 0;
    var startC = col, startR = row, startD = dir;
    var guard = 0;
    var reversed = false;
    while (guard++ < 40) {
      var n = step(grid, col, row, dir);
      if (n.event === 'reverse') { reversed = true; break; }
      col = n.col; row = n.row; dir = n.dir;
      seen++;
      if (col === startC && row === startR && dir === startD) break;
    }
    return {
      steps: seen,
      reversed: reversed,
      closed: !reversed && col === startC && row === startR && dir === startD
    };
  }

  function validSlots(placed, tool) {
    return SLOTS.filter(function (s) { return !placed[s.id] && s.tool === tool; });
  }

  function suggested(placed, tool) {
    var valid = validSlots(placed, tool);
    for (var i = 0; i < GUIDE.length; i++) {
      var id = GUIDE[i];
      for (var k = 0; k < valid.length; k++) if (valid[k].id === id) return id;
    }
    return valid.length ? valid[0].id : null;
  }

  function nextTool(placed) {
    for (var i = 0; i < GUIDE.length; i++) {
      if (!placed[GUIDE[i]]) return byId[GUIDE[i]].tool;
    }
    return null;
  }

  function place(placed, slotId, tool) {
    var slot = byId[slotId];
    if (!slot || placed[slotId] || slot.tool !== tool) return { ok: false, placed: placed };
    var next = clonePlaced(placed);
    next[slotId] = { type: slot.type, role: slot.role || null, name: slot.name || '' };
    return { ok: true, placed: next, id: slotId };
  }

  function slotAt(x, y) {
    var best = null;
    var bestD = Infinity;
    for (var i = 0; i < SLOTS.length; i++) {
      var s = SLOTS[i];
      var r = cellRect(s);
      var dx = 0;
      var dy = 0;
      if (x < r.x) dx = r.x - x;
      else if (x > r.x + r.w) dx = x - (r.x + r.w);
      if (y < r.y) dy = r.y - y;
      else if (y > r.y + r.h) dy = y - (r.y + r.h);
      var d = Math.hypot(dx, dy);
      if (d <= CELL * 0.16 && d < bestD) { best = s; bestD = d; }
    }
    return best;
  }

  function canBoard(doorsOpen, atStation, speed) {
    return !!doorsOpen && !!atStation && typeof speed === 'number' && speed < 8;
  }

  function lightsFor(speed, braking) {
    if (!(speed >= 10)) return 'stop';
    if (braking || speed < CRUISE * 0.62) return 'slow';
    return 'go';
  }

  function makeRun() {
    return {
      dist: HOME_DIST,
      speed: 0,
      cruise: 0,
      armedStop: false,
      stopDist: null,
      stopping: false,
      doors: false,
      boarded: 0,
      waiting: FRIENDS,
      celebration: false,
      celebrateT: 0,
      endCard: false,
      alight: 0,
      doorRejected: false,
      nudgeDoors: false,
      lights: 'stop',
      horn: 0
    };
  }

  function atHome(run) { return run.speed < 8 && nearDist(run.dist, HOME_DIST); }
  function atFestival(run) { return run.speed < 8 && nearDist(run.dist, FEST_DIST); }

  function tryBoard(run) {
    if (canBoard(run.doors, atHome(run), run.speed) && run.waiting > 0) {
      run.boarded += run.waiting;
      run.waiting = 0;
    }
  }

  function stepRun(run, dt) {
    tryBoard(run);
    var braking = false;
    var goal = run.cruise;
    if (run.stopping) { goal = 0; braking = run.speed > 8; }
    if (run.armedStop && run.stopDist != null && !run.celebration) {
      var ahead = aheadDist(run.dist, run.stopDist);
      var need = (run.speed * run.speed) / (2 * BRAKE);
      if (ahead <= need + 18 || (ahead < 24 && run.speed < 80)) {
        goal = 0;
        braking = true;
      }
    }
    if (run.celebration) { goal = 0; braking = run.speed > 1; }
    if (run.speed < goal) run.speed = Math.min(goal, run.speed + ACCEL * dt);
    else run.speed = Math.max(goal, run.speed - BRAKE * dt);
    if (run.speed < 0.8 && goal === 0) run.speed = 0;

    if (run.speed > 0 && !run.celebration) {
      var move = run.speed * dt;
      if (run.armedStop && run.stopDist != null) {
        var gap = aheadDist(run.dist, run.stopDist);
        if (move >= gap - 0.5) {
          run.dist = run.stopDist;
          run.speed = 0;
          run.cruise = 0;
          run.armedStop = false;
          run.stopping = false;
          move = 0;
        }
      }
      if (move > 0) run.dist = wrapDist(run.dist + move);
    }

    if (run.speed >= 8) {
      if (run.doors) run.doorRejected = true;
      run.doors = false;
    } else if (run.stopping && run.speed === 0) {
      run.stopping = false;
      run.cruise = 0;
    }

    var started = false;
    if (!run.celebration && !run.endCard && atFestival(run) && run.boarded > 0) {
      run.celebration = true;
      run.celebrateT = 0;
      run.doors = true;
      run.cruise = 0;
      run.speed = 0;
      run.armedStop = false;
      started = true;
    }
    if (run.celebration) {
      run.celebrateT += dt;
      run.alight = Math.max(0, Math.min(1, run.celebrateT / CELEBRATE));
      if (!started && run.celebrateT >= CELEBRATE) {
        run.endCard = true;
        run.boarded = 0;
        run.alight = 1;
      }
    }
    if (run.horn > 0) run.horn = Math.max(0, run.horn - dt);
    run.lights = lightsFor(run.speed, braking || run.armedStop);
    run.doorRejected = run.doorRejected && run.speed >= 8;
    return run;
  }

  function tickRun(run, dt) {
    dt = Math.max(0, dt || 0);
    var left = dt;
    var guard = 0;
    while (left > 0 && guard++ < 800) {
      var h = left > 0.05 ? 0.05 : left;
      stepRun(run, h);
      left -= h;
    }
    return run;
  }

  function createSession() {
    var placed = emptyPlaced();
    var history = [];
    var phase = 'paint';
    var style = 'steam';
    var color = 'red';
    var tool = 'station';
    var kid = true;
    var throttle = 1;
    var run = makeRun();

    function state() {
      return {
        phase: phase,
        style: style,
        color: color,
        tool: tool,
        kid: kid,
        throttle: throttle,
        loop: loopClosed(placed),
        dist: run.dist,
        speed: run.speed,
        lights: run.lights,
        doors: run.doors,
        boarded: run.boarded,
        waiting: run.waiting,
        celebration: run.celebration,
        endCard: run.endCard,
        alight: run.alight,
        doorRejected: !!run.doorRejected,
        nudgeDoors: !!run.nudgeDoors,
        horn: run.horn,
        placedCount: SLOTS.filter(function (s) { return placed[s.id]; }).length
      };
    }

    function resetRun() {
      run = makeRun();
    }

    function placeSlot(slotId) {
      if (phase !== 'build') return { ok: false, state: state() };
      var res = place(placed, slotId, tool);
      if (!res.ok) return { ok: false, state: state() };
      placed = res.placed;
      history.push(slotId);
      var follow = nextTool(placed);
      if (follow) tool = follow;
      return { ok: true, state: state() };
    }

    return {
      state: state,
      placed: function () { return clonePlaced(placed); },
      paint: function (nextStyle, nextColor) {
        if (STYLES.indexOf(nextStyle) >= 0) style = nextStyle;
        if (COLORS.indexOf(nextColor) >= 0) color = nextColor;
        return state();
      },
      confirmPaint: function () {
        if (phase === 'paint') {
          phase = loopClosed(placed) ? 'drive' : 'build';
          if (phase === 'build') tool = nextTool(placed) || 'station';
          if (phase === 'drive') resetRun();
        }
        return state();
      },
      openPaint: function () { phase = 'paint'; return state(); },
      openBuild: function () {
        phase = 'build';
        tool = nextTool(placed) || tool;
        return state();
      },
      openDrive: function () {
        if (loopClosed(placed)) phase = 'drive';
        return state();
      },
      setTool: function (next) {
        if (next === 'straight' || next === 'curve' || next === 'station') tool = next;
        return state();
      },
      nextTool: function () { return nextTool(placed); },
      suggested: function () { return suggested(placed, tool); },
      place: function (slotId) { return placeSlot(slotId); },
      placeSuggested: function () {
        var id = suggested(placed, tool);
        if (!id) return { ok: false, state: state() };
        return placeSlot(id);
      },
      undo: function () {
        if (!history.length || phase === 'paint') return state();
        var id = history.pop();
        placed = clonePlaced(placed);
        placed[id] = null;
        tool = byId[id].tool;
        if (phase === 'drive') {
          phase = 'build';
          resetRun();
        }
        return state();
      },
      confirmBuild: function () {
        if (loopClosed(placed)) {
          phase = 'drive';
          resetRun();
        }
        return state();
      },
      setKid: function (on) { kid = !!on; return state(); },
      setThrottle: function (v) {
        throttle = Math.max(0, Math.min(1, Number(v) || 0));
        if (!kid && phase === 'drive' && !run.endCard && !run.celebration) {
          run.cruise = CRUISE * throttle;
          run.stopping = throttle === 0;
          if (throttle > 0) run.stopping = false;
        }
        return state();
      },
      doors: function () {
        if (phase !== 'drive' || run.endCard) return state();
        run.nudgeDoors = false;
        if (run.speed >= 8) {
          run.doors = false;
          run.doorRejected = true;
          return state();
        }
        run.doorRejected = false;
        run.doors = !run.doors;
        tryBoard(run);
        return state();
      },
      go: function () {
        if (phase !== 'drive' || run.endCard || run.celebration) return state();
        run.nudgeDoors = false;
        if (kid && run.waiting > 0 && atHome(run) && !run.doors) {
          run.nudgeDoors = true;
          run.cruise = 0;
          return state();
        }
        tryBoard(run);
        if (kid) {
          run.cruise = CRUISE;
          run.stopping = false;
          if (run.boarded > 0 && !run.celebration) {
            run.armedStop = true;
            run.stopDist = FEST_DIST;
          } else {
            run.armedStop = false;
          }
        } else {
          run.cruise = CRUISE * throttle;
          run.stopping = throttle === 0;
        }
        return state();
      },
      stopAtStation: function () {
        if (phase !== 'drive' || run.endCard || run.celebration) return state();
        var targets = [HOME_DIST, FEST_DIST];
        var best = null;
        var bestD = Infinity;
        for (var i = 0; i < targets.length; i++) {
          var d = aheadDist(run.dist, targets[i]);
          if (d < STOP_RADIUS) continue;
          if (d < bestD) { bestD = d; best = targets[i]; }
        }
        if (best == null) best = nearDist(run.dist, FEST_DIST) ? HOME_DIST : FEST_DIST;
        run.stopDist = best;
        run.armedStop = true;
        run.stopping = false;
        if (run.cruise < CRUISE * 0.45) run.cruise = kid ? CRUISE * 0.75 : Math.max(CRUISE * throttle, CRUISE * 0.45);
        tryBoard(run);
        return state();
      },
      horn: function () {
        run.horn = 0.45;
        return state();
      },
      halt: function () {
        run.speed = 0;
        run.cruise = 0;
        run.armedStop = false;
        run.stopping = false;
        run.lights = 'stop';
        return state();
      },
      tick: function (dt) {
        if (phase !== 'drive') return state();
        tickRun(run, dt);
        return state();
      },
      rideAgain: function () {
        if (!loopClosed(placed)) return state();
        phase = 'drive';
        resetRun();
        return state();
      },
      pose: function (dist) { return pointAt(dist == null ? run.dist : dist); },
      carPoses: function (count, gap) {
        var out = [];
        var n = count || 3;
        var g = gap || 150;
        for (var i = 0; i < n; i++) out.push(pointAt(run.dist - i * g));
        return out;
      }
    };
  }

  function railPolylines(placed) {
    return TRAVEL.map(function (leg) {
      var slot = byId[leg.id];
      return {
        id: leg.id,
        type: slot.type,
        role: slot.role || null,
        tool: slot.tool,
        filled: !!(placed && placed[leg.id]),
        points: piecePoints(slot, leg.enter, leg.exit)
      };
    });
  }

  function inventory(placed) {
    var have = { straight: 2, curve: 4, station: 2 };
    SLOTS.forEach(function (s) { if (placed[s.id]) have[s.tool]--; });
    return have;
  }

  return {
    BOARD: BOARD,
    CELL: CELL,
    ORIGIN: ORIGIN,
    CAMERA: CAMERA,
    SLOTS: SLOTS,
    GUIDE: GUIDE,
    SCENERY: SCENERY,
    STYLES: STYLES,
    COLORS: COLORS,
    COLOR_HEX: COLOR_HEX,
    PATH_LENGTH: PATH.length,
    HOME_DIST: HOME_DIST,
    FEST_DIST: FEST_DIST,
    CELEBRATE: CELEBRATE,
    project: project,
    unproject: unproject,
    trackZ: trackZ,
    cameraProof: cameraProof,
    sceneryOnBoard: sceneryOnBoard,
    cellRect: cellRect,
    slotAt: slotAt,
    emptyPlaced: emptyPlaced,
    place: place,
    suggested: suggested,
    nextTool: nextTool,
    validSlots: validSlots,
    loopClosed: loopClosed,
    toGrid: toGrid,
    lap: lap,
    step: step,
    pointAt: pointAt,
    railPolylines: railPolylines,
    inventory: inventory,
    canBoard: canBoard,
    lightsFor: lightsFor,
    createSession: createSession,
    previewPose: function () {
      return {
        x: ORIGIN.x + CELL * 1.5,
        y: ORIGIN.y + CELL * 1.5,
        angle: 0.18
      };
    }
  };
});
