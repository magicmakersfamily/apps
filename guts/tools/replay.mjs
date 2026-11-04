// Plays a GUTS playtest recording (saved from the game with ?playtest=1) back, frame by frame, in a real browser.
// Every 30 frames it compares Gus's position, speed and belly with the recording: while they match, the replay is
// exact; the first mismatch is reported as "drifted" (usually because the game code changed since the recording).
// It writes a short playtest report with pictures of the moments that matter (stalls, markers, blowouts, the end).
//   node guts/tools/replay.mjs ~/Downloads/guts-playtest-2026-11-04-1730.json
//   node guts/tools/replay.mjs --latest                 the newest guts-playtest-*.json in ~/Downloads
//   node guts/tools/replay.mjs --tests                  replay every saved test in guts/tests/playtests/ and check its "expect"
//   node guts/tools/replay.mjs <file> --save fence-stuck --expect reach:60   keep it as a test (see below)
// --browser picks the browser (default: the one it was recorded in), --strict fails on any drift.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, gutsUrl } from './cdp.mjs';
import { record, outDir, REPO } from '../../tools/play/harness.mjs';

const WATCH = fileURLToPath(new URL('./watch.js', import.meta.url));
const TESTS = path.join(REPO, 'guts/tests/playtests');

export function browserOf(rec) { const u = rec.browser || ''; if (['chromium', 'firefox', 'webkit'].includes(u)) return u; return /Firefox\//.test(u) ? 'firefox' : /Safari\//.test(u) && !/Chrome\//.test(u) ? 'webkit' : 'chromium'; }
export function load(file) { const r = JSON.parse(fs.readFileSync(file, 'utf8')); if (r.format !== 'guts-playtest') throw new Error(file + ' is not a GUTS playtest recording'); return r; }

/* ---------- runs inside the page: one attempt, start to end, in a single synchronous pass ---------- */
function replayAttempt(a) {
  var G = GUTS, Game = G.Game, In = G.Input, P = G.playtest;
  Game.save = JSON.parse(JSON.stringify(a.save)); Game.applySettings();
  var cv = document.querySelector('#stage canvas') || document.querySelector('canvas'), box = cv.parentNode;
  function view(v) { box.style.width = v.W + 'px'; box.style.height = v.H + 'px'; box.style.flex = 'none'; Game.resize(); }
  view(a.view);
  var ev = {}; a.events.forEach(function (e) { (ev[e[0]] = ev[e[0]] || []).push(e); });
  var kind0 = a.events.filter(function (e) { return e[1] === 'kind'; })[0]; In.kind = kind0 ? kind0[2] : 'kb';
  var opts = {}; for (var k in a.opts || {}) opts[k] = a.opts[k]; opts.seed = a.seed;
  if (opts.v2 == null) opts.v2 = a.stage === 'gym';   // recordings from before 1.7 never stored it: they used the classic controls (except the Gym)
  (P ? P.begin : Game.begin).call(Game, a.stage, opts);
  if (window.__guts) window.__guts.show('play');
  Game.paused = true;   // only this loop moves the game
  var vs = Game.viewSize(), viewOk = Math.abs(vs.W - a.view.W) < 0.01 && Math.abs(vs.H - a.view.H) < 0.01;
  var w = GUTSWatch({}), checks = {}; a.checks.forEach(function (c) { checks[c[0]] = c; });
  var NAMES = ['frame', 'x', 'y', 'vx', 'vy', 'pressure', 'vitality', 'time'];
  var drift = null, marks = [], shots = [], seenFind = 0, blowShots = 0, lastStall = '', update = P ? P.update : Game.update;
  function q4(v) { return Math.round(v * 10000) / 10000; }
  function shot(why, f) {
    if (shots.length >= 14) return;
    try { Game.render(); shots.push({ why: why, frame: f, t: Math.round(Game.st.t * 10) / 10, tile: Math.round(Game.st.g.x / 32), img: cv.toDataURL('image/jpeg', 0.72) }); } catch (e) {}
  }
  var ri = 0, rleft = a.input.length ? a.input[0][0] : 0, f = 0, stop = false;
  for (f = 0; f < a.dt.length && !stop; f++) {
    (ev[f] || []).forEach(function (e) {
      if (e[1] === 'set') { Game.save.set = e[2]; Game.applySettings(); }
      else if (e[1] === 'kind') In.kind = e[2];
      else if (e[1] === 'view') view(e[2]);
      else if (e[1] === 'mark') { marks.push({ frame: f, t: Math.round(Game.st.t * 10) / 10, tile: Math.round(Game.st.g.x / 32) }); shot('marker', f); }
    });
    if (rleft <= 0) { ri++; rleft = a.input[ri][0]; }
    P.applyRow(a.input[ri].slice(1)); rleft--;
    var dt = a.dt[f] / 10000, t0 = performance.now();
    try { update.call(Game, dt); } catch (e) { w.fail('exception', 'Game.update threw: ' + e.message); break; }
    w.timeUpdate(performance.now() - t0);
    if (w.frame(dt) === 'stop') { shot('failure', f + 1); break; }
    var c = checks[f + 1];
    if (c && !drift) {
      var now = P.check(f + 1);
      for (var i = 1; i < c.length; i++) if (Math.abs(now[i] - c[i]) > 2e-4) { drift = { frame: f + 1, t: Math.round(c[7] * 10) / 10, field: NAMES[i], recorded: c[i], replayed: q4(now[i]) }; shot('drift', f + 1); break; }
    }
    // a picture the moment Gus gets stuck, and of the first blowouts
    var fl = w.findings();
    while (seenFind < fl.length) { var nf = fl[seenFind++]; if ((nf.type === 'stall' && nf.where !== lastStall) || (nf.type === 'blowout' && ++blowShots <= 2)) shot(nf.type, f + 1); if (nf.type === 'stall') lastStall = nf.where; }
  }
  var res = w.result(null);
  shot('end', f);
  res.frames = f; res.recordedFrames = a.dt.length; res.drift = drift; res.exact = !drift && f === a.dt.length; res.marks = marks; res.shots = shots;
  res.viewMatched = viewOk; res.recordedEnd = a.end || null;
  return res;
}

/* ---------- one recording: every attempt ---------- */
export async function replayFile(file, { browser, strict = false, expect = null, name } = {}) {
  const rec = load(file), b = browser || browserOf(rec), label = name || path.basename(file, '.json');
  const results = [];
  for (let i = 0; i < rec.attempts.length; i++) {
    const a = rec.attempts[i];
    if (!a.dt || !a.dt.length) continue;
    const vw = Math.max(400, Math.ceil(a.view.innerW || a.view.W)), vh = Math.max(300, Math.ceil(a.view.innerH || a.view.H));
    const p = await launch({ url: await gutsUrl(), browser: b, w: vw, h: vh });
    let res;
    try {
      if (!(await p.ready())) throw new Error('the game never finished loading');
      await p.page.addScriptTag({ path: WATCH });
      res = await p.page.evaluate(replayAttempt, a);
    } catch (e) { res = { status: 'error', failures: [{ type: 'exception', where: 'harness', text: e.message.split('\n')[0] }], findings: [], shots: [], marks: [] }; }
    res.failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
    await p.close();
    // pictures
    const shotDir = path.join(outDir(), 'shots');
    fs.mkdirSync(shotDir, { recursive: true });
    for (const s of res.shots || []) {
      const fn = path.join(shotDir, `replay_${label}_${i + 1}_${s.why}_${s.frame}.jpg`.replace(/[^\w./-]+/g, '-'));
      fs.writeFileSync(fn, Buffer.from(s.img.split(',')[1], 'base64')); s.file = fn; delete s.img;
    }
    // expectations (for saved tests)
    const ex = expect || {}, fails = [...res.failures];
    if ((strict || ex.exact) && res.drift) fails.push({ type: 'flow', where: 'frame ' + res.drift.frame, text: `replay drifted at ${res.drift.t} s (${res.drift.field} ${res.drift.recorded} recorded, ${res.drift.replayed} replayed)` });
    if (ex.status && res.status !== ex.status) fails.push({ type: 'progression', where: 'tile ' + res.furthestTile, text: `expected the level to end "${ex.status}", it ended "${res.status}"` });
    if (ex.reach && !(res.furthestTile >= ex.reach)) fails.push({ type: 'progression', where: 'tile ' + res.furthestTile, text: `expected these inputs to reach tile ${ex.reach}, they reached ${res.furthestTile}` });
    if (ex.noStallNear != null) for (const s of res.findings.filter((x) => x.type === 'stall')) if (Math.abs(Number(s.where.replace(/\D+/g, ' ').trim().split(' ')[0]) - ex.noStallNear) <= 3) fails.push({ type: 'progression', where: s.where, text: `still stalls near tile ${ex.noStallNear}` });
    const r = record({ game: 'guts', scenario: 'replay', persona: label, seed: i + 1, browser: b, file: path.relative(REPO, path.resolve(file)), recordedVersion: rec.version, stage: a.stage, mode: a.save.mode, ...res, failures: fails });
    results.push({ attempt: i + 1, rec: r, a });
  }
  return { rec, label, browser: b, results };
}

/* ---------- the playtest report ---------- */
function bar(timeline, width) {
  if (!timeline || !timeline.length) return '';
  const step = Math.max(1, Math.ceil(timeline.length / width)), max = Math.max(...timeline, 1), ch = '▁▂▃▄▅▆▇█';
  let s = ''; for (let i = 0; i < timeline.length; i += step) s += ch[Math.min(7, Math.floor(timeline[i] / max * 7.99))];
  return s;
}
export function writeReport(out) {
  const { rec, label, browser, results } = out, dir = outDir(), L = [];
  const mins = (s) => (s == null ? '?' : s >= 60 ? Math.floor(s / 60) + ' min ' + Math.round(s % 60) + ' s' : Math.round(s) + ' s');
  L.push(`# Playtest: ${label}`, '', `Recorded ${(rec.recordedAt || '').slice(0, 16).replace('T', ' ')} UTC with GUTS ${rec.version} in ${browserOf(rec)} · replayed in ${browser} · ${results.length} tr${results.length === 1 ? 'y' : 'ies'}`, '');
  for (const { attempt, rec: r, a } of results) {
    L.push(`## Try ${attempt}: ${r.status === 'clear' ? 'finished' : r.end && r.recordedEnd ? 'stopped' : 'stopped'} at tile ${r.furthestTile} of ${r.levelTiles} after ${mins(r.gameSeconds)} (${a.save.mode} mode)`, '');
    L.push(r.exact ? `Replay: **exact** (every checkpoint matched).` : r.drift ? `Replay: **drifted at ${r.drift.t} s** (${r.drift.field}); everything after that is approximate. Usually the game changed since this was recorded.` : `Replay: stopped early.`);
    if (!r.viewMatched) L.push(`Note: the game area could not be sized exactly as recorded, which can make the replay drift.`);
    L.push('', `Progress (furthest tile, each game second): \`${bar(r.timeline, 60)}\``, '');
    const stalls = r.findings.filter((x) => x.type === 'stall'), blow = r.findings.filter((x) => x.type === 'blowout'), falls = r.findings.filter((x) => x.type === 'fall');
    // back-to-back stalls at one spot are one stuck spell: it began 20 s before the first report
    const spells = []; for (const st of stalls) { const l = spells[spells.length - 1]; if (l && l.where === st.where && st.t - l.last <= 21) l.last = st.t; else spells.push({ where: st.where, first: st.t, last: st.t }); }
    L.push(`- Stuck (no further for 20 s or more): ${spells.length ? spells.map((x) => x.where + ' from ' + mins(Math.max(0, x.first - 20)) + ' for ' + mins(x.last - x.first + 20)).join('; ') : 'never'}`);
    L.push(`- Blowouts: ${blow.length}${blow.length ? ' (' + blow.slice(0, 6).map((s) => s.where).join('; ') + (blow.length > 6 ? '…' : '') + ')' : ''} · falls: ${falls.length} · helper snacks: ${r.helperSnacks}`);
    L.push(`- Jumps ${r.jumps}, blasts ${r.blasts}, bites ${r.newBites} new, Gut Bugs freed ${r.bugsFreed}, lantern ${r.lantern ? 'carried' : 'not carried'}, bao ${r.bao ? 'eaten' : 'not eaten'}`);
    if (r.marks && r.marks.length) L.push(`- Markers (key M): ${r.marks.map((m) => 'tile ' + m.tile + ' at ' + mins(m.t)).join('; ')}`);
    if (r.failures.length) { L.push('', `**Broken:**`); r.failures.forEach((f) => L.push(`- ${f.type} ${f.where}: ${f.text}`)); }
    if (r.shots && r.shots.length) { L.push(''); r.shots.forEach((s) => L.push(`![${s.why} at ${mins(s.t)}, tile ${s.tile}](${path.relative(dir, s.file)})`)); }
    L.push('');
  }
  L.push(`Keep this as a test: \`node guts/tools/replay.mjs <file> --save <short-name> --expect reach:<tile>\` (or \`status:clear\`, \`noStallNear:<tile>\`).`);
  const file = path.join(dir, `playtest-${label}.md`.replace(/[^\w./-]+/g, '-'));
  fs.writeFileSync(file, L.join('\n') + '\n');
  return file;
}

function latestDownload() {
  const d = path.join(os.homedir(), 'Downloads');
  const fsx = fs.readdirSync(d).filter((f) => /^guts-playtest-.*\.json$/.test(f)).map((f) => path.join(d, f)).sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs);
  if (!fsx.length) throw new Error('no guts-playtest-*.json in ~/Downloads');
  return fsx[0];
}
function parseExpect(list) {
  const e = {};
  for (const s of list) { const [k, v] = s.split(':'); e[k] = k === 'status' ? v : k === 'exact' ? v !== 'false' : Number(v); }
  return e;
}

/* ---------- command line ---------- */
if (import.meta.url === 'file://' + process.argv[1]) {
  const argv = process.argv.slice(2), opt = (n) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : null; };
  const browser = opt('browser'), strict = argv.includes('--strict');
  let bad = 0;
  if (argv.includes('--tests')) {
    const files = fs.existsSync(TESTS) ? fs.readdirSync(TESTS).filter((f) => f.endsWith('.json')).sort() : [];
    for (const f of files) {
      const rec = load(path.join(TESTS, f));
      const out = await replayFile(path.join(TESTS, f), { browser, strict, expect: rec.expect || {}, name: path.basename(f, '.json') });
      for (const { attempt, rec: r } of out.results) {
        if (r.failures.length) bad++;
        console.log(`${f.padEnd(36)} try ${attempt}  ${String(r.status).padEnd(5)} tile ${r.furthestTile}  ${r.exact ? 'exact' : r.drift ? 'drifted at ' + r.drift.t + ' s' : ''}  ${r.failures.length ? 'FAIL: ' + r.failures.map((x) => x.text).join('; ') : 'ok'}`);
      }
    }
    console.log('REPLAY TESTS', bad ? bad + ' FAILED' : 'OK: ' + files.length + ' saved playtests');
  } else {
    const file = argv.includes('--latest') ? latestDownload() : argv.find((a) => !a.startsWith('--') && a.endsWith('.json'));
    if (!file) { console.log('usage: node guts/tools/replay.mjs <recording.json> | --latest | --tests'); process.exit(2); }
    const out = await replayFile(file, { browser, strict });
    for (const { attempt, rec: r } of out.results) {
      if (r.failures.length) bad++;
      console.log(`try ${attempt}: ${r.status} at tile ${r.furthestTile}/${r.levelTiles} after ${r.gameSeconds} s · ${r.exact ? 'exact replay' : r.drift ? 'drifted at ' + r.drift.t + ' s (' + r.drift.field + ')' : 'stopped early'} · stalls ${r.findings.filter((x) => x.type === 'stall').length} · markers ${r.marks.length}${r.failures.length ? ' · FAIL: ' + r.failures.map((x) => x.text).join('; ') : ''}`);
    }
    console.log('Playtest report:', writeReport(out));
    const save = opt('save');
    if (save) {
      fs.mkdirSync(TESTS, { recursive: true });
      const rec = load(file); rec.expect = parseExpect(argv.filter((a, i) => argv[i - 1] === '--expect').flatMap((s) => s.split(',')));
      rec.browser = rec.browser ? browserOf(rec) : 'chromium';   // keep only which browser, not the full user agent
      const dest = path.join(TESTS, new Date().toISOString().slice(0, 10) + '-' + save.replace(/[^\w-]+/g, '-') + '.json');
      fs.writeFileSync(dest, JSON.stringify(rec));
      console.log('Saved as a test:', path.relative(REPO, dest), 'expect', JSON.stringify(rec.expect));
    }
    console.log('REPLAY', bad ? 'FAILED' : 'OK');
  }
  process.exitCode = bad ? 1 : 0;
}
