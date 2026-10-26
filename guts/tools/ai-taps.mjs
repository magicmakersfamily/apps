import { launch } from './cdp.mjs';
const p = await launch({ url: (process.env.GUTS_URL || process.env.GUTS_URL || 'http://localhost:8765/guts/index.html') + '?ai=1', w: 1280, h: 800 });
await p.sleep(2200);
await p.eval('__guts.startLevel()'); await p.sleep(400);
const rect = (sel) => p.eval(`(function(){ var r=document.querySelector('${sel}').getBoundingClientRect(); return {x:r.x+r.width/2, y:r.y+r.height/2}; })()`);
async function click(sel) { const c = await rect(sel); await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y, button: 'left', clickCount: 1 }); }
const gx = () => p.eval('Math.round(__guts.Game.st.g.x)');
for (let i = 0; i < 3; i++) { const x0 = await gx(); await click('#tb-right'); await p.sleep(900); console.log('click', i + 1, 'right button moves Gus', (await gx()) - x0, 'px'); }
const x1 = await gx(); await click('#tb-left'); await p.sleep(900); console.log('click left button moves Gus', (await gx()) - x1, 'px');
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
console.log('logs', JSON.stringify(p.logs)); p.close();
