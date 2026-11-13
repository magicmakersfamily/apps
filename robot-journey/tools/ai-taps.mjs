// Plays the way AI browser helpers (ChatGPT agent, Claude in Chrome, Gemini) do: brief key taps that carry only e.key
// (no e.code), mouse clicks on buttons, and reading the page text between moves. Checks:
//  1. Launch with a click; a machine tap of → (keydown+keyup at once) still moves the robot in normal mode.
//  2. A machine tap of Space still gives a full jump (not a tiny hop).
//  3. Turn mode from the start screen; the text box describes the scene; the world stays frozen between moves.
//  4. Only "3" then "e" taps (rocket jump right), reading #ai-panel text, reaches the Bright Spot.
//  5. The on-screen Turn-mode buttons work with clicks.
import { launch, baseUrl, record } from '../../tools/play/harness.mjs';
const p = await launch({ url: (await baseUrl()) + 'robot-journey/', w: 1280, h: 800, seed: 3 });
await p.ready('!!window.RobotJourney');
const failures = [];
const fail = (where, text) => { failures.push({ type: 'input', where, text }); console.log('FAIL', where, text); };
const center = (sel) => p.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
const click = async (sel) => { const c = await center(sel); await p.click(c.x, c.y); };
const tapKey = (k) => p.eval(`(() => { const o = { key: ${JSON.stringify(k)}, bubbles: true }; window.dispatchEvent(new KeyboardEvent('keydown', o)); window.dispatchEvent(new KeyboardEvent('keyup', o)); })()`);
const st = () => p.eval('RobotJourney.ai.state()');

// 1-2: normal (real-time) mode
await click('#launch-btn'); await p.sleep(1200);
let a = await st(); await tapKey('ArrowRight'); await p.sleep(600); let b = await st();
console.log('machine tap → in real time moved', b.robot.x - a.robot.x, 'px');
if (!(b.robot.x - a.robot.x >= 15)) fail('real-time', 'a key tap without e.code did not move the robot');
await click('#btn-right'); await p.sleep(600); const c1 = await st();
console.log('click on ▶ button moved', c1.robot.x - b.robot.x, 'px');
if (!(c1.robot.x - b.robot.x >= 15)) fail('real-time', 'clicking the on-screen right button did not move the robot');
let top = 0; await tapKey(' ');
for (let i = 0; i < 30; i++) { await p.sleep(25); top = Math.max(top, (await st()).robot.feet); }
console.log('machine tap Space jumped', top, 'high');
if (!(top >= 110)) fail('real-time', 'a Space tap without e.code gave only a small hop (' + top + ')');

// 3: back to the start screen, enter Turn mode the way an AI would find it
await p.goto((await baseUrl()) + 'robot-journey/'); await p.ready('!!window.RobotJourney');
const guide = await p.eval("document.getElementById('ai-guide').innerText");
if (!/Turn mode/.test(guide) || !/jump right/i.test(guide)) fail('guide', 'the hidden how-to-play text for AI helpers is missing');
await click('#launch-turn-btn'); await p.sleep(800);
const short = await p.eval("document.getElementById('ai-short').innerText");
console.log('short hint:', short);
if (!/^💡 (Try|Take|Wait)/.test(short)) fail('text view', 'no short kid-friendly hint: ' + short);
await click('#show-me'); await p.sleep(300);
if (!(await p.eval("document.querySelectorAll('#turn-pad .pulse-hl').length >= 1"))) fail('show me', 'Show me did not light up a move button');
const ghost = await p.eval('RobotJourney.debug.guide');
if (!ghost || !(ghost.trace > 10)) fail('show me', 'Show me did not draw a ghost route: ' + JSON.stringify(ghost));
// an AI helper opens the full readout with "Show details"
await click('#ai-hide'); await p.sleep(300);
let text = await p.eval("document.getElementById('ai-panel').innerText");
console.log('--- first text view ---\n' + text + '\n---');
for (const want of ['Robot: x', 'standing on the floor', 'hover-drone', 'Hint', 'Bright Spot portal', 'Moves:']) if (!text.includes(want)) fail('text view', 'the text view does not mention "' + want + '"');
a = await st(); await p.sleep(1500); b = await st();
if (a.robot.x !== b.robot.x || JSON.stringify(a.nearby) !== JSON.stringify(b.nearby)) fail('turn mode', 'the world moved while waiting for a move');

// 4a: a careless helper that only ever taps 3 then E (rocket jump right) — design data, not a failure
await tapKey('3');
let spam = 0, spamText = '';
while (spam < 40) {
  await tapKey('e'); spam++;
  for (let i = 0; i < 100 && (await p.eval('RobotJourney.ai.busy()')); i++) await p.sleep(50);
  spamText = await p.eval("document.getElementById('ai-panel').innerText");
  if (/You reached the Bright Spot|You won/.test(spamText)) break;
}
console.log('only 3+E taps:', spam, 'moves →', spamText.split('\n')[0]);
// 4b: a helper that reads the Hint line and taps the keys it names, reaching the Bright Spot
await p.goto((await baseUrl()) + 'robot-journey/?ai=1'); await p.ready('!!window.RobotJourney');
await click('#launch-btn'); await p.sleep(800);
const KEY = { '→ (or D)': 'ArrowRight', '← (or A)': 'ArrowLeft', 'S': 's', 'E': 'e', 'Q': 'q', 'Space': ' ' };
let turns = 0, falls = 0;
while (turns < 80) {
  text = await p.eval("document.getElementById('ai-panel').innerText");
  if (/You reached the Bright Spot|You won/.test(text)) break;
  if (/fell into a gap/.test(text.split('\n')[1] || '')) falls++;
  const m = /Hint[^:]*: press (?:([123]), then )?(.+?) \(/.exec(text);
  if (!m) { fail('text view', 'no Hint line on turn ' + turns + ':\n' + text); break; }
  if (m[1]) await tapKey(m[1]);
  await tapKey(KEY[m[2]]); turns++;
  for (let i = 0; i < 100 && (await p.eval('RobotJourney.ai.busy()')); i++) await p.sleep(50);
  await p.sleep(80);
}
console.log('following the Hint line:', turns, 'moves,', falls, 'falls →', text.split('\n')[0]);
if (!/You reached the Bright Spot|You won/.test(text)) fail('turn mode', 'following the Hint line did not reach the Bright Spot in 80 moves');

// 5: Turn-mode buttons by click
await p.goto((await baseUrl()) + 'robot-journey/?ai=1'); await p.ready('!!window.RobotJourney');
await click('#launch-btn'); await p.sleep(800);
a = await st();
await click('#turn-pad [data-act="power1"]');
if ((await st()).jumpSize !== 1) fail('buttons', 'the 1 Hop button did not pick jump size 1');
const pressed = await p.eval(`document.querySelector('#turn-pad [data-act="power1"]').getAttribute('aria-pressed')`);
if (pressed !== 'true') fail('buttons', 'the selected jump size is not shown as pressed');
await click('#turn-pad [data-act="jumpRight"]');
for (let i = 0; i < 100 && (await p.eval('RobotJourney.ai.busy()')); i++) await p.sleep(50);
b = await st();
console.log('Jump right ↗ button click moved', b.robot.x - a.robot.x, 'px');
if (!(b.robot.x - a.robot.x > 100)) fail('buttons', 'the Jump right button did not jump right');
if (!(await p.eval("document.getElementById('move-pad').hidden"))) fail('buttons', 'the hold-down ◀ ▶ buttons still show in Turn mode');
await click('#turn-pad [data-act="right"]');
for (let i = 0; i < 100 && (await p.eval('RobotJourney.ai.busy()')); i++) await p.sleep(50);
const c = await st();
if (!(c.robot.x > b.robot.x)) fail('buttons', 'the Step ▶ button did not step right in Turn mode');

failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
record({ game: 'robot-journey', scenario: 'ai-taps', browser: p.browserName, turns, failures });
console.log('AI TAPS', failures.length ? 'FAILED ' + JSON.stringify(failures) : 'OK');
process.exitCode = failures.length ? 1 : 0;
await p.close();
