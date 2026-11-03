import { launch } from './cdp.mjs';
import { record } from '../../tools/play/harness.mjs';
const p = await launch({ url: (process.env.GUTS_URL || 'http://localhost:8765/guts/index.html') + '?ai=1', w: 1280, h: 800 });
await p.sleep(2200);
await p.eval('__guts.startLevel()'); await p.sleep(400);
for (let i = 0; i < 120 && (await p.eval('!!GUTS.Game.st.moment')); i++) await p.sleep(100);   // the opening scene plays by itself (a click would only skip it)
const rect = (sel) => p.eval(`(function(){ var r=document.querySelector('${sel}').getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
async function click(sel) { const c = await rect(sel); await p.click(c.x, c.y); }
const gx = () => p.eval('Math.round(__guts.Game.st.g.x)');
const failures = [];
for (let i = 0; i < 3; i++) { const x0 = await gx(); await click('#tb-right'); await p.sleep(900); const d = (await gx()) - x0; console.log('click', i + 1, 'right button moves Gus', d, 'px'); if (!(d > 0)) failures.push({ type: 'input', where: 'touch buttons', text: 'clicking the on-screen right button did not move Gus' }); }
const x1 = await gx(); await click('#tb-left'); await p.sleep(900); const dl = (await gx()) - x1; console.log('click left button moves Gus', dl, 'px'); if (!(dl < 0)) failures.push({ type: 'input', where: 'touch buttons', text: 'clicking the on-screen left button did not move Gus' });
// let an "AI" walk the whole first room using nothing but taps: right taps and jump taps, reading the text view between presses
let steps = 0; const t0 = Date.now();
async function key(k) { await p.eval(`(function(){ var o={key:'${k}', bubbles:true}; window.dispatchEvent(new KeyboardEvent('keydown',o)); window.dispatchEvent(new KeyboardEvent('keyup',o)); })()`); await p.sleep(450); }
let last = -1;
while (steps < 120) {
  steps++;
  const s = await p.eval('GUTS.ai.state()');
  if (s.x > 36) break;
  if (s.wall && s.wall.dist <= 2) { await key(' '); await key('ArrowRight'); } else await key('ArrowRight');
}
console.log('after', steps, 'single-tap actions Gus is at tile', await p.eval('GUTS.ai.state().x'), '(kitchen counter is at 24-30)');
const reached = await p.eval('GUTS.ai.state().x');
if (!(reached > 20)) failures.push({ type: 'input', where: 'tile ' + reached, text: 'single key taps did not walk Gus through the first room' });
failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
console.log('logs', JSON.stringify(p.logs));
record({ game: 'guts', scenario: 'ai-taps', browser: p.browserName, reached, steps, failures });
console.log('AI TAPS', failures.length ? 'FAILED' : 'OK');
process.exitCode = failures.length ? 1 : 0;
await p.close();
