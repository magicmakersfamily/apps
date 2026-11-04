// One command for every check on the App Shelf: all `*.test.js` / `*.test.mjs` model tests, then each game's
// browser checks (listed in <game>/tools/suites.json), then one ranked report.
//   node tools/check.mjs            quick: model tests + Chrome checks (runs before every push)
//   node tools/check.mjs --full     full: also Firefox and WebKit (Safari's engine), more seeds, slow bots
//   node tools/check.mjs --game guts   only that game's browser checks (model tests still all run)
// Exit code 0 only when every test passed and nothing is broken. Design findings (stalls, falls) never fail it.
// Needs the dev-only harness once: (cd tools/play && npm ci && npx playwright install firefox webkit)
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), has = (f) => args.includes(f), val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const level = has('--full') ? 'full' : 'quick', only = val('--game'), started = Date.now();
const SKIP = new Set(['.git', 'node_modules', 'versions', 'out', '.cache']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
function run(cmd, argv, { cwd = REPO, env = {}, log } = {}) {
  return new Promise((resolve) => {
    const ch = spawn(cmd, argv, { cwd, env: { ...process.env, ...env } });
    let text = ''; const add = (d) => { text += d; };
    ch.stdout.on('data', add); ch.stderr.on('data', add);
    ch.on('close', (code) => { if (log) fs.writeFileSync(log, text); resolve({ code, text }); });
  });
}

/* ---------- 1. model tests (no browser) ---------- */
const files = walk(REPO);
const tests = files.filter((f) => /\.test\.m?js$/.test(f)).map((f) => path.relative(REPO, f)).sort();
const ut = await run(process.execPath, ['--test', ...tests]);
const count = (k) => Number((ut.text.match(new RegExp('ℹ ' + k + ' (\\d+)')) || [])[1] || 0);
const unit = { files: tests.length, pass: count('pass'), fail: count('fail'), ok: ut.code === 0 && count('pass') > 0 };
console.log(`model tests   ${unit.ok ? 'ok  ' : 'FAIL'}  ${unit.pass} passed, ${unit.fail} failed (${unit.files} files)`);
if (!unit.ok) console.log(ut.text.split('\n').filter((l) => /^not ok|✖|Error|expected|actual/.test(l.trim())).slice(0, 20).join('\n'));

/* ---------- 2. browser checks ---------- */
let harness;
try { harness = await import('./play/harness.mjs'); }
catch (e) { console.log('\nBrowser checks need the harness once:  (cd tools/play && npm ci && npx playwright install firefox webkit)'); process.exit(unit.ok ? 2 : 1); }
const out = path.join(REPO, 'tools/play/out', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '-' + level);
fs.mkdirSync(path.join(out, 'logs'), { recursive: true });
const srv = await harness.serve(REPO);
const env = { PLAY_BASE: srv.url, PLAY_OUT: out };

const suites = [];
for (const f of files.filter((f) => f.endsWith(path.join('tools', 'suites.json')))) {
  const game = path.relative(REPO, f).split(path.sep)[0];
  if (only && game !== only) continue;
  const def = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const s of def[level] || []) {
    const o = { game, script: s[0], argv: [], env: {}, cwd: REPO, records: def.records !== false };
    for (const a of s.slice(1)) {
      if (a.startsWith('env:')) { const [k, v] = a.slice(4).split('='); o.env[k] = v; }
      else if (a.startsWith('cwd:')) o.cwd = path.join(REPO, a.slice(4));
      else o.argv.push(a);
    }
    o.name = [path.basename(o.script, '.mjs'), ...o.argv.map((a) => a.replace(/^--/, '')).filter((a) => !['browser', 'seed', 'seeds', 'stage', 'tests'].includes(a)), ...Object.values(o.env)].join('-');
    suites.push(o);
  }
}
let next = 0; const results = [];
async function worker() {
  while (next < suites.length) {
    const s = suites[next++], t0 = Date.now(), log = path.join(out, 'logs', s.game + '_' + s.name + '.log');
    const r = await run(process.execPath, [path.join(REPO, s.script), ...s.argv], { cwd: s.cwd, env: { ...env, ...s.env }, log });
    const last = r.text.trim().split('\n').filter((l) => /\b(OK|FAIL|FAILED|PASS|DID NOT FINISH)\b/.test(l)).pop() || r.text.trim().split('\n').pop() || '';
    results.push({ ...s, code: r.code, secs: Math.round((Date.now() - t0) / 1000) });
    console.log(`${(s.game + ' ' + s.name).padEnd(44)} ${r.code === 0 ? 'ok  ' : 'FAIL'}  ${String(Math.round((Date.now() - t0) / 1000)).padStart(3)} s  ${last.slice(0, 110)}`);
    if (r.code !== 0 && !s.records) harness.record({ game: s.game, scenario: s.name, browser: 'chromium', failures: [{ type: 'error', where: 'suite', text: 'exited with code ' + r.code + ' (log: ' + path.relative(REPO, log) + ')' }] });
  }
}
await Promise.all(Array.from({ length: Math.min(Number(val('--parallel') || 3), suites.length) }, worker));
srv.close();

/* ---------- 3. report ---------- */
const { build } = await import('./play/report.mjs');
const rep = build(out);
const failedSuites = results.filter((r) => r.code !== 0);
const ok = unit.ok && !failedSuites.length && !rep.broken.length;
console.log(`\n${ok ? 'CHECK OK' : 'CHECK FAILED'} (${level}, ${Math.round((Date.now() - started) / 1000)} s): ${unit.pass} model tests, ${results.length - failedSuites.length}/${results.length} browser checks passed, ${rep.runs.length} runs, ${rep.broken.length} broken`);
for (const c of rep.broken.slice(0, 5)) console.log(`  - ${c.type} · ${c.game} · ${c.where}: ${c.text.slice(0, 120)} (${c.runs.length} runs)`);
console.log(`Report: ${path.relative(REPO, path.join(out, 'report.md'))}`);
fs.writeFileSync(path.join(REPO, 'tools/play/out/latest.txt'), path.relative(REPO, out) + '\n');
process.exitCode = ok ? 0 : 1;
