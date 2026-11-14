// Renders each song (and the finale fanfare) to WAV with an OfflineAudioContext, so a grown-up can listen
// without playing the game. Usage: node robot-journey/tools/render-music.mjs <out-dir>   (dev only)
import fs from 'node:fs';
import path from 'node:path';
import { launch, baseUrl } from '../../tools/play/harness.mjs';
const out = process.argv[2] || 'robot-journey-music';
fs.mkdirSync(out, { recursive: true });
const p = await launch({ url: (await baseUrl()) + 'robot-journey/', w: 800, h: 600, seed: 11 });
await p.ready('!!window.RobotJourney');
const jobs = [['1-zone1-scrapyard-shuffle', 'scrapyard', 2], ['2-zone2-james-theme', 'james', 1], ['3-zone3-medley-in-d', 'spire', 1], ['4-bright-spot-fanfare', 'fanfare', 0], ['5-win-screen-james-theme-slow', 'victory', 1], ['6-robo-jam', 'robojam', 1]];
for (const [name, id, loops] of jobs) {
  const b64 = await p.page.evaluate(async ([id, loops]) => {
    const rate = 44100;
    const song = SONGS[id];
    const secs = id === 'fanfare' ? 7 : (60 / song.bpm / 4) * 16 * song.bars * loops + 2.5;
    const off = new OfflineAudioContext(2, Math.ceil(secs * rate), rate);
    const Real = window.AudioContext;
    window.AudioContext = function () { return off; };
    audioCtx = null; musicEnabled = true; soundEnabled = true;
    initAudio();
    clearInterval(Music.timer); Music.timer = null;
    musicBus.gain.value = MUSIC_LEVEL;
    if (id === 'fanfare') Music.fanfare();
    else {
      const sd = 60 / song.bpm / 4;
      for (let st = 0; st < 16 * song.bars * loops; st++) Music.playStep(song, st, 0.05 + st * sd, sd);
    }
    const buf = await off.startRendering();
    window.AudioContext = Real; audioCtx = null;
    // 16-bit WAV
    const n = buf.length, ch = 2, data = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const W = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
    W(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); W(8, 'WAVE'); W(12, 'fmt ');
    data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true); data.setUint32(24, rate, true);
    data.setUint32(28, rate * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true); W(36, 'data'); data.setUint32(40, n * ch * 2, true);
    const L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    for (let i = 0; i < n; i++) { data.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true); data.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const bytes = new Uint8Array(data.buffer); let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { b64: btoa(s), peak, secs };
  }, [id, loops]);
  const f = path.join(out, name + '.wav');
  fs.writeFileSync(f, Buffer.from(b64.b64, 'base64'));
  console.log(name, b64.secs.toFixed(1) + ' s', 'peak', b64.peak.toFixed(2), '->', f);
}
if (p.errors.length) console.log('errors', JSON.stringify(p.errors));
await p.close();
