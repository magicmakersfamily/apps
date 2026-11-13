// A made-up tune, hummed imperfectly: sharp of concert pitch, wobbly, tempo drifting, started late.
function hum(sr, opts) {
  opts = opts || {};
  const cents = opts.cents ?? 35, deg = [0,0,4,4,7,7,4,-1, 5,5,4,4,2,2,0,-1, 7,9,7,4,5,4,2,-1, 0,2,4,2,0,0,0,-1];
  const tonic = opts.tonic ?? 67, out = []; let t = opts.lead ?? 0.7, beat = opts.beat ?? 0.56, seed = 7;
  const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const notes = [];
  deg.forEach((d, i) => { const b = beat * (1 + 0.06 * Math.sin(i / 5)) * (1 + (r() - .5) * 0.06); if (d >= 0) notes.push({ s: t, e: t + b * 0.82, m: tonic + d + cents / 100 + (r() - .5) * 0.3 }); t += b; });
  const n = Math.floor((t + 0.5) * sr), x = new Float32Array(n);
  for (const nt of notes) { let ph = 0; const i0 = Math.floor(nt.s * sr), i1 = Math.floor(nt.e * sr);
    for (let i = i0; i < i1; i++) { const u = (i - i0) / sr, f = 440 * Math.pow(2, (nt.m - 69 + 0.25 * Math.sin(2 * Math.PI * 5.5 * u) + 0.6 * Math.exp(-u * 30) * -1) / 12);
      ph += 2 * Math.PI * f / sr; const a = Math.min(1, u * 25) * Math.min(1, (nt.e - nt.s - u) * 18);
      x[i] += 0.25 * a * (Math.sin(ph) + 0.4 * Math.sin(2 * ph) + 0.2 * Math.sin(3 * ph)); } }
  for (let i = 0; i < n; i++) x[i] += (r() - .5) * 0.006;
  return { x, notes, tonic };
}
function taps(sr) { const times = [0.5,1.0,1.25,1.5,2.0,2.5,2.75,3.0,3.5,4.0,4.25,4.5,5.0,5.5,6.0,6.5,6.75,7.0,7.5,8.0]; const n = Math.floor(9 * sr), x = new Float32Array(n); let seed = 3; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const t of times) { const i0 = Math.floor(t * sr); for (let i = 0; i < sr * 0.06; i++) x[i0 + i] += 0.5 * Math.exp(-i / (sr * 0.012)) * (r() * 2 - 1); }
  for (let i = 0; i < n; i++) x[i] += (r() - .5) * 0.004; return { x, times }; }
if (typeof module !== 'undefined' && module.exports) module.exports = { hum, taps }; else { self.demoHum = hum; self.demoTaps = taps; }
