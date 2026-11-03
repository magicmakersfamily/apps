// Real-time smoke test, the way a person starts the game: a real click on Play, skip the story with Space,
// hold a real arrow key and check Gus moves; then a phone-sized touch screen (no sideways scrolling).
// Saves a screenshot of each. Usage: node guts/tools/smoke.mjs [--browser chromium,firefox,webkit | all]
import path from 'node:path';
import { launch, gutsUrl } from './cdp.mjs';
import { record, outDir, BROWSERS } from '../../tools/play/harness.mjs';

async function desktop(browser) {
  const p = await launch({ url: await gutsUrl(), browser, w: 1280, h: 800 });
  const failures = [], m = {};
  try {
    if (!(await p.ready())) throw new Error('the game never finished loading');
    await p.page.click('#b-play');
    for (let i = 0; i < 80 && (await p.eval('__guts.UI.screen')) !== 'play'; i++) { await p.page.keyboard.press('Space'); await p.sleep(250); }
    if ((await p.eval('__guts.UI.screen')) !== 'play') failures.push({ type: 'flow', where: 'title', text: 'Play + Space never reached the level (screen: ' + (await p.eval('__guts.UI.screen')) + ')' });
    for (let i = 0; i < 40 && (await p.eval('!!(GUTS.Game.st && GUTS.Game.st.moment)')); i++) { await p.page.keyboard.press('Space'); await p.sleep(250); }
    await p.sleep(600);
    m.fps = await p.eval('new Promise(function (r) { var n = 0, t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); })(); })');
    const x0 = await p.eval('GUTS.Game.st.g.x');
    await p.page.keyboard.down('ArrowRight'); await p.sleep(1200); await p.page.keyboard.up('ArrowRight');
    m.movedTiles = Math.round(((await p.eval('GUTS.Game.st.g.x')) - x0) / 32 * 10) / 10;
    if (!(m.movedTiles > 1)) failures.push({ type: 'input', where: 'keyboard', text: 'holding the right arrow for 1.2 s moved Gus ' + m.movedTiles + ' tiles' });
    m.screenshot = await p.shot(path.join(outDir(), 'shots', 'guts_smoke_desktop_' + browser + '.png'));
  } catch (e) { failures.push({ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }); }
  failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
  await p.close();
  return record({ game: 'guts', scenario: 'smoke-desktop', browser, ...m, failures });
}

async function phone(browser) {
  const p = await launch({ url: await gutsUrl(), browser, w: 400, h: 800, mobile: true });
  const failures = [], m = {};
  try {
    if (!(await p.ready())) throw new Error('the game never finished loading');
    m.pageWidth = await p.eval('document.documentElement.scrollWidth');
    if (m.pageWidth > 401) failures.push({ type: 'layout', where: 'phone 400 px', text: 'page is ' + m.pageWidth + ' px wide: it scrolls sideways' });
    m.screenshot = await p.shot(path.join(outDir(), 'shots', 'guts_smoke_phone_' + browser + '.png'));
  } catch (e) { failures.push({ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }); }
  failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
  await p.close();
  return record({ game: 'guts', scenario: 'smoke-phone', browser, ...m, failures });
}

const i = process.argv.indexOf('--browser'), bl = i > 0 ? process.argv[i + 1] : (process.env.BROWSER || 'chromium');
const browsers = bl === 'all' ? BROWSERS : bl.split(',');
let bad = 0;
await Promise.all(browsers.map(async (b) => {
  for (const r of [await desktop(b), await phone(b)]) {
    if (r.failures.length) bad++;
    console.log(b.padEnd(8), r.scenario.padEnd(14), r.fps ? r.fps + ' fps, moved ' + r.movedTiles + ' tiles' : r.pageWidth ? 'page ' + r.pageWidth + ' px wide' : '', r.failures.length ? 'FAIL: ' + r.failures.map((x) => x.text).join('; ') : 'ok');
  }
}));
console.log('SMOKE', bad ? bad + ' FAILED' : 'OK');
process.exitCode = bad ? 1 : 0;
