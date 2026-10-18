// Run with: node --test tools/
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { parse, check, openItems } from './tracker.mjs';

const head = '| ID | Type | Game | Title | Priority | Status | Found | Fixed in | Notes |\n|---|---|---|---|---|---|---|---|---|\n';
const doc = (open, closed) => `## Open\n\n${head}${open || ''}\n## Closed\n\n${head}${closed || ''}`;
const row = (id, o = {}) => `| ${id} | ${o.type || (id.includes('-F') ? 'feature' : 'bug')} | ${o.game || id.replace(/-[FB]\d+$/, '')} | ${o.title || 'T'} | ${o.p || 'P2'} | ${o.status || 'planned'} | self | ${o.fixed || ''} | |\n`;

test('the real TRACKER.md has no problems', () => {
  const text = readFileSync(new URL('../TRACKER.md', import.meta.url), 'utf8');
  assert.deepStrictEqual(check(text), []);
  assert.ok(parse(text).rows.length > 10);
});

test('a clean file passes', () => {
  assert.deepStrictEqual(check(doc(row('blow-up-B1'), row('blow-up-F2', { status: 'done', fixed: '1.4' }))), []);
});

test('catches duplicates, bad ids, mismatched type, bad status and misplaced rows', () => {
  const p = check(doc(row('blow-up-B1') + row('blow-up-B1') + row('Blow_Up-1') + row('blow-up-F3', { type: 'bug' }) + row('blow-up-B4', { status: 'nope' }) + row('blow-up-B5', { status: 'done', fixed: '1.0' })));
  assert.ok(p.some(m => /duplicate/.test(m)));
  assert.ok(p.some(m => /ID must look like/.test(m)));
  assert.ok(p.some(m => /does not match the Type/.test(m)));
  assert.ok(p.some(m => /Status must be/.test(m)));
  assert.ok(p.some(m => /belong under Closed/.test(m)));
});

test('done needs a version, prefix must match game, wrong column count is reported', () => {
  assert.ok(check(doc('', row('blow-up-B1', { status: 'done' }))).some(m => /Fixed in/.test(m)));
  assert.ok(check(doc(row('blow-up-B1', { game: 'aquarium' }))).some(m => /prefix/.test(m)));
  assert.ok(check(doc('| a | b |\n')).some(m => /columns/.test(m)));
});

test('refuses anything that looks like an email address', () => {
  assert.ok(check(doc(row('blow-up-B1', { title: 'Reported by someone@example.com' }))).some(m => /email/.test(m)));
});

test('openItems sorts by priority, then doing before planned', () => {
  const t = doc(row('a-B1', { p: 'P2', status: 'planned' }) + row('a-B2', { p: 'P1', status: 'planned' }) + row('a-B3', { p: 'P1', status: 'doing' }) + row('b-B1', { p: 'P0', status: 'idea' }));
  assert.deepStrictEqual(openItems(parse(t).rows).map(r => r.id), ['b-B1', 'a-B3', 'a-B2', 'a-B1']);
  assert.deepStrictEqual(openItems(parse(t).rows, 'a').length, 3);
});
