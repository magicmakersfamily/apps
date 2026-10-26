import { spawn } from 'node:child_process';
import fs from 'node:fs';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export async function launch({ port = 9333, w = 1280, h = 720, url }) {
  const dir = fs.mkdtempSync('/tmp/guts-chrome-');
  const proc = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, '--window-size=' + w + ',' + h, '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=1', 'about:blank'], { stdio: 'ignore' });
  let targets;
  for (let i = 0; i < 50; i++) { try { targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json(); if (targets.length) break; } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  let id = 0; const pend = new Map(); const logs = [];
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    else if (d.method === 'Runtime.consoleAPICalled') logs.push(d.params.type + ': ' + d.params.args.map(a => a.value ?? a.description).join(' '));
    else if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    else if (d.method === 'Log.entryAdded') logs.push('log ' + d.params.entry.level + ': ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
  });
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable'); await send('Log.enable');
  const api = {
    logs, send,
    async goto(u) { await send('Page.navigate', { url: u }); await new Promise(r => setTimeout(r, 1500)); },
    async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception?.description || r.result.exceptionDetails)); return r.result.result.value; },
    async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path, Buffer.from(r.result.data, 'base64')); },
    async key(type, code, key) { await send('Input.dispatchKeyEvent', { type, code, key: key || code, windowsVirtualKeyCode: 0 }); },
    async resize(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); },
    sleep: (ms) => new Promise(r => setTimeout(r, ms)),
    close() { try { ws.close(); } catch (e) {} proc.kill(); }
  };
  if (url) await api.goto(url);
  return api;
}
