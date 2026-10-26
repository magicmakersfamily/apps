/* GUTS data: levels (built with small calls, no ASCII art), stage list, Food Dex, story lines.
   Pure data + builders, no drawing. Browser: window.GUTS.Data. Node: module.exports (levels.test.js). */
(function (root) {
  'use strict';

  var SOLID = '#BC?XTU~d';          // solid tile characters
  var ONEWAY = '=H';                // stand-on-top-only characters

  /* ---------- level builder ---------- */
  function Lvl(w, h, theme) {
    this.w = w; this.h = h; this.theme = theme;
    this.g = [];
    for (var y = 0; y < h; y++) { var r = []; for (var x = 0; x < w; x++) r.push(' '); this.g.push(r); }
    this.start = { x: 2, y: 13 };
    this.checks = []; this.foods = []; this.bots = []; this.drones = []; this.bugs = [];
    this.prompts = []; this.feelings = []; this.patches = []; this.crowds = []; this.movers = [];
    this.chompers = []; this.crates = {}; this.decor = []; this.puddles = [];
    this.goal = null; this.lantern = null; this.blastZones = []; this.pitY = h + 6; this.reacts = []; this.cat = null;
  }
  Lvl.prototype = {
    get: function (x, y) { if (x < 0 || x >= this.w) return '#'; if (y < 0) return ' '; if (y >= this.h) return ' '; return this.g[y][x]; },
    put: function (x, y, ch) { if (x >= 0 && x < this.w && y >= 0 && y < this.h) this.g[y][x] = ch; return this; },
    box: function (x, y, w, h, ch) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.put(x + i, y + j, ch || 'B'); return this; },
    ground: function (x0, x1, top, ch) { return this.box(x0, top, x1 - x0, this.h - top, ch || '#'); },
    clear: function (x, y, w, h) { return this.box(x, y, w, h, ' '); },
    plat: function (x, y, w) { return this.box(x, y, w, 1, '='); },
    hidden: function (x, y, w) { return this.box(x, y, w, 1, 'H'); },
    food: function (x, y, id, respawn) { this.foods.push({ x: x, y: y, id: id, respawn: !!respawn }); return this; },
    crate: function (x, y, id) { this.put(x, y, '?'); this.crates[x + ',' + y] = id; return this; },
    bot: function (x, y, min, max) { this.bots.push({ x: x, y: y, min: min, max: max }); return this; },
    drone: function (x, y, range, every) { this.drones.push({ x: x, y: y, range: range, every: every || 4 }); return this; },
    bug: function (x, y, id) { this.bugs.push({ x: x, y: y, id: id }); return this; },
    check: function (x, y) { this.checks.push({ x: x, y: y }); return this; },
    prompt: function (x, icon, line) { this.prompts.push({ x: x, icon: icon, line: line }); return this; },
    feel: function (x, kind, size) { this.feelings.push({ x: x, kind: kind, size: size || 'small' }); return this; },
    patch: function (x, y, w, kind) { this.box(x, y, w, 1, 'd'); this.patches.push({ x: x, y: y, w: w, kind: kind }); return this; },
    crowd: function (x0, x1, y) { this.crowds.push({ x0: x0, x1: x1, y: y }); return this; },
    mover: function (m) { this.movers.push(m); return this; },
    chomp: function (x, w, period, phase, minLen, maxLen) { this.chompers.push({ x: x, w: w, period: period, phase: phase || 0, minLen: minLen || 3, maxLen: maxLen || 11 }); return this; },
    dec: function (type, x, y, o) { var d = o || {}; d.type = type; d.x = x; d.y = y; this.decor.push(d); return this; },
    blast: function (x0, x1) { this.blastZones.push([x0, x1]); return this; },
    react: function (type, x, y, w, h, o) { var r = o || {}; r.type = type; r.x = x; r.y = y; r.w = w; r.h = h; this.reacts.push(r); return this; },
    catPath: function (list) { this.cat = { path: list }; return this; }
  };

  /* ---------- the stages ---------- */
  var VEG = ['broccoli', 'carrot'];

  function buildHome() {
    var L = new Lvl(118, 18, 'home');
    L.ground(0, 118, 14);
    L.box(0, 0, 88, 2, '#');                      // indoor ceiling; the back yard is open sky
    L.start = { x: 4, y: 13 };
    // ---- bedroom: a rumbling belly, a fizzy drink, and a laundry basket that is about to have a very big morning
    L.dec('bed', 1, 14, {}); L.dec('window', 9, 4, {}); L.dec('dresser', 10, 12, { w: 4, h: 2 });
    L.food(7, 13, 'apple');
    L.box(10, 12, 4, 2, 'B');                     // dresser: 2 tiles up
    L.food(11, 11, 'soda');                       // the first fizzy drink: eating it starts the first blast
    L.plat(14, 10, 2); L.plat(16, 8, 5);          // hop up: dresser, little shelf, wall shelf
    L.react('basket', 17, 6, 3, 2);               // laundry basket on the wall shelf
    L.bug(21, 6, 'home-1');
    L.feel(5, 'shoes', 'small');
    L.prompt(2, 'move', 'Walk with the stick or arrow keys.');
    L.prompt(8, 'jump', 'Jump onto the dresser!');
    L.check(23, 13);
    // ---- the cat has the bao: Mimi leads the way
    L.catPath([
      { x: 8.5, y: 14, wait: 2.6 }, { x: 25, y: 14 }, { x: 31, y: 10 }, { x: 55.5, y: 4 },
      { x: 68, y: 12, sleep: true }, { x: 91, y: 14 }, { x: 99, y: 14 }, { x: 109.5, y: 8, final: true }
    ]);
    L.feel(26, 'excited', 'small');
    // ---- kitchen: counter, a hanging fruit basket, a cupboard shelf, the fridge
    L.box(27, 12, 3, 2, 'B');                     // step
    L.box(30, 10, 6, 4, 'B');                     // counter, 4 tiles up (the step makes it two hops)
    L.food(31, 9, 'broccoli'); L.food(34, 9, 'carrot');
    L.prompt(29, 'eat:broccoli', 'Crunchy greens make Gus bouncy.');
    L.react('hanger', 31, 5, 4, 2);               // jump up and bump it: fruit falls
    L.plat(37, 8, 4); L.bug(39, 7, 'home-2');     // cupboard shelf
    L.box(38, 12, 5, 2, 'B');                     // table
    L.food(40, 11, 'candy');
    L.dec('kitchen', 26, 0, { w: 30 });
    L.check(45, 13);
    L.food(46, 13, 'soda', true); L.food(48, 13, 'candy', true);      // snack counter before the fridge, always refilled
    L.prompt(45, 'eat:soda', 'Fizzy and sweet fill the belly with bubbles.');
    L.plat(47, 12, 2); L.plat(49, 10, 2); L.plat(51, 8, 2); L.plat(53, 6, 1);   // kitchen shelves: the walking way up
    L.box(54, 4, 3, 10, 'B');                     // fridge: 10 tiles. Climb the shelves, or rocket over it!
    L.dec('fridge', 54, 4, { w: 3, h: 10 });
    L.prompt(52, 'blast', 'Hop up the shelves, or hold BLAST to rocket over the fridge!');
    // ---- living room: Mimi is asleep on the sofa
    L.feel(60, 'hungry', 'small');
    L.prompt(62, 'breathe', 'Mimi is asleep. Stand still and hold CALM so the rumbles stay quiet.');
    L.food(61, 13, 'water', true);
    L.dec('rug', 58, 14, { w: 10 });
    L.check(62, 13);
    L.box(66, 12, 6, 2, 'B'); L.dec('sofa', 66, 12, { w: 6 });
    L.box(76, 12, 4, 2, 'B');                     // coffee table
    L.lantern = { x: 77, y: 11 };
    L.dec('tv', 82, 9, {});
    L.prompt(74, 'jump', 'Po Po’s lantern is on the coffee table!');
    L.food(70, 11, 'blueberries'); L.food(83, 13, 'carrot');
    L.feel(84, 'wait', 'small');
    L.check(86, 13);
    // ---- back yard: snacks, a bounce flower to grow, a pinwheel, and crates to hop up
    L.food(90, 13, 'candy', true); L.food(92, 13, 'soda', true);
    L.react('pinwheel', 95, 10, 3, 4);            // blast near it and watch it spin
    L.prompt(96, 'blast', 'Blast over the dirt and see what grows!');
    L.patch(100, 14, 3, 'flower');
    L.box(104, 12, 2, 2, 'B'); L.box(106, 10, 2, 4, 'B');                 // crate steps, 2 tiles each
    L.dec('crates', 104, 12, { w: 2, h: 2 }); L.dec('crates', 106, 10, { w: 2, h: 4 });
    L.box(108, 8, 3, 6, 'B');                     // fence: hop the crates, or bounce over it
    L.dec('fence', 108, 8, { w: 3, h: 6 });
    L.bug(109, 6, 'home-3');
    L.check(97, 13);
    L.food(114, 13, 'banana'); L.food(112, 13, 'apple');
    L.goal = { x: 115, y: 13, type: 'gate' };
    L.crowd(90, 106, 14);
    return L;
  }

  function buildMarket() {
    var L = new Lvl(176, 18, 'market');
    L.ground(0, 38, 14); L.ground(41, 76, 14); L.ground(79, 176, 14);
    L.start = { x: 3, y: 13 };
    L.dec('billboard', 6, 2, {});
    L.prompt(3, 'move', 'Beige Snax Bots are marching. Jump on them!');
    L.plat(9, 10, 5);
    L.crate(10, 7, 'apple'); L.crate(12, 7, 'broccoli');
    L.bot(20, 13, 14, 27); L.food(16, 13, 'carrot');
    L.patch(28, 14, 3, 'flower');
    L.box(33, 12, 4, 2, 'B'); L.food(34, 11, 'cherries'); L.food(36, 11, 'banana');
    L.check(44, 13);
    L.plat(48, 10, 5); L.plat(56, 8, 5); L.plat(64, 10, 5);
    L.food(50, 9, 'apple'); L.food(58, 7, 'cherries'); L.food(66, 9, 'banana');
    L.bot(60, 13, 55, 70); L.bot(52, 13, 46, 56);
    L.patch(52, 14, 3, 'stalk');
    L.food(70, 13, 'water');
    L.plat(76, 12, 3);                            // helper over pit 2
    L.feel(84, 'toy', 'small');
    // crowd zone with the fruit vendor; two ways past the produce tower
    L.crowd(80, 112, 14);
    L.food(94, 13, 'soda', true); L.food(95, 13, 'coney', true);
    L.prompt(93, 'blast', 'Fill up and blast over the produce tower!');
    L.blast(86, 106);
    L.plat(87, 12, 3); L.plat(90, 10, 3); L.plat(93, 8, 3); L.plat(96, 7, 4);   // ground route: stairs of awnings
    L.box(100, 7, 3, 7, 'B'); L.dec('tower', 100, 7, { w: 3, h: 7 });
    L.bug(101, 3, 'market-1');
    L.food(89, 13, 'broccoli');
    L.check(113, 13);
    L.bot(118, 13, 114, 126); L.bot(122, 13, 116, 124);
    // secret room under a cracked roof: pound the cracks
    L.food(124, 13, 'coney', true);
    L.prompt(123, 'pound', 'Heavy? Press down in the air to ground-pound!');
    L.plat(126, 12, 3);                           // step up to the roof
    L.box(129, 12, 1, 2, 'B'); L.box(138, 12, 1, 2, 'B');
    L.box(129, 11, 10, 1, 'B'); L.put(133, 11, 'C'); L.put(134, 11, 'C');
    L.bug(134, 13, 'market-2'); L.food(131, 13, 'fish');
    L.patch(142, 14, 3, 'flower');
    L.check(146, 13);
    L.feel(148, 'hungry', 'small');
    L.bot(154, 13, 148, 162);
    L.plat(158, 10, 4); L.bug(160, 8, 'market-3');
    L.goal = { x: 170, y: 13, type: 'lever' };
    L.dec('machine', 168, 8, {});
    return L;
  }

  function buildCommute() {
    var L = new Lvl(192, 26, 'commute');
    L.groundRow = 22;
    L.ground(0, 192, 22);
    L.start = { x: 3, y: 21 };
    L.prompt(3, 'move', 'Coney Commute! Use the park, or climb the freeway.');
    // lower park route: greens and berries
    L.food(14, 21, 'broccoli'); L.food(20, 21, 'blueberries'); L.food(26, 21, 'carrot');
    L.patch(30, 22, 3, 'flower');
    L.bot(24, 21, 18, 34);
    L.check(38, 21);
    // freeway ramp (2 tiles per step) and broken lanes with 4-tile gaps
    L.box(40, 20, 2, 2, 'B'); L.box(42, 18, 2, 4, 'B');
    L.box(44, 17, 14, 2, 'B'); L.box(62, 17, 14, 2, 'B'); L.box(80, 17, 14, 2, 'B');
    L.food(50, 16, 'apple'); L.food(68, 16, 'banana'); L.food(86, 16, 'cherries');
    L.bot(70, 16, 63, 74);
    L.dec('freeway', 40, 14, { x1: 96 });
    L.drone(34, 10, 18, 4); L.drone(62, 9, 16, 4); L.drone(88, 10, 12, 4);
    L.feel(76, 'toy', 'small');
    L.check(96, 21);
    // the vendor cart
    L.food(100, 21, 'coney', true); L.food(102, 21, 'soda', true);
    L.prompt(99, 'eat:coney', 'Coney dog + ginger ale = a huge blast!');
    L.prompt(110, 'pound', 'Heavy? Ground-pound the cracks in the road.');
    // tunnel under the road with a Gut Bug; stairs lead back up
    L.clear(112, 23, 11, 2);
    L.put(115, 22, 'C'); L.put(116, 22, 'C'); L.put(117, 22, 'C');
    L.box(120, 24, 1, 1, 'B'); L.box(121, 23, 1, 2, 'B');
    L.bug(117, 24, 'commute-1'); L.food(114, 24, 'cherries');
    // clouds: the secret air route
    L.plat(124, 8, 5); L.plat(131, 6, 5); L.plat(138, 8, 5);
    L.bug(133, 5, 'commute-2');
    L.food(126, 7, 'fish');
    L.blast(112, 140);
    L.check(140, 21);
    // chili, then a beige wall hiding an alcove
    L.food(141, 21, 'chili'); L.prompt(139, 'eat:chili', 'Chili! A fire burp forward, a rocket shove backward.');
    L.plat(144, 20, 2);
    L.box(146, 19, 9, 1, 'B'); L.box(154, 20, 1, 2, 'B'); L.box(146, 20, 1, 2, 'X');
    L.bug(150, 21, 'commute-3'); L.food(152, 21, 'cherries');
    L.patch(158, 22, 3, 'tree');
    L.bot(164, 21, 158, 172); L.bot(172, 21, 166, 180);
    L.drone(150, 11, 20, 3);
    L.feel(160, 'hungry', 'small');
    L.food(168, 21, 'water');
    L.goal = { x: 186, y: 21, type: 'lever' };
    L.dec('machine', 184, 16, {});
    L.crowd(100, 130, 22);
    return L;
  }

  function buildRooftops() {
    var L = new Lvl(190, 20, 'rooftop');
    L.pitY = 26;
    function roof(x0, x1, top) { L.box(x0, top, x1 - x0, 20 - top, '#'); }
    roof(0, 23, 12); roof(25, 40, 10); roof(44, 56, 12); roof(70, 88, 11); roof(93, 106, 6);
    roof(106, 123, 15); roof(141, 163, 14); roof(165, 190, 12);
    L.start = { x: 3, y: 11 };
    L.prompt(3, 'move', 'Rooftops at dusk. Hop across the gaps!');
    L.food(10, 11, 'apple'); L.food(32, 9, 'banana');
    L.bot(14, 11, 8, 21); L.bot(31, 9, 27, 38);
    L.check(47, 11);
    L.mover({ x: 57, y: 12, w: 6, dx: 7, dy: 0, period: 6, kind: 'train' });
    L.prompt(55, 'jump', 'Hop onto the People Mover!');
    L.food(60, 11, 'water');
    L.bot(80, 10, 72, 86);
    L.food(74, 10, 'soda'); L.food(76, 10, 'tomato');
    L.dec('antenna', 80, 4, {}); L.bug(80, 4, 'roof-1');
    L.plat(88, 9, 3); L.plat(91, 7, 3);
    L.food(89, 8, 'broccoli');
    L.feel(98, 'high', 'medium');
    L.check(100, 5);
    L.food(110, 14, 'cherries'); L.bot(114, 14, 108, 120);
    L.check(108, 14);
    L.food(118, 14, 'popsicle');
    L.prompt(116, 'eat:popsicle', 'Brain freeze slows the whole world for a moment.');
    L.mover({ x: 123, y: 14, w: 6, dx: 11, dy: 0, period: 3.4, kind: 'train' });
    L.food(145, 13, 'fish');
    L.prompt(144, 'eat:fish', 'Fish helps you see hidden paths.');
    L.hidden(147, 12, 2); L.hidden(150, 10, 2); L.hidden(153, 8, 2); L.hidden(156, 6, 2);
    L.bug(157, 5, 'roof-2');
    L.check(143, 13);
    L.bot(154, 13, 148, 160);
    L.food(167, 11, 'coney');
    L.plat(171, 10, 4); L.bug(173, 8, 'roof-3');
    L.feel(170, 'hungry', 'small');
    L.goal = { x: 184, y: 11, type: 'lever' };
    L.dec('machine', 182, 6, {});
    return L;
  }

  function buildGolem() {
    var L = new Lvl(50, 18, 'factory');
    L.ground(0, 50, 14);
    L.start = { x: 3, y: 13 };
    L.box(0, 0, 50, 1, '#');
    L.plat(11, 10, 6); L.plat(22, 6, 6); L.plat(31, 10, 5);
    L.food(2, 13, 'coney', true); L.food(5, 13, 'soda', true); L.food(8, 13, 'broccoli', true);
    L.check(4, 13);
    L.dec('conveyor', 6, 14, { w: 28 });
    L.goal = { x: 47, y: 13, type: 'none' };
    L.boss = { golemX: 38, jointX: 20, basketX: 39 };
    L.crowd(1, 20, 14);
    L.prompt(10, 'pound', 'Heavy? Ground-pound the glowing conveyor!');
    return L;
  }

  function buildMouth() {
    var L = new Lvl(132, 18, 'mouth');
    L.ground(0, 132, 14);
    L.box(0, 0, 132, 2, '#');
    L.start = { x: 3, y: 13 };
    L.prompt(3, 'move', 'You got swallowed! Mind the teeth.');
    L.box(10, 12, 3, 2, 'T'); L.box(17, 12, 3, 2, 'T');
    // saliva pool with tongue trampolines
    L.clear(24, 14, 12, 4); L.box(24, 16, 12, 2, '#'); L.box(24, 15, 12, 1, 'v');
    L.box(27, 15, 3, 1, 'U'); L.box(31, 15, 3, 1, 'U');
    L.food(26, 11, 'water'); L.food(32, 10, 'yogurt');
    L.prompt(22, 'jump', 'Tongue trampolines! Bounce across the saliva.');
    L.check(40, 13);
    // first set of chompers
    L.box(44, 12, 3, 2, 'T'); L.box(51, 12, 3, 2, 'T'); L.box(58, 12, 3, 2, 'T');
    L.chomp(44, 3, 3.2, 0, 3, 11); L.chomp(51, 3, 3.2, 0.5, 3, 11); L.chomp(58, 3, 3.2, 0, 3, 11);
    L.food(48, 12, 'blueberries'); L.food(55, 12, 'tomato');
    L.bug(49, 5, 'mouth-1');
    L.check(66, 13);
    L.clear(70, 14, 10, 4); L.box(70, 16, 10, 2, '#'); L.box(70, 15, 10, 1, 'v');
    L.box(73, 15, 3, 1, 'U');
    L.plat(76, 11, 3); L.food(77, 9, 'banana');
    // second set, faster
    L.box(84, 12, 3, 2, 'T'); L.box(90, 12, 3, 2, 'T'); L.box(96, 12, 3, 2, 'T');
    L.chomp(84, 3, 2.8, 0.25, 3, 11); L.chomp(90, 3, 2.8, 0.75, 3, 11); L.chomp(96, 3, 2.8, 0.25, 3, 11);
    L.food(87, 12, 'candy'); L.food(93, 12, 'chili');
    L.bug(88, 5, 'mouth-2');
    L.check(102, 13);
    L.feel(106, 'high', 'small');
    L.food(108, 13, 'water');
    L.bug(112, 13, 'mouth-3');
    L.goal = { x: 126, y: 13, type: 'throat' };
    L.molar = { x: 118, w: 7 };
    return L;
  }

  var STAGES = {
    home:   { id: 'home',   n: '0',   name: 'Morning at Home', zh: '早晨在家', world: 'detroit', theme: 'home', music: 'home', build: buildHome, beige: false, noMeter: true,
              intro: 'Gus wakes up with a rumbling belly. His breakfast bao is gone! And there goes Mimi the cat, trotting off with it.', next: 'market' },
    market: { id: 'market', n: '1-1', name: 'Eastern Market Mayhem', zh: '東方市場', world: 'detroit', theme: 'market', music: 'detroit', build: buildMarket, beige: true,
              intro: 'Eastern Market is turning beige. Unplug the Snax machine!', next: 'commute' },
    commute:{ id: 'commute',n: '1-2', name: 'The Coney Commute', zh: '熱狗通勤', world: 'detroit', theme: 'commute', music: 'detroit', build: buildCommute, beige: true,
              intro: 'Two ways across: eat greens in the park, or blast over the freeway.', next: 'rooftops' },
    rooftops:{id: 'rooftops',n: '1-3',name: 'People Mover Rooftops', zh: '空中列車', world: 'detroit', theme: 'rooftop', music: 'detroit-dusk', build: buildRooftops, beige: true,
              intro: 'Hop the rooftops and ride the People Mover.', next: 'golem' },
    golem:  { id: 'golem',  n: 'Boss', name: 'The Assembly Line Golem', zh: '流水線巨人', world: 'detroit', theme: 'factory', music: 'boss', build: buildGolem, beige: true, boss: true, noAuto: true,
              intro: 'The Golem is boxing food into Snax. Do not fight it. Feed it!', next: 'mouth' },
    mouth:  { id: 'mouth',  n: 'In', name: 'The Mouth', zh: '嘴巴裡面', world: 'inside', theme: 'mouth', music: 'inside', build: buildMouth, beige: false,
              intro: 'Inside Gus. Watch the teeth!', next: null }
  };
  var ORDER = ['home', 'market', 'commute', 'rooftops', 'golem', 'mouth'];

  var LOCKED_WORLDS = [
    { id: 'mexico', name: 'Mexico', zh: '墨西哥', color: '#e2574c' },
    { id: 'japan', name: 'Japan', zh: '日本', color: '#e87aa0' },
    { id: 'taiwan', name: 'Taiwan', zh: '台灣', color: '#3fb08a' },
    { id: 'hongkong', name: 'Hong Kong', zh: '香港', color: '#f0b429' }
  ];

  /* ---------- Food Dex: name, zh, jyutping (one syllable per character), fact, power ---------- */
  var DEX_WORLDS = [
    { id: 'detroit', name: 'Detroit', color: '#c0583a', total: 12 },
    { id: 'mexico', name: 'Mexico', color: '#e2574c', total: 12 },
    { id: 'japan', name: 'Japan', color: '#e87aa0', total: 12 },
    { id: 'taiwan', name: 'Taiwan', color: '#3fb08a', total: 12 },
    { id: 'hongkong', name: 'Hong Kong', color: '#f0b429', total: 12 },
    { id: 'inside', name: 'Inside', color: '#e0709a', total: 10 },
    { id: 'recipes', name: 'Recipes', color: '#8a6bd0', total: 10 }
  ];
  var DEX = {
    coney:      { w: 'detroit', name: 'Coney dog', zh: '熱狗', jp: 'jit6 gau2', fact: 'Detroit’s coney dog diners have been open for more than 100 years.', power: 'Big pressure, and Gus gets heavy.' },
    pizza:      { w: 'detroit', name: 'Square pizza', zh: '方形薄餅', jp: 'fong1 jing4 bok6 beng2', fact: 'The first ones were baked in square steel pans from car factories.', power: 'Pressure, and a heavy tummy.' },
    paczki:     { w: 'detroit', name: 'Pączki', zh: '波蘭冬甩', jp: 'bo1 laan4 dung1 lat1', fact: 'Polish donuts. Hamtramck lines up for them on Pączki Day.', power: 'Sugar dash plus a heavy tummy.' },
    cherries:   { w: 'detroit', name: 'Michigan cherries', zh: '車厘子', jp: 'ce1 lei4 zi2', fact: 'Michigan grows most of America’s tart cherries.', power: 'Vitality and a quick speed boost.' },
    apple:      { w: 'detroit', name: 'Apple', zh: '蘋果', jp: 'ping4 gwo2', fact: 'Apples float because they are about one quarter air.', power: 'Vitality and a quick speed boost.' },
    popsicle:   { w: 'detroit', name: 'Popsicle', zh: '雪條', jp: 'syut3 tiu2', fact: 'An 11-year-old invented it in 1905 by leaving a drink outside on a cold night.', power: 'Brain freeze: the world slows down.' },
    soda:       { w: 'detroit', name: 'Ginger ale', zh: '薑汁汽水', jp: 'goeng1 zap1 hei3 seoi2', fact: 'The bubbles are carbon dioxide, the same gas you breathe out.', power: 'Fast dash, then a slow crash.' },
    corn:       { w: 'detroit', name: 'Sweet corn', zh: '粟米', jp: 'suk1 mai5', fact: 'Every strand of corn silk connects to one kernel.', power: 'A gentle toot hover.' },
    broccoli:   { w: 'detroit', name: 'Broccoli', zh: '西蘭花', jp: 'sai1 laan4 faa1', fact: 'A broccoli head is a bunch of tiny flower buds.', power: 'Big vitality: springy and steady.' },
    carrot:     { w: 'detroit', name: 'Carrot', zh: '紅蘿蔔', jp: 'hung4 lo4 baak6', fact: 'The first carrots were purple or yellow, not orange.', power: 'Vitality: springy and steady.' },
    fish:       { w: 'detroit', name: 'Whitefish', zh: '白魚', jp: 'baak6 jyu2', fact: 'Whitefish live in the Great Lakes, right next to Detroit.', power: 'Brain sight: hidden paths glow.' },
    beans:      { w: 'detroit', name: 'Navy beans', zh: '白豆', jp: 'baak6 dau2', fact: 'Michigan is one of America’s biggest bean-growing states.', power: 'A gentle toot hover.' },
    water:      { w: 'inside', name: 'Water', zh: '水', jp: 'seoi2', fact: 'Your body is more than half water.', power: 'Cools pressure and steadies the next blast.' },
    banana:     { w: 'inside', name: 'Banana', zh: '香蕉', jp: 'hoeng1 ziu1', fact: 'Bananas are berries, but strawberries aren’t.', power: 'Vitality and speed. Then candy: a clean blast!' },
    candy:      { w: 'inside', name: 'Gummy candy', zh: '軟糖', jp: 'jyun5 tong2', fact: 'Sugar gives fast energy that runs out fast too.', power: 'Fast dash, then a slow crash.' },
    chili:      { w: 'inside', name: 'Chili', zh: '辣椒', jp: 'laat6 ziu1', fact: 'Capsaicin tricks your mouth into feeling heat.', power: 'Fire burp forward, rocket shove backward.' },
    yogurt:     { w: 'inside', name: 'Yogurt', zh: '乳酪', jp: 'jyu5 lok3', fact: 'Yogurt is milk that friendly bacteria turned tangy.', power: 'Vitality, and new neighbours for the village.' },
    blueberries:{ w: 'inside', name: 'Blueberries', zh: '藍莓', jp: 'laam4 mui2', fact: 'One of the few naturally blue foods.', power: 'Vitality and a quick speed boost.' },
    tomato:     { w: 'inside', name: 'Tomato', zh: '番茄', jp: 'faan1 ke2', fact: 'Tomatoes are fruits because they hold seeds.', power: 'Vitality. Great for dropping on red buttons.' },
    bao:        { w: 'hongkong', name: 'Bao', zh: '包', jp: 'baau1', fact: 'Steamed buns are a Hong Kong breakfast and tea-time favourite.', power: 'A happy, full belly and a burst of speed.' },
    snax:       { w: 'special', name: 'Beige Snax', zh: '米色零食', jp: 'mai5 sik1 ling4 sik6', fact: 'Fills you up. Does nothing.', power: 'Nothing! And a bored grey squatter moves in.' }
  };

  /* ---------- story ---------- */
  var STORY = {
    intro: [
      { panel: 'factory', who: 'narrator', line: 'This is Baron Von Processo. He has never tasted anything real.' },
      { panel: 'machine', who: 'narrator', line: 'His Snax machines squish every food on Earth into the same beige cube. Crunch. Crunch. Boring.' },
      { panel: 'baron', who: 'baron', line: 'Tacos? Beige! Noodles? Beige! Soon the whole world will taste like nothing!' },
      { panel: 'room', who: 'narrator', line: 'Meet Gus. Today he flies to Hong Kong for Grandma’s Mid-Autumn feast.' },
      { panel: 'lantern', who: 'narrator', line: 'He made a paper lantern for Po Po. Now he just has to get there.' },
      { panel: 'belly', who: 'narrator', line: 'Everything Gus eats, and everything he feels, goes into his belly. And his belly makes him move!' }
    ],
    afterHome: [
      { panel: 'tv', who: 'narrator', line: 'Gus and Mimi share the bao. Then, on the news: beige cubes are appearing at Eastern Market!' }
    ],
    beforeBoss: [
      { panel: 'golemReveal', who: 'narrator', line: 'The Assembly Line Golem is boxing food into Snax. Do not fight it. Feed it!' }
    ],
    afterBoss: [
      { panel: 'golemFed', who: 'narrator', line: 'The Golem sneezes out every coney dog it swallowed. Color floods back into the market!' },
      { panel: 'call', who: 'porpor', line: 'Gus! Did you eat? … A coney dog. Okay. Did you eat a vegetable?',
        alt: { veg: 'Gus! Did you eat? … A coney dog. And broccoli! Good boy.' } },
      { panel: 'call', who: 'porpor', line: '… The onions don’t count. 食飯啦!', canto: '食飯啦', jyut: 'sik6 faan6 laa1', alt: { veg: 'Sik faan laa! Eat your rice!' } },
      { panel: 'swallow', who: 'narrator', line: 'A last stray Snax flies into Gus’s mouth. Gulp! Gus shrinks, cartoon style, and slides down his own throat.' }
    ],
    molar: [
      { panel: 'molar', who: 'narrator', line: 'Uh-oh. A big molar is closing!' },
      { panel: 'biffy', who: 'biffy', line: 'Gotcha! Hi! I’m Biffy! I live down here!' },
      { panel: 'village0', who: 'biffy', line: 'Welcome to your Gut Village. It’s a bit empty… Every new food you eat brings new neighbours!' }
    ],
    porporCanto: { text: '食飯啦', jyut: 'sik6 faan6 laa1' }
  };

  /* ---------- feelings (thought bubbles) ---------- */
  var FEELINGS = {
    shoes:  { icon: 'shoes',  line: 'Shoes on the wrong feet!', size: 'small' },
    toy:    { icon: 'toy',    line: 'Someone took my toy!', size: 'small' },
    bump:   { icon: 'bump',   line: 'I bumped my foot!', size: 'small' },
    hungry: { icon: 'hungry', line: 'I’m so hungry!', size: 'small' },
    waffle: { icon: 'waffle', line: 'The last waffle is gone!', size: 'big' },
    wait:   { icon: 'wait',   line: 'Grandma’s waiting!', size: 'small' },
    high:   { icon: 'high',   line: 'That’s too high!', size: 'medium' },
    stop:   { icon: 'stop',   line: 'I have to stop playing!', size: 'medium' },
    excited:{ icon: 'excited',line: 'Ooh! Mimi has my bao!', size: 'small' }
  };

  function ground(L) { // helper for tests: is a cell standable (solid or one-way)
    return SOLID.indexOf(L) >= 0 || ONEWAY.indexOf(L) >= 0;
  }

  var api = { Lvl: Lvl, SOLID: SOLID, ONEWAY: ONEWAY, STAGES: STAGES, ORDER: ORDER, LOCKED_WORLDS: LOCKED_WORLDS,
    DEX: DEX, DEX_WORLDS: DEX_WORLDS, STORY: STORY, FEELINGS: FEELINGS, isStand: ground, VEG: VEG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GUTS = root.GUTS || {}; root.GUTS.Data = api; }
})(typeof window !== 'undefined' ? window : this);
