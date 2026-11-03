// Turns a folder of run records (tools/play/out/<run>/runs/*.json) into one short ranked report:
// broken things first (grouped, so 30 runs hitting one bug are one line with a count and one command to
// reproduce it), then design data per persona (finish rate, where players stall or fall), then speed.
// Usage: node tools/play/report.mjs [out-folder]   (default: the newest run)
import fs from 'node:fs';
import path from 'node:path';
import { REPO } from './harness.mjs';

const SEVERITY = { exception: 1, error: 1, invariant: 2, softlock: 3, progression: 4, flow: 5, input: 5, layout: 6 };
const bucket = (where) => String(where || '').replace(/tile (\d+)(,\d+)?/, (_, x) => 'near tile ' + Math.round(x / 5) * 5);
const norm = (t) => String(t || '').replace(/\d+(\.\d+)?/g, '#').replace(/\s+/g, ' ').slice(0, 160);
const median = (a) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0) + '%';

export function repro(r) {
  if (r.scenario === 'persona') return `node guts/tools/personas.mjs --persona ${r.persona} --seed ${r.seed} --browser ${r.browser}`;
  if (r.scenario && r.scenario.startsWith('smoke')) return `node ${r.game}/tools/smoke.mjs --browser ${r.browser}`;
  return `BROWSER=${r.browser} node ${r.game}/tools/${r.scenario}.mjs`;
}

export function build(dir) {
  const files = fs.existsSync(path.join(dir, 'runs')) ? fs.readdirSync(path.join(dir, 'runs')).filter((f) => f.endsWith('.json')) : [];
  const runs = files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, 'runs', f), 'utf8')));
  const commit = runs[0] ? runs[0].commit : 'unknown';

  /* ---- broken: cluster identical failures ---- */
  const clusters = new Map();
  for (const r of runs) for (const f of r.failures || []) {
    const key = [r.game, f.type, bucket(f.where), norm(f.text)].join('|');
    if (!clusters.has(key)) clusters.set(key, { game: r.game, type: f.type, where: bucket(f.where), text: f.text, runs: [], browsers: new Set(), who: new Set() });
    const c = clusters.get(key); c.runs.push(r); c.browsers.add(r.browser); c.who.add(r.persona || r.scenario);
  }
  const broken = [...clusters.values()].sort((a, b) => (SEVERITY[a.type] || 9) - (SEVERITY[b.type] || 9) || b.runs.length - a.runs.length);

  /* ---- design data per persona ---- */
  const personas = {};
  for (const r of runs.filter((x) => x.scenario === 'persona')) {
    const p = personas[r.persona] || (personas[r.persona] = { runs: 0, clear: 0, times: [], furthest: [], coverage: [], falls: 0, blowouts: 0, helper: 0, spots: {} });
    p.runs++; if (r.status === 'clear') { p.clear++; p.times.push(r.gameSeconds); }
    p.furthest.push(r.furthestTile); p.coverage.push(r.coverage); p.falls += r.falls || 0; p.blowouts += r.blowouts || 0; p.helper += r.helperSnacks || 0;
    const seen = new Set();
    for (const f of r.findings || []) {
      const k = f.type + ' ' + bucket(f.where); if (seen.has(k)) continue; seen.add(k);
      (p.spots[k] = p.spots[k] || { type: f.type, where: bucket(f.where), runs: 0, example: r }).runs++;
    }
  }
  /* hotspots across all personas: places where several runs got stuck, fell or gave up */
  const hot = {};
  for (const [name, p] of Object.entries(personas)) for (const s of Object.values(p.spots)) {
    const k = s.type + ' ' + s.where; (hot[k] = hot[k] || { type: s.type, where: s.where, runs: 0, personas: new Set(), example: s.example }).runs += s.runs; hot[k].personas.add(name);
  }
  const hotspots = Object.values(hot).filter((h) => h.type !== 'fall' || h.runs > 1).sort((a, b) => b.personas.size - a.personas.size || b.runs - a.runs).slice(0, 8);

  /* ---- speed ---- */
  const speed = {};
  for (const r of runs) {
    const s = speed[r.browser] || (speed[r.browser] = { upd: [], rnd: [], fps: [] });
    if (r.updateMs) s.upd.push(r.updateMs.p95); if (r.renderMs) s.rnd.push(r.renderMs.p95); if (r.fps) s.fps.push(r.fps);
  }

  /* ---- write ---- */
  const L = [];
  const scen = [...new Set(runs.map((r) => r.scenario))];
  L.push(`# Play check report`, ``, `Commit ${commit} · ${runs.length} runs (${scen.join(', ')}) · ${[...new Set(runs.map((r) => r.browser))].join(', ')} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`, ``);
  L.push(`## Broken (${broken.length ? broken.length + ' distinct, ' + broken.reduce((n, c) => n + c.runs.length, 0) + ' runs' : 'none'})`, ``);
  if (!broken.length) L.push(`Nothing broken: no errors, crashes, invariant breaks or blocked progress in any run.`, ``);
  broken.forEach((c, i) => {
    const ex = c.runs[0];
    L.push(`${i + 1}. **${c.type}** · ${c.game} · ${c.where}: ${c.text}`);
    L.push(`   ${c.runs.length} run${c.runs.length > 1 ? 's' : ''} · ${[...c.browsers].join(', ')} · ${[...c.who].join(', ')}`);
    L.push(`   Reproduce: \`${repro(ex)}\`` + (ex.screenshot ? ` · screenshot: ${path.relative(REPO, ex.screenshot)}` : ''));
  });
  if (Object.keys(personas).length) {
    L.push(``, `## How the personas played (design data, never a failure)`, ``);
    L.push(`| persona | runs | finished | median time | furthest (median tile) | coverage | falls | blowouts | helper snacks |`, `|---|---|---|---|---|---|---|---|---|`);
    for (const [n, p] of Object.entries(personas)) L.push(`| ${n} | ${p.runs} | ${p.clear} (${pct(p.clear, p.runs)}) | ${p.times.length ? median(p.times) + ' s' : '–'} | ${median(p.furthest)} | ${median(p.coverage)}% | ${p.falls} | ${p.blowouts} | ${p.helper} |`);
    if (hotspots.length) {
      L.push(``, `**Hotspots** (where runs stalled 20 s, fell, or gave up; most personas first):`, ``);
      hotspots.forEach((h) => L.push(`- ${h.type} ${h.where}: ${h.runs} run${h.runs > 1 ? 's' : ''}, ${[...h.personas].join(', ')} · e.g. \`${repro(h.example)}\``));
    }
  }
  L.push(``, `## Speed`, ``);
  for (const [b, s] of Object.entries(speed)) {
    const parts = [];
    if (s.upd.length) parts.push(`game update p95 ${Math.max(...s.upd)} ms`);
    if (s.rnd.length) parts.push(`draw p95 ${Math.max(...s.rnd)} ms`);
    if (s.fps.length) parts.push(`real-time ${Math.min(...s.fps)} fps (headless)`);
    if (parts.length) L.push(`- ${b}: ${parts.join(' · ')}`);
  }
  L.push(``, `Budget: one frame is 16.7 ms at 60 fps. Headless browsers draw without the graphics card, so fps here is a floor, not what a player sees.`);
  const md = L.join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'report.md'), md);
  fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ commit, runs: runs.length, broken: broken.map((c) => ({ type: c.type, game: c.game, where: c.where, text: c.text, runs: c.runs.length, repro: repro(c.runs[0]) })), personas: Object.fromEntries(Object.entries(personas).map(([n, p]) => [n, { runs: p.runs, clear: p.clear, medianSeconds: median(p.times) }])) }, null, 1));
  return { md, broken, runs };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const root = path.join(REPO, 'tools/play/out');
  const dir = process.argv[2] || path.join(root, fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory()).sort().pop());
  const { md } = build(dir);
  console.log(md);
  console.log('Report written to', path.join(dir, 'report.md'));
}
