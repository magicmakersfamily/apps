/* Tabletop loop. Run with `node --test`. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('./sim.js');

test('the camera looks down at a board, and the track is not in the sky', function () {
  const proof = S.cameraProof();
  assert.equal(proof.camera, 'tabletop-three-quarter');
  assert.equal(proof.threeQuarter, true);
  assert.equal(proof.frontLowerThanBack, true);
  assert.equal(proof.heightGoesUp, true);
  assert.equal(proof.boardHasWidth, true);
  assert.equal(proof.trackOnBoard, true);
  assert.equal(proof.boardThick, true);
  assert.equal(proof.skyFloat, false);
  assert.equal(S.trackZ(), S.BOARD.thick);
  assert.equal(S.sceneryOnBoard(), true);
});

test('a board point projects and unprojects back to itself', function () {
  const z = S.trackZ();
  const samples = [[40, 40], [900, 200], [1400, 1100], [220, 320]];
  for (const [x, y] of samples) {
    const p = S.project(x, y, z);
    const back = S.unproject(p.x, p.y, z);
    assert.ok(Math.abs(back.x - x) < 0.01, 'x ' + x);
    assert.ok(Math.abs(back.y - y) < 0.01, 'y ' + y);
  }
});

test('clockwise travel along the home straight moves west', function () {
  const a = S.pointAt(S.HOME_DIST);
  const b = S.pointAt(S.HOME_DIST + 24);
  assert.ok(b.x < a.x - 10, 'home straight heads west, clockwise');
});

test('the guided eight pieces close one loop and the other way around too', function () {
  let placed = S.emptyPlaced();
  assert.equal(S.loopClosed(placed), false);
  assert.equal(S.nextTool(placed), 'station');
  assert.equal(S.place(placed, 'nw', 'straight').ok, false);
  let guard = 0;
  while (!S.loopClosed(placed) && guard++ < 10) {
    const tool = S.nextTool(placed);
    const id = S.suggested(placed, tool);
    assert.ok(id, 'a slot for ' + tool);
    const res = S.place(placed, id, tool);
    assert.equal(res.ok, true);
    placed = res.placed;
  }
  assert.equal(S.loopClosed(placed), true);
  assert.equal(guard, 8);
  const grid = S.toGrid(placed);
  const cw = S.lap(grid, 1, 2, 'W');
  const ccw = S.lap(grid, 1, 2, 'E');
  assert.equal(cw.closed, true);
  assert.equal(cw.reversed, false);
  assert.equal(cw.steps, 8);
  assert.equal(ccw.closed, true);
  assert.equal(ccw.reversed, false);
  assert.equal(ccw.steps, 8);
  const home = S.cellRect(S.SLOTS.find((s) => s.id === 'home'));
  const hit = S.slotAt(home.x + home.w / 2, home.y + home.h / 2);
  assert.equal(hit.id, 'home');
});

test('undo lifts the last piece and opens the loop', function () {
  const session = S.createSession();
  session.confirmPaint();
  while (!session.state().loop) {
    assert.equal(session.placeSuggested().ok, true);
  }
  assert.equal(session.state().loop, true);
  session.undo();
  assert.equal(session.state().loop, false);
  assert.equal(session.state().placedCount, 7);
  session.placeSuggested();
  assert.equal(session.state().loop, true);
});

test('boarding waits until the train is stopped at home with the doors open', function () {
  assert.equal(S.canBoard(true, true, 0), true);
  assert.equal(S.canBoard(true, true, 40), false);
  assert.equal(S.canBoard(false, true, 0), false);
  assert.equal(S.canBoard(true, false, 0), false);
});

test('lights are go, slow, and stop — never a speed number', function () {
  assert.equal(S.lightsFor(0, false), 'stop');
  assert.equal(S.lightsFor(40, false), 'slow');
  assert.equal(S.lightsFor(260, false), 'go');
  assert.equal(S.lightsFor(260, true), 'slow');
  for (const speed of [0, 12, 100, 260]) {
    const name = S.lightsFor(speed, false);
    assert.equal(typeof name, 'string');
    assert.equal(/\d/.test(name), false);
  }
});

function buildDrive() {
  const session = S.createSession();
  session.paint('bullet', 'rainbow');
  session.confirmPaint();
  assert.equal(session.state().phase, 'build');
  assert.equal(session.state().style, 'bullet');
  assert.equal(session.state().color, 'rainbow');
  let guard = 0;
  while (!session.state().loop && guard++ < 10) {
    session.setTool(session.nextTool());
    assert.equal(session.placeSuggested().ok, true);
  }
  session.confirmBuild();
  assert.equal(session.state().phase, 'drive');
  assert.equal(session.state().loop, true);
  return session;
}

test('doors while moving stay shut', function () {
  const session = buildDrive();
  session.doors();
  assert.equal(session.state().boarded, 4);
  assert.equal(session.state().waiting, 0);
  session.go();
  let guard = 0;
  while (session.state().speed < 20 && guard++ < 40) session.tick(0.1);
  assert.ok(session.state().speed >= 20);
  session.doors();
  assert.equal(session.state().doors, false);
  assert.equal(session.state().doorRejected, true);
  assert.equal(session.state().boarded, 4);
});

test('paint, a chunky loop, then a festival stop celebrates before the end card', function () {
  const session = buildDrive();
  session.doors();
  assert.equal(session.state().waiting, 0);
  session.stopAtStation();
  let guard = 0;
  while (!session.state().celebration && guard++ < 500) session.tick(0.1);
  assert.equal(session.state().celebration, true, 'in-world celebration');
  assert.equal(session.state().endCard, false, 'the card waits');
  assert.ok(session.state().alight < 1);
  guard = 0;
  while (!session.state().endCard && guard++ < 40) session.tick(0.1);
  assert.equal(session.state().endCard, true);
  assert.equal(session.state().celebration, true);
  assert.equal(session.state().alight, 1);
  session.rideAgain();
  const again = session.state();
  assert.equal(again.endCard, false);
  assert.equal(again.celebration, false);
  assert.equal(again.loop, true);
  assert.equal(again.phase, 'drive');
  assert.equal(again.waiting, 4);
  assert.equal(again.boarded, 0);
  assert.equal(again.lights, 'stop');
});

test('kid GO with friends aboard also reaches the festival', function () {
  const session = buildDrive();
  session.go();
  assert.equal(session.state().nudgeDoors, true);
  assert.ok(session.state().speed < 1);
  session.doors();
  session.go();
  let guard = 0;
  while (!session.state().celebration && guard++ < 500) session.tick(0.1);
  assert.equal(session.state().celebration, true);
  assert.equal(session.state().endCard, false);
});

test('an empty arrival does not throw the end card', function () {
  const session = buildDrive();
  session.stopAtStation();
  let guard = 0;
  while (session.state().speed > 0 || guard < 5) {
    session.tick(0.1);
    if (session.state().speed === 0 && guard > 8) break;
    if (++guard > 500) break;
  }
  assert.equal(session.state().celebration, false);
  assert.equal(session.state().endCard, false);
  assert.equal(session.state().boarded, 0);
});
