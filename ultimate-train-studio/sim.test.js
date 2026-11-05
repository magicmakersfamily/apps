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

test('board all only counts people while the doors are open', function () {
  const closed = S.boardAll(1, [{}, {}], false);
  assert.equal(closed.count, 1);
  assert.equal(closed.boarded, 0);
  const open = S.boardAll(1, [{}, {}, {}], true);
  assert.equal(open.count, 4);
  assert.equal(open.waiting.length, 0);
});
