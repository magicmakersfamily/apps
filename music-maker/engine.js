/* Magic Music Maker: the music model.
   Hears a free-time recording (no count-in), finds the notes, the singer's own tuning,
   the key and the pulse, then plans a band that follows the singer.
   Pure functions, no Web Audio here, so it can be tested with node. */
(function (root) {
'use strict';
const E = {};
const FR = 16000, HOP = 160, WIN = 512, MINTAU = 10, MAXTAU = 213, DT = HOP / FR;
E.FR = FR; E.DT = DT;

function median(a) { const b = Array.from(a).sort((x, y) => x - y), n = b.length; return n ? (n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2) : 0; }
function pct(a, p) { const b = Array.from(a).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : 0; }
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
E.rng = rng;

E.toMono16k = function (chs, sr) {
  const n = chs[0].length, m = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) m[i] += c[i] / chs.length;
  if (sr === FR) return m;
  const ratio = sr / FR, outN = Math.floor(n / ratio), out = new Float32Array(outN), k = Math.max(1, Math.floor(ratio));
  for (let i = 0; i < outN; i++) { const i0 = Math.floor(i * ratio); let s = 0, c = 0; for (let j = 0; j < k && i0 + j < n; j++) { s += m[i0 + j]; c++; } out[i] = s / c; }
  return out;
};

const KS_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const NOTE_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
E.NOTE_NAMES = NOTE_NAMES;
// diatonic triads: [semitones above tonic, quality]
const CHORDS = {
  major: [[0, 'M', 'I'], [2, 'm', 'ii'], [5, 'M', 'IV'], [7, 'M', 'V'], [9, 'm', 'vi']],
  minor: [[0, 'm', 'i'], [3, 'M', 'III'], [5, 'm', 'iv'], [7, 'm', 'v'], [8, 'M', 'VI'], [10, 'M', 'VII']]
};
const TRANS = { 'V>I': .3, 'v>i': .3, 'IV>V': .2, 'ii>V': .25, 'IV>I': .15, 'vi>IV': .2, 'I>IV': .1, 'I>V': .1, 'I>vi': .1, 'VII>i': .25, 'VI>VII': .2, 'iv>v': .15, 'i>VI': .1, 'i>iv': .1 };

/* ---------- hearing ---------- */
E.analyze = function (x) {
  const nF = Math.floor((x.length - WIN - MAXTAU - 2) / HOP);
  if (nF < 30) return { mode: 'empty' };
  const rms = new Float32Array(nF);
  for (let t = 0; t < nF; t++) { let s = 0; const o = t * HOP; for (let j = 0; j < WIN; j++) { const v = x[o + j]; s += v * v; } rms[t] = Math.sqrt(s / WIN); }
  const peak = pct(rms, .97), floor = pct(rms, .15);
  if (peak < 0.004) return { mode: 'empty' };
  const gate = Math.max(0.003, floor * 2.5, peak * 0.07);

  // pitch (YIN)
  const f0 = new Float32Array(nF), d = new Float32Array(MAXTAU + 3);
  let active = 0;
  for (let t = 0; t < nF; t++) {
    if (rms[t] < gate) continue;
    active++;
    const o = t * HOP; let run = 0;
    for (let tau = 1; tau <= MAXTAU + 1; tau++) {
      let s = 0;
      for (let j = 0; j < WIN; j += 2) { const df = x[o + j] - x[o + j + tau]; s += df * df; }
      run += s; d[tau] = run > 0 ? s * tau / run : 1;
    }
    let pick = -1, best = -1, bestV = 1e9;
    for (let tau = MINTAU; tau <= MAXTAU; tau++) {
      if (d[tau] < 0.15) { while (tau + 1 <= MAXTAU && d[tau + 1] < d[tau]) tau++; pick = tau; break; }
      if (d[tau] < bestV) { bestV = d[tau]; best = tau; }
    }
    if (pick < 0 && bestV < 0.3) pick = best;
    if (pick > 0) { const a = d[pick - 1], b = d[pick], c = d[pick + 1], den = a - 2 * b + c; const sh = den ? .5 * (a - c) / den : 0; f0[t] = FR / (pick + (Math.abs(sh) < 1 ? sh : 0)); }
  }

  // energy onsets (taps, claps, re-sung notes)
  const le = new Float32Array(nF), env = new Float32Array(nF), isOn = new Uint8Array(nF);
  for (let t = 0; t < nF; t++) le[t] = Math.log(rms[t] + 1e-4);
  for (let t = 3; t < nF; t++) env[t] = Math.max(0, le[t] - le[t - 3]);
  const onsets = []; let last = -99;
  for (let t = 3; t < nF - 3; t++) {
    if (env[t] > 0.7 && env[t] >= env[t - 1] && env[t] >= env[t + 1] && t - last >= 9 && Math.max(rms[t], rms[t + 1], rms[t + 2]) > gate) {
      onsets.push({ f: t, s: Math.min(3, env[t]) }); isOn[t] = 1; last = t;
    }
  }

  // notes
  const midi = new Float32Array(nF);
  for (let t = 0; t < nF; t++) midi[t] = f0[t] > 0 ? 69 + 12 * Math.log2(f0[t] / 440) : NaN;
  const sm = new Float32Array(nF);
  for (let t = 0; t < nF; t++) {
    if (isNaN(midi[t])) { sm[t] = NaN; continue; }
    const w = []; for (let k = -2; k <= 2; k++) { const v = midi[t + k]; if (t + k >= 0 && t + k < nF && !isNaN(v)) w.push(v); }
    sm[t] = median(w);
  }
  const raw = []; let cur = null, dev = 0, gap = 0, pend = [];
  const close = (endF) => { if (cur) { cur.end = endF; if (cur.end - cur.start >= 7) raw.push(cur); } cur = null; dev = 0; pend = []; };
  for (let t = 0; t < nF; t++) {
    const m = sm[t];
    if (isNaN(m)) { if (cur) { gap++; if (gap >= 4) { close(t - gap + 1); gap = 0; } } continue; }
    gap = 0;
    if (!cur) { cur = { start: t, vals: [m] }; continue; }
    const ref = median(cur.vals.slice(-12));
    if (Math.abs(m - ref) > 0.75) {
      dev++; pend.push(m);
      if (dev >= 4) { const st = t - dev + 1, vals = pend.slice(); close(st); cur = { start: st, vals }; }
    } else {
      dev = 0; pend = []; cur.vals.push(m);
      if (isOn[t] && t - cur.start >= 10) { close(t); cur = { start: t, vals: [m] }; }
    }
  }
  close(nF);
  let notes = raw.map(n => ({ s: n.start * DT, e: n.end * DT, p: median(n.vals.slice(Math.floor(n.vals.length * .2))) }));
  // merge neighbours that are really one note (same pitch, no gap, no fresh attack)
  const merged = [];
  for (const n of notes) {
    const q = merged[merged.length - 1];
    if (q && n.s - q.e < 0.03 && Math.abs(n.p - q.p) < 0.45 && !isOn[Math.round(n.s / DT)]) q.e = n.e; else merged.push(n);
  }
  notes = merged;

  const dur = nF * DT;
  const voiced = notes.reduce((a, n) => a + n.e - n.s, 0);
  const res = { dur, peak, nF, sm, onsets: onsets.map(o => ({ t: o.f * DT, s: o.s })) };
  if (notes.length >= 3 && voiced > 0.25 * active * DT) res.mode = 'melody';
  else if (onsets.length >= 3) res.mode = 'rhythm';
  else if (notes.length >= 1) res.mode = 'melody';
  else return { mode: 'empty' };

  if (res.mode === 'melody') {
    // the singer's own tuning: how far their notes sit from concert pitch
    let sx = 0, sy = 0;
    for (const n of notes) { const w = n.e - n.s, a = 2 * Math.PI * (n.p - Math.floor(n.p)); sx += w * Math.cos(a); sy += w * Math.sin(a); }
    let off = Math.atan2(sy, sx) / (2 * Math.PI); if (off > .5) off -= 1;
    res.tune = off;
    for (const n of notes) n.m = Math.round(n.p - off);
    // key
    const hist = new Array(12).fill(0);
    for (const n of notes) hist[((n.m % 12) + 12) % 12] += n.e - n.s;
    let bestK = { r: -2 };
    for (const mode of ['major', 'minor']) for (let k = 0; k < 12; k++) {
      const prof = mode === 'major' ? KS_MAJ : KS_MIN; let r = 0, ha = 0, pa = 0, hh = 0, pp = 0;
      for (let i = 0; i < 12; i++) { ha += hist[i] / 12; pa += prof[i] / 12; }
      for (let i = 0; i < 12; i++) { const h = hist[(i + k) % 12] - ha, p = prof[i] - pa; r += h * p; hh += h * h; pp += p * p; }
      r = r / (Math.sqrt(hh * pp) || 1);
      if (mode === 'minor') r -= 0.03;
      if (r > bestK.r) bestK = { r, tonic: k, mode };
    }
    res.key = { tonic: bestK.tonic, mode: bestK.mode };
    const sc = SCALE[bestK.mode].map(v => (v + bestK.tonic) % 12);
    for (const n of notes) {
      const pc = ((n.m % 12) + 12) % 12;
      if (sc.includes(pc)) n.q = n.m;
      else { const up = sc.includes((pc + 1) % 12), dn = sc.includes((pc + 11) % 12); n.q = (up && dn) ? ((n.p - off) > n.m ? n.m + 1 : n.m - 1) : up ? n.m + 1 : n.m - 1; }
    }
    res.notes = notes;
  } else {
    res.tune = 0; res.key = { tonic: 0, mode: 'major' }; res.notes = [];
  }

  // pulse: follow the performer instead of forcing a grid
  const marks = res.mode === 'melody'
    ? notes.map(n => ({ f: Math.round(n.s / DT), s: 1 + Math.min(1, (n.e - n.s) * 2) })).concat(onsets.map(o => ({ f: o.f, s: .4 })))
    : onsets.map(o => ({ f: o.f, s: o.s }));
  const pulse = new Float32Array(nF);
  for (const mk of marks) for (let k = -3; k <= 3; k++) { const t = mk.f + k; if (t >= 0 && t < nF) pulse[t] += mk.s * Math.exp(-k * k / 4.5); }
  let P = 50;
  if (marks.length >= 4) {
    let bv = -1;
    for (let lag = 28; lag <= 110; lag++) {
      let s = 0; for (let t = lag; t < nF; t++) s += pulse[t] * pulse[t - lag];
      // also reward the double, so a steady slow pulse is not mistaken for its half
      let s2 = 0; if (lag * 2 < nF) for (let t = lag * 2; t < nF; t++) s2 += pulse[t] * pulse[t - lag * 2];
      const w = Math.exp(-0.5 * Math.pow(Math.log2(lag / 52) / 0.75, 2));
      const v = (s + 0.5 * s2) * w;
      if (v > bv) { bv = v; P = lag; }
    }
  }
  const score = new Float32Array(nF), prev = new Int32Array(nF).fill(-1), alpha = 5;
  for (let t = 0; t < nF; t++) {
    let best = 0, bp = -1;
    for (let p = Math.max(0, t - 2 * P); p <= t - Math.floor(P / 2); p++) {
      if (p < 0) continue;
      const lr = Math.log((t - p) / P), s = score[p] - alpha * lr * lr;
      if (s > best) { best = s; bp = p; }
    }
    score[t] = pulse[t] + best; prev[t] = bp;
  }
  let endF = nF - 1, ev = -1;
  for (let t = Math.max(0, nF - P); t < nF; t++) if (score[t] > ev) { ev = score[t]; endF = t; }
  let bf = []; for (let t = endF; t >= 0; t = prev[t]) { bf.push(t); if (prev[t] < 0) break; }
  bf.reverse();
  const firstEv = marks.length ? Math.min.apply(null, marks.map(m => m.f)) : 0;
  const lastEv = res.mode === 'melody' ? Math.round(notes[notes.length - 1].e / DT) : Math.max.apply(null, marks.map(m => m.f));
  if (bf.length < 3) { bf = []; for (let t = firstEv; t < nF; t += P) bf.push(t); if (bf.length < 3) bf = [firstEv, firstEv + P, firstEv + 2 * P]; }
  // gentle smoothing so the band breathes with the singer but does not jitter
  let iv = []; for (let i = 0; i + 1 < bf.length; i++) iv.push(bf[i + 1] - bf[i]);
  const iv2 = iv.map((v, i) => { const a = iv[Math.max(0, i - 1)], c = iv[Math.min(iv.length - 1, i + 1)]; return .25 * a + .5 * v + .25 * c; });
  const B = [bf[0] * DT]; for (const v of iv2) B.push(B[B.length - 1] + v * DT);
  const pf = (iv2[0] + (iv2[1] || iv2[0])) / 2 * DT, pl = (iv2[iv2.length - 1] + (iv2[iv2.length - 2] || iv2[iv2.length - 1])) / 2 * DT;
  while (B[0] > firstEv * DT - 13 * pf) B.unshift(B[0] - pf);
  while (B[B.length - 1] < lastEv * DT + 13 * pl) B.push(B[B.length - 1] + pl);
  res.B = B; res.bpm = Math.round(60 / (median(iv2) * DT));
  const pos = E.posFn(B);

  // which beat feels like "one"
  const starts = res.mode === 'melody' ? notes.map(n => ({ t: n.s, w: n.e - n.s })) : res.onsets.map(o => ({ t: o.t, w: o.s * .2 }));
  let bestPh = 0, bestPv = -1; const tot = starts.reduce((a, s) => a + s.w, 0);
  for (let k = 0; k < 4; k++) {
    let v = 0;
    starts.forEach((s, i) => { const p = pos(s.t), j = Math.round(p); if (Math.abs(p - j) < .3 && ((j - k) % 4 + 4) % 4 === 0) v += s.w + (i === 0 ? tot * .3 : 0); });
    if (v > bestPv) { bestPv = v; bestPh = k; }
  }
  const firstPos = pos(starts[0].t);
  let d0 = Math.floor(firstPos + .3); while (((d0 - bestPh) % 4 + 4) % 4 !== 0) d0--;
  const lastPos = pos(lastEv * DT);
  let nA = Math.max(1, Math.ceil((lastPos - d0 - 0.15) / 4)); if (nA > 1 && nA % 2) nA++;
  res.d0 = d0; res.nA = nA;

  // chords: one per bar, chosen to fit the notes that land in it
  const set = CHORDS[res.key.mode], T = res.key.tonic, barLen = (B[d0 + 4] - B[d0]);
  if (res.mode === 'melody') {
    const sc = []; // sc[bar][chord]
    for (let b = 0; b < nA; b++) {
      const t0 = B[d0 + 4 * b], t1 = B[d0 + 4 * b + 4];
      sc.push(set.map((ch, ci) => {
        const tones = [ch[0], ch[0] + (ch[1] === 'M' ? 4 : 3), ch[0] + 7].map(v => (v + T) % 12); let s = 0;
        for (const n of notes) { const ov = Math.min(n.e, t1) - Math.max(n.s, t0); if (ov > 0) s += ov * (tones.includes(((n.q % 12) + 12) % 12) ? 1 : -.35); }
        if (ci === 0) s += barLen * (b === 0 ? .2 : .04) + (b === nA - 1 ? barLen * .35 : 0);
        return s;
      }));
    }
    const vit = [sc[0].slice()], bk = [];
    for (let b = 1; b < nA; b++) {
      vit.push([]); bk.push([]);
      for (let c = 0; c < set.length; c++) {
        let bv = -1e9, bi = 0;
        for (let p = 0; p < set.length; p++) { const v = vit[b - 1][p] + (TRANS[set[p][2] + '>' + set[c][2]] || 0) * barLen * .5 - (p === c ? barLen * .08 : 0); if (v > bv) { bv = v; bi = p; } }
        vit[b][c] = bv + sc[b][c]; bk[b - 1][c] = bi;
      }
    }
    let c = vit[nA - 1].indexOf(Math.max.apply(null, vit[nA - 1])); const seq = [c];
    for (let b = nA - 2; b >= 0; b--) { c = bk[b][c]; seq.unshift(c); }
    res.chords = seq.map(ci => ({ root: (set[ci][0] + T) % 12, q: set[ci][1], name: set[ci][2] }));
  } else {
    const loop = [0, 3, 4, 2]; // I V vi IV
    res.chords = []; for (let b = 0; b < nA; b++) { const ch = set[b === nA - 1 && nA > 1 ? 0 : loop[b % 4]]; res.chords.push({ root: (ch[0] + T) % 12, q: ch[1], name: ch[2] }); }
    // a tune grown from the taps: every tap becomes a note on a five-note scale
    const penta = [0, 2, 4, 7, 9], r = rng(Math.round(res.onsets.reduce((a, o) => a + o.t * 977, 7)));
    let idx = 5; const gen = [];
    res.onsets.forEach((o, i) => {
      const nx = res.onsets[i + 1]; idx += [-2, -1, -1, 1, 1, 2, 0][Math.floor(r() * 7)]; idx = Math.max(2, Math.min(11, idx));
      const m = 60 + T + penta[idx % 5] + 12 * Math.floor(idx / 5) - 12;
      gen.push({ s: o.t, e: Math.min(o.t + .5, nx ? nx.t - .02 : o.t + .5), q: m, m });
    });
    res.gen = gen;
  }
  res.keyName = NOTE_NAMES[res.key.tonic] + ' ' + res.key.mode;
  return res;
};

E.posFn = function (B) {
  return function (t) {
    if (t <= B[0]) return (t - B[0]) / (B[1] - B[0]);
    for (let i = 0; i + 1 < B.length; i++) if (t < B[i + 1]) return i + (t - B[i]) / (B[i + 1] - B[i]);
    const n = B.length - 1; return n + (t - B[n]) / (B[n] - B[n - 1]);
  };
};

/* ---------- tuning the voice (pitch correction, like a pop record) ---------- */
// all the pitches of the key, so a harmony can step "two notes up the scale"
E.scaleStep = function (q, steps, key) {
  const pcs = SCALE[key.mode].map(v => (v + key.tonic) % 12), all = [];
  for (let m = 0; m < 128; m++) if (pcs.includes(m % 12)) all.push(m);
  let i = all.indexOf(q);
  if (i < 0) { i = 0; for (let k = 0; k < all.length; k++) if (Math.abs(all[k] - q) < Math.abs(all[i] - q)) i = k; }
  return all[Math.max(0, Math.min(all.length - 1, i + steps))];
};
E.mixDown = function (chs) {
  const n = chs[0].length, m = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) m[i] += c[i] / chs.length;
  return m;
};
// how many semitones to move the voice at each analysis frame:
// amount 1 = every sung note lands exactly on the band's note, wobble gone; 0 = untouched.
// speed = seconds the voice takes to slide to a new note (short = the hard "pop" sound).
// steps = 0 for the lead, +2 / -2 for a harmony a third above / below.
E.shiftTrack = function (plan, o) {
  o = o || {};
  const nF = plan.nF || 0, sh = new Float32Array(nF), amount = o.amount == null ? 1 : o.amount, steps = o.steps || 0;
  if (plan.mode !== 'melody' || !nF) return sh;
  for (const n of plan.notes) {
    const f0 = Math.max(0, Math.round(n.s / DT)), f1 = Math.min(nF, Math.round(n.e / DT));
    const target = (steps ? E.scaleStep(n.q, steps, plan.key) : n.q) + plan.tune;
    for (let t = f0; t < f1; t++) {
      const m = plan.sm[t], cur = (isNaN(m) || Math.abs(m - n.p) > 0.8) ? n.p : m;
      const lim = steps ? 6 : 2.2; // a pitch-tracker slip must never turn into a chipmunk
      sh[t] = Math.max(-lim, Math.min(lim, target - cur)) * amount;
    }
  }
  const a = 1 - Math.exp(-DT / Math.max(.004, o.speed == null ? .03 : o.speed));
  const y = new Float32Array(sh);
  for (let t = 1; t < nF; t++) y[t] = y[t - 1] + a * (sh[t] - y[t - 1]);
  for (let t = nF - 2; t >= 0; t--) y[t] = y[t + 1] + a * (y[t] - y[t + 1]);
  return y;
};
// time-domain pitch-synchronous overlap-add: the voice keeps its length and its vowel colour
E.pitchShift = function (x, sr, plan, shiftFr) {
  const n = x.length, out = new Float32Array(n), nF = plan.nF, sm = plan.sm;
  if (!nF) { out.set(x); return out; }
  const fAt = (i) => (i / sr - WIN / 2 / FR) / DT;
  const voicedAt = (i) => { const f = Math.round(fAt(i)); if (f < 0 || f >= nF || isNaN(sm[f])) return 0; return sr / (440 * Math.pow(2, (sm[f] - 69) / 12)); };
  const shiftAt = (i) => { const f = fAt(i), f0 = Math.max(0, Math.min(nF - 1, Math.floor(f))), f1 = Math.min(nF - 1, f0 + 1), w = Math.max(0, Math.min(1, f - f0)); return shiftFr[f0] * (1 - w) + shiftFr[f1] * w; };
  const U = Math.round(.01 * sr), marks = [];
  let pos = U;
  while (pos < n) {
    let P = voicedAt(pos);
    if (P) {
      P = Math.max(sr / 1000, Math.min(sr / 60, P));
      const a = Math.max(0, Math.round(pos - P / 4)), b = Math.min(n - 1, Math.round(pos + P / 4)); let bi = Math.round(pos), bv = -1e9;
      for (let i = a; i <= b; i++) if (x[i] > bv) { bv = x[i]; bi = i; }
      pos = bi; marks.push({ pos, P, v: 1 }); pos += P;
    } else { marks.push({ pos, P: U, v: 0 }); pos += U; }
  }
  if (!marks.length) { out.set(x); return out; }
  let ts = 0, j = 0;
  while (ts < n) {
    while (j + 1 < marks.length && Math.abs(marks[j + 1].pos - ts) <= Math.abs(marks[j].pos - ts)) j++;
    const mk = marks[j], P = mk.P, r = mk.v ? Math.pow(2, shiftAt(ts) / 12) : 1, L = Math.max(2, Math.round(P)), c = Math.round(mk.pos), s0 = Math.round(ts);
    for (let k = -L; k <= L; k++) {
      const a = c + k, b = s0 + k; if (a < 0 || a >= n || b < 0 || b >= n) continue;
      out[b] += x[a] * (.5 + .5 * Math.cos(Math.PI * k / L)) / r;
    }
    ts += P / r;
  }
  return out;
};
// the whole job: a mono voice in, the same voice moved onto the band's notes out
E.tuneVoice = function (mono, sr, plan, o) {
  o = o || {};
  if (plan.mode !== 'melody') return mono;
  return E.pitchShift(mono, sr, plan, E.shiftTrack(plan, o));
};

/* ---------- the bands ---------- */
E.STYLES = [
  { id: 'pop', name: 'Pop Party', icon: '🌟', kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.', swing: 0,
    bass: 'r.r.r.r.r.r.r.r.', bassSound: 'synthbass', bassLen: 1.6, comp: [{ type: 'stab', pat: 'x..x..x...x..x..', sound: 'pluck', len: 2 }], lead: 'synth', center: 74, rev: .25 },
  { id: 'lullaby', name: 'Lullaby', icon: '🌙', shaker: 'o...o...o...o...', swing: 0,
    bass: 'r.......5.......', bassSound: 'soft', bassLen: 7, comp: [{ type: 'arp', pat: 'x.x.x.x.x.x.x.x.', sound: 'bell', len: 4 }], lead: 'bell', center: 79, rev: .55 },
  { id: 'rock', name: 'Rock Band', icon: '🎸', kick: 'x.....x.x.....x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', swing: 0,
    bass: 'r.r.r.r.r.r.r.r.', bassSound: 'saw', bassLen: 1.7, comp: [{ type: 'stab', pat: 'x.x.x.x.x.x.x.x.', sound: 'power', len: 1.8 }], lead: 'guitar', center: 72, rev: .2 },
  { id: 'lofi', name: 'Cozy Beat', icon: '☕', kick: 'x.....x...x.....', snare: '....o.......o...', hat: 'x.o.x.o.x.o.x.o.', swing: .8,
    bass: 'r.....r...5.....', bassSound: 'soft', bassLen: 4, comp: [{ type: 'pad', sound: 'epiano', seventh: true }], lead: 'mellow', center: 72, rev: .35, crackle: true },
  { id: 'orchestra', name: 'Orchestra', icon: '🎻', timp: 'x.......o.......', swing: 0,
    bass: 'r...5...r...5...', bassSound: 'pizz', bassLen: 2, comp: [{ type: 'pad', sound: 'strings' }, { type: 'arp', pat: 'x.x.x.x.x.x.x.x.', sound: 'harp', len: 3 }], lead: 'flute', center: 77, rev: .6 },
  { id: 'funk', name: 'Funky Groove', icon: '🎷', kick: 'x..x....x.x.....', snare: '....x..o....x..o', hat: 'xoxoxoxoxoxoxoxo', swing: .25,
    bass: 'r..r..8.r.r..8.5', bassSound: 'saw', bassLen: 1.3, comp: [{ type: 'stab', pat: '..x...x..x....x.', sound: 'clav', len: 1 }], lead: 'brass', center: 72, rev: .2 },
  { id: 'arcade', name: 'Robot Arcade', icon: '🤖', kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', swing: 0,
    bass: 'r.8.r.8.r.8.r.8.', bassSound: 'square', bassLen: 1.6, comp: [{ type: 'arp', pat: 'xxxxxxxxxxxxxxxx', sound: 'chip', len: 1 }], lead: 'chiplead', center: 76, rev: .1 },
  { id: 'train', name: 'Choo-Choo', icon: '🚂', kick: 'x.......x.......', snare: '....o.......o...', chug: 'x.xox.xox.xox.xo', swing: .7,
    bass: 'r...5...r...5...', bassSound: 'soft', bassLen: 3, comp: [{ type: 'stab', pat: '..x...x...x...x.', sound: 'banjo', len: 2 }], lead: 'whistle', center: 79, rev: .25, whistle: true }
];

const WORDS = [
  [/rock|guitar|loud|dinosaur|monster truck/, { style: 'rock' }, 'rock band'],
  [/sleep|night|lullab|dream|moon|quiet|gentle|baby/, { style: 'lullaby' }, 'sleepy and soft'],
  [/robot|game|arcade|computer|beep|pixel/, { style: 'arcade' }, 'robot arcade'],
  [/train|choo|railroad|engine|locomotive/, { style: 'train' }, 'train ride'],
  [/chill|cozy|rain|coffee|lo-?fi|relax/, { style: 'lofi' }, 'cozy beat'],
  [/funk|groov|dance|disco|boogie/, { style: 'funk' }, 'funky dance'],
  [/movie|epic|dragon|castle|orchestra|king|queen|adventure|hero/, { style: 'orchestra' }, 'big orchestra'],
  [/pop|party|happy|birthday|sunny/, { style: 'pop' }, 'pop party'],
  [/space|cosmic|star|galaxy|planet|rocket|underwater|ocean|cave|canyon/, { rev: .35 }, 'big echoing room'],
  [/magic|fairy|sparkl|twinkl|glitter|unicorn|wizard/, { sparkle: true }, 'sparkles'],
  [/pop ?star|auto-?tune|superstar|idol|diva|concert|singer|record/, { voice: 'pop' }, 'pop star voice'],
  [/robot|alien/, { voice: 'robot' }, 'robot voice'],
  [/echo|cave|canyon|mountain/, { voice: 'echo' }, 'echo voice'],
  [/fast|zoom|race|speedy|wild|crazy|loud|energy|excit/, { energy: 3 }, 'high energy'],
  [/slow|calm|sleepy|soft|quiet|gentle/, { energy: 1 }, 'calm'],
  [/giant|monster|dinosaur|dragon|bear|deep|low/, { octave: -1 }, 'low and big'],
  [/tiny|mouse|bird|fairy|high|squeak/, { octave: 1 }, 'high and small'],
  [/train|choo|whistle/, { whistle: true }, 'train whistle']
];
E.readWords = function (text) {
  const t = (text || '').toLowerCase(), out = { heard: [] };
  if (!t.trim()) return out;
  for (const [re, set, label] of WORDS) if (re.test(t)) { for (const k in set) if (!(k in out)) out[k] = set[k]; out.heard.push(label); }
  return out;
};

/* ---------- arranging ---------- */
E.arrange = function (plan, style, o) {
  o = o || {};
  const B = plan.B, d0 = plan.d0, nA = plan.nA, nAb = 4 * nA, playback = o.playback !== false;
  const energy = o.energy || 2, vE = [0, .7, .85, 1][energy];
  const t0 = B[d0 - 4], G = [];
  for (let s = 0; s <= 4 + nAb; s++) G.push(B[d0 - 4 + s] - t0);
  const lenA = G[4 + nAb] - G[4];
  if (playback) for (let s = 1; s <= nAb; s++) G.push(G[4 + s] + lenA);
  const lastIv = G[G.length - 1] - G[G.length - 2];
  for (let s = 1; s <= 5; s++) G.push(G[G.length - 1] + lastIv * (1 + .05 * s));
  const gT = (x) => { const i = Math.max(0, Math.min(G.length - 2, Math.floor(x))); return G[i] + (x - i) * (G[i + 1] - G[i]); };
  const nBars = 1 + nA + (playback ? nA : 0) + 1, outro = nBars - 1;
  const tonicChord = { root: plan.key.tonic, q: plan.key.mode === 'major' ? 'M' : 'm', name: plan.key.mode === 'major' ? 'I' : 'i' };
  const chordOf = (b) => b === 0 ? plan.chords[0] : b === outro ? tonicChord : plan.chords[(b - 1) % nA];
  const sw = (style.swing || 0) * .167;
  const stepT = (b, s) => gT(b * 4 + s / 4 + (s % 4 === 2 ? sw : s % 2 === 1 ? sw * .5 : 0));
  const ev = [], push = (k, t, d, n, v, snd) => ev.push({ k, t, d, n, v, snd });
  // a drummer is never exactly on the grid: tiny, repeatable timing and loudness wobble
  const hr = rng(Math.round((plan.dur || 1) * 1000) + nA * 7919);
  const voice2 = plan.mode === 'melody' && playback && o.voice === 'pop';
  const sc = SCALE[plan.key.mode].map(v => (v + plan.key.tonic) % 12);
  const voicing = (ch, seventh) => {
    let r = 48 + ch.root; if (r < 50) r += 12; if (r > 60) r -= 12;
    const n = [r, r + (ch.q === 'M' ? 4 : 3), r + 7];
    if (seventh) { const maj7 = sc.includes((ch.root + 11) % 12); n.push(r + (maj7 ? 11 : 10)); }
    return n;
  };
  const drum = (kind, pat, b, scale) => {
    if (!pat) return;
    for (let s = 0; s < 16; s++) { const c = pat[s]; if (c === '.' || !c) continue; if (c === 'o' && energy === 1 && kind !== 'shaker' && kind !== 'timp') continue; const lift = (playback && b > nA && b <= 2 * nA) ? 1.12 : 1; push(kind, Math.max(0, stepT(b, s) + (b === 0 && s === 0 ? 0 : (hr() - .5) * (kind === 'kick' ? .008 : .014))), .1, 0, (c === 'x' ? 1 : .5) * vE * (scale || 1) * lift * (.9 + hr() * .2)); }
  };
  for (let b = 0; b < nBars; b++) {
    const ch = chordOf(b), isA = b >= 1 && b <= nA, lvl = isA ? .8 : 1;
    if (b === outro) {
      push('kick', stepT(b, 0), .2, 0, vE); push('crash', stepT(b, 0), 1.5, 0, .7 * vE);
      const dur = gT(b * 4 + 4) - gT(b * 4);
      for (const cp of style.comp) push('chord', stepT(b, 0), dur * 1.2, voicing(ch, cp.seventh), .9, cp.sound);
      push('bass', stepT(b, 0), dur, 36 + ((ch.root + 12 - 0) % 12), .9, style.bassSound);
      const top = 72 + plan.key.tonic; let k = 0;
      for (let m = top - 12; m <= top + 12 && k < 10; m++) if (sc.includes(((m % 12) + 12) % 12)) { push('spark', gT(b * 4 + k * .25), .5, m, .5); k++; }
      if (style.whistle || o.whistle) { push('whistle', gT(b * 4 + 1), dur * .5, 72 + plan.key.tonic, .6); push('whistle', gT(b * 4 + 1), dur * .5, 79 + plan.key.tonic, .5); }
      continue;
    }
    drum('kick', style.kick, b); if (b > 0) drum('snare', style.snare, b);
    drum('hat', style.hat, b, .8); drum('shaker', style.shaker, b); drum('chug', style.chug, b); drum('timp', style.timp, b);
    const lastOfSection = (b === nA) || (playback && b === 2 * nA);
    if (lastOfSection && energy >= 2 && style.snare) for (let s = 12; s < 16; s++) push('snare', stepT(b, s), .1, 0, (.4 + .15 * (s - 12)) * vE);
    if (playback && b === nA + 1) push('crash', stepT(b, 0), 1.5, 0, .6 * vE);
    if (energy >= 2 && ((playback && b === nA) || (b === outro - 1 && b > 1))) push('riser', stepT(b, 0), gT(b * 4 + 4) - gT(b * 4), 0, .55 * vE);
    const br = 36 + ch.root % 12 + (ch.root % 12 > 7 ? -12 : 0);
    for (let s = 0; s < 16; s++) {
      const c = style.bass[s]; if (c === '.') continue;
      push('bass', stepT(b, s), (stepT(b, Math.min(16, s + 1)) - stepT(b, s)) * style.bassLen, br + (c === '5' ? 7 : c === '8' ? 12 : 0), .9 * lvl, style.bassSound);
    }
    for (const cp of style.comp) {
      const v = voicing(ch, cp.seventh), stepLen = (gT(b * 4 + 4) - gT(b * 4)) / 16;
      if (cp.type === 'pad') push('chord', stepT(b, 0), stepLen * 16, v, .8 * lvl, cp.sound);
      else if (cp.type === 'stab') { for (let s = 0; s < 16; s++) if (cp.pat[s] === 'x') push('chord', stepT(b, s), stepLen * cp.len, v, .8 * lvl, cp.sound); }
      else { const seq = [v[0], v[1], v[2], v[0] + 12, v[2], v[1]]; let k = 0; for (let s = 0; s < 16; s++) if (cp.pat[s] === 'x') { push('chord', stepT(b, s), stepLen * cp.len, [seq[k % seq.length] + 12], .6 * lvl, cp.sound); k++; } }
    }
    if (o.sparkle && b > 0) push('spark', stepT(b, 0), .6, 84 + ch.root % 12, .35);
  }
  // the tune
  const mel = plan.mode === 'melody' ? plan.notes : plan.gen;
  const med = median(mel.map(n => n.q));
  const shift = Math.round(((style.center || 74) - med) / 12) * 12 + (o.octave || 0) * 12;
  const melT = (t) => t - t0;
  if (plan.mode === 'rhythm') for (const n of mel) push('lead', melT(n.s), n.e - n.s, n.q + shift, .55, style.lead);
  if (playback) for (const n of mel) {
    const d = Math.max(.12, n.e - n.s);
    push('lead', melT(n.s) + lenA, d, n.q + shift, voice2 ? .5 : .9, style.lead);
    if (energy >= 2 && plan.mode === 'melody' && n.q + shift + 12 <= 92) push('lead', melT(n.s) + lenA, d, n.q + shift + 12, voice2 ? .2 : .3, style.lead);
  }
  // little answers from the band when the singer takes a breath
  if (plan.mode === 'melody') {
    const pos = E.posFn(B);
    for (let i = 0; i + 1 < mel.length; i++) {
      const a = pos(mel[i].e), b2 = pos(mel[i + 1].s);
      if (b2 - a >= 1.4) {
        const bar = Math.max(0, Math.min(nA - 1, Math.floor((a - d0) / 4))), v = voicing(plan.chords[bar]);
        for (let k = 0; k < 3 && a + .35 + k * .33 < b2 - .2; k++) push('spark', gT(a - d0 + 4 + .35 + k * .33), .5, v[k] + 24, .4);
      }
    }
  }
  ev.sort((a, b) => a.t - b.t);
  const sections = [{ id: 'intro', t0: 0, t1: G[4] }, { id: 'you', t0: G[4], t1: G[4 + nAb] }];
  if (playback) sections.push({ id: 'band', t0: G[4 + nAb], t1: G[4 + 2 * nAb] });
  sections.push({ id: 'end', t0: sections[sections.length - 1].t1, t1: G[G.length - 1] });
  return { events: ev, len: G[G.length - 1] + 1.6, voiceAt: -t0, voice2, G, sections, lenA, shift, beat: lastIv,
    bars: Array.from({ length: nBars }, (_, b) => ({ t: gT(b * 4), chord: chordOf(b) })) };
};

if (typeof module !== 'undefined' && module.exports) module.exports = E; else root.MME = E;
})(typeof self !== 'undefined' ? self : this);
