// Proves the playtest recorder and the replay stay exact: plays the real game in real time with ?playtest=1
// (real clicks and key presses, a marker, a pause, a restart), saves the file through the game's own buttons,
// replays it, and fails unless every checkpoint of every try matches.
// Usage: node guts/tools/record-check.mjs [--browser chromium|firefox|webkit]
import fs from 'node:fs';
import path from 'node:path';
import { launch, gutsUrl } from './cdp.mjs';
import { record, outDir } from '../../tools/play/harness.mjs';
import { replayFile } from './replay.mjs';

const i = process.argv.indexOf('--browser'), browser = i > 0 ? process.argv[i + 1] : (process.env.BROWSER || 'chromium');
const failures = [], m = {};
const p = await launch({ url: await gutsUrl('?playtest=1'), browser, w: 1280, h: 800 });
const kb = p.page.keyboard, hold = async (k, ms) => { await kb.down(k); await p.sleep(ms); await kb.up(k); };
let file = null;
try {
  if (!(await p.ready())) throw new Error('the game never finished loading');
  if (!(await p.eval('!!document.getElementById("pt-rec")'))) failures.push({ type: 'flow', where: 'title', text: 'the REC tag is missing with ?playtest=1' });
  await p.page.click('#b-play');
  for (let n = 0; n < 80 && (await p.eval('__guts.UI.screen')) !== 'play'; n++) { await kb.press('Space'); await p.sleep(250); }
  // try 1: skip the heist, run, jump, blast, breathe, mark a moment
  await p.sleep(1500); await kb.press('Space');
  await hold('ArrowRight', 1800); await kb.press('Space'); await hold('ArrowRight', 900);
  await kb.down('ArrowRight'); await kb.press('Space'); await p.sleep(400); await kb.press('Space'); await p.sleep(700); await kb.up('ArrowRight');
  await kb.press('KeyM');
  await hold('KeyX', 700); await hold('KeyB', 1200); await hold('ArrowLeft', 600); await hold('ArrowRight', 2500);
  await kb.down('ArrowRight'); for (let n = 0; n < 6; n++) { await kb.press('Space'); await p.sleep(330); } await kb.up('ArrowRight');
  // pause, save from the pause menu (a download), restart from the pause menu
  await kb.press('Escape'); await p.sleep(300);
  const [dl1] = await Promise.all([p.page.waitForEvent('download', { timeout: 8000 }), p.page.click('#p-playtest')]);
  m.firstSave = dl1.suggestedFilename();
  await p.page.click('#p-restart'); await p.sleep(900);
  // try 2: a short one, then save with the REC tag
  await kb.press('Space'); await p.sleep(1400); await kb.press('Space');
  await hold('ArrowRight', 2200); await kb.press('Space'); await hold('ArrowRight', 1200);
  const [dl2] = await Promise.all([p.page.waitForEvent('download', { timeout: 8000 }), p.page.click('#pt-rec')]);
  file = path.join(outDir(), 'recordings', 'record-check-' + browser + '.json');
  fs.mkdirSync(path.dirname(file), { recursive: true }); await dl2.saveAs(file);
} catch (e) { failures.push({ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }); }
failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
await p.close();

if (file) {
  const rec = JSON.parse(fs.readFileSync(file, 'utf8'));
  m.tries = rec.attempts.length; m.frames = rec.attempts.map((a) => a.dt.length); m.kb = Math.round(fs.statSync(file).size / 1024);
  if (rec.attempts.length !== 2) failures.push({ type: 'flow', where: 'recorder', text: 'expected 2 tries in the file, found ' + rec.attempts.length });
  if (!rec.attempts[0] || !rec.attempts[0].events.some((e) => e[1] === 'mark')) failures.push({ type: 'flow', where: 'recorder', text: 'the M marker was not recorded' });
  const out = await replayFile(file, { browser, strict: true, name: 'record-check-' + browser });
  m.replays = out.results.map((r) => ({ exact: r.rec.exact, frames: r.rec.frames, tile: r.rec.furthestTile, drift: r.rec.drift }));
  for (const r of out.results) {
    if (!r.rec.exact) failures.push({ type: 'flow', where: 'replay try ' + r.attempt, text: r.rec.drift ? `replay drifted at ${r.rec.drift.t} s (${r.rec.drift.field}: ${r.rec.drift.recorded} recorded, ${r.rec.drift.replayed} replayed)` : `replay stopped at frame ${r.rec.frames} of ${r.rec.recordedFrames}` });
    if (!(r.rec.furthestTile > 5)) failures.push({ type: 'input', where: 'replay try ' + r.attempt, text: 'the recorded play barely moved Gus (tile ' + r.rec.furthestTile + ')' });
  }
}
record({ game: 'guts', scenario: 'record-check', browser, ...m, failures });
console.log(JSON.stringify(m));
console.log('RECORD CHECK', failures.length ? 'FAILED: ' + failures.map((f) => f.text).join('; ') : 'OK: recorded in real time, replayed exactly');
process.exitCode = failures.length ? 1 : 0;
