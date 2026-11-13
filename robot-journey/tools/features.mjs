// 1.1 checks (from the ChatGPT and family feedback): first-jump coaching and its reward gear, help after two falls
// (ghost robot + glowing ledge), the drag launch can't be repeated forever in mid-air, R restarts, the results screen
// adds up, gears by zone with a next goal, and Remix leaves no "Journey complete" text behind.
import { launch, baseUrl, record } from '../../tools/play/harness.mjs';
const p = await launch({ url: (await baseUrl()) + 'robot-journey/', w: 1280, h: 800, seed: 9 });
await p.ready('!!window.RobotJourney');
const failures = [];
const fail = (where, text) => { failures.push({ type: 'feature', where, text }); console.log('FAIL', where, text); };
const ok = (c, where, text) => { if (!c) fail(where, text); else console.log('ok  ', where); };
const st = () => p.eval('RobotJourney.ai.state()');
const coach = () => p.eval("document.getElementById('coach').hidden ? '' : document.getElementById('coach-text').textContent");
await p.eval("localStorage.removeItem('robot-journey:coached')");
await p.page.click('#launch-btn'); await p.sleep(900);
ok(/grab the gear/.test(await coach()), 'coach', 'the first tip should be "Jump to grab the gear!"');
const g0 = (await st()).gears.got;
await p.page.keyboard.down('Space'); await p.sleep(250);
ok(/again in the air/.test(await coach()), 'coach', 'after the first jump the tip should say to jump again in the air');
await p.page.keyboard.up('Space'); await p.sleep(60);
await p.page.keyboard.down('Space'); await p.sleep(450); await p.page.keyboard.up('Space');
ok(/Rocket boost/.test(await coach()), 'coach', 'a double jump should be cheered');
await p.sleep(900);
const g1 = (await st()).gears.got;
ok(g1 - g0 >= 2, 'coach', 'jump + double jump straight up should collect the start gear and the high reward gear (got ' + (g1 - g0) + ')');
// drag launch: once on the ground, once more in the air (using the boost), then no more
const rob = () => p.eval('(() => { const pl = RobotJourney.debug.player; return { x: pl.x, y: pl.y, vy: pl.vy, g: pl.grounded }; })()');
await p.sleep(800);
const drag = async (dx, dy) => { const c = await p.eval("(() => { const r = document.getElementById('gameCanvas').getBoundingClientRect(); return { x: r.width * 0.5, y: r.height * 0.5 }; })()"); await p.page.mouse.move(c.x, c.y); await p.page.mouse.down(); await p.page.mouse.move(c.x + dx / 2, c.y + dy / 2); await p.page.mouse.move(c.x + dx, c.y + dy); await p.page.mouse.up(); };
await drag(120, -160); await p.sleep(120);
const a1 = await rob(); ok(a1.vy < -5 && !a1.g, 'drag', 'a drag up-right from the ground should launch the robot');
await drag(60, -160); await p.sleep(60); const a2 = await rob();
ok(a2.vy < -8, 'drag', 'a second drag in mid-air should use the air boost');
await drag(60, -160); await p.sleep(60); const a3 = await rob();
ok(!(a3.vy < a2.vy - 3), 'drag', 'a third drag in mid-air should do nothing (no endless flying)');
// two falls at the first gap past checkpoint 1 -> ghost route + tip
await p.eval(`(() => { const pl = RobotJourney.debug.player; pl.x = 2000; pl.y = 300; pl.vx = 0; pl.vy = 0; })()`);
await p.sleep(1200);
for (let f = 0; f < 2; f++) {
  await p.page.keyboard.down('ArrowRight');
  for (let i = 0; i < 60; i++) { await p.sleep(50); const r = await rob(); if (r.x < 2060 && i > 6) break; }
  await p.page.keyboard.up('ArrowRight'); await p.sleep(1200);
}
await p.sleep(600);
const guide = await p.eval('RobotJourney.debug.guide');
ok(guide && guide.trace > 10 && guide.target >= 0, 'fall help', 'after two falls a ghost route to a glowing ledge should appear: ' + JSON.stringify(guide));
ok(/ghost robot/.test(await coach()), 'fall help', 'after two falls the tip should point at the ghost robot');
// R restarts
await p.page.keyboard.press('r'); await p.sleep(300);
const rs = await st(); ok(rs.robot.x < 300 && rs.gears.got <= 1, 'restart', 'R should restart from the beginning');
// finish with Turn-mode moves (fast), then check the results screen
const res = await p.eval(`(() => { const RJ = window.RobotJourney, D = RJ.debug; RJ.setTurnMode(true);
  for (let i = 0; i < 40 && D.gameState === 'PLAYING'; i++) { const h = RJ.ai.state().hint; const m = /press (?:([123]), then )?(.+?) \\(/.exec(h); if (m[1]) RJ.ai.act('power' + m[1]); RJ.ai.run({ '→ (or D)': 'right', '← (or A)': 'left', 'S': 'wait', 'E': 'jumpRight', 'Q': 'jumpLeft', 'Space': 'jumpUp' }[m[2]]); }
  return { hud: +document.getElementById('score-display').innerText, state: D.gameState }; })()`);
for (let i = 0; i < 90 && (await p.eval('RobotJourney.debug.gameState')) !== 'WIN'; i++) await p.sleep(100);
const win = await p.eval(`(() => ({ rows: [...document.querySelectorAll('#score-breakdown dd')].map((d) => +d.textContent.replace(/[^0-9]/g, '')),
  zones: document.querySelectorAll('#zone-gears > div').length, goal: document.getElementById('next-goal').textContent,
  best: document.getElementById('best-line').textContent, time: document.getElementById('final-time').textContent }))()`);
console.log(JSON.stringify(win), 'hud', res.hud);
ok(win.rows.length === 4 && win.rows[0] + win.rows[1] + win.rows[2] === win.rows[3], 'results', 'score rows should add up to the total');
ok(win.rows[0] === res.hud, 'results', 'the first row should equal the score shown in the top bar (' + res.hud + ')');
ok(win.zones === 3 && /gear|Every gear/.test(win.goal), 'results', 'gears by zone and a next goal should show');
ok(/best/i.test(win.best) && /^\d+:\d\d$/.test(win.time), 'results', 'time and personal best should show');
// Remix: no leftover finale text for screen readers
await p.page.click('text=REMIX LEVEL'); await p.sleep(400);
const ban = await p.eval("document.getElementById('cinematic-text').textContent.trim() + '|' + document.getElementById('cinematic-banner').getAttribute('aria-hidden')");
ok(ban === '|true', 'remix', 'Remix should clear the "Journey complete" text and hide the banner from screen readers: ' + ban);
failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
record({ game: 'robot-journey', scenario: 'features', browser: p.browserName, failures });
console.log('FEATURES', failures.length ? 'FAILED ' + JSON.stringify(failures) : 'OK');
process.exitCode = failures.length ? 1 : 0;
await p.close();
