/* Track rules for Ultimate Train Studio.
   The page draws and plays sound. This file only decides where the train may go.
   Works in the browser (global TrainSim) and in node --test (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.TrainSim = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var VEC = { E: [1, 0], S: [0, 1], W: [-1, 0], N: [0, -1] };
  var OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };
  var ANGLE = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 };
  var DIRS = ['E', 'S', 'W', 'N'];
  /* Each curve is one corner of a rectangle, named from the outside.
     curve-tl links east and south, curve-tr west and south,
     curve-br north and west, curve-bl east and north.
     A clockwise loop (east along the top) and a counterclockwise loop both fit. */
  var LINKS = {
    'straight-h': [['E', 'W']],
    'straight-v': [['N', 'S']],
    station: [['E', 'W']],
    speed: [['E', 'W']],
    'curve-tl': [['E', 'S']],
    'curve-tr': [['W', 'S']],
    'curve-br': [['N', 'W']],
    'curve-bl': [['E', 'N']]
  };
  var CURVES = ['curve-tl', 'curve-tr', 'curve-br', 'curve-bl'];

  function tileLinks(tile) {
    if (!tile) return [];
    if (tile.type === 'switch') {
      var dirs = ['E', 'W'];
      if (tile.state) dirs.push('N');
      return dirs;
    }
    var pairs = LINKS[tile.type];
    if (!pairs) return [];
    return pairs[0].slice();
  }

  function exitDir(tile, dir, mem) {
    if (!tile) return null;
    if (tile.type === 'switch') {
      if (dir === 'S') {
        if (!tile.state) return null;
        return (mem && mem.rejoin) || 'W';
      }
      if (dir === 'N') return null;
      if (tile.state && (dir === 'E' || dir === 'W')) return 'N';
      if (dir === 'E' || dir === 'W') return dir;
      return null;
    }
    var pairs = LINKS[tile.type];
    if (!pairs) return null;
    var from = OPP[dir];
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i][0], b = pairs[i][1];
      if (a === from) return b;
      if (b === from) return a;
    }
    return null;
  }

  function step(grid, col, row, dir, mem) {
    mem = mem || {};
    var dc = VEC[dir][0], dr = VEC[dir][1];
    var nc = col + dc, nr = row + dr;
    var rows = grid.length, cols = grid[0].length;
    if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) {
      return { col: col, row: row, dir: OPP[dir], event: 'reverse', tile: grid[row][col], mem: mem };
    }
    var tile = grid[nr][nc];
    var next = exitDir(tile, dir, mem);
    if (next == null) {
      return { col: col, row: row, dir: OPP[dir], event: 'reverse', tile: grid[row][col], mem: mem };
    }
    var event = null;
    if (tile.type === 'speed') event = 'speed';
    else if (tile.type === 'station') event = 'station';
    else if (tile.type === 'switch' && tile.state && next === 'N' && dir !== 'S') event = 'switch';
    if (tile.type === 'switch' && tile.state && (dir === 'E' || dir === 'W') && next === 'N') mem.rejoin = dir;
    return { col: nc, row: nr, dir: next, event: event, tile: tile, mem: mem };
  }

  function emptyGrid(cols, rows) {
    var grid = [];
    for (var r = 0; r < rows; r++) {
      var row = [];
      for (var c = 0; c < cols; c++) row.push(null);
      grid.push(row);
    }
    return grid;
  }

  function buildLoop(cols, rows) {
    cols = cols || 14;
    rows = rows || 9;
    var grid = emptyGrid(cols, rows);
    var width = 10, height = 6;
    var c0 = Math.max(0, Math.floor((cols - width) / 2));
    var r0 = Math.max(0, Math.floor((rows - height) / 2));
    var c1 = c0 + width - 1;
    var r1 = r0 + height - 1;
    var c, r;
    for (c = c0; c <= c1; c++) {
      grid[r0][c] = { type: 'straight-h' };
      grid[r1][c] = { type: 'straight-h' };
    }
    for (r = r0; r <= r1; r++) {
      grid[r][c0] = { type: 'straight-v' };
      grid[r][c1] = { type: 'straight-v' };
    }
    grid[r0][c0] = { type: 'curve-tl' };
    grid[r0][c1] = { type: 'curve-tr' };
    grid[r1][c0] = { type: 'curve-bl' };
    grid[r1][c1] = { type: 'curve-br' };
    var stationCol = c0 + 4;
    grid[r0][stationCol] = { type: 'station', name: 'Central Station', role: 'stop' };
    var sw = c0 + 6;
    grid[r1][sw] = { type: 'switch', state: 0 };
    grid[r1][Math.min(c1 - 1, sw + 2)] = { type: 'speed' };
    if (r1 - 1 > r0) grid[r1 - 1][sw] = { type: 'straight-v' };
    if (r1 - 2 > r0) grid[r1 - 2][sw] = { type: 'straight-v' };
    return {
      grid: grid,
      cols: cols,
      rows: rows,
      start: { col: stationCol, row: r0 },
      dir: 'E',
      station: { col: stationCol, row: r0 },
      perimeter: 2 * (width + height - 2)
    };
  }

  /* Last Train to the Lantern Festival.
     A short hillside line. One curve is missing so the hill does not connect.
     Travel east along the top, turn down, pick up at the lantern stop, then
     down again to the festival station, which is a dead end. */
  function buildFestival(cols, rows) {
    cols = cols || 14;
    rows = rows || 9;
    var grid = emptyGrid(cols, rows);
    var put = function (c, r, type, extra) {
      var piece = { type: type, state: 0 };
      if (extra) {
        if (extra.name) piece.name = extra.name;
        if (extra.role) piece.role = extra.role;
        if (extra.lanterns) piece.lanterns = true;
      }
      grid[r][c] = piece;
    };
    put(3, 1, 'straight-h');
    put(4, 1, 'straight-h');
    put(5, 1, 'straight-h');
    put(6, 2, 'straight-v');
    put(6, 3, 'curve-br');
    put(5, 3, 'straight-h');
    put(4, 3, 'station', { name: 'Lantern Stop', role: 'stop', lanterns: true });
    put(3, 3, 'curve-tl');
    put(3, 4, 'straight-v');
    put(3, 5, 'curve-bl');
    put(4, 5, 'straight-h');
    put(5, 5, 'station', { name: 'Lantern Festival', role: 'festival', lanterns: true });
    return {
      grid: grid,
      cols: cols,
      rows: rows,
      start: { col: 3, row: 1 },
      dir: 'E',
      pickup: { col: 4, row: 3 },
      festival: { col: 5, row: 5 },
      gap: { col: 6, row: 1 },
      fit: 'curve-tr'
    };
  }

  function wantedDirs(grid, row, col) {
    var need = [];
    var block = [];
    for (var i = 0; i < DIRS.length; i++) {
      var dir = DIRS[i];
      var nc = col + VEC[dir][0], nr = row + VEC[dir][1];
      if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) continue;
      var neighbor = grid[nr][nc];
      if (!neighbor) continue;
      if (tileLinks(neighbor).indexOf(OPP[dir]) >= 0) need.push(dir);
      else block.push(dir);
    }
    return { need: need, block: block };
  }

  function obviousCurve(grid, row, col) {
    if (row < 0 || col < 0 || row >= grid.length || col >= grid[0].length) return null;
    var w = wantedDirs(grid, row, col);
    if (!w.need.length) return null;
    var hits = [];
    for (var i = 0; i < CURVES.length; i++) {
      var type = CURVES[i];
      var links = LINKS[type][0];
      var ok = true;
      var k;
      for (k = 0; k < w.need.length; k++) if (links.indexOf(w.need[k]) < 0) ok = false;
      for (k = 0; k < w.block.length; k++) if (links.indexOf(w.block[k]) >= 0) ok = false;
      if (w.need.length >= 2) {
        if (w.need.length !== 2) ok = false;
        else for (k = 0; k < links.length; k++) if (w.need.indexOf(links[k]) < 0) ok = false;
      }
      if (ok) hits.push(type);
    }
    return hits.length === 1 ? hits[0] : null;
  }

  function gaps(grid) {
    var out = [];
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[0].length; c++) {
        if (grid[r][c]) continue;
        var w = wantedDirs(grid, r, c);
        if (w.need.length >= 2) out.push({ col: c, row: r, need: w.need.slice(), type: obviousCurve(grid, r, c) });
      }
    }
    return out;
  }

  function firstGap(grid) {
    var list = gaps(grid);
    return list.length ? list[0] : null;
  }

  function openEnds(grid) {
    var out = [];
    for (var r = 0; r < grid.length; r++) {
      for (var c = 0; c < grid[0].length; c++) {
        var tile = grid[r][c];
        if (!tile) continue;
        var links = tileLinks(tile);
        for (var i = 0; i < links.length; i++) {
          var dir = links[i];
          var nc = c + VEC[dir][0], nr = r + VEC[dir][1];
          var neighbor = null;
          if (nr >= 0 && nc >= 0 && nr < grid.length && nc < grid[0].length) neighbor = grid[nr][nc];
          if (tileLinks(neighbor).indexOf(OPP[dir]) < 0) out.push({ col: c, row: r, dir: dir });
        }
      }
    }
    return out;
  }

  function seenKey(col, row, dir) {
    return col + ',' + row + ',' + dir;
  }

  function reaches(grid, col, row, dir, targetCol, targetRow) {
    if (col === targetCol && row === targetRow) return true;
    var mem = {};
    var seen = {};
    var guard = 0;
    while (guard++ < 160) {
      var n = step(grid, col, row, dir, mem);
      if (n.event === 'reverse') return false;
      col = n.col;
      row = n.row;
      dir = n.dir;
      if (col === targetCol && row === targetRow) return true;
      var key = seenKey(col, row, dir);
      if (seen[key]) return false;
      seen[key] = 1;
    }
    return false;
  }

  function firstHole(grid, col, row, dir) {
    var mem = {};
    var seen = {};
    var guard = 0;
    while (guard++ < 160) {
      var nc = col + VEC[dir][0];
      var nr = row + VEC[dir][1];
      var n = step(grid, col, row, dir, mem);
      if (n.event === 'reverse') return { col: nc, row: nr, atCol: col, atRow: row, dir: dir };
      col = n.col;
      row = n.row;
      dir = n.dir;
      var key = seenKey(col, row, dir);
      if (seen[key]) return null;
      seen[key] = 1;
    }
    return null;
  }

  function nextStation(grid, col, row, dir, pred) {
    var mem = {};
    var seen = {};
    var guard = 0;
    function ok(tile, c, r) {
      return !!(tile && tile.type === 'station' && (!pred || pred(tile, c, r)));
    }
    if (grid[row] && ok(grid[row][col], col, row)) return { col: col, row: row, dir: dir };
    while (guard++ < 160) {
      var n = step(grid, col, row, dir, mem);
      if (n.event === 'reverse') return null;
      col = n.col;
      row = n.row;
      dir = n.dir;
      var key = seenKey(col, row, dir);
      if (seen[key]) return null;
      seen[key] = 1;
      if (ok(n.tile, col, row)) return { col: col, row: row, dir: dir };
    }
    return null;
  }

  function nextCurve(type) {
    var i = CURVES.indexOf(type);
    return CURVES[(i < 0 ? 0 : i + 1) % CURVES.length];
  }

  function placePiece(grid, row, col, tool) {
    if (row < 0 || col < 0 || row >= grid.length || col >= grid[0].length) return null;
    var tile = grid[row][col];
    if (tool === 'erase') {
      grid[row][col] = null;
      return null;
    }
    if (tool === 'curve-1') {
      var fit = obviousCurve(grid, row, col);
      if (!tile) {
        var born = fit || 'curve-tl';
        grid[row][col] = { type: born };
        return born;
      }
      if (String(tile.type).indexOf('curve-') === 0) {
        if (fit && tile.type !== fit) {
          grid[row][col] = { type: fit };
          return fit;
        }
        var turned = nextCurve(tile.type);
        grid[row][col] = { type: turned };
        return turned;
      }
      var placed = fit || 'curve-tl';
      grid[row][col] = { type: placed };
      return placed;
    }
    if (tile && tile.type === tool) {
      grid[row][col] = null;
      return null;
    }
    var piece = { type: tool, state: 0 };
    if (tool === 'station') {
      piece.name = 'Station';
      piece.role = 'stop';
    }
    grid[row][col] = piece;
    return tool;
  }

  function toggleSwitch(tile) {
    if (tile && tile.type === 'switch') tile.state = tile.state ? 0 : 1;
    return tile;
  }

  /* Doors and boarding count only when the train is stopped at a station.
     A moving train, even with the doors flagged open, boards nobody. */
  function canBoard(doorsOpen, atStation, speed) {
    return !!doorsOpen && !!atStation && typeof speed === 'number' && speed < 1;
  }

  function boardAll(count, waiting, doorsOpen, atStation, speed) {
    if (!canBoard(doorsOpen, atStation, speed)) {
      return { count: count, waiting: waiting, boarded: 0, doorsOpen: !!doorsOpen };
    }
    return { count: count + waiting.length, waiting: [], boarded: waiting.length, doorsOpen: true };
  }

  function lap(grid, col, row, dir) {
    var mem = {};
    var seen = 0;
    var startC = col, startR = row, startD = dir;
    var guard = 0;
    var reversed = false;
    while (guard++ < 400) {
      var n = step(grid, col, row, dir, mem);
      if (n.event === 'reverse') { reversed = true; break; }
      col = n.col; row = n.row; dir = n.dir;
      seen++;
      if (col === startC && row === startR && dir === startD) break;
    }
    return { steps: seen, col: col, row: row, dir: dir, reversed: reversed, closed: col === startC && row === startR && dir === startD };
  }

  return {
    VEC: VEC,
    OPP: OPP,
    ANGLE: ANGLE,
    DIRS: DIRS,
    LINKS: LINKS,
    CURVES: CURVES,
    exitDir: exitDir,
    step: step,
    emptyGrid: emptyGrid,
    buildLoop: buildLoop,
    buildFestival: buildFestival,
    tileLinks: tileLinks,
    obviousCurve: obviousCurve,
    gaps: gaps,
    firstGap: firstGap,
    openEnds: openEnds,
    reaches: reaches,
    firstHole: firstHole,
    nextStation: nextStation,
    nextCurve: nextCurve,
    placePiece: placePiece,
    toggleSwitch: toggleSwitch,
    canBoard: canBoard,
    boardAll: boardAll,
    lap: lap
  };
});
