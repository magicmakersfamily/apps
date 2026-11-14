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
    if (!/Version 1\.3 \(beta\)/.test(body)) fail(label, 'version line missing');
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
    await p.page.selectOption('#music-select', 'james'); await p.sleep(2600);
    const js = await p.eval('Music.songId');
    if (js !== 'james') fail(label, "choosing James's Theme did not switch the song: " + js);
    await p.page.selectOption('#music-select', 'robojam'); await p.sleep(2600);
    const rj = await p.eval('Music.songId');
    if (rj !== 'robojam') fail(label, 'choosing Robo Jam did not switch the song: ' + rj);
    // Robo Jam is well-formed: one chord and one lead row per bar, every note inside its bar, the intro has no lead
    const shape = await p.eval("(() => { const s = SONGS.robojam; const bad = []; s.lead.notes.forEach((r, b) => r.forEach(([st, n, len]) => { if (st < 0 || st + len > 16 || n < 40 || n > 100) bad.push(b + ':' + st + ':' + n); })); return { bars: s.bars, chords: s.chords.length, lead: s.lead.notes.length, bad, intro: s.lead.notes.slice(0, 4).flat().length }; })()");
    if (shape.chords !== shape.bars || shape.lead !== shape.bars || shape.bad.length || shape.intro) fail(label, 'Robo Jam is malformed: ' + JSON.stringify(shape));
    await p.page.selectOption('#music-select', 'off');
    const mb = await p.eval("document.getElementById('music-select').value + '|' + document.getElementById('music-icon').textContent + '|' + musicEnabled");
    if (mb !== 'off|🔇|false') fail(label, 'music picker does not show Off: ' + mb);
    if (!(await p.eval("!document.getElementById('coach').hidden || localStorage.getItem('robot-journey:coached') === '1'"))) fail(label, 'the first-jump coach tip did not show');
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
