// Smoke check for Magic Music Maker: the page boots with no errors on laptop and phone, the version line and footer are
// there, a pretend hum goes to step 2, the song renders with sound, every band renders, and nothing scrolls sideways.
// Usage: node music-maker/tools/smoke.mjs [--browser chromium|firefox|webkit|all]
import { launch, baseUrl, record, outDir } from '../../tools/play/harness.mjs';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const which = arg('--browser', 'chromium');
const list = which === 'all' ? ['chromium', 'firefox', 'webkit'] : which.split(',');
let bad = 0;
for (const browser of list) {
  const failures = [];
  const fail = (where, text) => { failures.push({ type: 'smoke', where, text }); console.log('FAIL', browser, where, text); };
  for (const [w, h, label] of [[1280, 800, 'laptop'], [390, 844, 'phone']]) {
    const p = await launch({ browser, url: (await baseUrl()) + 'music-maker/', w, h, seed: 5, mobile: label !== 'laptop' });
    if (!(await p.ready('!!window.MME && document.getElementById("recBtn")'))) fail(label, 'page did not boot');
    const body = await p.eval('document.body.innerText');
    if (!/Version 1\.2 \(beta\)/.test(body)) fail(label, 'version line missing');
    if (!/Ko-fi/.test(body) || !/Tell a friend/.test(body)) fail(label, 'shelf footer incomplete');
    if (await p.eval('document.documentElement.scrollWidth > innerWidth + 1')) fail(label, 'page scrolls sideways at step 1');
    if (!(await p.eval('document.getElementById("tab2").disabled'))) fail(label, 'step 2 should be locked before recording');
    await p.shot(path.join(outDir(), `music-maker-${browser}-${label}-step1.png`));
    for (const [btn, mode] of [['demoHum', 'melody'], ['demoTap', 'rhythm']]) {
      if (await p.eval('document.getElementById("step1").hidden')) await p.page.click('#again');
      await p.page.click('#' + btn);
      if (!(await p.ready('!document.getElementById("step2").hidden && S.plan && S.plan.mode === "' + mode + '" && S.song && document.getElementById("busy").textContent === ""', 90000))) { fail(label, btn + ': no song after the example'); continue; }
      if ((await p.eval('S.plan.mode')) !== mode) fail(label, btn + ': heard as ' + (await p.eval('S.plan.mode')) + ', wanted ' + mode);
      const rms = await p.eval('(() => { const d = S.song.getChannelData(0); let e = 0; for (let i = 0; i < d.length; i += 7) e += d[i] * d[i]; return Math.sqrt(e / (d.length / 7)); })()');
      if (!(rms > 0.03)) fail(label, btn + ': rendered song is nearly silent (rms ' + rms + ')');
      if (await p.eval('document.documentElement.scrollWidth > innerWidth + 1')) fail(label, btn + ': page scrolls sideways at step 2');
      if (!(await p.eval('S.playing'))) fail(label, btn + ': song did not start playing by itself');
    }
    // Pop star is on by default: the tuned voice must sit on the band's notes, the backing singers on a third above and below
    if (await p.eval('document.getElementById("step1").hidden')) await p.page.click('#again');
    await p.page.click('#demoHum');
    if (!(await p.ready('!document.getElementById("step2").hidden && S.plan && S.plan.mode === "melody" && S.tuned && document.getElementById("busy").textContent === ""', 90000))) fail(label, 'Pop star did not tune the hum');
    else {
      const tune = await p.eval(`(() => { const E = MME, sr = S.tuned.lead.sampleRate, out = {};
        for (const [k, steps] of [['lead', 0], ['up', 2], ['dn', -2]]) {
          const a = E.analyze(E.toMono16k([S.tuned[k].getChannelData(0)], sr)); let n = 0, worst = 0;
          for (const m of S.plan.notes) { const f = a.notes.find((x) => Math.abs(x.s - m.s) < .25); if (!f) continue; n++; worst = Math.max(worst, Math.abs(f.p - ((steps ? E.scaleStep(m.q, steps, S.plan.key) : m.q) + S.plan.tune))); }
          out[k] = { matched: n, of: S.plan.notes.length, worst: +worst.toFixed(3) }; }
        return out; })()`);
      for (const k of ['lead', 'up', 'dn']) if (!(tune[k].matched >= tune[k].of - 2 && tune[k].worst < 0.2)) fail(label, 'tuned ' + k + ' off the notes: ' + JSON.stringify(tune[k]));
      const sec = await p.eval('(() => { const d = S.song.getChannelData(0), sr = S.song.sampleRate, b = S.arr.sections.find((x) => x.id === "band"); let e = 0, n = 0; for (let i = Math.floor(b.t0 * sr); i < Math.floor(b.t1 * sr); i += 5) { e += d[i] * d[i]; n++; } return Math.sqrt(e / n); })()');
      if (!(sec > 0.03)) fail(label, 'the chorus is nearly silent (rms ' + sec + ')');
    }
    for (const v of ['natural', 'echo', 'robot', 'pop']) {
      await p.page.click('#voice button[data-v="' + v + '"]');
      if (!(await p.ready('S.voice === "' + v + '" && document.getElementById("busy").textContent === "" && document.querySelector("#voice [aria-pressed=true]").dataset.v === "' + v + '" && !!document.getElementById("voiceNote").textContent', 90000))) { fail(label, 'voice ' + v + ' did not finish rendering'); continue; }
      const r = await p.eval('(() => { const d = S.song.getChannelData(0); let e = 0; for (let i = 0; i < d.length; i += 7) e += d[i] * d[i]; return Math.sqrt(e / (d.length / 7)); })()');
      if (!(r > 0.03)) fail(label, 'voice ' + v + ': song is nearly silent (rms ' + r + ')');
    }
    await p.page.click('#styles button:nth-child(5)');
    if (!(await p.ready('document.getElementById("busy").textContent === "" && S.style === "orchestra"', 90000))) fail(label, 'choosing a band did not finish rendering');
    await p.page.click('#playBtn'); await p.sleep(200);
    if (await p.eval('S.playing')) fail(label, 'pause button did not pause');
    await p.shot(path.join(outDir(), `music-maker-${browser}-${label}-step2.png`));
    await p.page.click('#again');
    if (await p.eval('document.getElementById("step1").hidden')) fail(label, 'Sing a new one did not return to step 1');
    for (const e of p.errors) fail(label, e.kind + ': ' + e.text);
    await p.close();
  }
  record({ game: 'music-maker', scenario: 'smoke', browser, failures });
  bad += failures.length;
}
console.log(bad ? `music-maker smoke: ${bad} failure(s)` : 'music-maker smoke: ok');
process.exit(bad ? 1 : 0);
