/* GUTS art, part 3: Mimi the cat and the objects that react to Gus (laundry basket, fruit hanger, pinwheel). */
(function (root) {
  'use strict';
  var A = root.GUTS.Art, P = A.p, INK = A.INK, TAU = Math.PI * 2;
  var fs = P.fs, ell = P.ell, circ = P.circ, rr = P.rr, line = P.line, poly = P.poly;

  /* ---------------- Mimi the cat ---------------- */
  /* o: face 1/-1, state sit | run | sleep | startle | purr | perch, bao (carrying the bao), scale */
  A.cat = function (ctx, x, y, t, o) {
    o = o || {}; var st = o.state || 'sit', face = o.face || 1, sc = o.scale || 1;
    var fur = '#f29a4a', fur2 = '#ffc27a', dark = '#c86a1e';
    var hopY = (o.hop ? -Math.abs(Math.sin(t * 7)) * 11 : 0) + (o.peek ? 15 : 0);
    ctx.save(); ctx.translate(x, y + hopY); ctx.scale(face * sc, sc);
    var wag = Math.sin(t * (st === 'startle' ? 18 : st === 'purr' ? 5 : 3)) * (st === 'sleep' ? 0.05 : 0.35);
    function tail(bx, by, puffed) {
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.bezierCurveTo(bx - 18, by - 4, bx - 26 + wag * 12, by - 24, bx - 14 + wag * 20, by - 40);
      ctx.lineWidth = puffed ? 11 : 7; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke();
      ctx.lineWidth = puffed ? 7 : 3.5; ctx.strokeStyle = fur; ctx.stroke();
    }
    function ears(hx, hy) {
      poly(ctx, [hx - 8, hy - 5, hx - 6, hy - 17, hx + 1, hy - 8], fur, 2.5); poly(ctx, [hx + 2, hy - 8, hx + 8, hy - 17, hx + 10, hy - 4], fur, 2.5);
      poly(ctx, [hx - 6.5, hy - 7, hx - 5.5, hy - 13, hx - 1, hy - 8], '#ffb5b5', 0); poly(ctx, [hx + 3, hy - 8, hx + 7, hy - 13, hx + 8.5, hy - 6], '#ffb5b5', 0);
    }
    function face_(hx, hy, mood) {
      ell(ctx, hx, hy, 11, 9.5, fur, 3);
      ell(ctx, hx + 2, hy + 3, 6, 4.2, fur2, 0);
      if (mood === 'sleep') { ctx.beginPath(); ctx.arc(hx - 3.5, hy - 1, 2.6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.arc(hx + 4.5, hy - 1, 2.6, 0.1 * Math.PI, 0.9 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(); }
      else if (mood === 'alert') { ell(ctx, hx - 3.5, hy - 1, 2.6, 0.9, '#9be07b', 1.6); ell(ctx, hx + 4.5, hy - 1, 3.4, 4.2, '#9be07b', 1.6); circ(ctx, hx + 5, hy - 1, 1.1, INK, 0); }
      else if (mood === 'startle') { ell(ctx, hx - 3.5, hy - 1, 3.6, 4.6, '#fff', 1.8); ell(ctx, hx + 4.5, hy - 1, 3.6, 4.6, '#fff', 1.8); circ(ctx, hx - 3, hy - 1, 1.3, INK, 0); circ(ctx, hx + 5, hy - 1, 1.3, INK, 0); }
      else if (mood === 'purr') { ctx.beginPath(); ctx.arc(hx - 3.5, hy - 1, 2.8, 1.1 * Math.PI, 1.9 * Math.PI); ctx.arc(hx + 4.5, hy - 1, 2.8, 1.1 * Math.PI, 1.9 * Math.PI); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(); }
      else { var bl = (t * 0.7) % 3 < 0.12; if (bl) { line(ctx, hx - 6, hy - 1, hx - 1, hy - 1, INK, 1.8); line(ctx, hx + 2, hy - 1, hx + 7, hy - 1, INK, 1.8); } else { ell(ctx, hx - 3.5, hy - 1, 3, 3.8, '#9be07a', 1.6); ell(ctx, hx + 4.5, hy - 1, 3, 3.8, '#9be07a', 1.6); ell(ctx, hx - 3, hy - 1, 0.9, 3, INK, 0); ell(ctx, hx + 5, hy - 1, 0.9, 3, INK, 0); } }
      poly(ctx, [hx + 5, hy + 2, hx + 9, hy + 2, hx + 7, hy + 4.5], '#ff8fa0', 1.2);
      line(ctx, hx + 8, hy + 3, hx + 17, hy + 1, 'rgba(43,29,20,.7)', 1); line(ctx, hx + 8, hy + 4.5, hx + 17, hy + 5.5, 'rgba(43,29,20,.7)', 1);
    }
    function stripes(cx, cy, w) { for (var i = -1; i <= 1; i++) line(ctx, cx + i * 7, cy - 9, cx + i * 7 + 2, cy - 3, dark, 2.2); }
    function sockHat(hx, hy) { if (!o.sock) return; ctx.save(); ctx.translate(hx - 1, hy - 13); ctx.rotate(-0.55); rr(ctx, -4, -3, 9, 17, 4, '#fff', 2); ctx.fillStyle = '#e0584a'; ctx.fillRect(-3.5, 1, 8, 3); ctx.fillRect(-3.5, 8, 8, 3); ell(ctx, 5, 15, 5, 3.5, '#fff', 2); ctx.restore(); }
    function bao(bx, by) { ell(ctx, bx, by, 6, 5, '#fffaf0', 2); line(ctx, bx, by - 4.5, bx + 2.5, by - 1, 'rgba(150,120,80,.6)', 1); line(ctx, bx, by - 4.5, bx - 2.5, by - 1, 'rgba(150,120,80,.6)', 1); }
    if (st === 'sleep') {
      var br = Math.sin(t * 2) * 1.2;
      tail(-16, -6, false);
      ell(ctx, 0, -9, 21, 10 + br * 0.4, fur, 3); stripes(0, -12, 20);
      face_(15, -9, o.alert ? 'alert' : 'sleep'); ears(15 + (o.alert ? Math.sin(t * 25) * 1.2 : 0), -9);
      if (o.bao) bao(8, -3);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.font = '700 ' + (12 + ((t * 2) % 2) * 3) + 'px Fredoka, sans-serif'; ctx.textAlign = 'center';
      var zz = (t * 0.8) % 1; ctx.globalAlpha = 1 - zz; ctx.strokeText('z', 24, -26 - zz * 18); ctx.fillText('z', 24, -26 - zz * 18); ctx.globalAlpha = 1;
    } else if (st === 'run') {
      var ph = t * (o.sneak ? 9 : 20);
      tail(-18, -22, false);
      line(ctx, -10, -9, -10 + Math.sin(ph) * 9, 0, INK, 6); line(ctx, -10, -9, -10 + Math.sin(ph) * 9, 0, fur, 3);
      line(ctx, 10, -9, 10 - Math.sin(ph) * 9, 0, INK, 6); line(ctx, 10, -9, 10 - Math.sin(ph) * 9, 0, fur, 3);
      ell(ctx, 0, -17 + Math.abs(Math.sin(ph)) * -2, 22, 9, fur, 3); stripes(0, -20, 20);
      line(ctx, -14, -12, -14 - Math.sin(ph + 2) * 8, -2, INK, 6); line(ctx, -14, -12, -14 - Math.sin(ph + 2) * 8, -2, fur, 3);
      line(ctx, 14, -12, 14 + Math.sin(ph + 2) * 8, -2, INK, 6); line(ctx, 14, -12, 14 + Math.sin(ph + 2) * 8, -2, fur, 3);
      face_(22, -22, 'run'); ears(22, -22); sockHat(22, -22);
      if (o.bao) bao(31, -19);
    } else { // sit, perch, purr, startle
      var puff = st === 'startle';
      tail(-9, -6, puff);
      ell(ctx, -4, -4, 9, 5, fur, 3); ell(ctx, 5, -4, 9, 5, fur, 3);                                 // paws
      ell(ctx, 0, -17 + (puff ? -3 : 0), puff ? 14 : 11, puff ? 17 : 15, fur, 3); stripes(0, -20, 14);
      ell(ctx, 3, -14, 6.5, 9, fur2, 0);
      face_(3, -36 + (puff ? -2 : 0), st === 'startle' ? 'startle' : (st === 'purr' || st === 'cheer') ? 'purr' : 'sit'); ears(3, -36 + (puff ? -2 : 0)); sockHat(3, -36 + (puff ? -2 : 0));
      if (o.bao) bao(12, -33);
      if (st === 'cheer') { ctx.fillStyle = '#ffd93d'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4; for (var cs = 0; cs < 3; cs++) { var cy2 = -54 - ((t * 1.6 + cs * 0.3) % 1) * 14; poly(ctx, [10 + cs * 9, cy2 - 4, 12 + cs * 9, cy2, 16 + cs * 9, cy2, 13 + cs * 9, cy2 + 3, 14 + cs * 9, cy2 + 8, 10 + cs * 9, cy2 + 5, 6 + cs * 9, cy2 + 8, 7 + cs * 9, cy2 + 3, 4 + cs * 9, cy2, 8 + cs * 9, cy2], '#ffd93d', 1.4); } }
      if (st === 'purr') for (var h = 0; h < 2; h++) { var hz = (t * 0.9 + h * 0.5) % 1; ctx.globalAlpha = 1 - hz; poly(ctx, [14 + h * 8, -46 - hz * 22, 18 + h * 8, -52 - hz * 22, 22 + h * 8, -46 - hz * 22, 18 + h * 8, -40 - hz * 22], '#ff6b8a', 1.4); ctx.globalAlpha = 1; }
      if (puff) { ctx.fillStyle = '#e22b2b'; ctx.font = '700 22px "Luckiest Guy", Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 22, -52); }
    }
    ctx.restore();
  };

  /* ---------------- reactive objects ---------------- */
  var SOCKS = ['#e0584a', '#4a90d9', '#58b368', '#f0a53a', '#9b6bd1'];
  function basketBody(c, rot) {
    ctx_basket(c);
  }
  function ctx_basket(c) {
    rr(c, -30, -22, 60, 32, 8, '#d9a566', 3);
    for (var i = -2; i <= 2; i++) line(c, i * 11, -20, i * 11, 8, 'rgba(43,29,20,.3)', 2);
    for (var j = 0; j < 3; j++) line(c, -28, -14 + j * 10, 28, -14 + j * 10, 'rgba(43,29,20,.3)', 2);
    rr(c, -34, -26, 68, 8, 4, '#c08848', 3);
  }
  A.react = function (ctx, r, t) {
    var T = 32, x = r.x * T, y = r.y * T, w = r.w * T, h = r.h * T;
    if (r.type === 'basket') {
      var a = r.anim || 0;
      if (r.state === 'idle' || r.state === undefined) {
        ctx.save(); ctx.translate(x + w / 2, y + h);
        if (r.wobble > 0) ctx.rotate(Math.sin(t * 40) * 0.06 * r.wobble);
        for (var i = 0; i < 5; i++) { // socks poking out
          ctx.save(); ctx.translate(-20 + i * 10, -22); ctx.rotate(-0.4 + i * 0.22); rr(ctx, -4, -16, 8, 18, 3, i % 2 ? '#fff' : SOCKS[i % 5], 2); ctx.fillStyle = SOCKS[(i + 2) % 5]; ctx.fillRect(-4, -9, 8, 3); ctx.restore();
        }
        ctx_basket(ctx); ctx.restore();
      } else if (r.state === 'tipping') {
        var p = Math.min(1, a), bx = x + w / 2 + p * 70, by = y + h + p * p * (r.fallH || 160);
        ctx.save(); ctx.translate(bx, by); ctx.rotate(p * 2.6); ctx_basket(ctx); ctx.restore();
      } else { // landed upside down on the floor
        ctx.save(); ctx.translate(r.landX, r.landY); ctx.rotate(Math.PI); ctx.scale(1.0, 0.95); ctx_basket(ctx); ctx.restore();
      }
    } else if (r.type === 'hanger') {
      var sw = Math.sin((r.swingT || 0) * 9) * (r.swing || 0);
      ctx.save(); ctx.translate(x + w / 2, 64);
      ctx.rotate(sw);
      line(ctx, 0, 0, 0, y + 6 - 64, INK, 3); line(ctx, 0, 0, -w / 2.4, y + 20 - 64, 'rgba(43,29,20,.6)', 2); line(ctx, 0, 0, w / 2.4, y + 20 - 64, 'rgba(43,29,20,.6)', 2);
      ctx.translate(0, y - 64 + 28);
      if (!r.spent) { ['apple', 'banana', 'cherries'].forEach(function (id, i) { A.drawFood(ctx, id, -24 + i * 24, -10 - (i === 1 ? 6 : 0), 30); }); }
      ctx.beginPath(); ctx.moveTo(-w / 2.2, -4); ctx.quadraticCurveTo(0, 36, w / 2.2, -4); ctx.lineTo(w / 2.2, -8); ctx.lineTo(-w / 2.2, -8); ctx.closePath(); fs(ctx, '#d9a566', 3);
      ctx.restore();
    } else if (r.type === 'pinwheel') {
      var cx = x + w / 2, cy = y + 28, ang = r.ang || 0, base = (r.y + r.h) * T;
      line(ctx, cx, cy, cx, base, '#8a5a30', 6); circ(ctx, cx, base, 7, '#8a5a30', 2);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      var cols = ['#ff5c8a', '#ffd84a', '#4cc5ff', '#7be07b'];
      for (var k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2); poly(ctx, [0, 0, 30, -4, 30, 24], cols[k], 2.5); ctx.restore(); }
      circ(ctx, 0, 0, 5, '#fff', 2.5); ctx.restore();
      if (r.spin > 6) { ctx.globalAlpha = Math.min(0.5, (r.spin - 6) / 12); circ(ctx, cx, cy, 36, 'rgba(255,255,255,.5)', 0); ctx.globalAlpha = 1; }
    }
  };
})(typeof window !== 'undefined' ? window : this);
