// An "AI helper" that can only tap single keys: it reads the route hint from GUTS.ai.nextHop(), then taps
// arrows (one small step), A / D (run), Q / E (jump left / right) and Space (jump) in ?ai=1 Step mode.
import { launch } from './cdp.mjs';
const base = (process.env.GUTS_URL || 'http://localhost:8765/guts/index.html') + '?ai=1';
const p = await launch({ url: base, w: 1280, h: 800 });
await p.sleep(2600);
await p.eval('__guts.startLevel()'); await p.sleep(500);
const tap = (key) => p.eval(`(function(){ var o={key:'${key}', bubbles:true}; window.dispatchEvent(new KeyboardEvent('keydown',o)); window.dispatchEvent(new KeyboardEvent('keyup',o)); })()`);
async function settle() { await p.sleep(80); for (let i = 0; i < 150; i++) { if (await p.eval('GUTS.Game.waiting === true || GUTS.Game.st.status !== "play"')) return; await p.sleep(30); } }
const gx = async () => p.eval('GUTS.Game.st.g.x / 32');
// 1. measure the controls
async function measure(label, key) { const a = await gx(); await tap(key); await settle(); const b = await gx(); console.log(label.padEnd(34), (b - a).toFixed(1), 'tiles'); }
await measure('ArrowRight (one small step)', 'ArrowRight'); await measure('ArrowRight again', 'ArrowRight');
await measure('d  (run right)', 'd'); await measure('a  (run left)', 'a');
await p.eval('(function(){ var g=GUTS.Game.st.g; g.x=1500; g.y=14*32; })()'); await p.sleep(100);
await measure('e  (jump right)', 'e'); await measure('q  (jump left)', 'q'); await measure('Space (jump in place)', ' ');
// 2. play the level with the route hint
await p.eval('(function(){ var st=GUTS.Game.st, g=st.g; g.x=(st.L.start.x+0.5)*32; g.y=(st.L.start.y+1)*32; g.vx=g.vy=0; })()'); await p.sleep(200);
let actions = 0, last = '', same = 0, noHint = 0; const t0 = Date.now(); const log = [];
while (actions < 400) {
  const s = await p.eval('GUTS.ai.state()'); if (s.status === 'clear') break;
  // keep the belly topped up the way a player would: the level never needs a blast, so just carry on
  const h = await p.eval('GUTS.ai.nextHop()');
  if (!h) { noHint++; await tap(noHint > 2 ? (noHint % 2 ? 'ArrowLeft' : 'ArrowRight') : 'n'); await settle(); actions++; continue; }
  noHint = 0;
  let key;
  if (Math.abs(h.walkTiles) >= 0.7) key = Math.abs(h.walkTiles) > 4.5 ? (h.walkTiles > 0 ? 'd' : 'a') : (h.walkTiles > 0 ? 'ArrowRight' : 'ArrowLeft');
  else if (h.jump) { const ad = Math.abs(h.jump.dx); await tap(ad <= 1 ? '1' : ad <= 3 ? '2' : '3'); key = h.jump.dir > 0 ? 'e' : h.jump.dir < 0 ? 'q' : ' '; }
  else key = Math.abs(h.walkTiles) > 2 ? 'ArrowRight' : 'ArrowRight';
  const sig = key + '@' + Math.round(s.x * 2) + ',' + Math.round(s.y * 2); same = sig === last ? same + 1 : 0; last = sig;
  if (same > 5) { log.push('stuck at ' + s.x + ',' + s.y + ' wanting ' + key); break; }
  await tap(key); await settle(); actions++;
}
const fin = await p.eval('({status: GUTS.Game.st.status, tile: Math.round(GUTS.Game.st.g.x/32), bao: GUTS.Game.st.baoEaten})');
console.log(JSON.stringify({ actions, seconds: Math.round((Date.now() - t0) / 1000), ...fin, log }));
console.log('AI BOT', fin.status === 'clear' ? 'OK: finished the level with single key taps' : 'DID NOT FINISH');
if (p.logs.length) console.log('page logs', JSON.stringify(p.logs));
p.close();
