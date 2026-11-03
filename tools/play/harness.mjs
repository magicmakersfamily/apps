// Shared browser harness for App Shelf game checks (dev only, never published).
// One launcher for Chrome, Firefox and WebKit (Safari's engine) via Playwright, a tiny static server,
// a fixed random seed (Math.random is replaced before any game script runs), a stub PlayStation pad,
// and run records written as JSON under tools/play/out/. Game-specific bots live in each game's tools/ folder.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium, firefox, webkit } from 'playwright';

export const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BROWSERS = ['chromium', 'firefox', 'webkit'];
const OUTSIDE = /fonts\.(googleapis|gstatic)\.com|net::ERR_FAILED|ERR_INTERNET_DISCONNECTED|Failed to load resource/;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

/* ---------- static server for the repo (python's http.server resets connections under load) ---------- */
export function serve(root = REPO) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(root, p);
      if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
      fs.readFile(f, (err, buf) => {
        if (err) { res.writeHead(404); return res.end('not found'); }
        res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
        res.end(buf);
      });
    });
    srv.unref();   // never keeps a finished run alive
    srv.listen(0, '127.0.0.1', () => resolve({ url: 'http://127.0.0.1:' + srv.address().port + '/', close: () => srv.close() }));
  });
}

/* PLAY_BASE (set by tools/check.mjs) or a server started for this process */
let own = null;
export async function baseUrl() {
  if (process.env.PLAY_BASE) return process.env.PLAY_BASE;
  if (!own) own = await serve();
  return own.url;
}
export function stopServer() { if (own) { own.close(); own = null; } }

/* ---------- page setup scripts (run before the game's own scripts) ---------- */
function seedScript(seed) {
  if (seed == null) return;
  let a = seed >>> 0;
  Math.random = function () {   // mulberry32
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__seed = seed;
}
function padScript(mapping) {
  const idx = { cross: 0, circle: 1, square: 2, tri: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, up: 12, down: 13, left: 14, right: 15 };
  const raw = { square: 0, cross: 1, circle: 2, tri: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9 };
  const std = mapping !== 'raw';
  const pad = {
    id: std ? 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)' : '054c-09cc-Wireless Controller',
    index: 0, connected: true, mapping: std ? 'standard' : '', timestamp: 0,
    axes: std ? [0, 0, 0, 0] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 3.2857],
    buttons: Array.from({ length: std ? 17 : 14 }, () => ({ pressed: false, touched: false, value: 0 }))
  };
  window.__pad = pad;
  // set({ cross: true, lx: 1 }) presses buttons / moves the left stick; set({}) releases everything
  window.__padSet = function (s) {
    const map = std ? idx : raw;
    pad.buttons.forEach((b) => { b.pressed = false; b.value = 0; });
    for (const k in s) if (s[k] && map[k] !== undefined) { pad.buttons[map[k]].pressed = true; pad.buttons[map[k]].value = 1; }
    pad.axes[0] = s.lx || 0; pad.axes[1] = s.ly || 0; pad.timestamp++;
  };
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: function () { return [pad, null, null, null]; } });
  addEventListener('load', () => { try { const e = new Event('gamepadconnected'); e.gamepad = pad; dispatchEvent(e); } catch (er) {} });
}

/* ---------- launch ---------- */
export async function launch({ browser = process.env.BROWSER || 'chromium', url, w = 1280, h = 800, seed, pad, readyExpr, mobile = false, offline = true } = {}) {
  let b;
  if (browser === 'chromium') {
    // the family's real Chrome when it is installed, Playwright's Chromium otherwise
    try { b = await chromium.launch({ channel: 'chrome', args: ['--autoplay-policy=no-user-gesture-required'] }); }
    catch (e) { b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); }
  } else if (browser === 'firefox') b = await firefox.launch({ firefoxUserPrefs: { 'media.autoplay.default': 0 } });
  else if (browser === 'webkit') b = await webkit.launch();
  else throw new Error('unknown browser ' + browser + ' (use ' + BROWSERS.join(', ') + ')');
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: mobile && browser !== 'firefox', hasTouch: mobile });
  if (seed != null) await ctx.addInitScript(seedScript, seed);
  if (pad) await ctx.addInitScript(padScript, pad === true ? 'standard' : pad);
  // offline by default: only the local server answers, so runs never depend on the network (Google Fonts fall back)
  if (offline) await ctx.route((u) => !u.href.startsWith('http://127.0.0.1') && /^https?:/.test(u.href), (r) => r.abort());
  const page = await ctx.newPage();
  const logs = [], errors = [];
  page.on('console', (m) => { const t = m.type() + ': ' + m.text(); logs.push(t); if (m.type() === 'error' && !(offline && OUTSIDE.test(m.text()))) errors.push({ kind: 'console', text: m.text() }); });
  page.on('pageerror', (e) => { logs.push('EXCEPTION: ' + e.message); errors.push({ kind: 'exception', text: e.message, stack: (e.stack || '').split('\n').slice(0, 4).join(' | ') }); });
  page.on('requestfailed', (r) => { if (r.url().startsWith('http://127.0.0.1')) errors.push({ kind: 'request', text: 'failed to load ' + new URL(r.url()).pathname }); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1') && !r.url().endsWith('favicon.ico')) errors.push({ kind: 'request', text: r.status() + ' ' + new URL(r.url()).pathname }); });
  const api = {
    page, ctx, browser: b, browserName: browser, logs, errors, seed,
    async goto(u) { await page.goto(u, { waitUntil: 'load' }); },
    async eval(expr) { return page.evaluate(expr); },
    async ready(expr = readyExpr, ms = 15000) { if (!expr) return true; try { await page.waitForFunction(expr, null, { timeout: ms, polling: 100 }); return true; } catch (e) { return false; } },
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    async shot(p) { fs.mkdirSync(path.dirname(p), { recursive: true }); await page.screenshot({ path: p }); return p; },
    async key(type, code, key) { const k = key || code; if (type === 'keyDown') await page.keyboard.down(k); else await page.keyboard.up(k); },
    async tap(key) { await page.keyboard.press(key === ' ' ? 'Space' : key); },
    async click(x, y) { await page.mouse.click(x, y); },
    async resize(width, height) { await page.setViewportSize({ width, height }); },
    async close() { try { await b.close(); } catch (e) {} }
  };
  if (url) await api.goto(url);
  return api;
}

/* ---------- run records ---------- */
let gitInfo = null;
export function commit() {
  if (gitInfo) return gitInfo;
  try {
    const h = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
    const dirty = execSync('git status --porcelain', { cwd: REPO }).toString().trim() ? '+dirty' : '';
    gitInfo = h + dirty;
  } catch (e) { gitInfo = 'unknown'; }
  return gitInfo;
}
export function outDir() {
  const d = process.env.PLAY_OUT || path.join(REPO, 'tools/play/out', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(d, { recursive: true });
  process.env.PLAY_OUT = d;
  return d;
}
/* One record per run. `failures` are things that are broken (they fail the check); `findings` are design data
   (stalls, falls, a persona that never finished) that go in the report but never fail anything. */
export function record(fields) {
  const r = { commit: commit(), at: new Date().toISOString(), failures: [], findings: [], ...fields };
  const d = path.join(outDir(), 'runs'); fs.mkdirSync(d, { recursive: true });
  const name = [r.game, r.scenario, r.persona, r.browser, r.seed].filter((x) => x != null).join('_').replace(/[^\w.-]+/g, '-');
  fs.writeFileSync(path.join(d, name + '.json'), JSON.stringify(r, null, 1));
  return r;
}
