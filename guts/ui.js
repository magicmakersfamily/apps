/* GUTS interface: screens, story scenes, spoken voice, menus you can drive with a controller, touch buttons. */
(function (root) {
  'use strict';
  var G = root.GUTS, Game = G.Game, D = G.Data, A = G.Art, Au = G.Audio, In = G.Input;
  var UI = G.UI = { screen: 'title' };
  function $(id) { return document.getElementById(id); }
  var SCREENS = ['title', 'pause', 'results', 'end', 'dex', 'village', 'settings'];
  var VERSION = '1.0';
  var touchDevice = false, focusIdx = 0, returnTo = 'title', capTimer = 0;

  /* ---------------- voice (the browser's own voices; recorded ones come later) ---------------- */
  var Voice = {
    voices: [], gen: 0, lastCancel: 0, speaking: false,
    load: function () { try { Voice.voices = root.speechSynthesis ? root.speechSynthesis.getVoices() : []; } catch (e) { Voice.voices = []; } },
    pick: function (lang, re) {
      var vs = Voice.voices.filter(function (v) { return v.lang.toLowerCase().replace('_', '-').indexOf(lang) === 0; });
      if (!vs.length) return null;
      var best = vs.filter(function (v) { return /enhanced|premium|natural/i.test(v.name); });
      if (re) { var m = (best.length ? best : vs).filter(function (v) { return re.test(v.name); }); if (m.length) return m[0]; }
      return (best.length ? best : vs)[0];
    },
    can: function () { return !!root.speechSynthesis && Game.save.set.voice; },
    cfg: function (who) {
      if (who === 'baron') return { re: /daniel|fred|oliver|arthur|alex/i, pitch: 0.55, rate: 0.9 };
      if (who === 'porpor') return { re: /karen|moira|tessa|fiona|serena|kate|samantha/i, pitch: 0.92, rate: 0.88 };
      if (who === 'biffy') return { re: /samantha|ava|zoe|allison/i, pitch: 1.8, rate: 1.05 };
      return { re: /samantha|ava|allison|susan|zoe|evan|nicky/i, pitch: 1, rate: 0.96 };
    },
    stop: function () { Voice.gen++; Voice.speaking = false; try { if (root.speechSynthesis) { root.speechSynthesis.cancel(); Voice.lastCancel = Date.now(); } } catch (e) {} },
    /* speak segments in order; done() once, after a short gap (or a watchdog) */
    speak: function (text, who, done, canto) {
      var gen = ++Voice.gen, finished = false;
      function end() { if (finished || gen !== Voice.gen) return; finished = true; Voice.speaking = false; Au.duck(false); setTimeout(function () { if (gen === Voice.gen && done) done(); }, 220); }
      if (!Voice.can()) { setTimeout(end, 700 + text.length * 45); return; }
      var segs = [text];
      if (canto && text.indexOf(canto) >= 0) { var p = text.split(canto); segs = []; if (p[0].trim()) segs.push(p[0]); segs.push({ canto: canto }); if (p[1] && p[1].replace(/[!.?\s]/g, '')) segs.push(p[1]); else if (p[1]) segs.push(p[1]); }
      var c = Voice.cfg(who), i = 0;
      Voice.speaking = true; Au.duck(true);
      var est = 1500 + text.length * 75; setTimeout(end, est + 1500);
      var wait = Math.max(0, 200 - (Date.now() - Voice.lastCancel));
      function next() {
        if (gen !== Voice.gen || finished) return;
        if (i >= segs.length) { end(); return; }
        var sg = segs[i++], isC = typeof sg === 'object', u;
        try { u = new root.SpeechSynthesisUtterance(isC ? sg.canto : sg); } catch (e) { end(); return; }
        if (isC) { var cv = Voice.pick('zh-hk', null) || Voice.pick('yue', null); if (!cv) { next(); return; } u.voice = cv; u.lang = cv.lang; u.rate = 0.85; u.pitch = who === 'porpor' ? 0.95 : 1; }
        else { var v = Voice.pick('en-us', c.re) || Voice.pick('en', c.re); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US'; u.rate = c.rate; u.pitch = c.pitch; }
        u.volume = 1; u.onend = next; u.onerror = next;
        try { root.speechSynthesis.speak(u); } catch (e) { end(); }
      }
      setTimeout(next, wait);
    },
    speakZh: function (text) {
      if (!root.speechSynthesis || !Game.save.set.voice) return;
      var cv = Voice.pick('zh-hk', null) || Voice.pick('yue', null); if (!cv) return;
      try { var u = new root.SpeechSynthesisUtterance(text); u.voice = cv; u.lang = cv.lang; u.rate = 0.8; root.speechSynthesis.speak(u); } catch (e) {}
    }
  };
  if (root.speechSynthesis) { Voice.load(); try { root.speechSynthesis.onvoiceschanged = Voice.load; } catch (e) {} }
  UI.Voice = Voice;

  /* ---------------- captions ---------------- */
  var WHO = { narrator: '', baron: 'Baron Von Processo', porpor: 'Por Por', biffy: 'Biffy' };
  function rubyFor(str, canto, jyut) {
    if (!canto || str.indexOf(canto) < 0) return esc(str);
    var syl = jyut.split(' '), chars = Array.from(canto), r = '';
    chars.forEach(function (ch, i) { r += '<ruby lang="zh-HK">' + ch + '<rt>' + (syl[i] || '') + '</rt></ruby>'; });
    return esc(str).replace(esc(canto), r);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setCaption(text, who, canto, jyut) {
    $('cap-who').textContent = WHO[who] || '';
    $('cap-text').innerHTML = rubyFor(text, canto, jyut);
    $('voice-tag').hidden = !(Voice.can() && text);
  }
  UI.clearCaption = function () { $('cap-text').textContent = ''; $('cap-who').textContent = ''; $('voice-tag').hidden = true; };

  /* in-game speech: prompts and feelings; never blocks the game clock */
  var pendingSay = null;
  UI.say = function (text, who, o) {
    o = o || {};
    setCaption(text, who);
    clearTimeout(capTimer); capTimer = setTimeout(function () { if (UI.screen === 'play') UI.clearCaption(); }, o.intro ? 6000 : 9000);
    if (!Voice.can()) return;
    if (Voice.speaking) { pendingSay = { text: text, who: who }; return; }
    Voice.speak(text, who, function () { if (pendingSay) { var p = pendingSay; pendingSay = null; Voice.speak(p.text, p.who); } });
  };

  /* ---------------- toast ---------------- */
  var toastT = 0;
  UI.toast = function (title, sub, iconId) {
    var el = $('toast'); el.innerHTML = (iconId ? '<img alt="" src="' + A.foodIcon(iconId).toDataURL() + '">' : '') + '<div>' + esc(title) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</div>';
    el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { el.classList.remove('on'); }, 2600);
  };

  /* ---------------- screens ---------------- */
  function show(name) {
    UI.screen = name;
    SCREENS.forEach(function (s) { $('s-' + s).hidden = s !== name; });
    if (name !== 'play') { UI.clearCaption(); Voice.stop(); pendingSay = null; }
    var playing = name === 'play' || name === 'cutscene';
    $('hudbtns').hidden = !(name === 'play' || name === 'pause');
    $('touch').classList.toggle('on', touchDevice && name === 'play');
    $('touch').classList.toggle('little', Game.save.mode === 'little');
    Game.paused = name === 'pause' || name === 'settings' && returnTo === 'pause';
    if (name === 'title') { Game.override = titleScene; Game.view = 'none'; Au.playSong('title'); UI.clearCaption(); Au.blastOff(); Au.breatheOff(); }
    if (name === 'village') { Game.override = villageScene; Au.setLayers(Math.min(5, Math.floor(Game.bugsRescued() / 1.5))); Au.playSong('village'); updateVillageInfo(); }
    if (name === 'dex') buildDex();
    if (name === 'settings') syncSettings();
    if (name === 'results' || name === 'end') { if (name === 'end') Game.override = endScene; }
    if (name === 'pause') { Au.blastOff(); Au.breatheOff(); }
    if (name === 'play') { Game.override = null; }
    focusIdx = 0; setTimeout(function () { applyFocus(true); }, 30);
    $('padhint').hidden = !In.pads;
  }
  UI.show = show;
  function visibleButtons() {
    var scr = $('s-' + UI.screen); if (!scr || scr.hidden) return [];
    return Array.prototype.slice.call(scr.querySelectorAll('button, input, a.btn')).filter(function (e) { return !e.disabled && !e.hidden && e.offsetParent !== null; });
  }
  function applyFocus(first) {
    var list = visibleButtons(); if (!list.length) return;
    list.forEach(function (e) { e.classList.remove('nav-focus'); });
    if (first) { var f = list.findIndex(function (e) { return e.hasAttribute('data-first'); }); focusIdx = f >= 0 ? f : 0; }
    focusIdx = Math.max(0, Math.min(list.length - 1, focusIdx));
    var el = list[focusIdx]; if (In.kind !== 'touch') el.classList.add('nav-focus');
    try { el.focus({ preventScroll: true }); } catch (e) {}
    if (el.scrollIntoView && el.closest('.dexgrid')) el.scrollIntoView({ block: 'nearest' });
  }
  function navMenu() {
    var n = In.nav, list = visibleButtons(); if (!list.length) return;
    var cur = list[focusIdx];
    if (cur && cur.type === 'range' && (n.left || n.right)) { cur.value = Math.max(0, Math.min(100, +cur.value + (n.right ? 10 : -10))); cur.dispatchEvent(new Event('input')); return; }
    if (n.down || n.right) { focusIdx = (focusIdx + 1) % list.length; applyFocus(); Au.sfx('select'); }
    else if (n.up || n.left) { focusIdx = (focusIdx - 1 + list.length) % list.length; applyFocus(); Au.sfx('select'); }
    else if (n.ok && cur) { Au.sfx('ok'); if (cur.type === 'checkbox') cur.click(); else cur.click(); }
    else if (n.back) { var b = $('s-' + UI.screen).querySelector('[data-back]'); if (b) { Au.sfx('back'); b.click(); } }
  }

  /* ---------------- scenes drawn on the canvas ---------------- */
  var INK = '#2b1d14';
  function titleScene(ctx, w, h, t) {
    var gy = h * 0.82;
    A.bg('market', ctx, { cx: t * 40, cy: 0, vw: w, vh: h, t: t, groundY: gy });
    ctx.fillStyle = '#8b8f9a'; ctx.fillRect(0, gy, w, h - gy); ctx.fillStyle = '#a3a7b3'; ctx.fillRect(0, gy, w, 14);
    for (var i = 0; i < 9; i++) A.person(ctx, w * (0.05 + i * 0.115), gy + 12, { c: i, s: i * 2, h: (i % 3) * 3, ph: i }, i % 2 ? 'cheer' : 'wary', t, false);
    var s = Math.min(w, h) / 170, names = ['apple', 'carrot', 'cherries', 'banana', 'tomato', 'broccoli'];
    var gx = w > 900 ? w * 0.74 : w * 0.5;
    A.gus(ctx, { x: gx, y: gy + 20 - Math.abs(Math.sin(t * 2.4)) * 18, t: t, state: 'springy', vit: 80, sx: s, sy: s, air: true, hasLantern: true, lan: Math.sin(t * 2) * 0.4, moving: true, run: t * 6 });
    for (var f = 0; f < names.length; f++) { var a = t * 0.8 + f * 1.05; A.drawFood(ctx, names[f], gx + Math.cos(a) * w * (w > 900 ? 0.18 : 0.34), gy - h * 0.34 + Math.sin(a * 1.3) * h * 0.1, Math.min(w, h) * 0.1, Math.sin(a) * 0.4); }
  }
  function villageScene(ctx, w, h, t) { A.village(ctx, w, h * 0.8, t, { bugs: Game.bugsRescued(), dex: Game.bitesFound(), snax: Game.save.snax || 0 }); }
  function endScene(ctx, w, h, t) { A.panel('golemFed', ctx, w, h, t); }
  function updateVillageInfo() {
    var b = Game.bugsRescued(), d = Game.bitesFound();
    $('villageInfo').textContent = b + ' Gut Bug' + (b === 1 ? '' : 's') + ' rescued · ' + d + ' of 80 bites found. Rescue bugs and eat new foods to grow the village.';
  }

  /* ---------------- story scenes ---------------- */
  var cut = null;
  function runScenes(list, done, opts) {
    opts = opts || {};
    cut = { list: list, i: 0, done: done, ready: false, timer: 0, token: 0 };
    UI.screen = 'cutscene'; SCREENS.forEach(function (s) { $('s-' + s).hidden = true; }); $('hudbtns').hidden = true; $('touch').classList.remove('on');
    Game.paused = false; Game.view = 'none'; Game.panelT = 0;
    $('b-skip').hidden = false;
    if (opts.song) Au.playSong(opts.song);
    lineStart();
  }
  function lineStart() {
    var s = cut.list[cut.i], tok = ++cut.token; cut.ready = false;
    Game.override = function (ctx, w, h, t) { A.panel(s.panel, ctx, w, h, t); };
    Game.panelT = 0;
    var text = s.line, canto = s.canto, jyut = s.jyut, veg = Game.save.eaten.broccoli || Game.save.eaten.carrot;
    if (veg && s.alt && s.alt.veg) { text = s.alt.veg; canto = s.canto ? 'Sik faan laa' : null; }
    setCaption(text, s.who, canto, jyut);
    if (s.panel === 'call') Au.sfx('ring');
    Voice.speak(text, s.who, function () { if (!cut || tok !== cut.token) return; cut.ready = true; cut.timer = setTimeout(function () { if (cut && tok === cut.token) lineNext(); }, Voice.can() ? 900 : 1200); }, canto);
  }
  function lineNext() {
    if (!cut) return; clearTimeout(cut.timer); Voice.stop(); cut.i++;
    if (cut.i >= cut.list.length) return endScenes();
    lineStart();
  }
  function endScenes() {
    var c = cut; cut = null; Voice.stop(); $('b-skip').hidden = true; Au.duck(false); UI.clearCaption();
    if (c && c.done) c.done();
  }
  UI.skipScenes = function () { if (cut) { clearTimeout(cut.timer); cut.token++; endScenes(); } };

  /* ---------------- level flow ---------------- */
  function startLevel() {
    returnTo = 'title';
    Voice.stop(); UI.clearCaption();
    Game.begin('home'); show('play');
    Au.playSong(D.STAGES.home.music);
  }
  function playFromTitle() {
    Au.init();
    if (!Game.save.seenIntro) {
      runScenes(D.STORY.intro, function () { Game.save.seenIntro = true; Game.persist(); startLevel(); }, { song: 'map' });
    } else startLevel();
  }
  function showResults(r) {
    var medal = function (on, name, text, svg) { return '<div class="medal' + (on ? ' on' : '') + '">' + svg + '<b>' + name + '</b><small>' + text + '</small></div>'; };
    var leaf = '<svg viewBox="0 0 48 48"><path d="M8 40C8 20 20 8 42 6c0 22-10 34-30 36" fill="' + '#7be07b' + '" stroke="#2b1d14" stroke-width="3" stroke-linejoin="round"/><path d="M10 38C20 28 28 20 38 12" fill="none" stroke="#2b1d14" stroke-width="3" stroke-linecap="round"/></svg>';
    var star = '<svg viewBox="0 0 48 48"><path d="M24 3l5 13 14 1-11 9 4 14-12-8-12 8 4-14L5 17l14-1z" fill="#ffcb2f" stroke="#2b1d14" stroke-width="3" stroke-linejoin="round"/></svg>';
    var lan = '<svg viewBox="0 0 48 48"><rect x="12" y="10" width="24" height="30" rx="10" fill="#ee4b3f" stroke="#2b1d14" stroke-width="3"/><rect x="17" y="4" width="14" height="6" rx="3" fill="#ffd36b" stroke="#2b1d14" stroke-width="2.5"/><path d="M18 20h12M18 30h12" stroke="#ffd36b" stroke-width="3"/></svg>';
    var h = '<h2>Morning at Home: done!</h2><p class="sub">Gus is ready for the big trip.</p><div class="medals">' +
      medal(r.zen, 'Zen medal', r.zen ? 'No blowouts. Calm!' : 'Finish with no blowouts.', leaf) +
      medal(r.chaos, 'Chaos medal', r.chaos ? 'Stylish blasts and a crowd chant!' : 'Three long, controlled blasts and a crowd chant.', star) +
      medal(r.tears === 0 && r.lantern, 'Perfect lantern', r.tears === 0 ? 'Not a single tear.' : 'Finish with no lantern tears.', lan) + '</div>' +
      '<div class="stats"><span>Gut Bugs ' + r.bugsHere + '/' + r.bugsTotal + '</span><span>Bites ' + Game.bitesFound() + '/80</span>' + (r.newBites ? '<span>' + r.newBites + ' new!</span>' : '') + '</div>' +
      '<div class="row"><button class="btn primary" id="r-next" data-first>Next</button><button class="btn" id="r-again">Play again</button><button class="btn" id="r-title" data-back>Title</button></div>';
    $('results').innerHTML = h; show('results');
    Au.sfx(r.zen || r.chaos ? 'medal' : 'clear');
    $('r-next').onclick = function () { runScenes(D.STORY.afterHome, function () { show('end'); }, { song: 'map' }); };
    $('r-again').onclick = function () { startLevel(); };
    $('r-title').onclick = function () { show('title'); };
  }

  /* ---------------- Food Dex ---------------- */
  function rubyZh(e) {
    var syl = e.jp.split(' '), r = ''; Array.from(e.zh).forEach(function (ch, i) { r += '<ruby>' + ch + '<rt>' + syl[i] + '</rt></ruby>'; }); return r;
  }
  function buildDex() {
    var grid = $('dexgrid'); grid.innerHTML = '';
    var sv = Game.save, n = Game.bitesFound();
    $('dexcount').textContent = n + ' / 80';
    D.DEX_WORLDS.forEach(function (w) {
      var ids = Object.keys(D.DEX).filter(function (k) { return D.DEX[k].w === w.id; });
      var head = document.createElement('div'); head.className = 'dexhead'; head.style.gridColumn = '1 / -1'; head.textContent = w.name + ' · ' + ids.filter(function (k) { return sv.dex[k]; }).length + ' / ' + w.total; grid.appendChild(head);
      for (var i = 0; i < w.total; i++) {
        var id = ids[i], b = document.createElement('button'); b.className = 'dexcard'; b.type = 'button';
        if (id && sv.dex[id]) { b.innerHTML = '<img alt="" src="' + A.foodIcon(id).toDataURL() + '"><small>' + esc(D.DEX[id].name) + '</small>'; (function (idc, bb) { bb.onclick = function () { selectDex(idc, bb); }; })(id, b); }
        else { b.className += ' locked'; b.innerHTML = '<img alt="" src="' + A.foodIcon(id || 'snax').toDataURL() + '"><small>?</small>'; (function (known) { b.onclick = function () { $('dexdetail').innerHTML = '<div><h3>' + (known ? 'Not found yet' : 'Coming soon') + '</h3><p class="sub">' + (known ? 'Keep eating and exploring to find this bite!' : 'Travel further to find new bites.') + '</p></div>'; }; })(!!id); }
        grid.appendChild(b);
      }
    });
    if (sv.dex.snax) { var s = document.createElement('button'); s.className = 'dexcard'; s.innerHTML = '<img alt="" src="' + A.foodIcon('snax').toDataURL() + '"><small>Beige Snax</small>'; s.onclick = function () { selectDex('snax', s); }; grid.appendChild(s); }
    $('dexdetail').innerHTML = '<div><h3>Pick a card</h3><p class="sub">Tap a bite you found to read about it.</p></div>';
  }
  function selectDex(id, el) {
    var e = D.DEX[id], B = G.Belly.FOODS[id];
    Array.prototype.forEach.call(document.querySelectorAll('.dexcard.sel'), function (x) { x.classList.remove('sel'); }); el.classList.add('sel');
    $('dexdetail').innerHTML = '<img alt="" src="' + A.foodIcon(id).toDataURL() + '"><div><h3>' + esc(e.name) + '</h3><div class="zh" lang="zh-HK">' + rubyZh(e) + '</div><p>' + esc(e.fact) + '</p><p class="sub"><b>Power:</b> ' + esc(e.power) + '</p><button class="btn small" id="dex-say">Hear it in Cantonese</button></div>';
    $('dex-say').onclick = function () { Voice.speakZh(e.zh); };
  }

  /* ---------------- settings ---------------- */
  function syncSettings() {
    var s = Game.save.set;
    $('set-music').value = s.music; $('set-sfx').value = s.sfx;
    ['voice', 'meters', 'shake', 'flash', 'cb'].forEach(function (k) { $('set-' + k).checked = !!s[k]; });
    Array.prototype.forEach.call($('gross').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.g === s.gross)); });
    Array.prototype.forEach.call($('speed').children, function (b) { b.setAttribute('aria-pressed', String(+b.dataset.s === s.speed)); });
    $('set-erase').textContent = 'Erase saved game';
  }
  function setSetting(k, v) { Game.save.set[k] = v; Game.persist(); Game.applySettings(); }

  /* ---------------- misc ---------------- */
  var MODES = {
    little: 'Little Guts: Gus runs by himself. You just jump, blast and breathe. Falling off an edge bounces you back.',
    standard: 'Standard: move, jump, blast and breathe, all yours.',
    check: 'Gut Check: aim your blast with the stick, meters on, a tougher belly.'
  };
  function syncMode() {
    var m = Game.save.mode;
    Array.prototype.forEach.call($('modes').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === m)); });
    $('modeDesc').textContent = MODES[m];
  }
  var isFS = false;
  function toggleFS() {
    var el = $('stage');
    if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (isFS) { el.classList.remove('pseudo-fs'); isFS = false; setTimeout(Game.resize, 50); return; }
    var req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) { var p; try { p = req.call(el); } catch (e) { p = null; } if (p && p.catch) p.catch(function () { el.classList.add('pseudo-fs'); isFS = true; setTimeout(Game.resize, 50); }); }
    else { el.classList.add('pseudo-fs'); isFS = true; setTimeout(Game.resize, 50); }
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(Game.resize, 80); }); });
  function tellFriend(statusEl) {
    var data = { title: 'GUTS: Around the World in 80 Bites', text: 'Try GUTS: whatever Gus eats and feels becomes motion.', url: 'https://magicmakersfamily.github.io/apps/guts/' };
    if (navigator.share) { navigator.share(data).catch(function () {}); return; }
    try { navigator.clipboard.writeText(data.url).then(function () { statusEl.textContent = 'Link copied!'; }); } catch (e) { statusEl.textContent = data.url; }
  }

  /* ---------------- per-frame ---------------- */
  var wasPause = false;
  Game.hooks.tick = function (dt) {
    if (!Au.running() && (In.kind === 'pad' || In.anyP)) { try { Au.init(); } catch (e) {} }
    $('soundhint').hidden = Au.running(); $('padhint').hidden = !In.pads;
    var sc = UI.screen;
    if (sc === 'play') {
      if (In.pauseP) { show('pause'); }
    } else if (sc === 'cutscene') {
      if (In.nav.ok || In.nav.back) { lineNext(); }
    } else if (sc === 'results' || sc === 'end' || sc === 'title' || sc === 'pause' || sc === 'dex' || sc === 'village' || sc === 'settings') {
      navMenu();
      if (sc === 'pause' && In.pauseP) $('p-resume').click();
    }
    if (In.kind === 'touch' && !touchDevice) { touchDevice = true; if (sc === 'play') $('touch').classList.add('on'); }
  };
  Game.hooks.say = UI.say;
  Game.hooks.clear = showResults;
  Game.hooks.dex = function (id) { var e = D.DEX[id]; if (e) UI.toast('New bite! ' + e.name, e.zh + ' · ' + Game.bitesFound() + ' of 80', id); };
  var sproutSaid = false;
  Game.hooks.event = function (name) {
    if (name === 'sprout' && !sproutSaid) { sproutSaid = true; UI.say('It grew! A bounce flower. Jump on it!', 'narrator', { soft: true }); }
  };
  In.onPad(function (kind) { if (kind === 'connect') { UI.toast('Controller ready', 'Press ✕ to start'); $('padhint').hidden = false; } else UI.toast('Controller unplugged'); });

  /* ---------------- wiring ---------------- */
  function coverPage() {
    if (!document.getElementById('cover')) document.body.innerHTML = '<canvas id="cover" width="1200" height="744" style="display:block"></canvas>';
    document.body.style.cssText = 'margin:0;background:#14131f';
    var c = document.getElementById('cover').getContext('2d'); c.clearRect(0, 0, 1200, 744); A.cover(c, 1200, 744);
  }
  function init() {
    Game.init($('cv'));
    // skip button for story scenes
    var sk = document.createElement('button'); sk.id = 'b-skip'; sk.className = 'btn small'; sk.textContent = 'Skip'; sk.hidden = true; sk.style.cssText = 'position:absolute;left:12px;top:12px;z-index:7';
    $('view').appendChild(sk); sk.onclick = UI.skipScenes;
    $('view').addEventListener('pointerdown', function (e) { try { Au.init(); } catch (x) {} if (UI.screen === 'cutscene' && e.target.id !== 'b-skip') lineNext(); });
    document.addEventListener('keydown', function (e) {
      try { Au.init(); } catch (x) {}
      if (e.code === 'KeyF' && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) toggleFS();
    });
    $('b-play').onclick = playFromTitle;
    $('b-village').onclick = function () { returnTo = 'title'; show('village'); };
    $('b-dex').onclick = function () { returnTo = 'title'; show('dex'); };
    $('b-settings').onclick = function () { returnTo = 'title'; show('settings'); };
    $('b-fs2').onclick = toggleFS; $('b-fs').onclick = toggleFS; $('p-fs').onclick = toggleFS;
    Array.prototype.forEach.call($('modes').children, function (b) { b.onclick = function () { Game.save.mode = b.dataset.mode; Game.persist(); syncMode(); $('touch').classList.toggle('little', b.dataset.mode === 'little'); }; });
    $('dex-back').onclick = function () { show(returnTo === 'pause' ? 'pause' : 'title'); };
    $('v-back').onclick = function () { show('title'); };
    $('set-back').onclick = function () { show(returnTo === 'pause' ? 'pause' : 'title'); if (returnTo === 'pause') Game.paused = true; };
    $('b-pause').onclick = function () { if (UI.screen === 'play') show('pause'); };
    $('p-resume').onclick = function () { show('play'); Game.paused = false; };
    $('p-restart').onclick = function () { startLevel(); };
    $('p-settings').onclick = function () { returnTo = 'pause'; show('settings'); Game.paused = true; };
    $('p-quit').onclick = function () { Game.end(); show('title'); };
    $('b-mute').onclick = function () { var m = $('b-mute'), on = m.getAttribute('aria-pressed') !== 'true'; m.setAttribute('aria-pressed', String(on)); Au.setVolumes(on ? 0 : Game.save.set.music / 100, Game.save.set.sfx / 100); };
    $('e-again').onclick = function () { startLevel(); }; $('e-title').onclick = function () { show('title'); };
    $('e-tell').onclick = function () { tellFriend($('e-status')); }; $('tellBtn').onclick = function () { tellFriend($('tellStatus')); };
    $('set-music').oninput = function () { setSetting('music', +this.value); }; $('set-sfx').oninput = function () { setSetting('sfx', +this.value); };
    ['voice', 'meters', 'shake', 'flash', 'cb'].forEach(function (k) { $('set-' + k).onchange = function () { setSetting(k, this.checked); }; });
    Array.prototype.forEach.call($('gross').children, function (b) { b.onclick = function () { setSetting('gross', b.dataset.g); syncSettings(); Au.sfx('toot'); }; });
    Array.prototype.forEach.call($('speed').children, function (b) { b.onclick = function () { setSetting('speed', +b.dataset.s); syncSettings(); }; });
    var armed = false;
    $('set-erase').onclick = function () { if (!armed) { armed = true; this.textContent = 'Really erase? Tap again'; var me = this; setTimeout(function () { armed = false; me.textContent = 'Erase saved game'; }, 3500); } else { Game.resetSave(); armed = false; syncSettings(); syncMode(); this.textContent = 'Erased'; } };
    // touch buttons
    Array.prototype.forEach.call(document.querySelectorAll('.tb'), function (b) {
      var act = b.dataset.act;
      function down(e) { e.preventDefault(); touchDevice = true; In.setKind('touch'); try { Au.init(); } catch (x) {} In.touch[act] = 1; b.classList.add('down'); try { b.setPointerCapture(e.pointerId); } catch (x) {} }
      function up() { In.touch[act] = 0; b.classList.remove('down'); }
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    window.addEventListener('touchstart', function () { touchDevice = true; In.setKind('touch'); }, { passive: true, once: true });
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) touchDevice = true;
    document.addEventListener('visibilitychange', function () { if (document.hidden && UI.screen === 'play') show('pause'); });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem('guts:1')) Game.save.set.shake = false;
    // portrait phone hint
    if (window.innerWidth < 560 && window.innerHeight > window.innerWidth) { var hn = document.createElement('div'); hn.className = 'hint-rot'; hn.textContent = 'Turn your phone sideways for a bigger view.'; $('view').appendChild(hn); setTimeout(function () { hn.remove(); }, 7000); }
    syncMode(); show('title');
    root.__guts = { Game: Game, UI: UI, startLevel: startLevel, show: show, runScenes: runScenes };
  }
  if (location.hash === '#cover') {
    var drawCover = function () { coverPage(); };
    drawCover(); if (document.fonts && document.fonts.load) Promise.all([document.fonts.load('40px "Luckiest Guy"'), document.fonts.load('700 20px Fredoka')]).then(drawCover, drawCover);
  } else if (document.fonts && document.fonts.load) {
    var started = false, go = function () { if (!started) { started = true; init(); } };
    Promise.all([document.fonts.load('700 20px Fredoka'), document.fonts.load('40px "Luckiest Guy"')]).then(go, go); setTimeout(go, 1000);
  } else init();
})(window);
