/* GUTS playtest recorder, for grown-ups testing the game with kids. Off unless the page is opened with ?playtest=1
   (remembered on this device; ?playtest=0 turns it off). While on, a small "REC" tag shows. It keeps, for each try
   of a level, only what the game needs to play that try again exactly: the frame times, the buttons as the game saw
   them, the random seed and a copy of the saved progress. No names, no camera, no microphone, nothing is sent
   anywhere: the file is saved only when a grown-up clicks "Save playtest" (the REC tag or the pause menu).
   Key M adds a marker ("look here") at that moment. The tools in guts/tools/replay.mjs play the file back.
   Format: one session = { format, v, version, attempts: [ { stage, opts, seed, save, view, dt[], input[], checks[], events[], end } ] } */
(function (root) {
  'use strict';
  var G = root.GUTS, Game = G.Game, In = G.Input;
  var KEY = 'guts:playtest', LAST = 'guts:playtest:last';
  var BITS = ['jump', 'blast', 'breathe', 'jumpP', 'blastP', 'breatheP', 'poundP', 'pound', 'breatheGround', 'run', 'upP', 'downP'];   // add new inputs at the end only
  var on = false;
  try {
    var q = new URLSearchParams(root.location.search).get('playtest');
    if (q === '1') localStorage.setItem(KEY, '1'); if (q === '0') localStorage.removeItem(KEY);
    on = localStorage.getItem(KEY) === '1';
  } catch (e) { on = /[?&]playtest=1/.test(root.location.search); }

  function q3(v) { return Math.round((v || 0) * 1000) / 1000; }
  function q4(v) { return Math.round(v * 10000) / 10000; }
  function version() { var m = /Version (\d+\.\d+)/.exec((document.querySelector('footer') || document.body).textContent || ''); return m ? m[1] : '?'; }
  /* the inputs the game reads during one update, as one compact row (also used by the replay to set them back) */
  function inputRow() {
    var p = In.p1, bits = 0;
    for (var i = 0; i < BITS.length; i++) if (p[BITS[i]]) bits |= 1 << i;
    return [Math.round(q3(p.mx) * 1000), Math.round(q3(p.my) * 1000), Math.round(q3(p.aimX) * 1000), Math.round(q3(p.aimY) * 1000), p.hopP || 0, p.hopDist || 3, bits,
      In.nav.ok ? 1 : 0, (In.stepMode ? 1 : 0) | (In.tap ? 2 : 0) | (In.frozen ? 4 : 0)];
  }
  function applyRow(r) {
    var p = In.p1; p.mx = r[0] / 1000; p.my = r[1] / 1000; p.aimX = r[2] / 1000; p.aimY = r[3] / 1000; p.hopP = r[4]; p.hopDist = r[5];
    for (var i = 0; i < BITS.length; i++) p[BITS[i]] = !!(r[6] & (1 << i));
    In.nav.ok = !!r[7]; In.stepMode = !!(r[8] & 1); In.tap = !!(r[8] & 2); In.frozen = !!(r[8] & 4);
  }
  function check(f) { var st = Game.st, g = st.g, b = st.b; return [f, q4(g.x), q4(g.y), q4(g.vx), q4(g.vy), q4(b.pres), q4(b.vit), q4(st.t)]; }

  var session = { format: 'guts-playtest', v: 1, game: 'guts', version: version(), recordedAt: new Date().toISOString(),
    browser: navigator.userAgent, screen: { w: root.innerWidth, h: root.innerHeight, dpr: root.devicePixelRatio || 1 }, attempts: [] };
  var cur = null, lastRow = '', lastSet = '', lastKind = '';

  function finish(reason) {
    if (!cur) return;
    var st = Game.st;
    cur.end = { reason: reason, frames: cur.n, status: st ? st.status : 'gone', t: st ? q4(st.t) : null, tile: st ? Math.round(st.g.x / 32) : null };
    cur = null; autosave();
  }
  var saveT = 0;
  /* a backup copy in localStorage, capped at about 1 MB (oldest tries dropped first): every App Shelf game shares
     the site's few MB of storage, and a recording must never crowd out a game's saved progress */
  var CAP = 1000000;
  function autosave() {
    try {
      var s = { format: session.format, v: session.v, game: session.game, version: session.version, recordedAt: session.recordedAt, browser: session.browser, screen: session.screen, attempts: session.attempts.slice() };
      var txt = JSON.stringify(s);
      while (txt.length > CAP && s.attempts.length > 1) { s.attempts.shift(); txt = JSON.stringify(s); }
      if (txt.length > CAP) { localStorage.removeItem(LAST); return; }
      localStorage.setItem(LAST, txt);
    } catch (e) { try { localStorage.removeItem(LAST); } catch (e2) {} }
  }

  var origBegin = Game.begin, origUpdate = Game.update, origEnd = Game.end;
  if (on) {
    Game.begin = function (id, opts) {
      finish('restart');
      var saveCopy = JSON.parse(JSON.stringify(Game.save)), o = {}; for (var k in (opts || {})) o[k] = opts[k];
      origBegin.call(Game, id, opts);
      o.v2 = !!Game.st.v2;   // which controls this try used, so the replay uses the same
      var vs = Game.viewSize();
      cur = { stage: id, opts: o, seed: Game.st.seed, save: saveCopy, view: { W: vs.W, H: vs.H, innerW: root.innerWidth, innerH: root.innerHeight },
        startedAt: new Date().toISOString(), n: 0, dt: [], input: [], checks: [], events: [] };
      lastRow = ''; lastSet = JSON.stringify(Game.save.set); lastKind = '';
      session.attempts.push(cur);
    };
    Game.update = function (dt) {
      if (!cur || !Game.st) return origUpdate.call(Game, dt);
      // the replay sees exactly these numbers: frame time to 0.1 ms, stick values to 0.001
      var dq = Math.round(Math.min(dt, 0.05) * 10000); dt = dq / 10000;
      var row = inputRow(); applyRow(row);
      var rs = row.join(','); if (rs === lastRow && cur.input.length) cur.input[cur.input.length - 1][0]++; else { cur.input.push([1].concat(row)); lastRow = rs; }
      var ss = JSON.stringify(Game.save.set); if (ss !== lastSet) { cur.events.push([cur.n, 'set', JSON.parse(ss)]); lastSet = ss; }
      if (In.kind !== lastKind) { cur.events.push([cur.n, 'kind', In.kind]); lastKind = In.kind; }
      var vs = Game.viewSize(); if (vs.W !== cur.view.W || vs.H !== cur.view.H) { cur.events.push([cur.n, 'view', { W: vs.W, H: vs.H }]); cur.view.W = vs.W; cur.view.H = vs.H; }
      cur.dt.push(dq);
      origUpdate.call(Game, dt);
      cur.n++;
      if (Game.st && cur.n % 30 === 0) cur.checks.push(check(cur.n));
      if (Game.st && Game.st.status === 'clear' && !cur.cleared) { cur.cleared = cur.n; cur.events.push([cur.n, 'clear']); }
      saveT += dt; if (saveT > 20) { saveT = 0; autosave(); }
    };
    Game.end = function () { finish('end'); origEnd.call(Game); };
    root.addEventListener('pagehide', function () { autosave(); });
    root.addEventListener('keydown', function (e) {
      if (e.code === 'KeyM' && cur && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) { cur.events.push([cur.n, 'mark']); flash('Marked'); }
    });
  }

  /* ---------- saving the file ---------- */
  function download(data) {
    var d = new Date(), pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var name = 'guts-playtest-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
    var url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return name;
  }
  function save() {
    if (cur) cur.end = { reason: 'saved while playing', frames: cur.n, status: Game.st ? Game.st.status : 'gone', t: Game.st ? q4(Game.st.t) : null, tile: Game.st ? Math.round(Game.st.g.x / 32) : null };
    var data = session;
    if (!session.attempts.length) { try { data = JSON.parse(localStorage.getItem(LAST)); } catch (e) { data = null; } }
    if (!data || !data.attempts || !data.attempts.length) { flash('Nothing recorded yet'); return null; }
    var n = download(data); flash('Saved ' + n); return n;
  }

  /* ---------- the REC tag and the pause-menu button (only when recording is on) ---------- */
  var tag;
  function flash(text) { if (!tag) return; var t0 = tag.textContent; tag.textContent = text; setTimeout(function () { tag.textContent = t0; }, 1800); }
  if (on) {
    tag = document.createElement('button'); tag.type = 'button'; tag.id = 'pt-rec'; tag.textContent = '● REC · Save playtest';
    tag.title = 'Playtest recording is on: button presses and game events stay on this device. Click to save the file. M marks a moment. Open the game with ?playtest=0 to turn it off.';
    tag.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:600 12px system-ui,sans-serif;padding:4px 9px;border-radius:999px;border:1px solid #b3261e;background:#fff5f4;color:#b3261e;opacity:.85;cursor:pointer';
    tag.onclick = save;
    document.body.appendChild(tag);
    var pr = document.getElementById('p-quit');
    if (pr) { var b = document.createElement('button'); b.className = 'btn'; b.id = 'p-playtest'; b.type = 'button'; b.textContent = 'Save playtest recording'; b.onclick = save; pr.parentNode.insertBefore(b, pr); }
  }

  G.playtest = { on: on, session: function () { return session; }, save: save, inputRow: inputRow, applyRow: applyRow, check: check, BITS: BITS, update: origUpdate, begin: origBegin };
})(typeof window !== 'undefined' ? window : this);
