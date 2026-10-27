/* GUTS art, part 2: backgrounds, tiles, decorations, cutscene panels, the Gut Village, the cover. */
(function (root) {
  'use strict';
  var A = root.GUTS.Art, P = A.p, INK = A.INK, TAU = Math.PI * 2;
  var fs = P.fs, ell = P.ell, circ = P.circ, rr = P.rr, line = P.line, poly = P.poly;

  function hash(n) { n = Math.imul(n ^ 61, 1597334677); n ^= n >>> 15; n = Math.imul(n, 2246822519); n ^= n >>> 13; return (n >>> 0) / 4294967296; }
  function sky(ctx, o, stops) { var g = ctx.createLinearGradient(0, 0, 0, o.vh); stops.forEach(function (s) { g.addColorStop(s[0], s[1]); }); ctx.fillStyle = g; ctx.fillRect(0, 0, o.vw, o.vh); }
  function repeat(o, par, period, fn) {
    var base = o.cx * par, first = Math.floor(base / period) - 1;
    for (var i = first; i * period - base < o.vw + period; i++) fn(i * period - base, i);
  }

  /* ---------------- backgrounds ---------------- */
  var BG = {};
  BG.home = function (ctx, o) {
    var gy = o.groundY - o.cy, edge = 92 * 32 - o.cx;
    sky(ctx, o, [[0, '#8fd0ff'], [0.6, '#d6f0ff'], [1, '#fff0c9']]);
    // back yard: far houses and trees
    repeat(o, 0.25, 240, function (x, i) { var h = 70 + hash(i) * 60; rr(ctx, x, gy - h - 40, 150, h + 40, 4, ['#e8b4a0', '#a9c8e8', '#f0d9a0'][i % 3 < 0 ? 0 : Math.abs(i) % 3], 0); poly(ctx, [x - 8, gy - h - 40, x + 75, gy - h - 80, x + 158, gy - h - 40], '#a86a52', 0); });
    repeat(o, 0.5, 190, function (x, i) { circ(ctx, x + 60, gy - 78, 46 + hash(i) * 16, '#68c07a', 0); rr(ctx, x + 54, gy - 50, 12, 52, 3, '#8a5a30', 0); });
    ctx.fillStyle = '#7ccf6e'; ctx.fillRect(0, gy, o.vw, o.vh);
    if (edge > 0) { // indoor wall
      var wy0 = -o.cy, w = Math.min(edge, o.vw);
      ctx.fillStyle = '#ffe3a3'; ctx.fillRect(0, wy0, w, gy - wy0);
      ctx.fillStyle = '#ffd480'; var sx0 = -(o.cx % 48); for (var x = sx0; x < w; x += 48) ctx.fillRect(x, wy0, 20, gy - wy0);
      ctx.fillStyle = '#d98a4a'; ctx.fillRect(0, gy - 70, w, 70);       // wainscot
      ctx.fillStyle = '#c0763a'; ctx.fillRect(0, gy - 74, w, 6);
      ctx.fillStyle = '#9a5a2a'; ctx.fillRect(0, wy0, w, 6);
      if (o.cy < 0) {   // above the ceiling: the roof of the house, then sky
        var rh = Math.min(wy0, 120), ry = wy0 - rh;
        ctx.fillStyle = '#8f4a3c'; ctx.fillRect(0, ry, w, rh); ctx.strokeStyle = 'rgba(43,29,20,.35)'; ctx.lineWidth = 2;
        for (var rr2 = 0; rr2 < rh; rr2 += 16) { ctx.beginPath(); ctx.moveTo(0, ry + rr2); ctx.lineTo(w, ry + rr2); ctx.stroke(); for (var rx = ((rr2 / 16) % 2) * 20 - (o.cx % 40); rx < w; rx += 40) { ctx.beginPath(); ctx.moveTo(rx, ry + rr2); ctx.lineTo(rx, ry + rr2 + 16); ctx.stroke(); } }
        ctx.fillStyle = '#6b3328'; ctx.fillRect(0, ry, w, 8);
      }
    }
  };
  BG.market = function (ctx, o) {
    var gy = o.groundY - o.cy;
    sky(ctx, o, [[0, '#8fd0ff'], [0.55, '#d6f0ff'], [1, '#ffe9c2']]);
    repeat(o, 0.15, 360, function (x, i) {
      var h = 150 + hash(i) * 110; rr(ctx, x + 40, gy - h - 70, 60, h + 70, 4, '#9bb8d8', 0);
      circ(ctx, x + 70, gy - h - 74, 34, '#8aa8cc', 0);
      for (var r = 0; r < 5; r++) for (var c = 0; c < 2; c++) ctx.fillRect(x + 52 + c * 24, gy - h - 40 + r * 40, 10, 14);
      rr(ctx, x + 180, gy - 140 - hash(i + 9) * 60, 70, 210, 3, '#a9c2dd', 0);
    });
    repeat(o, 0.4, 300, function (x, i) {
      rr(ctx, x, gy - 150, 270, 150, 6, ['#b5533c', '#a64a35', '#c4624a'][Math.abs(i) % 3], 0);
      for (var k = 0; k < 6; k++) { rr(ctx, x + 18 + k * 42, gy - 120, 24, 34, 12, '#f3d9a8', 0); }
      rr(ctx, x - 10, gy - 162, 290, 16, 5, '#7e3a2a', 0);
    });
    repeat(o, 0.7, 210, function (x, i) {
      var cols = ['#e0584a', '#f3d9a8']; for (var k = 0; k < 6; k++) { ctx.fillStyle = cols[k % 2]; ctx.fillRect(x + k * 24, gy - 64, 24, 26); }
      ctx.fillStyle = '#7e3a2a'; ctx.fillRect(x + 4, gy - 38, 6, 38); ctx.fillRect(x + 134, gy - 38, 6, 38);
      circ(ctx, x + 40, gy - 28, 9, '#e63946', 0); circ(ctx, x + 60, gy - 28, 9, '#58b368', 0); circ(ctx, x + 80, gy - 28, 9, '#f0a53a', 0);
    });
  };
  BG.commute = function (ctx, o) {
    var gy = o.groundY - o.cy;
    sky(ctx, o, [[0, '#6fc3ff'], [0.5, '#bfe6ff'], [1, '#eaf7ff']]);
    repeat(o, 0.08, 800, function (x, i) {   // Ambassador Bridge
      ctx.strokeStyle = '#7f96b6'; ctx.lineWidth = 5;
      line(ctx, x + 100, gy - 100, x + 100, gy - 360, '#7f96b6', 14); line(ctx, x + 560, gy - 100, x + 560, gy - 360, '#7f96b6', 14);
      ctx.beginPath(); ctx.moveTo(x, gy - 110); ctx.quadraticCurveTo(x + 100, gy - 360, x + 330, gy - 150); ctx.quadraticCurveTo(x + 560, gy - 360, x + 800, gy - 110); ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#8aa0be'; ctx.fillRect(x, gy - 104, 800, 12);
    });
    repeat(o, 0.35, 210, function (x, i) { var r = 50 + hash(i) * 30; circ(ctx, x + 70, gy - r - 20, r, '#5fb872', 0); circ(ctx, x + 120, gy - r * 0.7, r * 0.8, '#6cc47e', 0); });
    repeat(o, 0.65, 140, function (x, i) { ell(ctx, x + 50, gy - 16, 50, 24, '#4aa862', 0); if (hash(i + 3) > 0.5) { rr(ctx, x + 60, gy - 60, 8, 40, 3, '#8a5a30', 0); circ(ctx, x + 64, gy - 70, 26, '#43b556', 0); } });
  };
  BG.rooftop = function (ctx, o) {
    var gy = o.groundY - o.cy;
    sky(ctx, o, [[0, '#241648'], [0.45, '#7a3a7e'], [0.8, '#f0647a'], [1, '#ffb36b']]);
    for (var s = 0; s < 40; s++) { var sx = (hash(s) * o.vw), sy = hash(s + 50) * o.vh * 0.45; circ(ctx, sx, sy, 1 + hash(s + 9) * 1.2, 'rgba(255,255,255,' + (0.4 + 0.4 * hash(s + 3)) + ')', 0); }
    circ(ctx, o.vw * 0.78, o.vh * 0.18, 34, '#ffe9b0', 0);
    repeat(o, 0.12, 300, function (x, i) { var h = 140 + hash(i) * 200; ctx.fillStyle = '#4a2a66'; ctx.fillRect(x, gy - h, 90, h + 200); ctx.fillRect(x + 110, gy - h * 0.7, 70, h * 0.7 + 200); ctx.fillStyle = 'rgba(255,210,120,.7)'; for (var k = 0; k < 8; k++) if (hash(i * 9 + k) > 0.5) ctx.fillRect(x + 12 + (k % 2) * 36, gy - h + 16 + Math.floor(k / 2) * 34, 14, 18); });
    repeat(o, 0.3, 260, function (x, i) { var h = 110 + hash(i + 40) * 160; ctx.fillStyle = '#2f1c4a'; ctx.fillRect(x, gy - h, 110, h + 200); ctx.fillStyle = 'rgba(255,200,110,.8)'; for (var k = 0; k < 10; k++) if (hash(i * 7 + k) > 0.45) ctx.fillRect(x + 12 + (k % 3) * 32, gy - h + 14 + Math.floor(k / 3) * 30, 12, 16); });
    // People Mover track with a distant train
    var ty = gy - 250; ctx.fillStyle = '#6b4a8a'; ctx.fillRect(0, ty, o.vw, 10);
    repeat(o, 0.55, 150, function (x) { ctx.fillRect(x + 70, ty, 8, 300); });
    var tx = ((o.t * 120) % (o.vw + 400)) - 200; rr(ctx, tx, ty - 26, 180, 26, 8, '#f0f0ff', 0); for (var w = 0; w < 5; w++) rr(ctx, tx + 10 + w * 34, ty - 20, 24, 12, 3, '#6fb4e8', 0);
  };
  BG.factory = function (ctx, o) {
    var gy = o.groundY - o.cy;
    sky(ctx, o, [[0, '#3b3329'], [0.6, '#6f6350'], [1, '#b8a67c']]);
    repeat(o, 0.2, 420, function (x, i) {
      ctx.save(); ctx.translate(x + 120, gy - 240 - hash(i) * 60); ctx.rotate(o.t * 0.3 * (i % 2 ? 1 : -1));
      circ(ctx, 0, 0, 70, '#55493a', 0); for (var k = 0; k < 10; k++) { ctx.rotate(TAU / 10); ctx.fillStyle = '#55493a'; ctx.fillRect(-9, -88, 18, 24); } circ(ctx, 0, 0, 24, '#3b3329', 0); ctx.restore();
      ctx.fillStyle = '#4a4034'; ctx.fillRect(x + 300, gy - 360, 46, 360); ctx.fillStyle = 'rgba(230,214,170,.5)'; circ(ctx, x + 320 + Math.sin(o.t + i) * 10, gy - 390, 30, 'rgba(230,214,170,.5)', 0);
    });
    repeat(o, 0.5, 180, function (x) { ctx.fillStyle = '#6b5f4c'; ctx.fillRect(x, gy - 200, 14, 200); ctx.fillRect(x - 30, gy - 160, 200, 10); });
    var hz = ctx.createLinearGradient(0, 0, 0, o.vh); hz.addColorStop(0, 'rgba(230,214,170,0)'); hz.addColorStop(1, 'rgba(230,214,170,.35)'); ctx.fillStyle = hz; ctx.fillRect(0, 0, o.vw, o.vh);
  };
  BG.mouth = function (ctx, o) {
    var gy = o.groundY - o.cy;
    sky(ctx, o, [[0, '#ffb1c4'], [0.5, '#ee7a9c'], [1, '#c24a74']]);
    repeat(o, 0.18, 260, function (x, i) { var r = 80 + hash(i) * 60; circ(ctx, x + 100, gy - 160 - hash(i + 5) * 120, r, 'rgba(194,74,116,.5)', 0); circ(ctx, x + 80, gy - 190, r * 0.35, 'rgba(255,200,215,.35)', 0); });
    repeat(o, 0.45, 180, function (x, i) { ell(ctx, x + 60, gy - 40 - hash(i) * 70, 60, 40, 'rgba(176,56,98,.5)', 0); circ(ctx, x + 40, gy - 64 - hash(i) * 70, 8, 'rgba(255,225,235,.5)', 0); });
    repeat(o, 0.7, 340, function (x, i) { var d = (o.t * 40 + hash(i) * 300) % 300; ell(ctx, x + 70, 30 + d, 5, 8, 'rgba(210,235,255,.8)', 0); line(ctx, x + 70, 0, x + 70, 30 + d - 6, 'rgba(210,235,255,.4)', 2); });
  };
  BG.village = function (ctx, o) {
    var gy = o.groundY - o.cy;
    sky(ctx, o, [[0, '#ffc2d4'], [0.6, '#ff9db8'], [1, '#ffd9b8']]);
    repeat(o, 0.2, 240, function (x, i) { for (var k = 0; k < 6; k++) { ell(ctx, x + 20 + k * 36, gy - 50 - hash(i * 7 + k) * 100, 12, 60 + hash(i + k) * 40, 'rgba(255,130,160,.5)', 0); } });
    ctx.fillStyle = '#ffb6a8'; ctx.fillRect(0, gy, o.vw, o.vh);
  };
  A.bg = function (theme, ctx, o) { (BG[theme] || BG.market)(ctx, o); };

  /* ---------------- tiles (cached 64px sprites drawn at 32) ---------------- */
  var tileCache = {};
  var TH = {
    home: { top: '#e6b36a', body: '#c98b4f', edge: '#a96d33', blk: '#d9953d' },
    market: { top: '#a3a7b3', body: '#7f8493', edge: '#5c6070', blk: '#b5533c' },
    commute: { top: '#4cc563', body: '#8a5a30', edge: '#6a4220', blk: '#9aa0ad' },
    rooftop: { top: '#a8a5c8', body: '#6f6a98', edge: '#4a456e', blk: '#8a85b0' },
    factory: { top: '#a39e92', body: '#7b7d86', edge: '#575963', blk: '#8c8068' },
    mouth: { top: '#ff9bb8', body: '#f07ba0', edge: '#c24a74', blk: '#e0709a' },
    village: { top: '#ffb6a8', body: '#f09890', edge: '#c06a68', blk: '#e8a0a0' }
  };
  function tileSprite(theme, ch, top, seed) {
    var key = theme + ch + (top ? 1 : 0) + (seed & 1), hit = tileCache[key]; if (hit) return hit;
    var cv = document.createElement('canvas'); cv.width = cv.height = 64; var c = cv.getContext('2d'); c.scale(2, 2);
    var t = TH[theme] || TH.market;
    function body(col) { c.fillStyle = col; c.fillRect(0, 0, 32, 32); }
    function speck(col, n) { c.fillStyle = col; for (var i = 0; i < n; i++) c.fillRect(((i * 53 + seed * 17) % 28) + 1, ((i * 37 + seed * 11) % 28) + 1, 3, 2); }
    if (ch === '#' || ch === 'C') {
      body(t.body);
      if (theme === 'commute') { speck('#6a4220', 5); speck('#a87a4a', 3); }
      else if (theme === 'home') { c.fillStyle = t.edge; c.fillRect(0, 15, 32, 2); c.fillRect(seed & 1 ? 10 : 22, 0, 2, 15); c.fillRect(seed & 1 ? 22 : 8, 17, 2, 15); }
      else if (theme === 'rooftop') { c.fillStyle = 'rgba(255,214,130,.8)'; if (!top) { c.fillRect(6, 8, 7, 9); c.fillRect(19, 8, 7, 9); c.fillRect(6, 22, 7, 8); } }
      else if (theme === 'factory') { c.fillStyle = t.edge; c.fillRect(0, 15, 32, 2); circ(c, 4, 4, 1.6, '#4a4d56', 0); circ(c, 28, 4, 1.6, '#4a4d56', 0); circ(c, 4, 28, 1.6, '#4a4d56', 0); circ(c, 28, 28, 1.6, '#4a4d56', 0); }
      else if (theme === 'mouth') { c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(10, 10, 6, 3, -0.4, 0, TAU); c.fill(); speck('#d9557f', 4); }
      else { c.fillStyle = t.edge; c.fillRect(0, 15, 32, 1.5); speck('#656a78', 4); }
      if (top) {
        c.fillStyle = t.top; c.fillRect(0, 0, 32, 10);
        if (theme === 'commute') { c.fillStyle = '#35a24e'; for (var g = 0; g < 8; g++) poly(c, [g * 4 + 1, 10, g * 4 + 3, 4 + (g % 3) * 2, g * 4 + 5, 10], '#35a24e', 0); }
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 9, 32, 2);
        if (theme === 'market') { c.fillStyle = '#f3d23a'; if (seed & 1) c.fillRect(8, 3, 16, 3); }
        if (theme === 'mouth') { c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(6, 2, 10, 2); }
      }
      c.strokeStyle = 'rgba(43,29,20,.35)'; c.lineWidth = 1; c.strokeRect(0.5, 0.5, 31, 31);
      if (ch === 'C') { c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.moveTo(4, 2); c.lineTo(14, 12); c.lineTo(9, 20); c.lineTo(20, 30); c.moveTo(14, 12); c.lineTo(26, 14); c.stroke(); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 0, 32, 32); }
    } else if (ch === 'B') {
      if (theme === 'market' || theme === 'commute') { body(t.blk); c.strokeStyle = 'rgba(43,29,20,.45)'; c.lineWidth = 1.5; for (var r = 0; r < 4; r++) { c.beginPath(); c.moveTo(0, r * 8 + 8); c.lineTo(32, r * 8 + 8); c.stroke(); c.beginPath(); var o2 = r % 2 ? 8 : 0; c.moveTo(o2 + 8, r * 8); c.lineTo(o2 + 8, r * 8 + 8); c.moveTo(o2 + 24, r * 8); c.lineTo(o2 + 24, r * 8 + 8); c.stroke(); } if (theme === 'commute') { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, 32, 6); } }
      else { body(t.blk); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 0, 32, 6); c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, 26, 32, 6); }
      c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(1, 1, 30, 30);
    } else if (ch === '?') {
      body('#e6a93c'); c.strokeStyle = '#8a5a00'; c.lineWidth = 2; c.strokeRect(1, 1, 30, 30); c.fillStyle = '#c4851a'; c.fillRect(3, 3, 26, 26); ctx_t(c, '?', 16, 24, 20, '#fff3c4');
      c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(1.2, 1.2, 29.6, 29.6);
    } else if (ch === 'X') {
      body('#e6d3a8'); c.strokeStyle = '#8a7650'; c.lineWidth = 1.6; c.strokeRect(1, 1, 30, 30); line(c, 0, 16, 32, 16, '#8a7650', 1.6); line(c, 16, 0, 16, 16, '#8a7650', 1.6); line(c, 8, 16, 8, 32, '#8a7650', 1.6); line(c, 24, 16, 24, 32, '#8a7650', 1.6); ctx_t(c, 'SNAX', 16, 13, 7, '#8a7650');
      c.strokeStyle = INK; c.lineWidth = 2.2; c.strokeRect(1.1, 1.1, 29.8, 29.8);
    } else if (ch === 'T') {
      body('#fffdf4'); c.fillStyle = '#e9e4cf'; c.fillRect(0, 22, 32, 10); ell(c, 10, 8, 4, 2.4, '#fff', 0); c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(1, 1, 30, 30);
    } else if (ch === 'U') {
      body('#e8456b'); c.fillStyle = '#ff8aa6'; c.fillRect(0, 0, 32, 9); for (var s = 0; s < 4; s++) circ(c, 4 + s * 8, 17, 2.2, '#c22d54', 0); c.strokeStyle = INK; c.lineWidth = 2.5; c.strokeRect(1, 1, 30, 30);
    } else if (ch === '~') {
      body('#7a5a2a'); c.fillStyle = '#d9a62e'; c.fillRect(0, 0, 32, 10); c.fillStyle = 'rgba(255,245,170,.6)'; c.fillRect(4, 2, 12, 3); c.fillRect(20, 5, 6, 2); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(1, 1, 30, 30);
    } else if (ch === 'd') {
      body('#6b4220'); speck('#8a5a30', 7); speck('#4a2c12', 5); c.fillStyle = '#7b4a24'; c.fillRect(0, 0, 32, 7); c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(1, 1, 30, 30);
    } else if (ch === '=') {
      var awn = theme === 'market';
      if (awn) { for (var k = 0; k < 4; k++) { c.fillStyle = k % 2 ? '#f3e9d0' : '#e0584a'; c.fillRect(k * 8, 0, 8, 12); } c.strokeStyle = INK; c.lineWidth = 2; c.strokeRect(1, 1, 30, 11); poly(c, [0, 12, 4, 17, 8, 12, 12, 17, 16, 12, 20, 17, 24, 12, 28, 17, 32, 12], '#e0584a', 1.6); }
      else { rr(c, 0, 0, 32, 10, 3, theme === 'home' ? '#f0c27a' : '#c9b79c', 2.4); line(c, 8, 3, 8, 8, 'rgba(43,29,20,.4)', 1.5); line(c, 24, 3, 24, 8, 'rgba(43,29,20,.4)', 1.5); }
    }
    tileCache[key] = cv; return cv;
  }
  function ctx_t(c, s, x, y, size, col) { c.fillStyle = col; c.font = '700 ' + size + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText(s, x, y); }
  A.tile = function (ctx, theme, ch, x, y, top, seed) { ctx.drawImage(tileSprite(theme, ch, top, seed || 0), x - 0.3, y - 0.3, 32.6, 32.6); };

  /* ---------------- decorations ---------------- */
  var FRONT = { fridge: 1, sofa: 1, rug: 1, fence: 1, tower: 1, crates: 1, dresser: 1 };
  A.decorIsFront = function (d) { return !!FRONT[d.type]; };
  A.decor = function (ctx, d, t, st) {
    var x = d.x * 32, y = d.y * 32, w = (d.w || 1) * 32, h = (d.h || 1) * 32;
    st = st || {};
    switch (d.type) {
      case 'bed': rr(ctx, x, y - 52, 140, 52, 6, '#4a90d9', 3); rr(ctx, x + 6, y - 74, 36, 28, 10, '#fff', 3); rr(ctx, x + 40, y - 62, 94, 18, 6, '#e8c46a', 2.5); rr(ctx, x - 6, y - 82, 10, 82, 3, '#8a5a30', 3); rr(ctx, x + 138, y - 64, 10, 64, 3, '#8a5a30', 3); break;
      case 'window': rr(ctx, x, y, 128, 128, 6, '#fff', 4); rr(ctx, x + 8, y + 8, 112, 112, 3, '#8fd0ff', 0); circ(ctx, x + 84, y + 40, 18, '#ffe066', 0); line(ctx, x + 64, y + 8, x + 64, y + 120, '#fff', 4); line(ctx, x + 8, y + 64, x + 120, y + 64, '#fff', 4); poly(ctx, [x - 10, y - 4, x + 26, y - 4, x + 14, y + 138, x - 10, y + 138], '#e0584a', 2.5); break;
      case 'kitchen': // upper cabinets and a window sill
        for (var i = 0; i < d.w; i += 4) { rr(ctx, x + i * 32 + 4, 100, 116, 76, 5, '#f0d9a8', 3); circ(ctx, x + i * 32 + 100, 154, 4, '#8a5a30', 1.5); }
        rr(ctx, x + 40, 20, 300, 40, 8, '#fff', 3); ctx.fillStyle = '#8a5a30'; ctx.font = '700 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('KITCHEN', x + 190, 46); break;
      case 'fridge': rr(ctx, x, y, w, h, 10, '#e8edf5', 4); line(ctx, x + 4, y + h * 0.36, x + w - 4, y + h * 0.36, INK, 3); rr(ctx, x + w - 18, y + 16, 6, 40, 3, '#9aa3b5', 2); rr(ctx, x + w - 18, y + h * 0.36 + 16, 6, 60, 3, '#9aa3b5', 2); ctx.save(); ctx.translate(x + 28, y + 33); ctx.rotate(Math.sin(t * 35) * (st.wob || 0) * 0.35); rr(ctx, -14, -11, 28, 22, 3, '#ffd93d', 2); ctx.restore(); ctx.save(); ctx.translate(x + 61, y + 81); ctx.rotate(Math.sin(t * 31 + 1) * (st.wob || 0) * 0.35); rr(ctx, -11, -11, 22, 22, 3, '#58b9f5', 2); ctx.restore(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x + 8, y + 8, 8, h - 16); break;
      case 'rug': ctx.fillStyle = 'rgba(224,88,74,.85)'; ctx.fillRect(x, y - 6, w, 8); ctx.fillStyle = '#fff1d6'; for (var k = 0; k < d.w; k++) ctx.fillRect(x + k * 32 + 12, y - 6, 8, 8); break;
      case 'sofa': rr(ctx, x - 6, y - 36, w + 12, 66, 14, '#4a90d9', 3.5); rr(ctx, x + 6, y - 20, w - 12, 40, 10, '#6aa7ec', 2.5); rr(ctx, x - 14, y - 24, 22, 54, 9, '#3a7bc4', 3); rr(ctx, x + w - 8, y - 24, 22, 54, 9, '#3a7bc4', 3); break;
      case 'tv': rr(ctx, x, y, 176, 108, 8, '#2b2b36', 4); rr(ctx, x + 10, y + 10, 156, 84, 4, '#0d1a2a', 0);
        if (st.tvOn !== false) { A.baron(ctx, x + 88, y + 92, 0.38, t, 'rant'); for (var q = 0; q < 6; q++) A.snaxCube(ctx, x + 22 + q * 26, y + 82 + Math.sin(t * 3 + q) * 3, 0, 12); ctx.fillStyle = '#fff'; ctx.fillRect(x + 10, y + 74, 156, 20); ctx.fillStyle = '#d9473f'; ctx.font = '700 11px Fredoka, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('BEIGE CUBES AT EASTERN MARKET', x + ((-t * 40) % 260) + 160, y + 88); }
        break;
      case 'fence': for (var f = 0; f < d.w * 2; f++) { rr(ctx, x + f * 16 + 1, y, 14, h, 3, '#f2f0e6', 2.5); poly(ctx, [x + f * 16 + 1, y, x + f * 16 + 8, y - 8, x + f * 16 + 15, y], '#f2f0e6', 2.5); } ctx.fillStyle = 'rgba(43,29,20,.2)'; ctx.fillRect(x, y + 30, w, 8); ctx.fillRect(x, y + h - 50, w, 8); break;
      case 'billboard': rr(ctx, x, y, 224, 128, 8, '#e6d3a8', 4); A.baron(ctx, x + 70, y + 128, 0.62, t, 'smile'); ctx.fillStyle = '#7a6a48'; ctx.font = '700 22px Fredoka, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('BEIGE', x + 126, y + 56); ctx.fillText('IS BEST!', x + 126, y + 84); line(ctx, x + 40, y + 128, x + 40, y + 300, '#6b5f4c', 8); line(ctx, x + 184, y + 128, x + 184, y + 300, '#6b5f4c', 8); break;
      case 'crates': for (var cr = 0; cr < d.h; cr++) for (var cc = 0; cc < d.w; cc++) { rr(ctx, x + cc * 32 + 1, y + cr * 32 + 1, 30, 30, 3, '#d9a566', 3); line(ctx, x + cc * 32 + 4, y + cr * 32 + 4, x + cc * 32 + 28, y + cr * 32 + 28, 'rgba(43,29,20,.35)', 2); line(ctx, x + cc * 32 + 28, y + cr * 32 + 4, x + cc * 32 + 4, y + cr * 32 + 28, 'rgba(43,29,20,.35)', 2); } break;
      case 'plate': rr(ctx, x - 6, y - 46, 46, 46, 5, '#c98b4f', 3); rr(ctx, x - 2, y - 40, 38, 14, 3, '#dda56a', 2); ell(ctx, x + 17, y - 52, 20, 5, '#fff', 2.5); if (st.plateBao !== false) A.drawFood(ctx, 'bao', x + 17, y - 66, 34); break;
      case 'dresser': rr(ctx, x, y, w, h, 8, '#c98b4f', 4); for (var dr = 0; dr < 2; dr++) { rr(ctx, x + 8, y + 6 + dr * 28, w - 16, 22, 4, '#dda56a', 2.5); rr(ctx, x + w / 2 - 8, y + 14 + dr * 28, 16, 5, 2, '#7a4a2a', 1.5); } ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 4, y + 4, w - 8, 4); break;
      case 'tower': for (var r = 0; r < d.h; r++) for (var c2 = 0; c2 < d.w; c2++) { var col = ['#e63946', '#58b368', '#f0a53a', '#4a90d9'][(r + c2) % 4]; rr(ctx, x + c2 * 32 + 2, y + r * 32 + 2, 28, 28, 7, '#d9a566', 3); circ(ctx, x + c2 * 32 + 16, y + r * 32 + 16, 8, col, 2); } break;
      case 'freeway': for (var px = d.x * 32 + 100; px < d.x1 * 32; px += 420) { rr(ctx, px, d.y * 32 + 104, 46, 700, 4, '#8f95a3', 3); } break;
      case 'antenna': line(ctx, x + 16, y + 20, x + 16, y + 360, '#6b5f7a', 6); circ(ctx, x + 16, y + 20, 10, '#ff4b6a', 2); ell(ctx, x + 16, y + 70, 30, 9, '#d8d4ec', 2.5); line(ctx, x - 10, y + 50, x + 42, y + 50, '#6b5f7a', 4); if (((t * 2) | 0) % 2) circ(ctx, x + 16, y + 20, 18, 'rgba(255,75,106,.35)', 0); break;
      case 'conveyor': rr(ctx, x, y - 4, w, 20, 6, '#4a4d56', 3); for (var cx2 = 0; cx2 < d.w * 2; cx2++) { var bx = x + ((cx2 * 16 + t * (st.jammed ? 0 : 60)) % w); poly(ctx, [bx, y + 1, bx + 8, y + 6, bx, y + 11], 'rgba(244,194,26,.8)', 0); } for (var cb = 0; cb < 5; cb++) { A.snaxCube(ctx, x + ((cb * 180 + t * (st.jammed ? 0 : 60)) % w), y - 14, 0, 20); } break;
      case 'machine': {
        var off = st.machineOff; rr(ctx, x, y, 200, 230, 12, '#d8c8a0', 4); rr(ctx, x + 18, y + 18, 164, 70, 8, '#bda57a', 3); ctx.fillStyle = '#7a6a48'; ctx.font = '700 24px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SNAX-O-TRON', x + 100, y + 62);
        rr(ctx, x + 40, y + 110, 120, 70, 6, '#3a3224', 3);
        if (!off) { for (var s = 0; s < 3; s++) circ(ctx, x + 40 + s * 40, y - 10 - ((t * 30 + s * 20) % 70), 14 + s * 4, 'rgba(120,110,90,' + (0.5 - s * 0.1) + ')', 0); A.snaxCube(ctx, x + 100, y + 200 + ((t * 70) % 30), t, 20); }
        else { for (var f2 = 0; f2 < 5; f2++) A.drawFood(ctx, ['apple', 'banana', 'cherries', 'tomato', 'broccoli'][f2], x + 30 + f2 * 36, y + 214 + Math.sin(t * 4 + f2) * 3, 28); }
        line(ctx, x + 200, y + 140, x + 236, y + 168 + (off ? 36 : 0), '#6b5f4c', 8); circ(ctx, x + 236, y + 168 + (off ? 36 : 0), 10, '#e22b2b', 3);
        break; }
    }
  };

  /* ---------------- cutscene panels ---------------- */
  function panelBg(ctx, w, h, c1, c2) { var g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  var PANEL = {};
  PANEL.factory = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#4a3d30', '#a8987a');
    for (var i = 0; i < 5; i++) { var cx = w * (0.1 + i * 0.2); rr(ctx, cx, h * 0.15, 50, h * 0.55, 4, '#3b3329', 0); circ(ctx, cx + 25 + Math.sin(t + i) * 10, h * 0.1 - ((t * 20 + i * 30) % 40), 26, 'rgba(230,214,170,.4)', 0); }
    rr(ctx, w * 0.3, h * 0.35, w * 0.4, h * 0.5, 12, '#d8c8a0', 4);
    A.baron(ctx, w / 2, h * 0.9, Math.min(w, h) / 380, t, 'smile');
  };
  PANEL.machine = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#5a4c3a', '#a8987a');
    rr(ctx, 0, h * 0.7, w, h * 0.12, 4, '#4a4d56', 3);
    var s = Math.min(w, h) / 360, names = ['apple', 'tomato', 'banana', 'cherries', 'broccoli', 'coney'];
    for (var i = 0; i < 8; i++) { var x = ((i * 130 * s + t * 90 * s) % (w + 120 * s)); var pass = x / w; var food = pass < 0.5; if (food) A.drawFood(ctx, names[i % names.length], x, h * 0.68, 60 * s); else A.snaxCube(ctx, x, h * 0.68, 0, 46 * s); }
    rr(ctx, w * 0.42, h * 0.2, w * 0.16, h * 0.5, 10, '#d8c8a0', 4); ctx.fillStyle = '#7a6a48'; ctx.font = '700 ' + (22 * s) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CRUNCH', w / 2, h * 0.45 + Math.sin(t * 20) * 3);
  };
  PANEL.baron = function (ctx, w, h, t) { panelBg(ctx, w, h, '#6a5c48', '#c8b88e'); A.baron(ctx, w / 2, h * 0.95, Math.min(w, h) / 250, t, 'rant'); for (var i = 0; i < 6; i++) A.snaxCube(ctx, w * (0.1 + i * 0.16), h * 0.15 + Math.sin(t * 2 + i) * 10, t + i, 30); };
  PANEL.room = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#ffe3a3', '#ffc977'); ctx.fillStyle = '#c98b4f'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
    ctx.save(); ctx.translate(w * 0.12, h * 0.1); ctx.scale(Math.min(w, h) / 300, Math.min(w, h) / 300); A.decor(ctx, { type: 'window', x: 0, y: 0 }, t); ctx.restore();
    ctx.save(); ctx.translate(w * 0.6, h * 0.78); var s = Math.min(w, h) / 200; ctx.scale(s, s); A.decor(ctx, { type: 'bed', x: 0, y: 0 / 32 }, t); ctx.restore();
    A.gus(ctx, { x: w * 0.38, y: h * 0.78, t: t, face: 1, state: 'springy', sx: Math.min(w, h) / 120, sy: Math.min(w, h) / 120, vit: 70 });
  };
  PANEL.lantern = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#2a2150', '#5a3f7a'); var s = Math.min(w, h) / 160;
    var gr = ctx.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h * 0.45, h * 0.6); gr.addColorStop(0, 'rgba(255,200,100,.7)'); gr.addColorStop(1, 'rgba(255,200,100,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(w / 2, h * 0.5); ctx.scale(s, s); ctx.rotate(Math.sin(t * 1.5) * 0.05);
    line(ctx, 0, -70, 0, -50, INK, 3); rr(ctx, -34, -52, 68, 14, 5, '#ffd36b', 3); rr(ctx, -42, -38, 84, 80, 22, '#ee4b3f', 4); ctx.fillStyle = 'rgba(255,230,140,.6)'; ctx.fillRect(-30, -28, 60, 60);
    for (var i = -1; i <= 1; i++) line(ctx, i * 18, -36, i * 18, 40, '#ffd36b', 3);
    rr(ctx, -34, 40, 68, 12, 5, '#ffd36b', 3); for (var k = -2; k <= 2; k++) line(ctx, k * 12, 52, k * 12 + Math.sin(t * 3 + k) * 3, 80, '#ffd36b', 3);
    ctx.fillStyle = '#7a1f1f'; ctx.font = '700 40px "Noto Serif TC", serif'; ctx.textAlign = 'center'; ctx.fillText('婆', 0, 18); ctx.restore();
  };
  PANEL.belly = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#ffd9b8', '#ffb6a8'); var s = Math.min(w, h) / 120;
    A.gus(ctx, { x: w * 0.5, y: h * 0.9, t: t, face: 1, state: 'tight', pres: 70, vit: 60, sx: s, sy: s, butterflies: 2 });
    var ic = ['apple', 'coney', 'broccoli', 'candy', 'water'];
    for (var i = 0; i < ic.length; i++) { var a = t * 1.5 + i * 1.3; A.drawFood(ctx, ic[i], w * 0.5 + Math.cos(a) * w * 0.2, h * 0.35 + Math.sin(a) * h * 0.1, 52 * s * 0.5); }
    ctx.fillStyle = '#6b3f2a'; ctx.font = '700 ' + (30 * s * 0.5) + 'px "Luckiest Guy", Fredoka, sans-serif'; ctx.textAlign = 'center'; if (((t * 3) | 0) % 2) ctx.fillText('GRRRGLE!', w * 0.5, h * 0.12);
  };
  PANEL.tv = function (ctx, w, h, t) { panelBg(ctx, w, h, '#3a2f4a', '#6a4a7a'); ctx.save(); ctx.translate(w * 0.2, h * 0.15); var s = Math.min(w, h) / 120; ctx.scale(s, s); A.decor(ctx, { type: 'tv', x: 0, y: 0 }, t); ctx.restore(); };
  PANEL.golemReveal = function (ctx, w, h, t) { panelBg(ctx, w, h, '#5a4c3a', '#a8987a'); var s = Math.min(w, h) / 380; A.golem(ctx, w * 0.62, h * 0.95, t, { telegraph: true }); ctx.save(); ctx.restore(); A.gus(ctx, { x: w * 0.2, y: h * 0.95, t: t, state: 'round', pres: 40, sx: s * 2, sy: s * 2, face: 1 }); };
  PANEL.golemFed = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#ffe8a8', '#ffc977'); A.golem(ctx, w * 0.55, h * 0.95, t, { fed: true });
    var names = ['coney', 'pizza', 'paczki', 'apple', 'cherries'];
    for (var i = 0; i < 14; i++) { var p = ((t * 0.6 + i * 0.13) % 1); A.drawFood(ctx, names[i % 5], w * 0.4 + p * w * 0.5 - (i % 4) * 30, h * 0.3 + Math.sin(p * Math.PI) * -h * 0.2 + p * h * 0.5, 44, t + i); }
    for (var k = 0; k < 30; k++) circ(ctx, (hash(k) * w + t * 20) % w, (hash(k + 99) * h + t * 40 + k * 7) % h, 4, ['#ff6b6b', '#ffd93d', '#6bdc8a', '#6aa7ff'][k % 4], 0);
  };
  PANEL.call = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#3a2a28', '#6a4a3a'); var s = Math.min(w, h) / 300;
    rr(ctx, w * 0.2, h * 0.08, w * 0.6, h * 0.84, 24, '#1a1a22', 5); rr(ctx, w * 0.22, h * 0.11, w * 0.56, h * 0.78, 14, '#ffe9c9', 0);
    A.porpor(ctx, w / 2, h * 0.9, s * 1.25, t);
    ctx.fillStyle = '#2b1d14'; ctx.font = '700 ' + (16 * s) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Popo is calling…', w / 2, h * 0.07);
  };
  PANEL.swallow = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#ffb1c4', '#c24a74'); var s = Math.min(w, h) / 160; var k = (t * 0.35) % 1;
    ctx.save(); ctx.translate(w / 2, h * 0.5); ctx.rotate(t * 2); for (var i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ell(ctx, 0, -h * 0.3 * (1 - k * 0.4), 14 * s, h * 0.2, 'rgba(255,255,255,' + (0.18) + ')', 0); } ctx.restore();
    A.gus(ctx, { x: w / 2, y: h * 0.62, t: t, spin: t * 3, sx: s * (1 - k * 0.4), sy: s * (1 - k * 0.4), state: 'round', pres: 30 });
    A.snaxCube(ctx, w / 2, h * 0.2 + k * h * 0.3, t * 5, 30 * s);
  };
  PANEL.molar = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#ffb1c4', '#c24a74'); var k = 0.5 + 0.5 * Math.sin(t * 1.2), s = Math.min(w, h) / 200;
    rr(ctx, w * 0.28, -20, w * 0.44, h * (0.2 + 0.28 * k), 28, '#fffdf4', 5); rr(ctx, w * 0.28, h - h * (0.16 + 0.12 * k), w * 0.44, h * 0.3, 28, '#fffdf4', 5);
    A.gus(ctx, { x: w / 2, y: h * 0.74, t: t, state: 'critical', pres: 90, sx: s, sy: s });
  };
  PANEL.biffy = function (ctx, w, h, t) {
    panelBg(ctx, w, h, '#ffc2d4', '#ff9db8'); var s = Math.min(w, h) / 80;
    A.gus(ctx, { x: w * 0.38, y: h * 0.86, t: t, state: 'round', pres: 30, sx: s * 0.9, sy: s * 0.9 });
    ctx.save(); ctx.translate(w * 0.64, h * 0.86 - Math.abs(Math.sin(t * 3)) * 18); ctx.scale(s * 1.1, s * 1.1); A.biffy(ctx, 0, 0, t, { face: -1 }); ctx.restore();
    for (var i = 0; i < 12; i++) circ(ctx, (hash(i) * w + t * 10) % w, (hash(i + 50) * h * 0.6 + t * 20) % (h * 0.8), 3, 'rgba(255,255,255,.7)', 0);
  };
  PANEL.village0 = function (ctx, w, h, t) { A.village(ctx, w, h, t, { bugs: 0, dex: 0, snax: 0, huts: 3, fams: {} }); };
  A.panel = function (name, ctx, w, h, t) { (PANEL[name] || PANEL.factory)(ctx, w, h, t); };

  /* ---------------- the Gut Village ---------------- */
  A.village = function (ctx, w, h, t, st) {
    var gy = h * 0.78;
    A.bg('village', ctx, { cx: t * 6, cy: 0, vw: w, vh: h, t: t, groundY: gy });
    var s = Math.min(w / 640, h / 360), huts = Math.min(8, 3 + Math.floor((st.bugs || 0) / 3)), stalls = Math.min(5, Math.floor((st.dex || 0) / 4)), lamps = Math.min(6, Math.floor((st.bugs || 0) / 2));
    ctx.save(); ctx.translate(0, 0);
    for (var i = 0; i < huts; i++) {
      var hx = w * (0.08 + i * (0.84 / 8)) + (i % 2) * 8, hy = gy - (i % 2) * 14 * s;
      var col = ['#f0d27a', '#ee8a70', '#d3ad6d'][i % 3];
      rr(ctx, hx, hy - 54 * s, 52 * s, 54 * s, 6 * s, col, 3); poly(ctx, [hx - 8 * s, hy - 54 * s, hx + 26 * s, hy - 88 * s, hx + 60 * s, hy - 54 * s], '#b5533c', 3); rr(ctx, hx + 18 * s, hy - 30 * s, 16 * s, 30 * s, 8 * s, '#7a4a2a', 2.5);
      if (i < lamps) { line(ctx, hx + 62 * s, hy, hx + 62 * s, hy - 40 * s, INK, 3); circ(ctx, hx + 62 * s, hy - 44 * s, 6 * s, '#ffe066', 2); }
    }
    for (var j = 0; j < stalls; j++) { var sx = w * (0.12 + j * 0.17), syy = gy + 26 * s; for (var k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#fff' : ['#e0584a', '#4a90d9', '#58b368', '#f0a53a', '#9b6bd1'][j]; ctx.fillRect(sx + k * 10 * s, syy - 46 * s, 10 * s, 12 * s); } rr(ctx, sx, syy - 34 * s, 40 * s, 22 * s, 3, '#c98b4f', 2.5); A.drawFood(ctx, ['apple', 'carrot', 'yogurt', 'blueberries', 'tomato'][j], sx + 20 * s, syy - 36 * s, 24 * s); }
    var nb = Math.min(12, (st.bugs || 0) + 2), fams = ['yogurt', 'kimchi', 'natto'], res = st.res || [];
    for (var b = 0; b < Math.max(0, nb - res.length); b++) A.bug(ctx, w * (0.1 + hash(b + 3) * 0.8) + Math.sin(t * 0.8 + b * 2) * 22 * s, gy + 40 * s + hash(b + 7) * 24 * s, t + b, fams[b % 3], { r: 11 * s, hop: ((t + b) % 4) < 0.6 });
    res.forEach(function (r, i) {
      var rx2 = w * (0.12 + (i % 6) * 0.15) + Math.sin(t * 0.7 + i) * 10 * s, ry2 = gy + (44 + (i % 2) * 22) * s, selr = st.sel === r.id;
      if (selr) { ctx.save(); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 6); circ(ctx, rx2, ry2 - 10 * s, 24 * s, '#ffe9a0', 0); ctx.restore(); }
      A.bug(ctx, rx2, ry2 - (selr ? Math.abs(Math.sin(t * 8)) * 16 * s : 0), t + i, r.fam, { r: (selr ? 15 : 12) * s, hop: selr });
      ctx.fillStyle = '#4a2a1a'; ctx.font = '700 ' + Math.max(11, 13 * s) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(r.name, rx2, ry2 + 24 * s);
    });
    for (var q = 0; q < Math.min(8, st.snax || 0); q++) { var qx = w * (0.2 + hash(q + 40) * 0.6), qy = gy + 56 * s + hash(q + 20) * 14 * s; ell(ctx, qx, qy, 12 * s, 11 * s, '#b8b1a0', 2.5); line(ctx, qx - 5 * s, qy - 2 * s, qx - 1 * s, qy - 2 * s, INK, 2); line(ctx, qx + 1 * s, qy - 2 * s, qx + 5 * s, qy - 2 * s, INK, 2); line(ctx, qx - 4 * s, qy + 4 * s, qx + 4 * s, qy + 4 * s, INK, 2); }
    ctx.save(); ctx.translate(w * 0.5, gy + 62 * s - Math.abs(Math.sin(t * 3)) * 14 * s); ctx.scale(s * 1.2, s * 1.2); A.biffy(ctx, 0, 0, t, { face: 1 }); ctx.restore();
    ctx.restore();
  };

  /* ---------------- cover (1200 x 744) ---------------- */
  A.cover = function (ctx, w, h) {
    var t = 3.1, s = h / 744;
    A.bg('market', ctx, { cx: 400, cy: 0, vw: w, vh: h, t: t, groundY: h * 0.82 });
    ctx.fillStyle = '#8b8f9a'; ctx.fillRect(0, h * 0.82, w, h * 0.18); ctx.fillStyle = '#a3a7b3'; ctx.fillRect(0, h * 0.82, w, 18 * s);
    for (var i = 0; i < 9; i++) A.person(ctx, w * (0.08 + i * 0.108), h * 0.82 + 8 * s, { c: i, s: i * 2, h: (i % 3) * 3, ph: i }, i % 3 === 1 ? 'chant' : 'cheer', t, false);
    // blast flame and Gus
    var gx = w * 0.5, gy = h * 0.69;
    var gr = ctx.createLinearGradient(0, gy + 40 * s, 0, h * 0.82); gr.addColorStop(0, 'rgba(255,200,60,.95)'); gr.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(gx - 40 * s, gy + 36 * s); ctx.quadraticCurveTo(gx, h * 0.84, gx + 40 * s, gy + 36 * s); ctx.fill();
    for (var c = 0; c < 9; c++) circ(ctx, gx + Math.sin(c * 2.3) * 70 * s, gy + 90 * s + c * 24 * s, (24 - c * 1.6) * s, 'rgba(240,222,180,.9)', 0);
    A.gus(ctx, { x: gx, y: gy, t: t, state: 'tight', pres: 62, vit: 80, sx: 3.1 * s, sy: 3.1 * s, air: true, vy: -200, hasLantern: true, lan: 0.8, blasting: true });
    var fx = [0.07, 0.19, 0.31, 0.69, 0.81, 0.93];
    for (var f = 0; f < 6; f++) A.drawFood(ctx, ['apple', 'carrot', 'cherries', 'banana', 'tomato', 'broccoli'][f], w * fx[f], h * (0.5 + (f % 2) * 0.12) - (f > 2 ? 0 : 0), 78 * s, f * 0.4 - 0.5);
    ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    ctx.font = '400 ' + (190 * s) + 'px "Luckiest Guy", Impact, sans-serif'; ctx.lineWidth = 22 * s; ctx.strokeStyle = INK; ctx.strokeText('GUTS', w / 2, h * 0.23); ctx.fillStyle = '#ffcb2f'; ctx.fillText('GUTS', w / 2, h * 0.23);
    ctx.font = '400 ' + (44 * s) + 'px "Luckiest Guy", Impact, sans-serif'; ctx.lineWidth = 9 * s; ctx.strokeText('AROUND THE WORLD IN 80 BITES', w / 2, h * 0.31); ctx.fillStyle = '#fff'; ctx.fillText('AROUND THE WORLD IN 80 BITES', w / 2, h * 0.31);
    rr(ctx, w - 190 * s, 24 * s, 160 * s, 48 * s, 24 * s, '#6c4b8c', 3); ctx.fillStyle = '#fff'; ctx.font = '700 ' + (26 * s) + 'px Fredoka, sans-serif'; ctx.fillText('BETA', w - 110 * s, 58 * s);
  };
})(typeof window !== 'undefined' ? window : this);
