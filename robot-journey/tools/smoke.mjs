// Smoke check: page loads with no errors in each browser, version line present, start → play → pause → resume,
// the music scheduler runs, toggles show their state, and the cover renders. Writes screenshots.
// Usage: node robot-journey/tools/smoke.mjs [--browser chromium|firefox|webkit|all] [--cover]
import { launch, baseUrl, record, outDir } from '../../tools/play/harness.mjs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const which = arg('--browser', 'chromium');
const list = which === 'all' ? ['chromium', 'firefox', 'webkit'] : which.split(',');
let bad = 0;
for (const browser of list) {
  const failures = [];
  const fail = (where, text) => { failures.push({ type: 'smoke', where, text }); console.log('FAIL', browser, where, text); };
  for (const [w, h, label] of [[1280, 800, 'laptop'], [390, 844, 'phone'], [844, 390, 'phone-landscape']]) {
    const p = await launch({ browser, url: (await baseUrl()) + 'robot-journey/', w, h, seed: 5, mobile: label !== 'laptop' });
    if (!(await p.ready('!!window.RobotJourney'))) fail(label, 'page did not boot');
    const body = await p.eval('document.body.innerText');
    if (!/Version 1\.0 \(beta\)/.test(body)) fail(label, 'version line missing');
    const over = await p.eval('document.documentElement.scrollWidth > innerWidth + 1');
    if (over) fail(label, 'page scrolls sideways');
    const startFits = await p.eval("(() => { const b = document.getElementById('launch-btn').getBoundingClientRect(); return b.width > 0; })()");
    if (!startFits) fail(label, 'launch button not visible');
    await p.shot(path.join(outDir(), `robot-journey-${browser}-${label}-start.png`));
    await p.page.click('#launch-btn');
    await p.sleep(700);
    if ((await p.eval('RobotJourney.debug.gameState')) !== 'PLAYING') fail(label, 'Launch did not start the game');
    await p.page.keyboard.down('ArrowRight'); await p.sleep(700); await p.page.keyboard.up('ArrowRight');
    const x = await p.eval('RobotJourney.ai.state().robot.x');
    if (!(x > 200)) fail(label, 'holding → did not run right (x ' + x + ')');
    await p.shot(path.join(outDir(), `robot-journey-${browser}-${label}-play.png`));
    const music = await p.eval("typeof audioCtx !== 'undefined' && audioCtx ? { state: audioCtx.state, song: Music.songId } : null");
    if (!music || music.song !== 'scrapyard') fail(label, 'Zone 1 song is not playing: ' + JSON.stringify(music));
    await p.page.click('#music-btn');
    const mb = await p.eval("document.getElementById('music-btn').getAttribute('aria-pressed') + '|' + document.getElementById('music-btn').innerText");
    if (!/^false\|.*Off/.test(mb)) fail(label, 'music button does not show Off after a click: ' + mb);
    await p.page.click('#pause-btn');
    if ((await p.eval('RobotJourney.debug.gameState')) !== 'PAUSED') fail(label, 'pause button did not pause');
    await p.page.click('#turn-toggle');
    const tt = await p.eval("document.getElementById('turn-toggle').innerText");
    if (!/On/.test(tt)) fail(label, 'Turn mode toggle does not show On: ' + tt);
    await p.page.keyboard.press('Escape');
    if ((await p.eval('RobotJourney.debug.gameState')) !== 'PLAYING') fail(label, 'Escape did not resume');
    await p.sleep(400);
    await p.shot(path.join(outDir(), `robot-journey-${browser}-${label}-turn.png`));
    failures.push(...p.errors.map((e) => ({ type: 'error', where: label + ' ' + e.kind, text: e.text })));
    await p.close();
  }
  if (process.argv.includes('--cover') && browser === 'chromium') {
    const p = await launch({ browser, url: (await baseUrl()) + 'robot-journey/#cover', w: 1200, h: 744, seed: 2 });
    await p.ready('!!window.RobotJourney'); await p.sleep(1500);
    await p.shot(path.resolve(path.dirname(new URL(import.meta.url).pathname), '../cover.png'));
    console.log('cover written');
    await p.close();
  }
  record({ game: 'robot-journey', scenario: 'smoke', browser, failures });
  console.log('SMOKE', browser, failures.length ? 'FAILED ' + JSON.stringify(failures) : 'OK');
  if (failures.length) bad++;
}
process.exitCode = bad ? 1 : 0;
