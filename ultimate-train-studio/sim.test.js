/* Track model. Run with `node --test`. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./sim.js');

test('preset loop is one closed lap with no reverse', function () {
  const built = S.buildLoop(14, 9);
  const lap = S.lap(built.grid, built.start.col, built.start.row, 'E');
  assert.equal(lap.reversed, false);
  assert.equal(lap.closed, true);
  assert.equal(lap.steps, built.perimeter);
});

test('the same loop also closes counterclockwise', function () {
  const built = S.buildLoop(14, 9);
  const lap = S.lap(built.grid, built.start.col, built.start.row, 'W');
  assert.equal(lap.reversed, false);
  assert.equal(lap.closed, true);
  assert.equal(lap.steps, built.perimeter);
});

test('a dead end turns the train around on the same tile', function () {
  const grid = S.emptyGrid(5, 5);
  grid[2][2] = { type: 'straight-h' };
  const n = S.step(grid, 2, 2, 'E', {});
  assert.equal(n.event, 'reverse');
  assert.equal(n.col, 2);
  assert.equal(n.row, 2);
  assert.equal(n.dir, 'W');
});

test('a thrown switch sends the train up the siding and back the way it came', function () {
  const built = S.buildLoop(14, 9);
  let sw = null;
  for (let r = 0; r < built.rows; r++) {
    for (let c = 0; c < built.cols; c++) {
      if (built.grid[r][c] && built.grid[r][c].type === 'switch') sw = { c: c, r: r, tile: built.grid[r][c] };
    }
  }
  assert.ok(sw);
  sw.tile.state = 1;
  const mem = {};
  const onto = S.step(built.grid, sw.c + 1, sw.r, 'W', mem);
  assert.equal(onto.col, sw.c);
  assert.equal(onto.row, sw.r);
  assert.equal(onto.dir, 'N');
  assert.equal(mem.rejoin, 'W');
  let col = onto.col, row = onto.row, dir = onto.dir;
  let back = null;
  for (let i = 0; i < 12; i++) {
    const n = S.step(built.grid, col, row, dir, mem);
    if (n.event === 'reverse') { dir = n.dir; continue; }
    col = n.col; row = n.row; dir = n.dir;
    if (col === sw.c && row === sw.r && dir === 'W') { back = n; break; }
  }
  assert.ok(back, 'train should rejoin the main line going west');
  const straight = S.step(built.grid, sw.c, sw.r, 'W', mem);
  assert.equal(straight.dir, 'W');
  assert.equal(straight.row, sw.r);
});

test('a straight switch stays on the main line', function () {
  const built = S.buildLoop(14, 9);
  const lap = S.lap(built.grid, built.start.col, built.start.row, 'E');
  assert.equal(lap.steps, built.perimeter);
});

test('speed tile reports a speed event and still connects', function () {
  const grid = S.emptyGrid(4, 3);
  grid[1][1] = { type: 'straight-h' };
  grid[1][2] = { type: 'speed' };
  const n = S.step(grid, 1, 1, 'E', {});
  assert.equal(n.event, 'speed');
  assert.equal(n.col, 2);
  assert.equal(n.dir, 'E');
});

test('curve tool cycles corners, and the same piece erases', function () {
  const grid = S.emptyGrid(3, 3);
  assert.equal(S.placePiece(grid, 1, 1, 'curve-1'), 'curve-tl');
  assert.equal(S.placePiece(grid, 1, 1, 'curve-1'), 'curve-tr');
  assert.equal(S.placePiece(grid, 1, 1, 'curve-1'), 'curve-br');
  assert.equal(S.placePiece(grid, 1, 1, 'curve-1'), 'curve-bl');
  assert.equal(S.placePiece(grid, 1, 1, 'station'), 'station');
  assert.equal(S.placePiece(grid, 1, 1, 'station'), null);
  assert.equal(grid[1][1], null);
});

test('boarding waits until the train is stopped at the station', function () {
  const moving = S.boardAll(0, [{}, {}, {}, {}], true, true, 120);
  assert.equal(moving.boarded, 0);
  assert.equal(moving.count, 0);
  assert.equal(moving.waiting.length, 4);
  const away = S.boardAll(0, [{}, {}], true, false, 0);
  assert.equal(away.boarded, 0);
  assert.equal(away.waiting.length, 2);
  const shut = S.boardAll(1, [{}, {}], false, true, 0);
  assert.equal(shut.count, 1);
  assert.equal(shut.boarded, 0);
  const stopped = S.boardAll(0, [{}, {}, {}, {}], true, true, 0);
  assert.equal(stopped.boarded, 4);
  assert.equal(stopped.count, 4);
  assert.equal(stopped.waiting.length, 0);
  assert.equal(S.canBoard(true, true, 120), false);
  assert.equal(S.canBoard(true, true, 0), true);
});

test('the lantern festival is one missing curve away from the hill', function () {
  const built = S.buildFestival();
  const gap = S.firstGap(built.grid);
  assert.ok(gap);
  assert.equal(gap.col, built.gap.col);
  assert.equal(gap.row, built.gap.row);
  assert.equal(gap.type, 'curve-tr');
  assert.equal(S.obviousCurve(built.grid, gap.row, gap.col), 'curve-tr');
  assert.equal(S.gaps(built.grid).length, 1);
  assert.equal(S.reaches(built.grid, built.start.col, built.start.row, 'E', built.festival.col, built.festival.row), false);
  const ends = S.openEnds(built.grid);
  assert.ok(ends.some(function (end) { return end.col === 5 && end.row === 1 && end.dir === 'E'; }));
  assert.ok(ends.some(function (end) { return end.col === 6 && end.row === 2 && end.dir === 'N'; }));
  assert.equal(S.placePiece(built.grid, gap.row, gap.col, 'curve-1'), 'curve-tr');
  assert.equal(S.firstGap(built.grid), null);
  assert.equal(S.reaches(built.grid, built.start.col, built.start.row, 'E', built.pickup.col, built.pickup.row), true);
  assert.equal(S.reaches(built.grid, built.start.col, built.start.row, 'E', built.festival.col, built.festival.row), true);
  const stop = S.nextStation(built.grid, built.start.col, built.start.row, 'E', function (tile) {
    return tile.role !== 'festival';
  });
  assert.equal(stop.col, built.pickup.col);
  assert.equal(stop.row, built.pickup.row);
  const fest = S.nextStation(built.grid, built.pickup.col, built.pickup.row, 'W', function (tile) {
    return tile.role === 'festival';
  });
  assert.equal(fest.col, built.festival.col);
  assert.equal(fest.row, built.festival.row);
});

test('a loose curve in open space still places when nothing asks for it', function () {
  const grid = S.emptyGrid(5, 5);
  assert.equal(S.obviousCurve(grid, 2, 2), null);
  assert.equal(S.placePiece(grid, 2, 2, 'curve-1'), 'curve-tl');
  assert.equal(S.firstGap(grid), null);
});

test('the preset loop has no hole between two open ends', function () {
  const built = S.buildLoop(14, 9);
  assert.equal(S.firstGap(built.grid), null);
  assert.equal(S.obviousCurve(built.grid, 0, 0), null);
});
