/* GUTS art, part 1: characters, food and feeling icons, plants, crowd, button glyphs.
   Everything is drawn in code (canvas 2D). Characters are drawn from the feet, facing right. */
(function (root) {
  'use strict';
  var INK = '#2b1d14', TAU = Math.PI * 2;
  var G = root.GUTS = root.GUTS || {};
  var A = G.Art = G.Art || {};
  A.INK = INK;

  function fs(ctx, fill, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw !== 0) { ctx.lineWidth = lw || 3; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); } }
  function ell(ctx, x, y, rx, ry, fill, lw, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); fs(ctx, fill, lw); }
  function circ(ctx, x, y, r, fill, lw) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); fs(ctx, fill, lw); }
  function rr(ctx, x, y, w, h, r, fill, lw) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); fs(ctx, fill, lw); }
  function line(ctx, x1, y1, x2, y2, col, lw) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = col || INK; ctx.lineWidth = lw || 3; ctx.lineCap = 'round'; ctx.stroke(); }
  function poly(ctx, pts, fill, lw) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); fs(ctx, fill, lw); }
  A.p = { fs: fs, ell: ell, circ: circ, rr: rr, line: line, poly: poly };

  /* ---------------- Gus ---------------- */
  /* o: x,y feet; face 1/-1; sx,sy squash; state; pres 0-100; vit 0-100; t; run phase; vy; lan (lantern angle);
     tears 0-3; hasLantern; breathing; blasting; spin; relief; glow; bob */
  A.gus = function (ctx, o) {
    var pres = o.pres || 0, vit = o.vit == null ? 55 : o.vit, st = o.state || 'springy', t = o.t || 0;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (o.spin) { ctx.translate(0, -24); ctx.rotate(o.spin); ctx.translate(0, 24); }
    var wad = st === 'tight' ? Math.sin(t * 9) * 0.1 : st === 'critical' ? Math.sin(t * 14) * 0.06 : 0;
    ctx.rotate(wad + (o.tilt || 0));
    ctx.scale((o.face || 1) * (o.sx || 1), o.sy || 1);
    var idle = o.moving ? 0 : Math.sin(t * (st === 'springy' ? 5 : 3)) * (st === 'springy' ? 1.6 : 0.8);
    var float = st === 'critical' && !o.grounded ? Math.sin(t * 3) * 3 : 0;
    ctx.translate(0, float);
    if (vit > 70 && o.glow !== false) { // soft glow when well fed
      var gr = ctx.createRadialGradient(0, -26, 8, 0, -26, 44); gr.addColorStop(0, 'rgba(255,240,150,.4)'); gr.addColorStop(1, 'rgba(255,240,150,0)');
      ctx.fillStyle = gr; ctx.fillRect(-46, -74, 92, 92);
    }
    var ph = o.run || 0, air = o.air, vy = o.vy || 0;
    // lantern on the backpack
    var lan = o.lan || 0;
    if (o.hasLantern) {
      var bx = -12, by = -38, lx = bx + Math.sin(lan) * 20 - 6, ly = by + Math.cos(lan) * 20 + 4;
      line(ctx, bx, by, lx + 6, ly - 6, INK, 2);
      rr(ctx, lx, ly - 4, 12, 15, 4, '#ee4b3f', 2.5);
      line(ctx, lx + 3, ly + 1, lx + 9, ly + 1, '#ffd36b', 2); line(ctx, lx + 3, ly + 7, lx + 9, ly + 7, '#ffd36b', 2);
      rr(ctx, lx + 2, ly - 7, 8, 4, 2, '#ffd36b', 2);
      for (var i = 0; i < (o.tears || 0); i++) { line(ctx, lx + 1 + i * 4, ly + 2 + i * 3, lx + 5 + i * 4, ly + 6 + i * 3, '#fff3d6', 2); }
    }
    // backpack
    rr(ctx, -21, -38, 13, 22, 5, '#2f80ed', 2.5);
    rr(ctx, -19, -33, 9, 6, 2, '#1d5fc4', 0);
    // legs and shoes
    var swing = air ? (vy < 0 ? 4 : -2) : Math.sin(ph) * 7;
    line(ctx, -5, -12, -5 + swing, -3, '#3a6ea5', 6); line(ctx, 6, -12, 6 - swing, -3, '#3a6ea5', 6);
    ell(ctx, -4 + swing + 2, -2, 6.5, 3.8, '#e63946', 2.5); ell(ctx, 7 - swing + 2, -2, 6.5, 3.8, '#e63946', 2.5);
    // body
    var wobAmt = st === 'springy' ? 0.25 : st === 'round' ? 0.9 : 1.7; if (o.buildup) wobAmt = 3.2;
    var rx = 13 + pres * 0.085 + Math.sin(t * (o.buildup ? 30 : 11)) * wobAmt, ry = 12 + pres * 0.05 - Math.sin(t * (o.buildup ? 30 : 11)) * wobAmt * 0.5;
    var by2 = -22 + idle * 0.3;
    ell(ctx, 0, by2, rx, ry, '#ffb02e', 3);
    if (o.tint && o.tintA > 0) { ctx.save(); ctx.globalAlpha = 0.7 * o.tintA; ctx.lineWidth = 6; ctx.strokeStyle = o.tint === 'green' ? '#58e07a' : '#ffa23c'; ctx.beginPath(); ctx.ellipse(0, by2, rx + 5, ry + 5, 0, 0, TAU); ctx.stroke(); ctx.restore(); }
    // belly
    var bellyAmt = st === 'springy' ? 0.7 : 0.95;
    ell(ctx, 4, by2 + 2, rx * bellyAmt * 0.82, ry * 0.88, '#ffcb57', 0);
    if (st !== 'springy') { ctx.beginPath(); ctx.arc(rx * 0.55, by2 + 4, 1.8, 0, TAU); ctx.fillStyle = '#c47a00'; ctx.fill(); }
    if (o.fizz) { for (var fz = 0; fz < 6; fz++) { var fp = (t * 1.6 + fz * 0.37) % 1; circ(ctx, Math.sin(fz * 2.3 + t * 3) * rx * 0.55 + 3, by2 + ry * 0.6 - fp * ry * 1.5, 1.6 + (fz % 3) * 0.7, 'rgba(255,255,255,.9)', 0); } }
    // butterflies swirling in the belly
    if (o.butterflies) {
      for (var b = 0; b < Math.min(3, o.butterflies); b++) {
        var a = t * 4 + b * 2.1, bx2 = Math.cos(a) * rx * 0.5 + 3, by3 = by2 + Math.sin(a * 1.3) * ry * 0.5;
        ell(ctx, bx2 - 2.5, by3, 2.8, 1.8, '#c48bff', 1, 0.5 + Math.sin(t * 22 + b) * 0.5); ell(ctx, bx2 + 2.5, by3, 2.8, 1.8, '#c48bff', 1, -0.5 - Math.sin(t * 22 + b) * 0.5);
      }
    }
    // arms
    var armSw = air ? -1.2 : Math.sin(ph + Math.PI) * 5;
    line(ctx, rx - 3, by2 - 4, rx + 3 + armSw, by2 + 6, '#ffb02e', 6); circ(ctx, rx + 3 + armSw, by2 + 7, 3.2, '#f6bf93', 2);
    // head
    var hy = -41 + idle * 0.6;
    ell(ctx, 2, hy, 13, 12.4, '#f6bf93', 3);
    // hair tuft
    ctx.beginPath(); ctx.moveTo(-9, hy - 8); ctx.quadraticCurveTo(-8, hy - 20, 0, hy - 14); ctx.quadraticCurveTo(3, hy - 24, 7, hy - 14); ctx.quadraticCurveTo(14, hy - 18, 12, hy - 7); ctx.quadraticCurveTo(2, hy - 12, -9, hy - 8); ctx.closePath(); fs(ctx, '#2b2118', 2.5);
    ell(ctx, -9, hy + 1, 2.6, 3.4, '#f6bf93', 2);
    if (o.sock) { ctx.save(); ctx.translate(-2, hy - 17); ctx.rotate(-0.5); rr(ctx, -7, -4, 14, 22, 5, '#fff', 2.5); ctx.fillStyle = '#e0584a'; ctx.fillRect(-6.5, 1, 13, 4); ctx.fillRect(-6.5, 10, 13, 4); ell(ctx, 7, 20, 7, 5, '#fff', 2.5); ctx.restore(); }
    // face
    var closed = o.breathing || o.relief;
    var wide = st === 'tight' || st === 'critical';
    var ex = [9, 0.5];
    for (var e = 0; e < 2; e++) {
      if (closed) { ctx.beginPath(); ctx.arc(ex[e], hy - 1, 3.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(); }
      else {
        ell(ctx, ex[e], hy - 1, wide ? 4.6 : 3.8, wide ? 5.6 : 4.8, '#fff', 2);
        circ(ctx, ex[e] + 1.2, hy - 0.5, wide ? 1.6 : 2.2, INK, 0);
      }
    }
    // eyebrows
    if (wide) { line(ctx, 5.5, hy - 9, 12, hy - 11.5, INK, 2.6); line(ctx, -3.5, hy - 11.5, 3, hy - 9, INK, 2.6); }
    else { line(ctx, 6, hy - 10.5, 12.5, hy - 8.5, INK, 2.8); line(ctx, -2.5, hy - 8.5, 3.5, hy - 10.5, INK, 2.8); }
    // mouth and cheeks
    if (o.relief) { ctx.beginPath(); ctx.arc(7, hy + 4, 4.5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fillStyle = '#7a1f1f'; ctx.fill(); ctx.stroke(); }
    else if (o.breathing) { circ(ctx, 10, hy + 6, 2.2, '#7a1f1f', 1.8); }
    else if (st === 'springy') { ctx.beginPath(); ctx.arc(7, hy + 3, 4.5, 0.1 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke(); }
    else if (st === 'round') { ctx.beginPath(); ctx.arc(7, hy + 4.5, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(); }
    else {
      circ(ctx, 13, hy + 4, 5.2 + Math.sin(t * 8) * 0.6, '#ffb0a0', 2); circ(ctx, -4, hy + 4, 5, '#ffb0a0', 2);
      ctx.beginPath(); ctx.moveTo(2, hy + 7); for (var w = 0; w < 5; w++) ctx.lineTo(2 + w * 2.4, hy + 7 + (w % 2 ? 1.8 : -1.8)); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
      // panic squiggles and sweat
      ctx.strokeStyle = '#4aa3df'; ctx.lineWidth = 2.2;
      var sw = (t * 30) % 12;
      ctx.beginPath(); ctx.moveTo(-9, hy - 12); ctx.quadraticCurveTo(-13, hy - 9 + sw * 0.1, -9, hy - 6); ctx.stroke();
      ell(ctx, 15, hy - 7 + (sw * 0.8), 2, 3, '#bfe8ff', 1.4);
      if (st === 'critical') { ell(ctx, -11, hy - 2 + sw * 0.6, 2, 3, '#bfe8ff', 1.4); }
    }
    if (o.dizzy) { for (var dz = 0; dz < 3; dz++) { var da = t * 5 + dz * 2.1; var sx2 = 3 + Math.cos(da) * 16, sy2 = hy - 17 + Math.sin(da) * 4; poly(ctx, [sx2, sy2 - 4.5, sx2 + 1.4, sy2 - 1.4, sx2 + 4.5, sy2 - 1, sx2 + 2, sy2 + 1.2, sx2 + 2.8, sy2 + 4.5, sx2, sy2 + 2.6, sx2 - 2.8, sy2 + 4.5, sx2 - 2, sy2 + 1.2, sx2 - 4.5, sy2 - 1, sx2 - 1.4, sy2 - 1.4], '#ffd93d', 1.4); } }
    ctx.restore();
  };

  /* ---------------- Biffy ---------------- */
  A.biffy = function (ctx, x, y, t, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.scale((o.face || 1) * (o.s || 1), o.s || 1);
    var bob = Math.sin(t * 6) * 2.5;
    ctx.translate(0, bob);
    var col = '#7fd3ff';
    // two arms form the Y
    ctx.lineCap = 'round';
    line(ctx, -5, -20, -13, -33, INK, 11); line(ctx, -5, -20, -13, -33, col, 6.5);
    line(ctx, 5, -20, 13, -33, INK, 11); line(ctx, 5, -20, 13, -33, col, 6.5);
    ell(ctx, 0, -14, 11.5, 12, col, 3);
    ell(ctx, 3, -11, 7, 7, '#a8e6ff', 0);
    ell(ctx, -3, -17, 3.4, 4.4, '#fff', 1.8); ell(ctx, 5, -17, 3.4, 4.4, '#fff', 1.8);
    circ(ctx, -2.2, -16.5, 1.7, INK, 0); circ(ctx, 5.8, -16.5, 1.7, INK, 0);
    ctx.beginPath(); ctx.arc(1.5, -10, 3.6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    circ(ctx, -7, -10, 2.4, '#ff9fb2', 0); circ(ctx, 10, -10, 2.4, '#ff9fb2', 0);
    if (o.holding) { ctx.restore(); A.drawFood(ctx, o.holding, x + 2 * (o.face || 1), y - 50 + bob, 22); return; }
    ctx.restore();
  };

  /* ---------------- Gut Bugs ---------------- */
  var FAM = {
    yogurt: { c: '#fff1d0', c2: '#ffe0a0', eye: 'sleepy' },
    kimchi: { c: '#ee5a48', c2: '#ff8a70', eye: 'angry' },
    natto: { c: '#d3ad6d', c2: '#ebcf94', eye: 'wide' }
  };
  A.famOf = function (id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return ['yogurt', 'kimchi', 'natto'][h % 3]; };
  A.bug = function (ctx, x, y, t, fam, o) {
    o = o || {}; var f = FAM[fam] || FAM.yogurt, r = o.r || 13;
    ctx.save(); ctx.translate(x, y);
    var hop = o.hop ? -Math.abs(Math.sin(t * 7)) * 8 : Math.sin(t * 3 + x * 0.1) * 2.5;
    ctx.translate(0, hop);
    for (var i = 0; i < 9; i++) { var a = i / 9 * TAU + Math.sin(t * 4 + i) * 0.15; line(ctx, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r + 5), Math.sin(a) * (r + 5), INK, 2); }
    circ(ctx, 0, 0, r, f.c, 3);
    circ(ctx, -3, -3, r * 0.5, f.c2, 0);
    if (f.eye === 'sleepy') { line(ctx, -7, -2, -2, -1, INK, 2.4); line(ctx, 2, -1, 7, -2, INK, 2.4); }
    else if (f.eye === 'angry') { circ(ctx, -4, -2, 2.6, INK, 0); circ(ctx, 4, -2, 2.6, INK, 0); line(ctx, -8, -7, -2, -4.5, INK, 2.2); line(ctx, 8, -7, 2, -4.5, INK, 2.2); }
    else { circ(ctx, -4, -2, 3.4, '#fff', 1.6); circ(ctx, 4, -2, 3.4, '#fff', 1.6); circ(ctx, -3.6, -2, 1.3, INK, 0); circ(ctx, 4.4, -2, 1.3, INK, 0); }
    ctx.beginPath(); ctx.arc(0, 4, 3.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    if (o.trapped) { // beige bubble
      ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + x * 0.1) * 2.5);
      circ(ctx, 0, 0, r + 11, 'rgba(226,208,170,.55)', 2.5); ctx.beginPath(); ctx.arc(-6, -8, 5, Math.PI, 1.6 * Math.PI); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
    }
  };

  /* ---------------- Snax Bot, drone, Snax cube ---------------- */
  A.snaxBot = function (ctx, x, y, t, dir, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y); ctx.scale(dir || 1, 1);
    var step = Math.sin(t * 10) * 4, sq = o.squash || 1;
    ctx.scale(1 / sq, sq);
    line(ctx, -7, -8, -7 + step, 0, INK, 5); line(ctx, 7, -8, 7 - step, 0, INK, 5);
    ell(ctx, -6 + step, 0, 5.5, 3, '#9d8b6b', 2); ell(ctx, 8 - step, 0, 5.5, 3, '#9d8b6b', 2);
    rr(ctx, -17, -36, 34, 30, 6, '#e6d3a8', 3);
    rr(ctx, -13, -32, 26, 8, 3, '#f3e6c4', 0);
    ctx.fillStyle = '#7a6a48'; ctx.font = '700 9px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SNAX', 0, -10);
    ell(ctx, 6, -22, 6, 6.5, '#fff', 2); circ(ctx, 8, -21, 2.5, INK, 0);
    line(ctx, 0, -29, 12, -26, INK, 3);       // grumpy brow
    ctx.restore();
  };
  A.drone = function (ctx, x, y, t) {
    ctx.save(); ctx.translate(x, y + Math.sin(t * 2 + x) * 3);
    ell(ctx, 0, 0, 34, 18, '#e6d3a8', 3);
    ell(ctx, -6, -6, 20, 7, '#f3e6c4', 0);
    // mustache logo
    ctx.beginPath(); ctx.moveTo(-14, 2); ctx.quadraticCurveTo(-8, -4, 0, 2); ctx.quadraticCurveTo(8, -4, 14, 2); ctx.quadraticCurveTo(8, 6, 0, 3); ctx.quadraticCurveTo(-8, 6, -14, 2); fs(ctx, '#8a7650', 1.5);
    poly(ctx, [-6, 17, 6, 17, 3, 26, -3, 26], '#bda57a', 2);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, 28 + Math.sin(t * 40) * 1.5); ctx.lineTo(8, 28 - Math.sin(t * 40) * 1.5); ctx.stroke();
    ctx.restore();
  };
  A.snaxCube = function (ctx, x, y, r, s) { s = s || 18; ctx.save(); ctx.translate(x, y); ctx.rotate(r || 0); rr(ctx, -s / 2, -s / 2, s, s, 4, '#e6d3a8', 2.5); ctx.fillStyle = '#8a7650'; ctx.font = '700 8px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('S', 0, 3); ctx.restore(); };

  /* ---------------- Baron, Popo, Golem ---------------- */
  A.baron = function (ctx, x, y, s, t, mood) {
    s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var bob = Math.sin(t * 3) * 2;
    line(ctx, 40, -10, 44, -70 + bob, '#8a6a3a', 6); circ(ctx, 44, -74 + bob, 7, '#d9b86c', 3);   // cane
    ell(ctx, -14, 0, 14, 6, '#8a7650', 3); ell(ctx, 14, 0, 14, 6, '#8a7650', 3);
    ctx.beginPath(); ctx.moveTo(-34, -6); ctx.bezierCurveTo(-48, -66, -22, -110, 0, -110); ctx.bezierCurveTo(22, -110, 48, -66, 34, -6); ctx.closePath(); fs(ctx, '#e6d3a8', 4);
    rr(ctx, -4, -104, 8, 78, 3, '#cdb88a', 2); circ(ctx, 0, -86, 3, '#8a7650', 0); circ(ctx, 0, -66, 3, '#8a7650', 0); circ(ctx, 0, -46, 3, '#8a7650', 0);
    ell(ctx, 0, -128, 26, 24, '#f2c9a5', 4);
    // top hat
    rr(ctx, -20, -178, 40, 36, 4, '#e6d3a8', 4); rr(ctx, -32, -146, 64, 9, 4, '#e6d3a8', 4); rr(ctx, -20, -150, 40, 7, 0, '#8a7650', 0);
    // monocle, eyes, mustache
    ell(ctx, -9, -134, 5, 6, '#fff', 2.5); ell(ctx, 11, -134, 5, 6, '#fff', 2.5);
    circ(ctx, -8, -134, 2, INK, 0); circ(ctx, 12, -134, 2, INK, 0);
    circ(ctx, 11, -134, 9, 'rgba(255,255,255,.25)', 2.5); line(ctx, 20, -128, 24, -112, '#8a6a3a', 1.5);
    line(ctx, -16, -143, -3, -139, INK, 3); line(ctx, 3, -139, 18, -145 - (mood === 'rant' ? 3 : 0), INK, 3);
    ctx.beginPath(); ctx.moveTo(-26, -118); ctx.quadraticCurveTo(-14, -130, 0, -120); ctx.quadraticCurveTo(14, -130, 26, -118); ctx.quadraticCurveTo(14, -108, 0, -115); ctx.quadraticCurveTo(-14, -108, -26, -118); fs(ctx, '#d3bf93', 3);
    if (mood === 'rant') { ell(ctx, 0, -104, 7, 5 + Math.abs(Math.sin(t * 10)) * 3, '#7a1f1f', 2.5); }
    else if (mood === 'sad') { ctx.beginPath(); ctx.arc(0, -98, 7, 1.15 * Math.PI, 1.85 * Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(0, -108, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); }
    ctx.restore();
  };
  A.porpor = function (ctx, x, y, s, t) {
    s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var bob = Math.sin(t * 2.4) * 1.5;
    ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(-52, -72, -22, -86); ctx.lineTo(22, -86); ctx.quadraticCurveTo(52, -72, 46, 0); ctx.closePath(); fs(ctx, '#d9473f', 4);
    rr(ctx, -9, -86, 18, 58, 4, '#fff1d6', 2.5);
    circ(ctx, -26, -52, 3, '#fff1d6', 1.5); circ(ctx, 26, -52, 3, '#fff1d6', 1.5);
    ell(ctx, 0, -112 + bob, 28, 28, '#f2c9a5', 4);
    // grey hair and bun
    ctx.beginPath(); ctx.arc(0, -118 + bob, 30, Math.PI * 1.02, Math.PI * 1.98); ctx.lineTo(24, -108 + bob); ctx.quadraticCurveTo(0, -126 + bob, -24, -108 + bob); ctx.closePath(); fs(ctx, '#c9ccd2', 3.5);
    circ(ctx, 0, -150 + bob, 13, '#c9ccd2', 3.5);
    // glasses
    circ(ctx, -11, -112 + bob, 9, 'rgba(255,255,255,.4)', 2.5); circ(ctx, 11, -112 + bob, 9, 'rgba(255,255,255,.4)', 2.5); line(ctx, -2, -112 + bob, 2, -112 + bob, INK, 2.5);
    circ(ctx, -11, -112 + bob, 2.4, INK, 0); circ(ctx, 11, -112 + bob, 2.4, INK, 0);
    ctx.beginPath(); ctx.arc(0, -102 + bob, 8, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = 2.6; ctx.strokeStyle = INK; ctx.stroke();
    circ(ctx, -21, -100 + bob, 3, '#3fb08a', 1.5); circ(ctx, 21, -100 + bob, 3, '#3fb08a', 1.5);   // jade earrings
    ctx.restore();
  };
  A.golem = function (ctx, x, y, t, o) {
    o = o || {}; ctx.save(); ctx.translate(x, y);
    var slump = o.stalled ? 14 : 0, shake = o.telegraph ? Math.sin(t * 50) * 3 : 0, col = o.fed ? '#f0a53a' : '#bcae8a', col2 = o.fed ? '#ffd27a' : '#d7c9a3';
    ctx.translate(shake, slump);
    // legs
    rr(ctx, -120, -70, 56, 70, 6, '#8c8068', 4); rr(ctx, 64, -70, 56, 70, 6, '#8c8068', 4);
    // body
    rr(ctx, -130, -220, 260, 160, 14, col, 4); rr(ctx, -112, -204, 224, 40, 8, col2, 0);
    for (var i = -3; i <= 3; i++) poly(ctx, [i * 30 - 12, -62, i * 30 + 12, -62, i * 30, -76], i % 2 ? '#2b1d14' : '#f4c21a', 0);
    // mouth hatch
    rr(ctx, -84, -140, 90, 62, 8, o.fed ? '#fff' : '#3a3224', 3);
    if (o.fed) { ctx.beginPath(); ctx.arc(-39, -124, 24, 0.1 * Math.PI, 0.9 * Math.PI); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke(); }
    else for (var k = 0; k < 5; k++) rr(ctx, -78 + k * 17, -138, 12, 20, 2, '#cfc2a0', 1.5);
    // head
    rr(ctx, -64, -300, 128, 84, 12, col, 4);
    var led = o.fed ? '#3fe08a' : (o.stalled ? '#555' : '#ff3b3b');
    circ(ctx, -26, -262, 13, '#fff', 3); circ(ctx, 26, -262, 13, '#fff', 3);
    circ(ctx, -26, -262, 6, led, 0); circ(ctx, 26, -262, 6, led, 0);
    // red button on top
    rr(ctx, -16, -320, 32, 22, 6, o.stalled ? '#ffcf3f' : '#e22b2b', 3.5);
    if (o.stalled) { ctx.globalAlpha = 0.6 + Math.sin(t * 8) * 0.3; circ(ctx, 0, -310, 26, 'rgba(255,220,80,.5)', 0); ctx.globalAlpha = 1; }
    // arms
    var up = o.slam ? 1 : 0;
    line(ctx, -130, -180, -170, -110 + up * -60, '#8c8068', 22); line(ctx, 130, -180, 170, -110 + up * -60, '#8c8068', 22);
    circ(ctx, -172, -108 + up * -60, 20, col, 4); circ(ctx, 172, -108 + up * -60, 20, col, 4);
    ctx.restore();
  };

  /* ---------------- crowd ---------------- */
  var SHIRTS = ['#e0584a', '#4a90d9', '#58b368', '#f0a53a', '#9b6bd1', '#e87aa0'], SKINS = ['#f6bf93', '#d89a6c', '#a56a43', '#f2c9a5', '#7a4a2a'];
  A.person = function (ctx, x, y, p, mood, t, mask) {
    // p: {c, s, h, ph, vendor}. mood: idle | cheer | scatter | chant | wary | faint
    ctx.save(); ctx.translate(x, y);
    var ph = p.ph || 0, shirt = p.vendor ? '#58b368' : SHIRTS[p.c % SHIRTS.length], skin = SKINS[p.s % SKINS.length];
    if (mood === 'faint') { ctx.rotate(-Math.PI / 2); ctx.translate(0, -10); }
    var bob = mood === 'cheer' || mood === 'chant' ? -Math.abs(Math.sin(t * 8 + ph)) * 8 : Math.sin(t * 2 + ph) * 1.2;
    ctx.translate(0, bob);
    var h = 30 + (p.h || 0);
    ell(ctx, 0, -h * 0.42, 11, h * 0.46, shirt, 2.5);
    rr(ctx, -8, -6, 6, 8, 2, '#4a4a6a', 2); rr(ctx, 2, -6, 6, 8, 2, '#4a4a6a', 2);
    var up = mood === 'cheer' || mood === 'chant';
    if (up) { var w = Math.sin(t * 9 + ph) * 4; line(ctx, -10, -h * 0.6, -16, -h - 6 + w, skin, 4); line(ctx, 10, -h * 0.6, 16, -h - 6 - w, skin, 4); }
    else if (mood === 'wary' || mood === 'scatter') { line(ctx, -9, -h * 0.5, -3, -h * 0.9, skin, 4); line(ctx, 9, -h * 0.5, 3, -h * 0.9, skin, 4); }
    else { line(ctx, -10, -h * 0.55, -12, -h * 0.2, skin, 4); line(ctx, 10, -h * 0.55, 12, -h * 0.2, skin, 4); }
    circ(ctx, 0, -h - 4, 10, skin, 2.5);
    if (p.vendor) { rr(ctx, -11, -h - 17, 22, 7, 3, '#f0d27a', 2); }
    else { ctx.beginPath(); ctx.arc(0, -h - 6, 10, Math.PI, TAU); ctx.fillStyle = ['#2b2118', '#6b4a2a', '#d9a441', '#999'][(p.c + p.s) % 4]; ctx.fill(); }
    if (mask) { rr(ctx, -7, -h - 5, 14, 8, 3, '#bfe8d6', 1.8); } else
    if (mood === 'faint') { line(ctx, -5, -h - 5, 5, -h - 5, INK, 2); }
    else if (up) { ctx.beginPath(); ctx.arc(0, -h - 3, 4.5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.fillStyle = '#7a1f1f'; ctx.fill(); }
    else { circ(ctx, -3.5, -h - 5, 1.4, INK, 0); circ(ctx, 3.5, -h - 5, 1.4, INK, 0); }
    if (mood === 'chant') { ctx.fillStyle = INK; ctx.font = '700 12px Fredoka, sans-serif'; ctx.textAlign = 'center'; if ((t * 3 + ph) % 3 < 1) ctx.fillText('GUS!', 0, -h - 22); }
    ctx.restore();
  };

  /* ---------------- plants (compost gardens) ---------------- */
  A.plant = function (ctx, kind, x, y, growth, t, grow) {
    // x,y: base (bottom center) of the plant; growth 1-3; grow 0..1 animation
    var s = (0.55 + 0.22 * growth) * Math.min(1, grow == null ? 1 : grow), sway = Math.sin(t * 1.8 + x) * 0.04;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(sway);
    if (kind === 'flower') {
      line(ctx, 0, 0, 0, -34, '#2f9d4a', 8); line(ctx, 0, -14, 14, -26, '#2f9d4a', 5); ell(ctx, 14, -28, 8, 4, '#4cc563', 2, -0.6);
      for (var i = 0; i < 8; i++) { var a = i / 8 * TAU; ell(ctx, Math.cos(a) * 17, -48 + Math.sin(a) * 9, 11, 7, i % 2 ? '#ff7fa8' : '#ff5c8a', 2.4, a); }
      circ(ctx, 0, -48, 9, '#ffd84a', 2.5);
    } else if (kind === 'stalk') {
      var n = 2 + growth, hgt = 64 * n;
      line(ctx, 0, 0, Math.sin(t) * 2, -hgt, '#2f9d4a', 9);
      for (var j = 1; j <= n; j++) { var side = j % 2 ? 1 : -1; ell(ctx, side * 28, -64 * j + 10, 30, 8, '#4cc563', 2.5, side * -0.1); line(ctx, 0, -64 * j + 12, side * 20, -64 * j + 10, '#2f9d4a', 4); }
      circ(ctx, 0, -hgt - 6, 11, '#7be07b', 2.5);
    } else { // tree
      var th = 80 + growth * 30;
      rr(ctx, -9, -th, 18, th, 5, '#8a5a30', 3);
      circ(ctx, 0, -th - 22, 40 + growth * 8, '#43b556', 3.5); circ(ctx, -26, -th - 4, 26, '#4cc563', 3.5); circ(ctx, 28, -th - 6, 26, '#4cc563', 3.5);
      circ(ctx, -12, -th - 28, 5, '#e63946', 1.5); circ(ctx, 18, -th - 14, 5, '#e63946', 1.5); circ(ctx, 4, -th - 40, 5, '#e63946', 1.5);
    }
    ctx.restore();
  };

  /* ---------------- food icons (cached) ---------------- */
  var iconCache = {};
  var foodDraw = {
    broccoli: function (c) { rr(c, 27, 34, 10, 22, 4, '#8bd36b', 2.5); circ(c, 20, 28, 11, '#2f9d4a', 2.5); circ(c, 32, 21, 13, '#38b455', 2.5); circ(c, 44, 28, 11, '#2f9d4a', 2.5); circ(c, 32, 33, 9, '#43c460', 0); },
    carrot: function (c) { poly(c, [18, 22, 46, 30, 12, 56], '#f58a1f', 2.8); line(c, 24, 36, 32, 38, '#c4650f', 2); line(c, 20, 46, 28, 48, '#c4650f', 2); ell(c, 44, 22, 5, 11, '#3fb356', 2, 0.9); ell(c, 50, 28, 5, 11, '#2f9d4a', 2, 1.3); ell(c, 40, 16, 4, 10, '#3fb356', 2, 0.3); },
    corn: function (c) { ell(c, 32, 30, 11, 23, '#ffd23f', 2.8, 0.4); for (var i = 0; i < 6; i++) for (var j = 0; j < 3; j++) circ(c, 25 + j * 6 + i * 1.5, 14 + i * 7, 1.6, '#e8a90f', 0); ell(c, 24, 42, 8, 16, '#4cc563', 2.5, 0.5); ell(c, 40, 42, 8, 16, '#3fb356', 2.5, -0.3); },
    beans: function (c) { ell(c, 24, 34, 10, 17, '#f4e9d0', 2.8, 0.5); ell(c, 40, 30, 10, 17, '#efe0c0', 2.8, -0.4); },
    banana: function (c) { c.beginPath(); c.moveTo(14, 20); c.quadraticCurveTo(22, 58, 54, 44); c.quadraticCurveTo(36, 54, 24, 18); c.closePath(); fs(c, '#ffd93d', 3); rr(c, 10, 12, 8, 8, 2, '#7a5a2a', 2); },
    apple: function (c) { circ(c, 24, 36, 17, '#e63946', 3); circ(c, 40, 36, 17, '#e63946', 3); circ(c, 32, 40, 17, '#e63946', 0); line(c, 32, 18, 34, 8, '#6b4a2a', 3); ell(c, 42, 12, 8, 4, '#3fb356', 2, -0.4); ell(c, 24, 30, 4, 7, '#ff8f98', 0, 0.3); },
    cherries: function (c) { line(c, 20, 40, 34, 10, '#4a8f3a', 3); line(c, 44, 40, 34, 10, '#4a8f3a', 3); circ(c, 20, 44, 11, '#c1121f', 3); circ(c, 44, 44, 11, '#c1121f', 3); ell(c, 40, 10, 8, 4, '#3fb356', 2, -0.3); circ(c, 17, 41, 3, '#ff6b78', 0); },
    blueberries: function (c) { circ(c, 22, 40, 12, '#4a64c8', 3); circ(c, 42, 40, 12, '#3a54b8', 3); circ(c, 32, 22, 12, '#5a74d8', 3); [[22, 40], [42, 40], [32, 22]].forEach(function (p) { circ(c, p[0], p[1] - 2, 3, '#2a3a88', 0); }); },
    tomato: function (c) { circ(c, 32, 36, 21, '#e8392f', 3); poly(c, [32, 16, 38, 22, 46, 20, 40, 28, 44, 34, 32, 30, 20, 34, 24, 28, 18, 20, 26, 22], '#3fb356', 2.2); ell(c, 24, 32, 5, 8, '#ff7a70', 0, 0.4); },
    fish: function (c) { poly(c, [46, 32, 62, 18, 62, 46], '#5f9dd1', 2.8); ell(c, 30, 32, 24, 14, '#8cc4ec', 3); ell(c, 30, 38, 20, 6, '#cfe8f7', 0); circ(c, 16, 28, 4, '#fff', 2); circ(c, 15, 28, 1.6, INK, 0); line(c, 36, 20, 36, 44, '#5f9dd1', 2); },
    yogurt: function (c) { poly(c, [14, 22, 50, 22, 44, 58, 20, 58], '#f5f7ff', 3); rr(c, 22, 32, 20, 14, 4, '#4a90d9', 0); circ(c, 32, 39, 4, '#ff7fa8', 0); ell(c, 32, 20, 20, 6, '#ffe9f0', 2.8); circ(c, 28, 14, 5, '#ff5c8a', 2); },
    water: function (c) { c.beginPath(); c.moveTo(32, 6); c.bezierCurveTo(50, 28, 54, 36, 54, 42); c.arc(32, 42, 22, 0, Math.PI); c.bezierCurveTo(10, 36, 14, 28, 32, 6); fs(c, '#58b9f5', 3); ell(c, 24, 42, 4, 8, '#cdeeff', 0, 0.3); },
    soda: function (c) { rr(c, 18, 12, 28, 46, 7, '#e8a317', 3); rr(c, 18, 26, 28, 14, 0, '#fff3c4', 0); ctx_text(c, 'GA', 32, 38, 11); [[26, 10], [38, 6], [32, 14]].forEach(function (p) { circ(c, p[0], p[1], 3, '#fff7d6', 1.6); }); },
    candy: function (c) { poly(c, [6, 22, 22, 32, 6, 42], '#ff7fb0', 2.5); poly(c, [58, 22, 42, 32, 58, 42], '#ff7fb0', 2.5); ell(c, 32, 32, 19, 14, '#ff4f8b', 3); line(c, 24, 20, 20, 44, '#fff', 3); line(c, 34, 19, 30, 45, '#ffd1e3', 3); },
    paczki: function (c) { ell(c, 32, 36, 25, 20, '#d9953d', 3); ell(c, 32, 33, 22, 15, '#fff', 0); circ(c, 32, 32, 7, '#d9953d', 2); for (var i = 0; i < 7; i++) circ(c, 18 + (i * 9) % 30, 24 + (i * 7) % 14, 1.4, '#e8e8e8', 0); },
    popsicle: function (c) { rr(c, 28, 38, 8, 22, 3, '#e5c58a', 2.5); rr(c, 16, 6, 32, 38, 14, '#4fc3f7', 3); rr(c, 16, 6, 32, 20, 14, '#ff7fa8', 0); rr(c, 16, 6, 32, 38, 14, null, 3); ell(c, 24, 18, 3, 6, '#fff', 0, 0.2); },
    coney: function (c) { rr(c, 6, 30, 52, 24, 12, '#e6b36a', 3); rr(c, 4, 22, 56, 14, 7, '#c0392b', 3); for (var i = 0; i < 6; i++) circ(c, 12 + i * 8, 24 + (i % 2) * 2, 3.2, '#f6f1e4', 1.4); line(c, 12, 28, 52, 28, '#8a2a1a', 3); },
    pizza: function (c) { poly(c, [8, 14, 56, 14, 56, 52, 8, 52], '#f2b134', 3); poly(c, [8, 14, 56, 14, 56, 22, 8, 22], '#d9953d', 0); circ(c, 22, 32, 6, '#d94141', 2); circ(c, 42, 28, 6, '#d94141', 2); circ(c, 32, 44, 6, '#d94141', 2); circ(c, 46, 44, 4, '#3fb356', 1); },
    chili: function (c) { c.beginPath(); c.moveTo(16, 18); c.bezierCurveTo(50, 8, 58, 38, 46, 56); c.bezierCurveTo(42, 40, 30, 32, 16, 28); c.closePath(); fs(c, '#e52b24', 3); ell(c, 14, 22, 8, 7, '#2fa84a', 2.5, 0.3); ell(c, 38, 24, 5, 3, '#ff8a7c', 0, 0.5); },
    bao: function (c) { ell(c, 32, 38, 24, 19, '#fffaf0', 3); for (var i = -2; i <= 2; i++) A.p.line(c, 32, 21, 32 + i * 8, 33, 'rgba(150,120,80,.55)', 1.8); circ(c, 32, 21, 3.4, '#eadfc6', 1.8); ell(c, 22, 34, 7, 4, 'rgba(255,255,255,.8)', 0, -0.4);
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2.6; c.lineCap = 'round'; for (var k = 0; k < 3; k++) { c.beginPath(); c.moveTo(22 + k * 10, 16); c.quadraticCurveTo(18 + k * 10, 10, 22 + k * 10, 5); c.stroke(); } },
    snax: function (c) { rr(c, 14, 14, 36, 36, 6, '#e6d3a8', 3.5); rr(c, 18, 18, 28, 8, 3, '#f3e6c4', 0); ctx_text(c, 'SNAX', 32, 42, 11, '#7a6a48'); }
  };
  function ctx_text(c, s, x, y, size, col) { c.fillStyle = col || '#8a5a00'; c.font = '700 ' + size + 'px Fredoka, sans-serif'; c.textAlign = 'center'; c.fillText(s, x, y); }
  A.foodIcon = function (id) {
    if (iconCache[id]) return iconCache[id];
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var c = cv.getContext('2d'); c.scale(2, 2);
    (foodDraw[id] || foodDraw.snax)(c);
    iconCache[id] = cv; return cv;
  };
  A.drawFood = function (ctx, id, x, y, size, rot) {
    var ic = A.foodIcon(id); ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.drawImage(ic, -size / 2, -size / 2, size, size); ctx.restore();
  };

  /* ---------------- feeling bubbles ---------------- */
  var feelDraw = {
    shoes: function (c) { ell(c, 22, 38, 12, 7, '#e63946', 2.5, 0.1); ell(c, 42, 38, 12, 7, '#4a90d9', 2.5, -0.1); line(c, 28, 20, 36, 24, INK, 2.5); line(c, 36, 20, 28, 24, INK, 2.5); ctx_text(c, '?', 32, 22, 16, '#d9473f'); },
    toy: function (c) { circ(c, 32, 36, 14, '#c98b4f', 3); circ(c, 20, 24, 6, '#c98b4f', 2.5); circ(c, 44, 24, 6, '#c98b4f', 2.5); circ(c, 28, 34, 2, INK, 0); circ(c, 36, 34, 2, INK, 0); line(c, 6, 14, 22, 8, '#d9473f', 3); },
    bump: function (c) { ell(c, 30, 40, 16, 9, '#f6bf93', 3, -0.2); poly(c, [44, 14, 47, 22, 56, 22, 49, 27, 52, 36, 44, 30, 36, 36, 39, 27, 32, 22, 41, 22], '#ffd93d', 2); },
    hungry: function (c) { ell(c, 32, 40, 22, 8, '#fff', 3); ell(c, 32, 38, 14, 4, '#e8e8e8', 0); line(c, 6, 14, 6, 34, INK, 2.5); line(c, 58, 14, 58, 34, INK, 2.5); ctx_text(c, '...', 32, 28, 18, '#d9473f'); },
    waffle: function (c) { rr(c, 10, 14, 44, 38, 6, '#e6b36a', 3); for (var i = 1; i < 4; i++) { line(c, 10 + i * 11, 14, 10 + i * 11, 52, '#b87a30', 2); line(c, 10, 14 + i * 9.5, 54, 14 + i * 9.5, '#b87a30', 2); } rr(c, 24, 26, 16, 12, 2, '#ffd93d', 1.5); },
    wait: function (c) { circ(c, 32, 34, 20, '#fff', 3); line(c, 32, 34, 32, 22, INK, 3); line(c, 32, 34, 42, 38, INK, 3); circ(c, 32, 34, 2, INK, 0); circ(c, 24, 8, 4, '#c9ccd2', 1.5); },
    high: function (c) { poly(c, [6, 56, 6, 30, 24, 30, 24, 56], '#8c8068', 2.8); ell(c, 40, 26, 8, 9, '#f6bf93', 2.5); circ(c, 38, 24, 1.8, INK, 0); circ(c, 43, 24, 1.8, INK, 0); ell(c, 40, 31, 2, 3, '#7a1f1f', 1.5); line(c, 40, 36, 40, 50, '#4a90d9', 3); poly(c, [36, 50, 44, 50, 40, 58], '#4a90d9', 1.5); },
    excited: function (c) { circ(c, 32, 34, 22, '#ffd93d', 3); [-9, 9].forEach(function (dx) { poly(c, [32 + dx, 22, 34 + dx, 28, 40 + dx, 28, 35 + dx, 32, 37 + dx, 38, 32 + dx, 34, 27 + dx, 38, 29 + dx, 32, 24 + dx, 28, 30 + dx, 28], '#ff5c8a', 1.6); }); c.beginPath(); c.arc(32, 40, 10, 0.1 * Math.PI, 0.9 * Math.PI); c.fillStyle = '#7a1f1f'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); poly(c, [54, 8, 56, 13, 61, 14, 56, 16, 54, 21, 52, 16, 47, 14, 52, 13], '#fff', 1.4); },
    stop: function (c) { rr(c, 8, 20, 48, 28, 12, '#555a68', 3); line(c, 18, 28, 18, 40, '#fff', 3); line(c, 12, 34, 24, 34, '#fff', 3); circ(c, 42, 30, 3.4, '#ff6b6b', 0); circ(c, 48, 38, 3.4, '#6aa7ff', 0); line(c, 6, 8, 58, 56, '#e22b2b', 5); }
  };
  A.bubble = function (ctx, kind, x, y, size, t, alpha) {
    var r = size === 'big' ? 34 : size === 'medium' ? 28 : 23;
    ctx.save(); ctx.translate(x, y + Math.sin(t * 3 + x) * 3); ctx.globalAlpha = alpha == null ? 1 : alpha;
    circ(ctx, 14, r + 12, 4, 'rgba(255,255,255,.9)', 1.8); circ(ctx, 6, r + 22, 2.5, 'rgba(255,255,255,.9)', 1.5);
    circ(ctx, 0, 0, r, 'rgba(255,255,255,.96)', 3);
    var c = foodIconCanvas(kind);
    ctx.drawImage(c, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
    ctx.restore();
  };
  var feelCache = {};
  function foodIconCanvas(kind) {
    if (feelCache[kind]) return feelCache[kind];
    var cv = document.createElement('canvas'); cv.width = cv.height = 128; var c = cv.getContext('2d'); c.scale(2, 2);
    (feelDraw[kind] || feelDraw.bump)(c); feelCache[kind] = cv; return cv;
  }

  /* ---------------- button glyphs ---------------- */
  var PAD_COL = { x: '#6aa7ff', o: '#ff6b6b', sq: '#ff9ad5', tri: '#3fe0a0' };
  function padSym(ctx, which, x, y, r) {
    circ(ctx, x, y, r, 'rgba(20,24,40,.92)', 0); ctx.lineWidth = Math.max(1.6, r * 0.14); ctx.strokeStyle = PAD_COL[which]; ctx.lineCap = 'round';
    var k = r * 0.5; ctx.beginPath();
    if (which === 'x') { ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k); }
    else if (which === 'o') { ctx.arc(x, y, k, 0, TAU); }
    else if (which === 'sq') { ctx.rect(x - k, y - k, k * 2, k * 2); }
    else { ctx.moveTo(x, y - k * 1.1); ctx.lineTo(x + k * 1.05, y + k * 0.8); ctx.lineTo(x - k * 1.05, y + k * 0.8); ctx.closePath(); }
    ctx.stroke(); circ(ctx, x, y, r, null, 1.6);
  }
  var GLYPH = {
    kb: { jump: 'SPACE', blast: 'X', breathe: 'B', pound: '↓', move: '← →', feed: 'U', eat: '' },
    pad: { jump: 'x', blast: 'sq', breathe: 'o', pound: 'tri' }
  };
  A.glyphName = function (action, kind) {
    if (kind === 'pad') { return { jump: 'Cross', blast: 'Square', breathe: 'Circle', pound: 'Triangle', move: 'Left stick' }[action]; }
    if (kind === 'touch') return { jump: 'Jump button', blast: 'Blast button', breathe: 'Breathe button', pound: 'Breathe button in the air', move: 'Arrow buttons' }[action];
    return { jump: 'Space', blast: 'X', breathe: 'B', pound: 'Down', move: 'Arrow keys' }[action];
  };
  /* draw a prompt glyph; returns width. kind: kb | pad | touch */
  A.glyph = function (ctx, action, x, y, kind, r) {
    r = r || 14;
    if (kind === 'pad' && GLYPH.pad[action]) { padSym(ctx, GLYPH.pad[action], x, y, r); return r * 2; }
    if (kind === 'pad' && action === 'move') { circ(ctx, x, y, r, 'rgba(20,24,40,.92)', 1.6); circ(ctx, x, y, r * 0.45, '#cfd6f5', 0); return r * 2; }
    var label = kind === 'touch' ? { jump: 'JUMP', blast: 'BLAST', breathe: 'CALM', pound: 'CALM', move: '◀ ▶' }[action] : GLYPH.kb[action];
    ctx.font = '700 ' + (r * 0.95) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center';
    var w = Math.max(r * 2, ctx.measureText(label).width + r * 0.9);
    rr(ctx, x - w / 2, y - r, w, r * 2, r * 0.45, 'rgba(250,250,250,.96)', 2.5);
    ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y + 1); ctx.textBaseline = 'alphabetic';
    return w;
  };
})(typeof window !== 'undefined' ? window : this);
