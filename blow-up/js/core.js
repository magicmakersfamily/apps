/* ============================================================================================
   CORE — shared helpers, saved prefs, game state. Loaded first: every other js/ file after
   content.js and sim.js reads $, esc, store, prefs and the S/running/... state from here. The game phase (may the
   clock run?) lives in main.js.
   ============================================================================================ */
'use strict';
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GAME_URL = 'https://magicmakersfamily.github.io/apps/blow-up/';
  const VERSION = '1.4';

  // --- Saving (every access wrapped: the game works without storage) ----------------------------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('blowup.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('blowup.' + k, JSON.stringify(v)); } catch (e) { /* storage off: fine */ } },
  };
  // Predict mode on by default (PLAN C6, KNOWN-BUGS B7): one of the strongest learning moments,
  // so it shouldn't need finding in Settings first.
  const prefs = Object.assign({ sound: true, narrator: true, captions: false, reduced: false, predict: true, speed: 1, style: 'rushed', voiceDetails: false }, store.get('prefs', {}));
  const savePrefs = () => store.set('prefs', prefs);
  let skillsSaved = store.get('skills', {});
  const stickers = new Set(store.get('stickers', []));
  const predictScore = store.get('predict', { right: 0, total: 0 });

  // --- Game state -------------------------------------------------------------------------------
  let S = null, running = false, acc = 0, last = performance.now();
  let freezeUntil = 0, bedtimeShown = false, lastSceneKey = '', lastStrings = 0, pickleSeen = {}, pickleLastT = -999;
  let discovered = new Set(), dayUsed = new Set(), lastBlowType = null, graphDirty = true;
  const MS_PER_MIN = 500;
  const COVER = location.hash === '#cover';

  const allCards = [...CT.UHOH, ...CT.HELPERS, ...CT.TOOLS];
  const cardById = Object.fromEntries(allCards.map(c => [c.id, c]));

