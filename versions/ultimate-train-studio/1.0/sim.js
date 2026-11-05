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
    grid[r0][stationCol] = { type: 'station', name: 'Central Station' };
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
      var next = tile && String(tile.type).indexOf('curve-') === 0 ? nextCurve(tile.type) : 'curve-tl';
      grid[row][col] = { type: next };
      return next;
    }
    if (tile && tile.type === tool) {
      grid[row][col] = null;
      return null;
    }
    var piece = { type: tool, state: 0 };
    if (tool === 'station') piece.name = 'Station';
    grid[row][col] = piece;
    return tool;
  }

  function toggleSwitch(tile) {
    if (tile && tile.type === 'switch') tile.state = tile.state ? 0 : 1;
    return tile;
  }

  function boardAll(count, waiting, doorsOpen) {
    if (!doorsOpen) return { count: count, waiting: waiting, boarded: 0, doorsOpen: false };
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
    LINKS: LINKS,
    CURVES: CURVES,
    exitDir: exitDir,
    step: step,
    emptyGrid: emptyGrid,
    buildLoop: buildLoop,
    nextCurve: nextCurve,
    placePiece: placePiece,
    toggleSwitch: toggleSwitch,
    boardAll: boardAll,
    lap: lap
  };
});
