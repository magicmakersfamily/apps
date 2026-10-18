#!/usr/bin/env node
// Check and list TRACKER.md.
//   node tools/tracker.mjs                  summary by game, then problems (exit 1 if any)
//   node tools/tracker.mjs --check          problems only (for a pre-commit run)
//   node tools/tracker.mjs --game <folder>  open items for one game, most urgent first
//   node tools/tracker.mjs --next [n]       the n most urgent open items across the shelf (default 5)
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const TYPES = ['feature', 'bug'];
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3'];
export const OPEN = ['idea', 'planned', 'doing', 'testing'];
export const CLOSED = ['done', 'dropped'];
const COLS = ['id', 'type', 'game', 'title', 'priority', 'status', 'found', 'fixedIn', 'notes'];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

// Read the rows under "## Open" and "## Closed". Returns { rows: [{...cols, section, line}], problems: [] }.
export function parse(text) {
  const rows = [], problems = [];
  let section = null;
  text.split('\n').forEach((raw, i) => {
    const line = i + 1;
    const h = /^##\s+(.*)$/.exec(raw);
    if (h) { section = /^open$/i.test(h[1].trim()) ? 'open' : /^closed$/i.test(h[1].trim()) ? 'closed' : null; return; }
    if (!section || !raw.startsWith('|')) return;
    const cells = raw.replace(/^\||\|\s*$/g, '').split('|').map(c => c.trim());
    if (cells[0] === 'ID' || /^-+$/.test(cells[0])) return;
    if (cells.length !== COLS.length) { problems.push(`line ${line}: expected ${COLS.length} columns, found ${cells.length}`); return; }
    const row = { section, line };
    COLS.forEach((c, k) => { row[c] = cells[k]; });
    rows.push(row);
  });
  return { rows, problems };
}

export function check(text) {
  const { rows, problems } = parse(text);
  const seen = new Map();
  const bad = (r, m) => problems.push(`line ${r.line} (${r.id || '?'}): ${m}`);
  rows.forEach(r => {
    const m = /^([a-z][a-z0-9-]*)-([FB])(\d+)$/.exec(r.id);
    if (!m) return bad(r, 'ID must look like <game-folder>-F<n> or -B<n>');
    if (seen.has(r.id)) bad(r, `duplicate ID (also line ${seen.get(r.id)})`); else seen.set(r.id, r.line);
    if (m[1] !== r.game) bad(r, `ID prefix "${m[1]}" does not match Game "${r.game}"`);
    if (!TYPES.includes(r.type)) bad(r, `Type must be one of ${TYPES.join(', ')}`);
    else if ((m[2] === 'F') !== (r.type === 'feature')) bad(r, 'the F/B in the ID does not match the Type');
    if (!PRIORITIES.includes(r.priority)) bad(r, `Priority must be one of ${PRIORITIES.join(', ')}`);
    if (![...OPEN, ...CLOSED].includes(r.status)) bad(r, `Status must be one of ${[...OPEN, ...CLOSED].join(', ')}`);
    if (r.section === 'open' && !OPEN.includes(r.status)) bad(r, 'done and dropped items belong under Closed');
    if (r.section === 'closed' && !CLOSED.includes(r.status)) bad(r, 'open items belong under Open');
    if (r.status === 'done' && !/^\d+(\.\d+)*$/.test(r.fixedIn)) bad(r, 'a done item needs "Fixed in" (a version like 1.7)');
    if (!r.title) bad(r, 'empty Title');
    if (EMAIL.test(raw(r))) bad(r, 'looks like an email address: keep personal details out of this public file');
  });
  return problems;
}
const raw = r => COLS.map(c => r[c]).join(' ');

const urgency = r => PRIORITIES.indexOf(r.priority) * 10 + (r.status === 'doing' ? 0 : r.status === 'testing' ? 1 : r.status === 'planned' ? 2 : 3);
export function openItems(rows, game) {
  return rows.filter(r => r.section === 'open' && (!game || r.game === game)).sort((a, b) => urgency(a) - urgency(b) || a.line - b.line);
}
const fmt = r => `${r.priority} ${r.status.padEnd(7)} ${r.id.padEnd(20)} ${r.title}`;

function main(argv) {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'TRACKER.md');
  const text = readFileSync(file, 'utf8');
  const { rows } = parse(text);
  const problems = check(text);
  const gi = argv.indexOf('--game'), ni = argv.indexOf('--next');
  if (gi >= 0) openItems(rows, argv[gi + 1]).forEach(r => console.log(fmt(r)));
  else if (ni >= 0) openItems(rows).slice(0, Number(argv[ni + 1]) || 5).forEach(r => console.log(fmt(r)));
  else if (!argv.includes('--check')) {
    const games = [...new Set(rows.map(r => r.game))].sort();
    console.log('game'.padEnd(16) + 'open  bugs  P0/P1  closed');
    games.forEach(g => {
      const o = rows.filter(r => r.game === g && r.section === 'open');
      console.log(g.padEnd(16) + String(o.length).padEnd(6) + String(o.filter(r => r.type === 'bug').length).padEnd(6) +
        String(o.filter(r => r.priority === 'P0' || r.priority === 'P1').length).padEnd(7) + rows.filter(r => r.game === g && r.section === 'closed').length);
    });
  }
  if (problems.length) { console.error('\nProblems:\n' + problems.map(p => '  ' + p).join('\n')); process.exit(1); }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
