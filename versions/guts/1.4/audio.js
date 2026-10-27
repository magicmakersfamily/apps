/* GUTS audio: original songs, adaptive layers and every sound effect, all synthesised with Web Audio.
   Nothing here is sampled or borrowed. Started only from a button press (init()). */
(function (root) {
  'use strict';
  var G = root.GUTS = root.GUTS || {};
  var ctx = null, master, comp, musicBus, sfxBus, lpNode, noiseBuf;
  var vol = { music: 0.7, sfx: 0.85 }, gross = 'medium';
  var detuneNow = 0;                    // cents; a blowout knocks the music off-key for a beat
  var NAMES = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

  function midi(name) {
    var m = /^([a-g])(#|b)?(\d)$/.exec(name); if (!m) return null;
    var n = NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return 12 * (parseInt(m[3], 10) + 1) + n;
  }
  function hz(mi) { return 440 * Math.pow(2, (mi - 69) / 12); }
  var QUAL = { '': [0, 4, 7], m: [0, 3, 7] };
  function chordNotes(name, oct) {
    var m = /^([A-G])(#|b)?(m?)$/.exec(name); var root = midi(m[1].toLowerCase() + (m[2] || '') + (oct || 3));
    return QUAL[m[3]].map(function (i) { return root + i; });
  }

  /* ---------------- the songs (all original) ---------------- */
  var SONGS = {
    title: { bpm: 132, style: 'motown', lead: 'brass',
      chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', ['Bb', 'C'], 'F'],
      mel: 'c5/2 f5/2 a5/2 g5/2 f5/4 c5/2 d5/2 | f5/3 e5/1 d5/2 a4/2 d5/6 -/2 | bb4/2 d5/2 f5/2 bb5/2 a5/4 g5/2 f5/2 | g5/4 -/2 e5/2 c5/4 e5/2 g5/2 | c6/2 a5/2 f5/2 a5/2 c6/4 a5/2 f5/2 | e5/2 a5/2 c6/2 a5/2 e5/4 -/2 c5/2 | d5/2 f5/2 bb5/2 d6/2 c6/2 bb5/2 a5/2 g5/2 | f5/6 c5/2 f5/4 -/4' },
    map: { bpm: 118, style: 'soft', lead: 'glock',
      chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', ['Bb', 'C'], 'F'],
      mel: 'c5/2 f5/2 a5/2 g5/2 f5/4 c5/2 d5/2 | f5/3 e5/1 d5/2 a4/2 d5/6 -/2 | bb4/2 d5/2 f5/2 bb5/2 a5/4 g5/2 f5/2 | g5/4 -/2 e5/2 c5/4 e5/2 g5/2 | c6/2 a5/2 f5/2 a5/2 c6/4 a5/2 f5/2 | e5/2 a5/2 c6/2 a5/2 e5/4 -/2 c5/2 | d5/2 f5/2 bb5/2 d6/2 c6/2 bb5/2 a5/2 g5/2 | f5/6 c5/2 f5/4 -/4' },
    home: { bpm: 100, style: 'uke', lead: 'glock',
      chords: ['G', 'Em', 'C', 'D', 'G', 'Bm', ['C', 'D'], 'G'],
      mel: 'b5/4 d6/2 b5/2 a5/4 g5/4 | e5/4 g5/2 b5/2 e6/4 -/4 | c6/2 b5/2 a5/2 g5/2 e5/4 g5/4 | a5/6 f#5/2 a5/4 -/4 | g5/2 a5/2 b5/2 d6/2 g6/4 d6/4 | f#6/4 d6/2 b5/2 f#5/4 -/4 | e5/2 g5/2 c6/4 d6/2 c6/2 a5/4 | g5/8 -/8' },
    detroit: { bpm: 116, style: 'motown', lead: 'brass',
      chords: ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'F', 'G'],
      mel: 'e5/2 g5/2 -/2 a5/2 g5/4 e5/2 c5/2 | -/2 e5/2 a5/2 c6/2 b5/2 a5/2 e5/4 | f5/2 a5/2 -/2 d6/2 c6/2 a5/2 f5/4 | g5/6 a5/2 b5/2 d6/2 -/4 | c6/2 -/2 g5/2 e5/2 g5/2 c6/2 e6/4 | d6/2 c6/2 a5/2 e5/2 a5/4 -/4 | f5/2 a5/2 c6/2 f6/2 e6/2 c6/2 a5/4 | g5/4 b5/4 d6/4 -/4' },
    'detroit-dusk': { bpm: 108, style: 'motown-soft', lead: 'organ',
      chords: ['C', 'Am', 'Dm', 'G', 'C', 'Am', 'F', 'G'],
      mel: 'e5/2 g5/2 -/2 a5/2 g5/4 e5/2 c5/2 | -/2 e5/2 a5/2 c6/2 b5/2 a5/2 e5/4 | f5/2 a5/2 -/2 d6/2 c6/2 a5/2 f5/4 | g5/6 a5/2 b5/2 d6/2 -/4 | c6/2 -/2 g5/2 e5/2 g5/2 c6/2 e6/4 | d6/2 c6/2 a5/2 e5/2 a5/4 -/4 | f5/2 a5/2 c6/2 f6/2 e6/2 c6/2 a5/4 | g5/4 b5/4 d6/4 -/4' },
    boss: { bpm: 144, style: 'drive', lead: 'brass',
      chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'],
      mel: 'd5/2 d5/2 f5/2 d5/2 a5/4 g5/2 f5/2 | e5/2 f5/2 e5/2 d5/2 c5/4 a4/4 | bb4/2 d5/2 f5/2 bb5/2 a5/2 f5/2 d5/4 | c5/2 e5/2 g5/2 c6/2 bb5/4 g5/4 | d6/4 a5/4 f5/4 d5/4 | e5/2 f5/2 g5/2 a5/2 bb5/4 a5/4 | g5/2 bb5/2 d6/2 bb5/2 g5/4 d5/4 | c#5/4 e5/4 a5/4 -/4' },
    inside: { bpm: 92, style: 'squelch', lead: 'marimba',
      chords: ['Em', 'G', 'C', 'B'],
      mel: 'e5/3 g5/1 b5/4 a5/2 g5/2 f#5/4 | g5/3 b5/1 d6/4 c6/2 b5/2 a5/4 | c6/4 e6/4 d6/2 c6/2 b5/4 | a5/2 f#5/2 d#5/4 b4/8' },
    village: { bpm: 84, style: 'village', lead: 'uke',
      chords: ['C', 'F', 'G', 'C', 'Am', 'F', 'G', 'C'],
      mel: 'e5/4 g5/4 c6/6 -/2 | a5/4 f5/4 c5/6 -/2 | b4/2 d5/2 g5/4 f5/2 e5/2 d5/4 | c5/8 -/8 | e5/2 a5/2 c6/4 b5/2 a5/2 e5/4 | f5/2 a5/2 c6/4 a5/4 f5/4 | d5/2 g5/2 b5/4 a5/2 g5/2 d5/4 | c5/4 e5/4 c5/8' }
  };

  function parseSong(s) {
    if (s._p) return s._p;
    var bars = s.mel.split('|').map(function (b) { return b.trim().split(/\s+/); });
    var n = bars.length, map = [];
    for (var i = 0; i < n * 16; i++) map.push(null);
    bars.forEach(function (toks, bi) {
      var pos = 0;
      toks.forEach(function (tk) {
        var p = tk.split('/'), len = parseInt(p[1], 10) || 1;
        if (pos < 16 && p[0] !== '-') map[bi * 16 + pos] = { m: midi(p[0]), len: Math.min(len, 16 - pos) };
        pos += len;
      });
    });
    s._p = { n: n, map: map };
    return s._p;
  }

  /* ---------------- engine ---------------- */
  function init() {
    if (!ctx) {
      var AC = root.AudioContext || root.webkitAudioContext; if (!AC) return false;
      ctx = new AC();
      comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master = ctx.createGain(); master.gain.value = 0.9; comp.connect(master); master.connect(ctx.destination);
      lpNode = ctx.createBiquadFilter(); lpNode.type = 'lowpass'; lpNode.frequency.value = 6000; lpNode.Q.value = 0.5;
      musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.5; musicBus.connect(lpNode); lpNode.connect(comp);
      sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      document.addEventListener('visibilitychange', function () { if (!ctx) return; if (document.hidden) ctx.suspend(); else ctx.resume(); });
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function note(bus, type, f, t0, dur, v, o) {
    o = o || {};
    var osc = ctx.createOscillator(), g = ctx.createGain(), out = osc;
    osc.type = type; osc.frequency.setValueAtTime(f, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.slideTo), t0 + (o.slideT || dur));
    osc.detune.value = (o.detune || 0) + (o.music ? detuneNow : 0);
    var lfo = null;
    if (o.vib) { lfo = ctx.createOscillator(); var lg = ctx.createGain(); lfo.frequency.value = o.vib[0]; lg.gain.value = o.vib[1]; lfo.connect(lg); lg.connect(osc.detune); lfo.start(t0); lfo.stop(t0 + dur + 0.1); }
    if (o.lp) {
      var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = o.q || 0.7;
      fl.frequency.setValueAtTime(o.lp, t0); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t0 + (o.lpT || dur));
      osc.connect(fl); out = fl;
    }
    out.connect(g); g.connect(bus);
    var a = o.a || 0.006;
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + a);
    if (o.hold) g.gain.setValueAtTime(v, t0 + dur * o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
    return osc;
  }
  function noise(bus, t0, dur, v, o) {
    o = o || {};
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    var f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass'; f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.f || 1500, t0); if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t0 + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(v, t0 + (o.a || 0.004)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(bus); src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }

  /* instruments */
  var INS = {
    brass: function (f, t, d, v) { note(musicBus, 'sawtooth', f, t, d, v * 0.55, { lp: f * 2, lpTo: f * 6, lpT: 0.06, a: 0.02, vib: [5.5, 7], music: 1, hold: 0.6 }); note(musicBus, 'square', f, t, d, v * 0.18, { lp: f * 3, a: 0.03, music: 1 }); },
    organ: function (f, t, d, v) { note(musicBus, 'sine', f, t, d, v * 0.5, { a: 0.01, hold: 0.8, music: 1, detune: -4 }); note(musicBus, 'sine', f * 2, t, d, v * 0.25, { a: 0.01, hold: 0.8, music: 1 }); note(musicBus, 'square', f, t, d, v * 0.12, { lp: 1200, a: 0.01, hold: 0.8, music: 1, detune: 5 }); },
    uke: function (f, t, d, v) { note(musicBus, 'triangle', f, t, Math.min(d + 0.12, 0.5), v * 0.8, { a: 0.003, music: 1 }); note(musicBus, 'sine', f * 2, t, 0.18, v * 0.3, { a: 0.003, music: 1 }); },
    glock: function (f, t, d, v) { note(musicBus, 'sine', f * 2, t, 0.7, v * 0.55, { a: 0.002, music: 1 }); note(musicBus, 'sine', f * 5.4, t, 0.25, v * 0.12, { a: 0.002, music: 1 }); },
    marimba: function (f, t, d, v) { note(musicBus, 'sine', f, t, 0.32, v * 0.85, { a: 0.002, music: 1 }); note(musicBus, 'sine', f * 4, t, 0.1, v * 0.25, { a: 0.002, music: 1 }); },
    flute: function (f, t, d, v) { note(musicBus, 'sine', f, t, d + 0.08, v * 0.55, { a: 0.07, vib: [5, 9], music: 1, hold: 0.7 }); note(musicBus, 'triangle', f * 2, t, d, v * 0.1, { a: 0.08, music: 1 }); },
    accordion: function (f, t, d, v) { note(musicBus, 'sawtooth', f, t, d, v * 0.2, { lp: f * 3, a: 0.05, music: 1, detune: -6, hold: 0.8 }); note(musicBus, 'sawtooth', f, t, d, v * 0.2, { lp: f * 3, a: 0.05, music: 1, detune: 6, hold: 0.8 }); },
    bass: function (f, t, d, v) { note(musicBus, 'triangle', f, t, d, v * 0.9, { a: 0.008, music: 1, hold: 0.5 }); note(musicBus, 'sine', f / 2, t, d, v * 0.5, { a: 0.01, music: 1 }); },
    wobble: function (f, t, d, v) { note(musicBus, 'sawtooth', f, t, d, v * 0.55, { lp: f * 1.2, lpTo: f * 5, lpT: d * 0.5, q: 7, a: 0.01, music: 1, hold: 0.6 }); },
    tuba: function (f, t, d, v) { note(musicBus, 'sawtooth', f, t, d, v, { lp: 520, a: 0.05, vib: [4, 12], music: 1, hold: 0.6 }); }
  };
  var DR = {
    kick: function (t, v) { note(musicBus, 'sine', 140, t, 0.16, v, { slideTo: 42, slideT: 0.12, a: 0.002 }); },
    snare: function (t, v) { noise(musicBus, t, 0.14, v * 0.7, { f: 1900, q: 0.8 }); note(musicBus, 'triangle', 200, t, 0.1, v * 0.5, { slideTo: 120 }); },
    clap: function (t, v) { for (var i = 0; i < 3; i++) noise(musicBus, t + i * 0.011, 0.07, v * 0.6, { f: 1500, q: 1.2 }); },
    hat: function (t, v, open) { noise(musicBus, t, open ? 0.14 : 0.04, v * 0.4, { type: 'highpass', f: 7500 }); },
    tamb: function (t, v) { noise(musicBus, t, 0.07, v * 0.45, { type: 'highpass', f: 5200 }); noise(musicBus, t + 0.02, 0.05, v * 0.25, { f: 9000, q: 4 }); },
    clank: function (t, v) { note(musicBus, 'square', 420, t, 0.07, v * 0.25, {}); note(musicBus, 'square', 631, t, 0.07, v * 0.2, {}); noise(musicBus, t, 0.06, v * 0.3, { f: 3000, q: 3 }); },
    shaker: function (t, v) { noise(musicBus, t, 0.05, v * 0.35, { type: 'highpass', f: 6000, a: 0.015 }); }
  };

  var cur = null, step = 0, nextT = 0, timer = null, layers = 0;
  var belly = { vit: 55, pres: 10 }, tempoMul = 1, duckAmt = 1, rng = Math.random;

  function chordAt(song, bar, s) {
    var c = song.chords[bar % song.chords.length]; if (Array.isArray(c)) c = c[s < 8 ? 0 : 1] || c[0]; return c;
  }
  function playStep(t) {
    var song = SONGS[cur.name], P = parseSong(song), bar = Math.floor(step / 16) % P.n, s = step % 16, gi = bar * 16 + s;
    var stl = song.style, chord = chordAt(song, bar, s), root = chordNotes(chord, 2)[0], tri = chordNotes(chord, 4);
    var sx = 60 / (song.bpm * tempoMul) / 4;
    var soft = stl === 'soft' || stl === 'motown-soft', mv = soft ? 0.7 : 1;
    // melody
    var mn = P.map[gi];
    if (mn) {
      var lead = song.lead;
      if (stl === 'village') lead = layers >= 3 ? 'flute' : 'uke';
      INS[lead](hz(mn.m), t, mn.len * sx * 0.95, 0.5 * mv);
      if (stl === 'village' && layers >= 4) INS.accordion(hz(mn.m - 12), t, mn.len * sx, 0.5);
    }
    if (stl === 'motown' || stl === 'motown-soft' || stl === 'soft') {
      if (s === 0 || s === 8) DR.kick(t, 0.9 * mv); if (s === 3 && !soft) DR.kick(t, 0.6); if (s === 10 && stl === 'motown') DR.kick(t, 0.6);
      if (s === 4 || s === 12) { DR.snare(t, 0.8 * mv); if (!soft) DR.clap(t, 0.7); }
      if (s % 2 === 0) DR.hat(t, 0.7 * mv, s === 14); if (!soft) DR.tamb(t, s % 4 === 2 ? 0.9 : 0.5); else if (s % 4 === 0) DR.tamb(t, 0.4);
      var bs = { 0: 0, 3: 7, 6: 0, 8: 0, 11: 7, 14: 12 }[s];
      if (bs !== undefined) INS.bass(hz(root + bs), t, sx * 2.4, 0.8 * mv);
      if (s === 2 || s === 6 || s === 10 || s === 14) tri.forEach(function (m) { INS.organ(hz(m), t, sx * 1.5, soft ? 0.32 : 0.24); });
      if (soft && s === 0) tri.forEach(function (m) { INS.organ(hz(m - 12), t, sx * 15, 0.22); });
    } else if (stl === 'uke') {
      if ([0, 3, 6, 8, 11, 14].indexOf(s) >= 0) tri.forEach(function (m, i) { INS.uke(hz(m), t + i * 0.012, sx * 2, 0.34); });
      if (s === 0 || s === 8) INS.bass(hz(root), t, sx * 4, 0.6);
      if (s % 4 === 2) DR.shaker(t, 0.6); if (s === 0) DR.kick(t, 0.4);
    } else if (stl === 'drive') {
      if (s % 4 === 0) DR.kick(t, 1); if (s === 4 || s === 12) DR.snare(t, 0.9); if (s % 2 === 0) DR.hat(t, 0.6, s === 14);
      if (s === 6 || s === 14) DR.clank(t, 1);
      if (s % 2 === 0) INS.bass(hz(root + (s % 4 === 2 ? 12 : 0)), t, sx * 1.8, 0.8);
      if (s === 0 || s === 8) tri.forEach(function (m) { INS.brass(hz(m), t, sx * 3, 0.32); });
    } else if (stl === 'squelch') {
      if (s === 0 || s === 10) DR.kick(t, 0.6); if (s === 4 || s === 12) DR.snare(t, 0.35); if (s % 4 === 2) DR.shaker(t, 0.5);
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11) INS.wobble(hz(root + (s === 6 ? 12 : 0)), t, sx * 2.6, 0.75);
      if (s === 2 && rng() < 0.7) note(musicBus, 'sine', 900 + rng() * 900, t, 0.09, 0.14, { slideTo: 500, music: 1 });  // drips
      if (s === 10 && rng() < 0.6) note(musicBus, 'sine', 1300 + rng() * 800, t, 0.08, 0.12, { slideTo: 700, music: 1 });
    } else if (stl === 'village') {
      var arp = [0, 1, 2, 1][s % 4]; if (s % 2 === 0) INS.uke(hz(tri[arp] - 12), t, sx * 2, 0.34);
      if (layers >= 1 && (s === 0 || s === 8)) INS.bass(hz(root), t, sx * 5, 0.6);
      if (layers >= 2 && s % 2 === 1) DR.shaker(t, 0.6);
      if (layers >= 5 && s === 0) DR.kick(t, 0.4);
    }
    // adaptive: tuba and gurgle layers rise with pressure
    var tubaG = Math.max(0, Math.min(1, (belly.pres - 30) / 40));
    if (tubaG > 0.05 && (s === 0 || s === 8) && stl !== 'village') INS.tuba(hz(root), t, sx * 5, 0.55 * tubaG);
    if (belly.pres > 50 && rng() < 0.18 && s % 2 === 1) note(musicBus, 'sine', 80 + rng() * 40, t, 0.16, 0.2 * tubaG, { slideTo: 60 + rng() * 40, music: 1 });
  }
  function sched() {
    if (!cur || !ctx) return;
    if (detuneNow < 0) detuneNow = Math.min(0, detuneNow + 4);
    while (nextT < ctx.currentTime + 0.14) {
      playStep(nextT);
      nextT += 60 / (SONGS[cur.name].bpm * tempoMul) / 4;
      step++;
    }
  }
  function playSong(name) {
    if (!ctx || !SONGS[name]) return;
    if (cur && cur.name === name) return;
    cur = { name: name }; step = 0; nextT = ctx.currentTime + 0.1; detuneNow = 0;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setValueAtTime(0.0001, ctx.currentTime);
    musicBus.gain.linearRampToValueAtTime(vol.music * 0.5 * duckAmt, ctx.currentTime + 0.6);
    if (!timer) timer = setInterval(sched, 25);
  }
  function stopSong() {
    cur = null; if (!ctx) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime); musicBus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.12);
    if (timer) { clearInterval(timer); timer = null; }
  }
  function applyMusicVol() { if (ctx && cur) musicBus.gain.setTargetAtTime(vol.music * 0.5 * duckAmt, ctx.currentTime, 0.1); }

  /* ---------------- sound effects ---------------- */
  var sustained = null, breath = null, lad = { state: 'springy', t: 0 };
  function sfx(name, o) {
    if (!ctx || vol.sfx <= 0) return; o = o || {};
    var t = ctx.currentTime + 0.002, B = sfxBus, p = o.pitch || 1;
    switch (name) {
      case 'jump': note(B, 'triangle', 190 * p, t, 0.13, 0.35, { slideTo: 520 * p }); break;
      case 'land': note(B, 'sine', 110, t, 0.12, 0.45, { slideTo: 50 }); noise(B, t, 0.05, 0.12, { f: 400 }); break;
      case 'toot': note(B, 'sawtooth', 200 * p, t, 0.14, 0.3, { slideTo: 120, lp: 700 }); note(B, 'square', 70, t, 0.1, 0.15, { lp: 300 }); break;
      case 'puff': noise(B, t, 0.1, 0.18, { f: 900, fTo: 400 }); break;
      case 'eat': note(B, 'sine', 360 * p, t, 0.08, 0.35); note(B, 'sine', 650 * p, t + 0.07, 0.1, 0.35); noise(B, t, 0.04, 0.15, { f: 2400 }); break;
      case 'eatBad': note(B, 'sine', 330, t, 0.1, 0.3, { slideTo: 250 }); note(B, 'sine', 500, t + 0.08, 0.1, 0.3, { slideTo: 420 }); noise(B, t, 0.05, 0.2, { f: 1400 }); break;
      case 'dex': [660, 880, 1320].forEach(function (f, i) { note(B, 'sine', f, t + i * 0.07, 0.25, 0.3); }); break;
      case 'bloom': note(B, 'sine', 420, t, 0.4, 0.3, { slideTo: 880 }); note(B, 'sine', 630, t + 0.05, 0.4, 0.2, { slideTo: 1320 }); [1500, 1900, 2300].forEach(function (f, i) { note(B, 'sine', f, t + 0.1 + i * 0.06, 0.18, 0.12); }); break;
      case 'pop': note(B, 'sine', 700, t, 0.09, 0.4, { slideTo: 220 }); break;
      case 'bug': [784, 988, 1175, 1568].forEach(function (f, i) { note(B, 'triangle', f, t + i * 0.06, 0.3, 0.3); }); break;
      case 'stomp': note(B, 'square', 280, t, 0.12, 0.3, { slideTo: 110 }); noise(B, t, 0.08, 0.25, { f: 700 }); note(B, 'sine', 900, t + 0.05, 0.1, 0.2, { slideTo: 300 }); break;
      case 'break': noise(B, t, 0.18, 0.45, { f: 1200, q: 0.6 }); note(B, 'square', 240, t, 0.15, 0.25, { slideTo: 60 }); break;
      case 'splat': noise(B, t, 0.22, 0.5, { type: 'lowpass', f: 1800, fTo: 200 }); note(B, 'sine', 160, t, 0.2, 0.5, { slideTo: 40 }); break;
      case 'check': note(B, 'triangle', 659, t, 0.5, 0.35); note(B, 'triangle', 988, t + 0.1, 0.6, 0.35); note(B, 'sine', 1976, t + 0.1, 0.4, 0.12); break;
      case 'lever': note(B, 'sawtooth', 420, t, 1.1, 0.35, { slideTo: 40, lp: 1200 }); noise(B, t, 0.12, 0.4, { f: 500 }); noise(B, t + 0.2, 0.4, 0.2, { type: 'lowpass', f: 900, fTo: 100 }); break;
      case 'gurgle': for (var i = 0; i < 4; i++) note(B, 'sine', 90 + i * 14, t + i * 0.09, 0.14, 0.45, { slideTo: 60 + i * 10, vib: [14, 40] }); noise(B, t, 0.4, 0.1, { f: 300, q: 2 }); break;
      case 'tuba': note(B, 'sawtooth', 98, t, 0.75, 0.55, { lp: 380, a: 0.06, vib: [6, 22], hold: 0.7 }); note(B, 'square', 49, t, 0.7, 0.2, { lp: 200, a: 0.06 }); break;
      case 'foghorn': note(B, 'sawtooth', 55, t, 1.3, 0.55, { lp: 320, a: 0.08, vib: [3, 18], hold: 0.8 }); note(B, 'sawtooth', 55.8, t, 1.3, 0.5, { lp: 320, a: 0.08, hold: 0.8 }); note(B, 'square', 110, t, 1.2, 0.2, { lp: 260, a: 0.1 }); break;
      case 'blowout':
        sfx('foghorn'); noise(B, t, 0.5, 0.5, { type: 'lowpass', f: 2200, fTo: 120 }); note(B, 'sawtooth', 160, t, 0.7, 0.45, { slideTo: 40, lp: 900 });
        if (gross === 'mild') { note(B, 'sine', 500, t, 0.6, 0.3, { slideTo: 2000 }); }
        detuneNow = -80; break;
      case 'fire': noise(B, t, 0.6, 0.45, { type: 'bandpass', f: 600, fTo: 2400, q: 0.7 }); note(B, 'sawtooth', 140, t, 0.5, 0.3, { slideTo: 300, lp: 900 }); break;
      case 'pound': note(B, 'sine', 120, t, 0.35, 0.8, { slideTo: 30 }); noise(B, t, 0.25, 0.5, { type: 'lowpass', f: 900, fTo: 100 }); break;
      case 'bounce': note(B, 'sine', 200, t, 0.3, 0.4, { slideTo: 560 }); note(B, 'sine', 560, t + 0.12, 0.25, 0.3, { slideTo: 280 }); break;
      case 'cheer': noise(B, t, 0.9, 0.3, { f: 1400, fTo: 2600, q: 0.5, a: 0.2 }); [880, 1100, 1320].forEach(function (f, i) { note(B, 'triangle', f, t + 0.2 + i * 0.1, 0.2, 0.15); }); break;
      case 'gasp': noise(B, t, 0.35, 0.3, { type: 'bandpass', f: 2400, fTo: 700, q: 0.8, a: 0.05 }); break;
      case 'chant': for (var k = 0; k < 6; k++) { noise(B, t + k * 0.28, 0.07, 0.4, { f: 1500, q: 1.2 }); note(B, 'triangle', 220 + (k % 3) * 40, t + k * 0.28, 0.18, 0.2); } break;
      case 'ring': for (var r = 0; r < 4; r++) { note(B, 'sine', 440, t + r * 0.5, 0.2, 0.3); note(B, 'sine', 480, t + r * 0.5, 0.2, 0.3); note(B, 'sine', 440, t + r * 0.5 + 0.25, 0.2, 0.3); note(B, 'sine', 480, t + r * 0.5 + 0.25, 0.2, 0.3); } break;
      case 'freeze': [1500, 2000, 2600, 3200].forEach(function (f, i) { note(B, 'sine', f, t + i * 0.06, 0.4, 0.14); }); note(B, 'sine', 300, t, 0.6, 0.2, { slideTo: 120 }); break;
      case 'tear': noise(B, t, 0.18, 0.4, { type: 'highpass', f: 2500, fTo: 6000 }); break;
      case 'meow': note(B, 'sawtooth', 520 * (o.pitch || 1), t, 0.55, 0.22, { slideTo: 900 * (o.pitch || 1), slideT: 0.18, lp: 1800, a: 0.04, vib: [9, 25], hold: 0.5 }); note(B, 'sawtooth', 900 * (o.pitch || 1), t + 0.18, 0.4, 0.2, { slideTo: 480, lp: 1500, a: 0.01 }); break;
      case 'purr': for (var pr = 0; pr < 8; pr++) note(B, 'sawtooth', 62 + (pr % 2) * 5, t + pr * 0.085, 0.12, 0.2, { lp: 260 }); break;
      case 'hiss': noise(B, t, 0.5, 0.4, { type: 'highpass', f: 3500, a: 0.04 }); break;
      case 'sock': note(B, 'sine', 150, t, 0.12, 0.3, { slideTo: 70 }); noise(B, t, 0.1, 0.2, { f: 700, q: 0.6 }); break;
      case 'friend': [523, 659, 784, 1047, 1319].forEach(function (f, i) { note(B, 'triangle', f, t + i * 0.07, 0.5, 0.3); note(B, 'sine', f * 2, t + i * 0.07, 0.35, 0.12); }); break;
      case 'fizz': for (var fi = 0; fi < 9; fi++) note(B, 'sine', 900 + fi * 170 + Math.random() * 120, t + fi * 0.045, 0.07, 0.12, { slideTo: 1500 + fi * 120 }); noise(B, t, 0.5, 0.12, { type: 'highpass', f: 5000, a: 0.05 }); break;
      case 'drum': [0, 0.16, 0.32, 0.48].forEach(function (d, i) { note(B, 'sine', i % 2 ? 150 : 110, t + d, 0.18, 0.5, { slideTo: 60 }); noise(B, t + d, 0.05, 0.2, { f: 900, q: 1 }); }); break;
      case 'joke': note(B, 'sine', 120, t, 0.14, 0.5, { slideTo: 55 }); noise(B, t + 0.2, 0.12, 0.45, { f: 1900, q: 0.8 }); noise(B, t + 0.45, 0.45, 0.28, { type: 'highpass', f: 6500, a: 0.01 }); break;
      case 'whirr': note(B, 'triangle', 500, t, 0.5, 0.18, { slideTo: 900, vib: [18, 40] }); break;
      case 'hurt': note(B, 'square', 300, t, 0.18, 0.3, { slideTo: 120 }); break;
      case 'select': note(B, 'triangle', 660, t, 0.08, 0.3); break;
      case 'back': note(B, 'triangle', 440, t, 0.08, 0.3); break;
      case 'ok': note(B, 'triangle', 660, t, 0.07, 0.3); note(B, 'triangle', 880, t + 0.07, 0.12, 0.3); break;
      case 'whoosh': noise(B, t, 0.4, 0.3, { f: 400, fTo: 3000, q: 0.6, a: 0.12 }); break;
      case 'clear': [523, 659, 784, 1047].forEach(function (f, i) { note(B, 'triangle', f, t + i * 0.1, 0.5, 0.4); note(B, 'sine', f * 2, t + i * 0.1, 0.4, 0.15); }); [523, 659, 784].forEach(function (f) { note(B, 'triangle', f * 2, t + 0.5, 1.2, 0.3); }); break;
      case 'medal': [784, 1047, 1319].forEach(function (f, i) { note(B, 'triangle', f, t + i * 0.09, 0.45, 0.35); }); break;
      case 'fed': [392, 494, 587, 784, 988].forEach(function (f, i) { note(B, 'triangle', f, t + i * 0.12, 0.7, 0.4); }); break;
    }
  }

  /* the signature blast: a fluttering saw you can hold. */
  function blastOn() {
    if (!ctx || sustained || vol.sfx <= 0) return;
    var t = ctx.currentTime, g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5, t + 0.04); g.connect(sfxBus);
    var nodes = [];
    if (gross === 'mild') {
      var w = ctx.createBufferSource(); w.buffer = noiseBuf; w.loop = true; var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 1.2);
      w.connect(f); f.connect(g); w.start(t); nodes.push(w);
      var wh = ctx.createOscillator(); wh.type = 'sine'; wh.frequency.setValueAtTime(500, t); wh.frequency.exponentialRampToValueAtTime(1500, t + 1.2); var wg = ctx.createGain(); wg.gain.value = 0.25; wh.connect(wg); wg.connect(g); wh.start(t); nodes.push(wh);
    } else {
      var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(100, t); o1.frequency.exponentialRampToValueAtTime(150, t + 1.4);
      var fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(420, t); fl.frequency.exponentialRampToValueAtTime(1100, t + 1.4);
      var am = ctx.createGain(); am.gain.value = 0.6;
      var lfo = ctx.createOscillator(); lfo.frequency.value = 28; var lg = ctx.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);   // the flutter
      o1.connect(fl); fl.connect(am); am.connect(g);
      var nz = ctx.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true; var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 0.8; var ng = ctx.createGain(); ng.gain.value = gross === 'max' ? 0.4 : 0.2;
      nz.connect(nf); nf.connect(ng); ng.connect(g);
      o1.start(t); lfo.start(t); nz.start(t); nodes.push(o1, lfo, nz);
      if (gross === 'max') { var o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 55; var g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(g); o2.start(t); nodes.push(o2); }
    }
    sustained = { g: g, nodes: nodes };
  }
  function blastOff() {
    if (!sustained || !ctx) return; var s = sustained; sustained = null; var t = ctx.currentTime;
    s.g.gain.cancelScheduledValues(t); s.g.gain.setValueAtTime(s.g.gain.value, t); s.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    s.nodes.forEach(function (n) { try { n.stop(t + 0.12); } catch (e) {} });
  }
  function breatheOn() {
    if (!ctx || breath || vol.sfx <= 0) return; var t = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9; f.frequency.value = 600;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.3; var lg = ctx.createGain(); lg.gain.value = 300; lfo.connect(lg); lg.connect(f.frequency);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.3);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(t); lfo.start(t); breath = { g: g, nodes: [src, lfo] };
  }
  function breatheOff() {
    if (!breath || !ctx) return; var b = breath; breath = null; var t = ctx.currentTime;
    b.g.gain.cancelScheduledValues(t); b.g.gain.setValueAtTime(b.g.gain.value, t); b.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    b.nodes.forEach(function (n) { try { n.stop(t + 0.35); } catch (e) {} });
  }

  /* the sound ladder: gurgle, tuba, foghorn. Call every frame with the belly state. */
  function ladder(state, dt) {
    if (!ctx) return;
    if (state !== lad.state) {
      lad.state = state; lad.t = 0;
      if (state === 'round') sfx('gurgle'); else if (state === 'tight') sfx('tuba'); else if (state === 'critical') sfx('foghorn');
      return;
    }
    lad.t += dt;
    if (state === 'round' && lad.t > 4.5) { lad.t = 0; sfx('gurgle'); }
    else if (state === 'tight' && lad.t > 2.6) { lad.t = 0; sfx('tuba'); }
    else if (state === 'critical' && lad.t > 1.7) { lad.t = 0; sfx('foghorn'); }
  }

  G.Audio = {
    init: init, playSong: playSong, stopSong: stopSong, sfx: sfx, blastOn: blastOn, blastOff: blastOff, breatheOn: breatheOn, breatheOff: breatheOff, ladder: ladder,
    setVolumes: function (m, s) { vol.music = m; vol.sfx = s; applyMusicVol(); if (ctx) sfxBus.gain.setTargetAtTime(s, ctx.currentTime, 0.05); if (s <= 0) { blastOff(); breatheOff(); } },
    setGross: function (g) { gross = g; },
    setBelly: function (vit, pres) {
      belly.vit = vit; belly.pres = pres; tempoMul = 0.94 + 0.0013 * vit;
      if (ctx) lpNode.frequency.setTargetAtTime(Math.min(9000, 1200 + 80 * vit), ctx.currentTime, 0.3);
    },
    setLayers: function (n) { layers = n; },
    duck: function (on) { duckAmt = on ? 0.35 : 1; applyMusicVol(); },
    bend: function () { detuneNow = -80; },
    current: function () { return cur && cur.name; },
    ready: function () { return !!ctx; },
    running: function () { return !!ctx && ctx.state === 'running'; },
    SONGS: SONGS, parseSong: parseSong
  };
})(typeof window !== 'undefined' ? window : this);
