// "My songs" check: two recordings are kept, then star, rename, new folder, drag onto a folder, drag to reorder,
// re-open keeps the band, delete with Undo, delete for good, "Save all my songs" + "Bring back", and everything survives a page reload.
// Recordings go in through "Use a recording" (a made-up hum as a WAV), the same path as the microphone's saved Blob.
// Usage: node music-maker/tools/songs.mjs [--browser chromium|firefox|webkit|all]
import { launch, baseUrl, record, outDir } from '../../tools/play/harness.mjs';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { hum } = require('../demo.js');
const MML = require('../library.js');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const which = arg('--browser', 'chromium');
const list = which === 'all' ? ['chromium', 'firefox', 'webkit'] : which.split(',');

function wavFile(file, cents) {
  const sr = 22050, { x } = hum(sr, { cents, lead: .6 }), n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-1, Math.min(1, x[i] * 2)) * 32767 | 0, 44 + i * 2);
  fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, b); return file;
}
const W1 = wavFile(path.join(outDir(), 'mm-song-a.wav'), 35), W2 = wavFile(path.join(outDir(), 'mm-song-b.wav'), -20);

let bad = 0;
for (const browser of list) {
  const failures = [];
  const fail = (where, text) => { failures.push({ type: 'songs', where, text }); console.log('FAIL', browser, where, text); };
  for (const [w, h, label] of [[1280, 800, 'laptop'], [390, 844, 'phone']]) {
    const p = await launch({ browser, url: (await baseUrl()) + 'music-maker/', w, h, mobile: label !== 'laptop' });
    const pg = p.page;
    const idle = 'document.getElementById("busy").textContent === "" && S.song';
    const names = () => p.eval('[...document.querySelectorAll("#songList .song .sname")].map((e) => e.textContent.trim().replace(/^\\S+\\s/, ""))');
    const count = () => p.eval('document.querySelectorAll("#songList .song").length');
    const back = async () => { if (await p.eval('document.getElementById("step1").hidden')) await pg.click('#again'); await p.ready('!document.getElementById("step1").hidden'); };
    const dragTo = async (fromSel, toSel, dy) => {
      const a = await pg.locator(fromSel).boundingBox(), b = toSel ? await pg.locator(toSel).boundingBox() : null;
      const tx = b ? b.x + b.width / 2 : a.x + a.width / 2, ty = b ? b.y + b.height / 2 : a.y + a.height / 2 + dy;
      await pg.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await pg.mouse.down();
      for (let k = 1; k <= 12; k++) { await pg.mouse.move(a.x + a.width / 2 + (tx - a.x - a.width / 2) * k / 12, a.y + a.height / 2 + (ty - a.y - a.height / 2) * k / 12); await p.sleep(30); }
      await p.sleep(120); await pg.mouse.up(); await p.sleep(250);
    };
    try {
      if (!(await p.ready('!!window.MML && document.getElementById("songsEmpty") && !document.getElementById("songsEmpty").hidden'))) fail(label, 'empty My songs list did not show');
      // two recordings, kept newest first; an example is not kept
      for (const f of [W1, W2]) {
        await back(); await pg.setInputFiles('#file', f);
        if (!(await p.ready('!document.getElementById("step2").hidden && S.cur && ' + idle, 90000))) fail(label, 'a recording was not kept');
      }
      if (!/Kept in My songs as “My song 2”/.test(await p.eval('document.getElementById("songNow").textContent'))) fail(label, 'step 2 does not say the song is kept');
      await back(); await pg.click('#demoHum'); await p.ready('!document.getElementById("step2").hidden && ' + idle, 90000);
      if (!/not kept/.test(await p.eval('document.getElementById("songNow").textContent'))) fail(label, 'the example should say it is not kept');
      await back();
      await p.ready('document.querySelectorAll("#songList .song").length === 2', 5000);
      if (JSON.stringify(await names()) !== '["My song 2","My song 1"]') fail(label, 'list order/names: ' + JSON.stringify(await names()));
      if (await p.eval('document.documentElement.scrollWidth > innerWidth + 1')) fail(label, 'My songs makes the page scroll sideways');

      // star, rename
      await pg.click('#songList .song:nth-child(2) .sstar');
      if ((await p.eval('document.querySelector("#folders [data-f=star] .n").textContent')) !== '1') fail(label, 'star count did not go to 1');
      await pg.click('#songList .song:nth-child(1) .smore'); await pg.click('#songList .smenu [data-act=rename]');
      await pg.fill('.rename-in', 'Dragon song'); await pg.keyboard.press('Enter');
      if ((await names())[0] !== 'Dragon song') fail(label, 'rename did not stick: ' + JSON.stringify(await names()));
      await pg.click('#songList .song:nth-child(1) .smore');
      if (await p.eval('document.documentElement.scrollWidth > innerWidth + 1')) fail(label, 'open song menu scrolls sideways');
      await pg.click('#songList .song:nth-child(1) .smore');

      // a folder, then drag "Dragon song" onto it, then drag to reorder
      await pg.click('#newFolder'); await pg.fill('#folderIn', 'Bedtime'); await pg.keyboard.press('Enter');
      const fid = await p.eval('(lib.folders[0] || {}).id');
      if (!fid) fail(label, 'new folder was not made');
      else {
        await dragTo('#songList .song:nth-child(1) .grip', '#folders [data-f="' + fid + '"]');
        if ((await p.eval('document.querySelector(\'#folders [data-f="' + fid + '"] .n\').textContent')) !== '1') fail(label, 'drag onto a folder did not file the song');
      }
      await dragTo('#songList .song:nth-child(1) .grip', null, 110);
      if (JSON.stringify(await names()) !== '["My song 1","Dragon song"]') fail(label, 'drag to reorder: ' + JSON.stringify(await names()));
      // keyboard move with the arrows on the dots
      await pg.focus('#songList .song:nth-child(2) .grip'); await pg.keyboard.press('ArrowUp');
      if (JSON.stringify(await names()) !== '["Dragon song","My song 1"]') fail(label, 'arrow keys did not move: ' + JSON.stringify(await names()));

      // re-open keeps the band that was picked
      await pg.click('#songList .song:nth-child(1) .splay');
      if (!(await p.ready('!document.getElementById("step2").hidden && S.cur && ' + idle, 90000))) fail(label, 're-open did not reach step 2');
      await pg.click('#styles button[data-id="rock"]').catch(() => pg.click('#styles button:nth-child(3)'));
      await p.ready('S.style === "rock" && ' + idle, 90000); await p.sleep(400);
      await back(); await pg.click('#songList .song:nth-child(2) .splay'); await p.ready('!document.getElementById("step2").hidden && ' + idle, 90000);
      await back(); await pg.click('#songList .song:nth-child(1) .splay'); await p.ready('!document.getElementById("step2").hidden && ' + idle, 90000);
      if ((await p.eval('S.style')) !== 'rock') fail(label, 're-opened song lost its band: ' + (await p.eval('S.style')));
      await back();

      // survives a reload
      await p.sleep(400); await pg.reload(); await p.ready('!!window.MML && document.querySelectorAll("#songList .song").length === 2', 10000);
      if (JSON.stringify(await names()) !== '["Dragon song","My song 1"]') fail(label, 'after reload: ' + JSON.stringify(await names()));
      if ((await p.eval('lib.songs.filter((s) => s.star).length')) !== 1 || !(await p.eval('lib.folders.length === 1 && lib.songs.some((s) => s.folder === lib.folders[0].id)'))) fail(label, 'star or folder lost after reload');

      // "Save all my songs" downloads one zip holding the list and both recordings
      let zipFile = null;
      if (await p.eval('document.getElementById("saveAll").hidden')) fail(label, 'Save all my songs is hidden');
      try {
        const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 15000 }), pg.click('#saveAll')]);
        zipFile = path.join(outDir(), `mm-backup-${browser}-${label}.zip`); await dl.saveAs(zipFile);
        if (!/^my-magic-songs-\d{4}-\d\d-\d\d\.zip$/.test(dl.suggestedFilename())) fail(label, 'backup file name: ' + dl.suggestedFilename());
        const files = MML.unzip(new Uint8Array(fs.readFileSync(zipFile))) || [];
        const songsIn = files.filter((f) => /^Songs\/0[12] .+\.wav$/.test(f.name) && f.data.length > 1000).length;
        if (files.length !== 3 || files[0].name !== 'my-songs.json' || songsIn !== 2) fail(label, 'backup zip holds: ' + files.map((f) => f.name + ':' + f.data.length).join(', '));
      } catch (e) { zipFile = null; fail(label, 'Save all my songs did not download: ' + String(e.message || e).split('\n')[0]); }

      // delete, Undo, then delete for good
      await pg.click('#songList .song:nth-child(2) .smore'); await pg.click('#songList .smenu [data-act=delete]');
      if ((await count()) !== 1 || (await p.eval('document.getElementById("toast").hidden'))) fail(label, 'delete did not hide the song or show Undo');
      await pg.click('#toastUndo');
      if ((await count()) !== 2) fail(label, 'Undo did not bring the song back');
      await pg.click('#songList .song:nth-child(2) .smore'); await pg.click('#songList .smenu [data-act=delete]');
      await p.eval('finishDeletes()'); await p.sleep(400);
      await pg.reload(); await p.ready('!!window.MML && document.querySelectorAll("#songList .song").length >= 1', 10000); await p.sleep(300);
      if ((await count()) !== 1) fail(label, 'deleted song came back after reload');
      if ((await p.eval('store.getAudio(lib.songs[0].id).then((b) => !!b && b.size > 1000)')) !== true) fail(label, 'the kept recording is missing');

      // the deleted song comes back from the "Save all my songs" file made before deleting it; bringing it back twice makes no copy
      if (zipFile) {
        await pg.setInputFiles('#backupFile', zipFile);
        await p.ready('document.querySelectorAll("#songList .song").length === 2', 8000); await p.sleep(400);
        if ((await count()) !== 2) fail(label, 'Bring back did not bring the deleted song back');
        if (!/Brought back 1 song/.test(await p.eval('document.getElementById("toastText").textContent'))) fail(label, 'Bring back message: ' + (await p.eval('document.getElementById("toastText").textContent')));
        if ((await p.eval('Promise.all(lib.songs.map((s) => store.getAudio(s.id))).then((bs) => bs.every((b) => b && b.size > 1000))')) !== true) fail(label, 'a brought-back recording is missing');
        await pg.setInputFiles('#backupFile', zipFile); await p.sleep(600);
        if ((await count()) !== 2 || !/already here/.test(await p.eval('document.getElementById("toastText").textContent'))) fail(label, 'bringing back twice made copies');
        await p.sleep(400); await pg.reload(); await p.ready('!!window.MML && document.querySelectorAll("#songList .song").length === 2', 10000);
        if ((await count()) !== 2) fail(label, 'brought-back song lost after reload');
      }
      await p.shot(path.join(outDir(), `music-maker-songs-${browser}-${label}.png`));
    } catch (e) { fail(label, 'crashed: ' + String(e.message || e).split('\n')[0]); }
    for (const e of p.errors) fail(label, e.kind + ': ' + e.text);
    await p.close();
  }
  record({ game: 'music-maker', scenario: 'songs', browser, failures });
  bad += failures.length;
}
console.log(bad ? `music-maker songs: ${bad} failure(s)` : 'music-maker songs: ok');
process.exit(bad ? 1 : 0);
