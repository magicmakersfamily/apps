/* GUTS belly model: foods, vitality, pressure, states and movement stats.
   No drawing here. Browser: window.GUTS.Belly. Node: module.exports (for belly.test.js). */
(function (root) {
  'use strict';

  var PHYS = {
    tile: 32, G: 1900, Grise: 1350, maxFall: 950, groundAccel: 1800, airAccel: 1200,
    coyote: 0.1, jumpBuffer: 0.12
  };

  /* kind: for the Dex and effects. vit/pres: base gain. Extra effects are handled in eat(). */
  var FOODS = {
    broccoli: { kind: 'veg', vit: 20, pres: 0 },
    carrot: { kind: 'veg', vit: 18, pres: 0 },
    corn: { kind: 'grain', vit: 10, pres: 5, hover: 6 },
    beans: { kind: 'grain', vit: 10, pres: 8, hover: 6 },
    banana: { kind: 'fruit', vit: 13, pres: 0, boost: 2.5 },
    apple: { kind: 'fruit', vit: 12, pres: 0, boost: 2.5 },
    cherries: { kind: 'fruit', vit: 13, pres: 0, boost: 2.5 },
    blueberries: { kind: 'fruit', vit: 14, pres: 0, boost: 2.5 },
    tomato: { kind: 'fruit', vit: 12, pres: 0 },
    fish: { kind: 'fish', vit: 14, pres: 0, sight: 10 },
    yogurt: { kind: 'ferment', vit: 16, pres: 2, microbe: true },
    water: { kind: 'water', vit: 0, pres: -25, steady: 6 },
    soda: { kind: 'sugar', vit: 0, pres: 24, dash: 3 },
    candy: { kind: 'sugar', vit: 0, pres: 20, dash: 3 },
    paczki: { kind: 'sugar', vit: 2, pres: 22, dash: 3, heavy: 6 },
    popsicle: { kind: 'cold', vit: 0, pres: 10, freeze: 3 },
    coney: { kind: 'grease', vit: 4, pres: 26, heavy: 10 },
    pizza: { kind: 'grease', vit: 4, pres: 24, heavy: 10 },
    chili: { kind: 'spice', vit: 4, pres: 14, fire: true },
    snax: { kind: 'snax', vit: 0, pres: 6 }
  };

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function create(opts) {
    opts = opts || {};
    return {
      vit: opts.vit != null ? opts.vit : 55,
      pres: opts.pres != null ? opts.pres : 10,
      heavyT: 0, boostT: 0, crashT: 0, cleanT: 0, steadyT: 0, sightT: 0, freezeT: 0, hoverT: 0,
      butterflies: 0, butterT: 1, hungerT: 0, t: 0,
      recent: [], blowouts: 0, state: 'springy',
      rng: opts.rng || Math.random,
      events: [],
      eaten: {}
    };
  }

  function fill(b) { return 1.35 - 0.007 * b.vit; }

  function stateOf(b) {
    var p = b.pres;
    return p < 35 ? 'springy' : p < 65 ? 'round' : p < 85 ? 'tight' : 'critical';
  }

  function addPressure(b, amount) {
    if (amount > 0) amount *= fill(b);
    b.pres = Math.max(0, b.pres + amount);
  }

  function emit(b, name, data) { b.events.push({ name: name, data: data }); }

  function recentHas(b, id, within) {
    for (var i = b.recent.length - 1; i >= 0; i--) {
      if (b.t - b.recent[i].t > within) break;
      if (b.recent[i].id === id) return true;
    }
    return false;
  }
  function recentKind(b, kind, within) {
    for (var i = b.recent.length - 1; i >= 0; i--) {
      if (b.t - b.recent[i].t > within) break;
      if (FOODS[b.recent[i].id].kind === kind) return true;
    }
    return false;
  }

  /* eat(b, id, mult): mult is 1 for a normal bite, 2 for a direct face-hit, 0.5 for a graze. */
  function eat(b, id, mult) {
    var f = FOODS[id];
    if (!f) return null;
    mult = mult == null ? 1 : mult;
    var info = { id: id, combo: null };
    b.eaten[id] = (b.eaten[id] || 0) + 1;
    b.hungerT = 0;
    b.vit = Math.min(100, b.vit + f.vit * mult);
    var p = f.pres * mult;
    if (f.kind === 'sugar' && recentKind(b, 'fruit', 10)) {
      p *= 0.8; b.cleanT = 8; info.combo = 'clean';
    }
    if (id === 'chili') {
      /* chili then water is a controlled burp: handled when water arrives */
    }
    if (id === 'water' && recentHas(b, 'chili', 10)) { info.combo = 'controlled-fire'; b.fireSafe = 8; }
    addPressure(b, p);
    if (f.heavy) b.heavyT = Math.max(b.heavyT, f.heavy);
    if (f.boost) b.boostT = Math.max(b.boostT, f.boost);
    if (f.dash) { b.boostT = Math.max(b.boostT, f.dash); if (!b.cleanT) b.crashQueued = true; }
    if (f.steady) b.steadyT = Math.max(b.steadyT, f.steady);
    if (f.sight) b.sightT = f.sight;
    if (f.freeze) b.freezeT = f.freeze;
    if (f.hover) b.hoverT = Math.max(b.hoverT, f.hover);
    if (f.microbe) emit(b, 'microbe', { id: id });
    if (f.fire) { b.fireT = 0.5; emit(b, 'fire', { safe: false }); }
    b.recent.push({ id: id, t: b.t });
    if (b.recent.length > 8) b.recent.shift();
    emit(b, 'eat', info);
    return info;
  }

  function feeling(b, size) {
    var amt = size === 'big' ? 22 : size === 'medium' ? 12 : 7;
    addPressure(b, amt);
    return amt;
  }

  function addButterflies(b, n) { b.butterflies += n; }

  /* tick: advance timers. breathing: Gus is holding breathe on the ground (or Biffy helping: breatheMult 2). */
  function tick(b, dt, o) {
    o = o || {};
    b.t += dt;
    var d = ['heavyT', 'boostT', 'cleanT', 'steadyT', 'sightT', 'freezeT', 'hoverT', 'crashT', 'fireSafe'];
    for (var i = 0; i < d.length; i++) if (b[d[i]] > 0) b[d[i]] = Math.max(0, b[d[i]] - dt);
    if (b.crashQueued && b.boostT <= 0) {
      b.crashQueued = false;
      if (!b.cleanT) b.crashT = 2.5;
    }
    if (b.fireT > 0) {
      b.fireT -= dt;
      if (b.fireT <= 0) { b.fireT = 0; emit(b, 'fire2', { safe: b.fireSafe > 0 }); }
    }
    /* vitality drains slowly, never below 15 by draining alone */
    if (b.vit > 15) b.vit = Math.max(15, b.vit - 0.35 * dt);
    /* butterflies make pressure jump unpredictably */
    if (b.butterflies > 0) {
      b.butterT -= dt;
      if (b.butterT <= 0) {
        b.butterT = 0.7 + b.rng() * 0.8;
        addPressure(b, (1 + b.rng() * 3) * Math.min(3, b.butterflies));
      }
    }
    if (o.breathing) {
      var m = o.breatheMult || 1;
      b.pres = Math.max(0, b.pres - 30 * m * dt);
      if (b.butterflies > 0) {
        b.breatheAcc = (b.breatheAcc || 0) + dt * m;
        if (b.breatheAcc >= 0.6) { b.breatheAcc = 0; b.butterflies--; emit(b, 'butterfly-out'); }
      }
    }
    b.hungerT += dt;
    if (b.hungerT >= 35) { b.hungerT = 0; emit(b, 'hungry'); }
    if (b.pres >= 100) {
      b.pres = 18; b.butterflies = 0; b.blowouts++;
      emit(b, 'blowout');
    }
    var s = stateOf(b);
    if (s !== b.state) { var prev = b.state; b.state = s; emit(b, 'state', { from: prev, to: s }); }
  }

  function v(b) { return Math.max(0, Math.min(1, b.vit / 100)); }

  /* Movement and blast stats from the current belly. */
  function stats(b) {
    var x = v(b);
    var speed = 205 * (1 + 0.45 * x);
    if (b.boostT > 0) speed *= 1.45;
    if (b.crashT > 0) speed *= 0.65;
    if (b.heavyT > 0 && b.pres > 25) speed *= 0.75;
    var jumpH = 80 + 60 * x;
    var wobble = Math.pow(1 - x, 1.5);
    if (b.steadyT > 0) wobble *= 0.4;
    if (b.cleanT > 0) wobble *= 0.2;
    return {
      speed: speed,
      jumpH: jumpH,
      jumpV: Math.sqrt(2 * PHYS.Grise * jumpH),
      air: 0.55 + 0.45 * x,
      thrust: 2250 + 500 * x,
      maxRise: 250 + 110 * x,
      drain: 52 - 14 * x,
      wobble: wobble,
      heavy: b.heavyT > 0 && b.pres > 25,
      gravMul: b.state === 'critical' ? 0.35 : 1,
      fill: fill(b)
    };
  }

  /* Peak height (px) of a jump-then-hold-blast at the current belly. Used by tests and the level checks. */
  function reach(b) {
    var s = stats(b);
    var y = 0, vy = -s.jumpV, pres = b.pres, dt = 1 / 120, t = 0, peak = 0;
    var held = true;
    while (t < 6) {
      var up = vy < 0;
      var g = (up ? PHYS.Grise : PHYS.G) * s.gravMul;
      vy += g * dt;
      if (t > 0.35 && pres > 2) {
        vy -= s.thrust * dt;
        pres -= s.drain * dt;
        if (vy < -s.maxRise) vy = -s.maxRise;
      }
      y += vy * dt;
      peak = Math.max(peak, -y);
      t += dt;
      if (y >= 0 && t > 0.2) break;
    }
    return peak;
  }

  var api = { PHYS: PHYS, FOODS: FOODS, mulberry: mulberry, create: create, eat: eat, feeling: feeling,
    addButterflies: addButterflies, tick: tick, stats: stats, reach: reach, fill: fill, stateOf: stateOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GUTS = root.GUTS || {}; root.GUTS.Belly = api; }
})(typeof window !== 'undefined' ? window : this);
