# GUTS: Around the World in 80 Bites: handoff

## 1.4 (beta, 2026-10-26): "The Great Bao Heist"

An outside replay called the game a lovable prototype and asked for more density, payoffs and cause-and-effect. 1.4 (all in `game.js`, `art3.js`, `data.js`, `ui.js`):
- **Scenes** (`startMoment`, `updateMoment`, `drawMoment`): the opening **heist** (Gus wakes, his belly rumbles, Mimi tiptoes in, snatches the bao from the nightstand, they freeze, she bolts) and the closing **reunion** (Mimi brings or nudges the bao over, Gus eats half, tosses her the other half, hearts and confetti, "BREAKFAST FOUND!"). The untrusted version has Mimi look away and push the bao with her paw. Camera zooms in; any button skips after 1.2 s (0.4 s on a replay). The gate also stages the reunion if Gus skipped Mimi.
- **Mimi** now hides in the laundry basket (only her ears show), launches out in a sock hat when it tips (or when Gus passes), walks beside a Gus she trusts (slower, waits less far ahead, hearts), and cheers, teases and glances back.
- **Zoom system** (`ZF`): scenes zoom in, the first blast eases in, the first time Gus stands on the fridge the camera pulls back ("What a view!") and the magnets wobble when he lands on shelves; the roof shows above the house.
- **Flower**: a dashed target and arrow on the sleeping patch, a staged sprout (hit-stop, rings, boing).
- Celebrations: lantern pickup, Mimi's purr, a freed Gut Bug (1.3). Dex discoveries show the power and say the name in Cantonese.
- **Gut Village residents** (`D.BUGS`): Pip the drummer, Spice the joke teller, Noodle the builder; tap one to hear its line, hear its sound and watch it hop.
- Fixes: results screen needed extra Waits in Step mode, route hints after the exit, results now say "this run" and "overall", the zoom notice only shows for a real pinch and closes itself, clearer left/right jump buttons.
- Checks: `ai-bot.mjs` (single key taps) and `route.mjs` (jumps only, no scene) both pass; 39 tests.
- Next: watch James play it unprompted (guts-F17), then more blast-centred set pieces and branching routes (guts-F16).

## 1.3 (beta, 2026-10-26): zoom lock, precise Step mode, a calmer screen

James kept getting a zoomed-in, unplayable screen; a second outside playtest (Step mode only) could not line up the fridge shelves. 1.3:
- **Zoom**: Ctrl+scroll (a Mac trackpad pinch), Safari gestures, two-finger touch and Ctrl/Cmd +/-/0 are blocked inside the game while playing; the page's own text below stays zoomable. If the page is zoomed anyway (visual viewport scale above 1), touch browsers snap back by briefly capping the viewport tag, and a "Fix the zoom" banner is kept in view (it follows the visual viewport). Settings → Screen size (smaller, normal, larger). Likely cause was a trackpad pinch on a MacBook, but the device is unconfirmed (tracker guts-B5).
- **Step mode precision**: arrow = one small step (about 1 tile), A / D = run, Q / E = jump left / right that lands at about 1, 3 or 5 tiles (keys 1 2 3, the Distance button or Settings → Tap distance). Hops steer to a target x and brake, so they are exact even against a wall; Tap and Step mode brake in the air. `GUTS.ai.nextHop()` plans the route (same rules as the level tests) and the text view says "walk 3 tiles right, then jump right with distance medium (key 2)…", lists nearby platforms and what reaches them.
- **Calmer screen**: the text view is one line with a "Look around" toggle, touch controls fade after 4.5 s idle, the Step notice hides after 8 s, the bite count is just an icon and a number.
- **Game feel**: freeing a Gut Bug has a brief slow-motion, rings and a toast (the basket tip has a short hit-stop too); Mimi glances back, teases, cheers a spectacular blast and twitches an ear when the belly rumbles near her sleep; fizzy food shows bubbles and a coloured glow in Gus's belly; a third soda at the fridge foot; the stuck helper also draws an arrow at the next step.
- Grandma is **Popo** (one word, said "poh-poh"; TTS is given "Poe poe").
- Checks: `node guts/tools/ai-bot.mjs` (single key taps only, finishes in ~57 actions) and `route.mjs` (jumps only) both pass; 39 tests.

## 1.2 (beta, 2026-10-26): the first level rebuilt, "Find the missing breakfast"

The family asked for a rebuild after an outside review and James's play. 1.2 keeps 1.1's never-stuck rules and adds:
- **Mimi the family cat** (`catPath` in `data.js`, `updateCat` in `game.js`, `A.cat` in `art3.js`): she carries Gus's bao and leads, waiting at each stop. She curls up asleep on the sofa: breathe calmly nearby and she purrs and trusts Gus; blast or blow out beside her and she hisses and bolts. At the fence she drops the bao, Gus eats it (Dex: Bao 包 baau1), and the gate also hands it over if he skipped her.
- **First blast by accident**: eating the first fizzy drink starts a slow-motion belly rumble with a big "Tap BLAST!" prompt (`st.slow`).
- **Things that react**: laundry basket on a shelf (tips, socks fly, one lands on Gus's head, it lands as a step), hanging fruit basket (jump into it: fruit falls), pinwheel (blast near it for 2 s: a snack pops out). All optional.
- Excitement as a power: the "Ooh! Mimi has my bao!" bubble gives pressure *and* a short speed boost. Food wording is neutral ("Crunchy greens make Gus bouncy"), not good/bad.
- Little Guts: auto-run is slower, a jump tap is always a full jump, Gus stops at any drop of 2+ tiles (so you choose when to jump), and steering left walks back.
- Dizzy stars when a blowout spins Gus, a belly wobble that grows with pressure and a shaking buildup before a held blast, pickups are easier to grab.
- Checks: `node guts/tools/route.mjs` plays the whole level jump-only at vitality 15 (31 hops, no failures); `levels.test.js` now also checks the cat path and the reactive objects (39 tests with the tracker's).
- Next: playtest 1.2 with James unprompted; then Detroit (guts-F2). Backlog ideas in `guts-F10`.

## 1.1 (beta, 2026-10-26): never stuck, and playable by taps and AI

Playtest: James got stuck at the last fence (needed a big blast). An outside AI review could not play at all (its key presses were too brief, and key-only events were ignored). 1.1:
- every required step is a plain jump (crate steps at the fence, kitchen shelves past the fridge); blasting is a shortcut and a secret, never a gate; the level's required hops are checked at vitality 15 and 55 with `guts/tools/hops.mjs`
- a stuck helper: after ~22 s without progress snacks float by with a hint (up to 4 times); the gate hands over a forgotten lantern
- input: `key` fallback when `code` is missing, every press lasts at least one frame
- **Tap mode** (one tap keeps going: walk 0.45 s, jump, blast 0.85 s, breathe 2.4 s), **Step mode** (the world waits for Gus to come to rest between presses; N or the Wait button looks around), on-screen buttons with a mouse, a **Text view**, and `GUTS.ai.state()/describe()/press()`. `?ai=1` switches them all on
- grandma is **Popo**, spoken "Poh Poh"
- Next: the first-level rebuild (guts-F7). Ideas from the outside review worth keeping: a funny first blast by accident (laundry basket full of socks that becomes a ramp), a question-shaped goal ("find the missing breakfast"), a world that reacts to Gus, three inventive interactions, one secret, one small character (a family cat), a joyful ending, quick funny recovery, and foods with playful different properties instead of "good/bad" wording. Test with children unprompted.

## Status (beta 1.0, 2026-10-26): the first level only

The family asked for the first level first, to prove the gameplay and mechanics. **Shipped: the Prologue, "Morning at Home"**,
with everything the brief's Phase 0–1 needs: move, jump, eat, blast, breathe, the sound ladder (gurgle, tuba, foghorn), belly states,
feelings bubbles and butterflies, compost gardens that persist (bounce flower), the lantern and its tears, the crowd arc, Gut Bugs,
medals, Food Dex (20 findable bites of 80), Gut Village screen, intro story and Popo's lines, three modes (Little Guts, Standard, Gut Check),
Gross-o-Meter, settings, keyboard + PlayStation pad (Gamepad API, standard and raw Sony mapping) + touch, original music (6 songs) and effects.

**Not wired up yet** (built as data or art, not in the engine): the Detroit levels, the Golem boss and The Mouth are *built and path-checked in
`data.js`* but the engine has no Snax bots, crates, drones, moving platforms, chompers or boss logic, and `ui.js` only starts `home`.
Biffy/co-op, cheek pouch, map screen, results for other stages, recorded voices, Mexico onward: see `TRACKER.md` (`guts-F1`..`F5`, `guts-B1`).

### Where things differ from the older plan below
- Controls: Blast is X, Shift or Period (not K); IJKL + U + O are reserved for Biffy. A grown flower springs Gus on **contact** (no need to land on top).
- Belly numbers changed after testing (`belly.js` is the truth): thrust 2250+500v, drain 52−14v, max rise 250+110v, heavy needs pressure > 25.
  A held blast of 10 pressure reaches about 5.5 tiles, 30 pressure about 10 tiles (at vitality 55).
- Logical view height is 500 px (not 576); portrait phones use a 460 px wide view. No emoji are drawn in play.
- Tests: `node --test guts/belly.test.js guts/levels.test.js` (31 tests: balance strategies, reachability of every stage, Dex jyutping).
- Browser smoke tests were driven over CDP with `Game.step()` and `Input._keys`, plus a stubbed `navigator.getGamepads`.
- Voices are the browser's own (a "backup voice" tag shows). Cantonese lines use a zh-HK voice when the device has one.

### Next (suggested order)
1. Family plays the first level on the real PS4 pad; tune `belly.js` (guts-F5, guts-B1).
2. Engine work for Eastern Market: Snax bots (stomp, blast, fire), `?` crates, `C` cracked floors for ground-pound, checkpoints already work, the beige colour overlay (`def.beige`).
3. Coney Commute (drones, grease puddles, pound tunnel), Rooftops (movers), the Golem boss, The Mouth.
4. Recorded voices, then Mexico.

The original design brief and prototype are kept locally as `guts/DESIGN-BRIEF.md` and `guts/original-prototype.html` (git-ignored, never published).

---

# Original build plan (still the roadmap)


This file is the handoff. Read it, `DESIGN-BRIEF.md` (the family's final design brief) and the repo's
`/Users/egon/family-games/CLAUDE.md` before writing code. `original-prototype.html` is the old single-file
prototype the family made with another AI: it shows the spirit, but it is being replaced, not extended.
**Do not commit `original-prototype.html` or `DESIGN-BRIEF.md`** (delete them, or keep them out of `git add`).

## What the family asked for (2026-10-26)

1. Update the game and publish it as a **beta** on the App Shelf.
2. **PS4 controller** support (DualShock 4 via the Gamepad API). Must be playable in the browser.
3. **Better music, not a copy of Mario.** The prototype's `marioMelody` is the Super Mario theme; it must go.
   All music is original, generated with Web Audio (compositions below).
4. Graphics, gameplay and storyline "much better", following the design brief.

The user explicitly asked to publish as a beta, so that request counts as the publish approval. Still: build,
test in Chrome, then publish with the beta badge. Shelf rules from `CLAUDE.md` all apply.

## Scope of beta 1.0 (Phase 0–3 of the brief, trimmed)

Playable, in order:

| # | Stage | Kind | New thing it teaches |
|---|---|---|---|
| 0 | Prologue: Morning at Home | tutorial | move, jump, eat, blast, breathe, compost, lantern |
| 1 | 1-1 Eastern Market Mayhem | Detroit | Snax Bots, crates, crowd, checkpoints, compost gardens |
| 2 | 1-2 The Coney Commute | Detroit | heavy state + ground-pound, grease, chili, air route vs ground route, cloud layer |
| 3 | 1-3 People Mover Rooftops | Detroit | moving trains, popsicle brain-freeze, "That's too high!" butterflies |
| 4 | Boss: The Assembly Line Golem | Detroit | ground-pound conveyor, blast up, drop tomato on the button, feed don't fight |
| 5 | Inside 1: The Mouth | inside | chomping teeth, tongue trampolines, meeting Biffy, Gut Village unlocks |

Also in 1.0: story cutscenes, Popo phone call after the boss, Gut Village hub (3 huts that grow), Food Dex
(80 slots, about 19 findable), medals (Zen + Chaos), 3 hidden Gut Bugs per stage, persistent compost gardens,
lantern with tears, crowd reactions, three modes (Little Guts / Standard / Gut Check), Gross-o-Meter, optional
co-op Biffy (2nd gamepad or IJKL keys), settings, saves in `localStorage`.

Out of 1.0 (show as locked "coming soon" on the world map): 1-4 Belle Isle Breeze, Mexico, Japan, Taiwan,
Hong Kong, the other inside levels, cheek pouch, aimable blasts in Standard, the feast and the moon ending.
End of beta = after The Mouth: Biffy shows the village, map shows "Next stop: Mexico — coming soon".

## Files (folder `guts/`)

Keep model and drawing separate (shelf rule). No CDN scripts (the prototype used Tailwind CDN: not allowed;
write plain CSS). Only Google Fonts may load from outside. No build step.

```
guts/index.html     page shell, CSS, HTML overlays (title, map, pause, settings, dex, results, caption bar),
                    footer, version line; loads the scripts below in order
guts/belly.js       the belly model: foods table, vitality/pressure, combos, states, blast stats, physics constants
guts/belly.test.js  node --test balance tests (strategies, see below)
guts/data.js        Food Dex entries (names, Chinese, Jyutping, facts), feelings, stage list, story scripts,
                    level builders (one function per stage)
guts/audio.js       music sequencer, original songs, adaptive layers, all SFX
guts/art.js         every drawing function: Gus, Biffy, Gut Bugs, Baron, Popo, Golem, Snax Bots, crowd,
                    food icons, feeling icons, backgrounds per theme, tiles, cutscene panels
guts/game.js        input (keyboard, gamepads, touch), physics, entities, camera, stage flow, boss, co-op, saves
guts/cover.png      1200×744, render from index.html#cover
```

Each script attaches to `window.GUTS` (`GUTS.Belly`, `GUTS.Data`, …); `belly.js` also does
`if (typeof module !== 'undefined') module.exports = Belly` so the test can `require` it.

## Screen and camera

- One `<canvas>` fills the game area (`100svh`, full width). Logical view height **576 px** (18 tiles of 32).
  `scale = min(H/576, W/640)`; `viewW = W/scale`, `viewH = H/scale`. Canvas backing store × devicePixelRatio (cap 2).
- Camera follows Gus with look-ahead in the facing direction (lerp 0.1), clamps to level bounds; when
  `viewH` > level height, align the level to the bottom and draw extra sky above. Gus may rocket up to 10 tiles
  above row 0; the camera follows him up.
- Terrain is pre-rendered into cached slices (32 tiles wide each, at `scale × dpr` resolution). Re-render only a
  slice that changes (broken crate, cracked floor, sprouted plant is an entity, not terrain).
- The page scrolls: game area first (100svh), footer below. `preventDefault` on game keys so Space/arrows never
  scroll the page while playing. Fullscreen button (Fullscreen API on the game container, pseudo-fullscreen
  fallback like the prototype). F toggles fullscreen.

## Controls

| Action | Keyboard (P1) | PS4 pad (standard mapping) | Touch |
|---|---|---|---|
| Move | ←/→ or A/D | left stick or d-pad | left/right pads (hidden in Little Guts) |
| Jump | Space, Z, ↑ or W | ✕ (button 0) | big Jump button |
| Blast (tap = toot hop, hold = rocket) | X, K or Shift | □ (2), R1 (5) or R2 (7) | Blast button (hold) |
| Breathe (hold, standing) | B, C, ↓ or S on ground | ○ (1) or L1 (4) | Breathe button, or press-and-hold on Gus |
| Ground-pound (when heavy) | ↓ in the air | ↓ / stick down in air, or △ (3) | Breathe button in the air |
| Pause | Esc or P | Options (9) | ⏸ button |
| Menus | arrows + Enter, Esc back | d-pad/stick + ✕, ○ back | tap |

- **Gamepad API:** poll `navigator.getGamepads()` every frame. Browsers hide a pad until a button is pressed:
  on `gamepadconnected` show a toast "🎮 Controller ready". Use `mapping === 'standard'` indices above.
  Fallback for a Sony pad reporting a non-standard mapping (id contains `054c`): buttons 0 □, 1 ✕, 2 ○, 3 △,
  axes 0/1 stick, d-pad on axis 9 (hat) — map those to the same actions. Stick dead-zone 0.3.
- First gamepad = P1 (Gus). Second gamepad (or IJKL + U feed + O breathe on the keyboard) = P2 Biffy when
  co-op is on. Pressing Options on a second pad turns co-op on.
- When a pad is in use, all on-screen prompts show PlayStation glyphs (✕ ○ □ △ drawn as coloured circles);
  with keyboard they show key caps; with touch they show the touch button icons. Track `lastInputKind`.
- Menu navigation by pad: the active overlay's visible buttons form a list; up/left = previous, down/right = next,
  ✕ clicks, ○ goes back. Visible focus ring. Rumble: if `gamepad.vibrationActuator` exists, short `dual-rumble`
  on blowout, ground-pound and boss hits (respect the "screen shake" setting).
- Test pads in headless Chrome by stubbing `navigator.getGamepads` (inject a fake standard pad); the family will
  test the real PS4 pad. Say so in the report.

## The belly model (`belly.js`)

Physics constants (shared with `game.js`): tile 32, gravity `G = 1900` px/s², rising gravity while jump is held
`Grise = 1350`, max fall 950, ground accel 1800, air accel `1200 × air`.

State: `vit` 0–100 (start 55), `pres` 0–100 (start 10), timers `heavyT boostT crashT cleanT steadyT sightT
freezeT hoverT`, `butterflies`, `hungerT`, `recent` (last foods with time), `t`, `rng` (seedable for tests).

Fill multiplier `fill = 1.35 − 0.007 × vit` (vit 0 → 1.35, 100 → 0.65): **eating well makes pressure fill slower.**
Every positive pressure gain (food or feeling) is multiplied by it.

| id | kind | vit | pres | extra |
|---|---|---|---|---|
| broccoli | veg | +20 | 0 | |
| carrot | veg | +18 | 0 | |
| corn | grain | +10 | +5 | hover 6 s |
| beans | grain | +10 | +8 | hover 6 s |
| banana, apple, cherries, blueberries | fruit | +12–14 | 0 | speed boost 2.5 s, no crash |
| tomato | fruit | +12 | 0 | |
| fish (whitefish) | fish | +14 | 0 | brain sight 10 s (hidden `H` platforms glow) |
| yogurt | ferment | +16 | +2 | microbe event: a Gut Bug family moves into the village |
| water | water | 0 | −25 | steady 6 s (blast wobble × 0.4) |
| soda (ginger ale), candy | sugar | 0 | +24 / +20 | dash 3 s (speed × 1.45) then crash 2.5 s (× 0.65), unless clean |
| paczki | sugar+grease | +2 | +22 | both |
| popsicle | cold | 0 | +10 | brain freeze: world (not Gus) at 0.4 speed for 3 s |
| coney, pizza | grease | +4 | +26 / +24 | heavy 10 s (heavy only while pres > 35) |
| chili | spice | +4 | +14 | fire: burp fireball forward + backward shove (vx −700, vy −500) after 0.5 s |
| snax (Beige Snax) | snax | 0 | +6 | nothing else; adds a grey squatter to the village |

Combos (from `recent`, within 10 s): banana → candy/soda = clean blast (pressure × 0.8, `cleanT` 8 s: wobble × 0.2,
no crash). chili → water = controlled fire (no backward shove). (Rice+egg+scallion is Japan; keep the table shape
ready for it.)

`tick(b, dt, {breathing})`: timers down; vitality drains 0.35/s but never below 15 by draining; breathing drains
pressure 30/s and lets one butterfly out every 0.6 s; each butterfly adds `1–4 × fill` pressure at random
0.7–1.5 s intervals; hunger: 35 s with no food → `hungry` event (game sends an "I'm so hungry" bubble);
`pres ≥ 100` → `blowout` event, then `pres = 18`, butterflies 0, `blowouts++`. Emit `state` events on change.

States (the body is the meter): springy < 35 ≤ round < 65 ≤ tight < 85 ≤ critical. Critical: gravity × 0.35
(Gus starts floating) and the foghorn loops.

Movement mods: run speed `205 × (1 + 0.45 v)` (v = vit/100) × boost × crash × heavy 0.75; jump height
`80 + 60 v` px (2.5–4.4 tiles; vit floor 15 keeps 2-tile steps always possible); air control `0.55 + 0.45 v`.

Blast stats: thrust `2700 + 900 v` px/s², max rise speed `480 + 160 v`, drain `26 − 9 v` pressure/s (eat well =
longer blast), wobble `(1 − v)^1.5` (× steady/clean). Wobble = random sideways force and nozzle angle jitter
up to ±35° × wobble. Toot hop (tap): needs pres ≥ 4, spends up to 7, `vy = −(380 + 120 v) × spent/7`.
If pres < 4, a sad tiny "pff" puff (no lift) so the button always answers.

Ground-pound: heavy, in the air, press down → vy 1300, breaks `C` tiles and crates, presses switches, stuns
nearby Snax Bots, screen shake.

### Balance tests (`belly.test.js`, `node --test`)

Add `reach(b)`: simulate a held blast from a jump with the constants above and return the peak height in px.
Simulate 150 s runs (dt 1/60, food encounter every 6 s, a small feeling every 20 s, seeded rng):

- **Healthy only** (veg/fruit/water, never junk): 0 blowouts, `reach` stays under the 8-tile sky (256 px).
- **Junk only, never breathes**: ≥ 2 blowouts.
- **Mixed** (eat greens, take junk when vit > 60, breathe when pres > 80, blast when pres > 60): 0 blowouts and
  max `reach` > 256 px, and its average wobble is lower than junk-only.
- No single food or feeling takes pressure from 10 to 100.
Run them and show the pass/fail counts from real output before claiming green.

## Level format (`data.js`)

Levels are built with small builder calls (no hand-counted ASCII): `ground(x0,x1,top)`, `block(x,y,w,h,ch)`,
`plat(x,y,w)` one-way, `put(x,y,ch)`, `food(x,y,id)`, plus config arrays. Coordinates in tiles, 18 rows unless
stated. Tile chars: `#` ground, `=` one-way, `B` block, `?` Snax crate (bonk from below or pound → food pops,
contents in `crates[]`), `C` cracked floor (pound only), `d` dirt patch (compost), `~` grease (slippery),
`v` saliva (liquid: slow, cools pressure 6/s), `U` tongue trampoline (bounce −900), `T` tooth, `X` Snax wall
(breaks to fireball, pound or a fast rocket hit), `H` hidden one-way (glows during brain sight).
Entities: `P` start, `S` checkpoint (lantern post), `G` goal (Snax machine lever; prologue: garden gate;
mouth: throat slide), `b` Gut Bug (trapped in a beige bubble), `e` Snax Bot, `h` Snax Drone/blimp, `A` lantern.
Config: `movers[]` (moving platforms: x, y, w, dx, dy, period), `prompts[]` (x, icon, voice line),
`feelings[]` (x trigger, kind), `crowd[]` (x0, x1), `patches[]` (plant per dirt patch: flower/stalk/tree),
`decor[]` (background objects), `chompers[]` (mouth teeth: x, w, period, phase), `theme`, `music`, `beige` start.

Guarantees for every stage: gaps ≤ 4 tiles on the main path, step-ups ≤ 2 tiles unless a plant, blast or
alternate route exists, every blast-only wall has unavoidable pressure food in front of it, and at least two routes
(ground/vitality and air/pressure) around each major obstacle. Pits: Standard respawns at the last checkpoint
(lantern tear +1); Little Guts bounces Gus back up. No lives, no game over, ever.

### Stage designs

**0 Prologue: Morning at Home** (120 wide; ceiling rows 0–1 indoors to x 84). Bedroom: start, toy box 2 tiles
(jump), "shoes on the wrong feet" bubble. Kitchen: counter 3 up with broccoli + banana ("greens = springy"),
cabinet shelf 4 up with a Gut Bug; table with ginger ale and candy, plus a soda on the floor in the path
(unavoidable); fridge wall 10 tall = **blast lesson** ("hold Blast"). Past the fridge: "the last waffle is gone!"
big bubble → belly tight → **breathe lesson** (rug, tuba warning, butterfly flies out) and water. Living room: TV
news shows the Baron ("beige cubes at Eastern Market!"), "I have to stop playing" bubble, lantern `A` on the coffee
table (Gus clips it to his backpack). Back yard: dirt patch → "blast over the dirt" → bounce flower grows →
fence 6 tall (flower or blast) → Gut Bug on the fence → garden gate goal.

**1 Eastern Market Mayhem** (≈170 wide): red-brick market sheds, striped awnings as one-way platforms, produce
crates, Snax Bots marching (stomp/blast/fire → they pop back into real food), dirt planters, crowd zone with the
fruit vendor (faints on blowouts), two checkpoints, 3 bugs (one on high awnings, one under a cracked floor reached
later with an ability — leave reachable in 1.0 via a stalk plant, one above the crowd needing a big blast).
Goal: unplug the Snax machine → colour floods back.

**2 The Coney Commute** (≈190 wide, 26 rows: cloud layer rows 2–6). Broken freeway overpass above a park. Snax
blimps drop grease puddles. Lower ground route: urban-farm greens and berries, chain springy jumps across
broken lanes (gaps 3–4). Vendor cart: coney dog + ginger ale → heavy waddle → ground-pound a cracked lane to a
shortcut, or one huge blast over traffic into the cloud layer (secret Gut Bug). Chili on the cart: fire burp
forward, shove backward into a hidden alcove with Michigan cherries. Planters: compost bounce flowers.

**3 People Mover Rooftops** (≈180 wide): rooftop hops at dusk, People Mover cars as moving platforms across wide
gaps, popsicle before the fastest train (brain freeze slows it), "That's too high!" bubble at the big drop →
butterflies → breathe or ride the wobble. Whitefish reveals an `H` path to a Gut Bug.

**4 Boss: The Assembly Line Golem** (46 wide arena, one screen-ish). Golem on the right (x 34–44), conveyor
from x 6 to 33 carrying beige Snax into its mouth. Vendor cart on the left respawns coney dogs and ginger ale.
Loop × 3: (a) Golem throws Snax cubes in arcs and slams (shockwave along the floor: jump it); (b) get heavy,
**ground-pound a conveyor joint** → it jams, Golem stalls, hatch opens; (c) **blast up** (girders at rows 10 and 6
help) and bump the hanging basket at row 1 → the **tomato drops on its red button** → it sneezes out coney dogs.
Each loop is a bit faster. After 3: it sneezes out every food it swallowed, turns colourful, waves. No hitting;
it is fed. Little Guts: no auto-run here, slower attacks.

**5 The Mouth** (≈130 wide): lower teeth as ground (`T`), gums between, tongue trampolines (`U`), saliva pools,
upper teeth chomp on a rhythm (chompers; caught = gently pushed out, tear +1). Foods: water, yogurt (first
family moves into the village), blueberries, tomato, banana, gummy candy, chili. Near the end a big molar closes
on Gus → scripted: **Biffy pulls him out** → cutscene → slide down the throat → the Gut Village (three lonely
huts). End-of-beta card.

## Systems

- **Compost:** blast exhaust particles and blowout splats that land on a `d` patch sprout its plant: flower =
  bounce pad (vy −820, growth 2+: −950), stalk = beanstalk of one-way leaves (3 + 2×growth tiles), tree = canopy
  platform that drops fruit every 8 s. **Gardens persist**: save `{stage: {patch: growth}}`; on replay they start
  grown, and each new sprouting raises growth (max 3, visibly bigger). Biffy can plant a seed on a patch:
  next sprout +1 growth.
- **Colour is health:** each stage starts beige from the first unlit checkpoint rightwards. Draw the world, then
  fill `[restoredX, camera right]` with beige `#d9c9a6` using `globalCompositeOperation = 'color'` at alpha 0.85.
  Lighting a checkpoint sweeps `restoredX` forward with a wave; popping Snax Bots adds small colour bursts;
  the goal floods everything. Gus, foods and UI draw after the overlay (always full colour).
- **Crowd:** people drawn behind the terrain in `crowd[]` zones; mood: cheer (good blasts, popped bots),
  scatter + hold noses + gas masks on Max (blowouts), point and gasp then chant "GUS! GUS! GUS!" after 3
  controlled blasts (≥ 0.7 s, no blowout). The same fruit vendor appears in every crowd and faints on blowouts.
  Store a crowd fandom value across stages (save) so the default mood shifts from horror to fandom.
- **Feelings:** thought bubbles with picture icons (no reading): shoes swapped, toy taken, bumped foot, hungry
  (empty plate), Grandma waiting (clock + Popo), too high (cliff + scared eyes, adds 2 butterflies),
  stop playing (game pad with ✕). Small +7, medium +12, big +22 (× fill). They drift toward Gus; dodge them
  or pop them with Biffy; three small ones creep up rather than spike.
- **Butterflies:** drawn inside Gus's belly as a swirl when present; breathing lets them out of his mouth.
- **Lantern:** after the prologue pickup it hangs from his backpack on a pendulum (angle + angular velocity,
  pushed by acceleration). Tears: blowout +1, pit +1, chomp +1 (max 3, drawn as rips); a checkpoint patches it.
  Stage finished with 0 tears = lantern sparkle; all Detroit stages tear-free = first lantern decoration (map).
- **Gut Bugs:** 3 per stage, trapped in beige bubbles; touch to free (chime, bug hops into Gus's belly). Saved by id.
- **Medals per stage:** Zen = no blowouts; Chaos = 3 controlled big blasts + a crowd chant (or a Snax Bot popped by
  a blast). Both shown on the results card; best kept in the save.
- **Co-op Biffy (P2):** flies freely within the screen; touching food holds it (one at a time), feed button
  throws it into Gus's mouth (P1 can't eat what Biffy holds); touching a feeling bubble pops it; breathe together
  = ×2 drain with a synced animation; feed button over a dirt patch plants a seed.
- **Modes:** Little Guts = auto-run right (stops at walls; jump/blast/breathe only), checkpoints every ~25 tiles,
  pits bounce back, slower bots and bubbles. Standard = default. Gut Check = meters shown, stick aims the blast
  (direction of thrust follows the stick, up ± 60°), tighter timings. Meters can also be switched on in settings.
- **Hunger:** "I'm so hungry" bubble from the model's hunger event.
- **Saves** (`localStorage` key `guts:1`, every access in try/catch): unlocked stages, medals, bugs, dex finds,
  gardens, lantern decorations, foods eaten counts, snax eaten, crowd fandom, settings, mode, co-op.

## Story (narrated; short sentences; check every line for double meanings when heard aloud)

Captions sit in a bar **under** the scene (never over play), stay up until the voice finishes plus 1.5 s; ✕/Space/tap
advances, a Skip button skips the scene. The game clock waits while the storyteller talks.

Intro (from New game): 1) The Baron's factory: "This is Baron Von Processo. He has never tasted anything real."
2) Machine squishes foods: "His Snax machines squish every food on Earth into the same beige cube. Crunch. Crunch.
Boring." 3) Baron: "Tacos? Beige! Noodles? Beige! Soon the whole world will taste like nothing!" 4) Gus's room:
"Meet Gus. Today he flies to Hong Kong for Grandma's Mid-Autumn feast." 5) "He made a paper lantern for Popo.
Now he just has to get there." 6) Belly gurgles: "Everything Gus eats, and everything he feels, goes into his
belly. And his belly makes him move!"

Before 1-1: map flies from home to Eastern Market; Baron on a billboard. Before boss: "I have to stop playing"
bubble on the way in (biggest bump), Golem reveal. After boss: Golem sneezes coney dogs, colour floods, crowd
chants; then **Popo calls** (phone ring, video-call frame): "Gus! Did you eat? … A coney dog. Okay. Did you eat
a vegetable? … The onions don't count. 食飯啦! Sik faan laa! Eat your rice!" Personalise from the save: if he ate
broccoli/carrot, "Broccoli! Good boy." instead of the onions line. Then a last stray Snax flies into his mouth,
he shrinks (cartoon logic) and is swallowed into his own belly → The Mouth. After The Mouth: Biffy: "Hi! I'm Biffy!
I live down here. Welcome to your Gut Village. It's a bit empty… Every new food you eat brings new neighbours!"
End card: "Next stop: Mexico! Coming soon." with Ko-fi, Tell a friend and "More from the App Shelf".

Voices: browser `speechSynthesis` (no recorded voices in 1.0 — there is no Kokoro venv on this Mac; recording
the lines is a 1.1 item). Queue lines, advance on `onend` with a gap and a watchdog, never `cancel()` before each
line. Narrator en-US (prefer an "Enhanced/Premium" voice if present), Popo: an older en voice + **Cantonese
phrases with a zh-HK voice** (Cantonese is the family's request in the brief, as in `mid-autumn/`; Traditional
characters with Jyutping as `<ruby>`), Biffy: higher pitch. Show a small "backup voice" tag (shelf convention).
Gus never speaks; his face and body carry it.

## Food Dex (80 slots)

Grouped: Detroit 12, Mexico 12, Japan 12, Taiwan 12, Hong Kong 12, Inside 10, Recipes 10. Findable in 1.0:
Detroit 12 + Inside 7; the rest show as locked silhouettes with their world's colour. Each card: drawn icon,
English, Traditional Chinese with Jyutping, one true fact, the power. Tap/✕ speaks the Cantonese name.

Detroit: coney dog 熱狗 jit6 gau2 ("Detroit's coney dog diners have been open for more than 100 years");
square pizza 方形薄餅 fong1 jing4 bok6 beng2 ("The first ones were baked in square steel pans like the ones used in
car factories"); pączki 波蘭冬甩 bo1 laan4 dung1 lat1 ("Polish donuts; Hamtramck lines up for them on Pączki Day");
Michigan cherries 車厘子 ce1 lei4 zi2 ("Michigan grows most of America's tart cherries"); apple 蘋果 ping4 gwo2
("Apples float because they are about one quarter air"); popsicle 雪條 syut3 tiu2 ("An 11-year-old invented it in
1905 by leaving his drink outside on a cold night"); ginger ale 薑汁汽水 goeng1 zap1 hei3 seoi2 ("The bubbles are
carbon dioxide, the same gas you breathe out"); sweet corn 粟米 suk1 mai5 ("Each strand of corn silk connects to one
kernel"); broccoli 西蘭花 sai1 laan4 faa1 ("A broccoli head is a bunch of tiny flower buds"); carrot 紅蘿蔔 hung4 lo4
baak6 ("The first carrots were purple or yellow, not orange"); whitefish 白魚 baak6 jyu2 ("Whitefish live in the
Great Lakes, right next to Detroit"); navy beans 白豆 baak6 dau2 ("Michigan is one of America's biggest bean-growing
states").
Inside: water 水 seoi2 ("Your body is more than half water"); banana 香蕉 hoeng1 ziu1 ("Bananas are berries, but
strawberries aren't"); gummy candy 軟糖 jyun5 tong2 ("Sugar gives fast energy that runs out fast too"); chili 辣椒
laat6 ziu1 ("Capsaicin tricks your mouth into feeling heat"); yogurt 乳酪 jyu5 lok3 ("Yogurt is milk that friendly
bacteria turned tangy"); blueberries 藍莓 laam4 mui2 ("One of the few naturally blue foods"); tomato 番茄 faan1 ke2
("Tomatoes are fruits because they hold seeds"). Beige Snax 米色零食 mai5 sik1 ling4 sik6 gets a special card
outside the 80 ("Fills you up. Does nothing.").
Double-check every character is Traditional and every Jyutping syllable before publishing.

## Art direction (all drawn in code, canvas 2D)

Chunky cartoon, thick dark outlines (`#2b1d14`, 3 px at logical scale), warm saturated colours, squash and stretch.

- **Gus** (hitbox 26×40, sprite ~50 tall, drawn from the feet): big round head, black messy hair tuft, determined
  eyebrows, big eyes that look where he's going; yellow-orange shirt that rides up over a round belly (belly button
  shows when round+); red sneakers; blue backpack with the red paper lantern on a string. Four belly states:
  springy (flat, bouncy idle bob), round (bulge, soft gurgle wobble), tight (penguin shuffle ±0.1 rad waddle,
  "oh no" face: wide eyes, puffed cheeks, panic squiggles), critical (floating, sweating, belly glowing). Breathing
  loop (eyes closed, chest in/out, blue cool puffs), relief face after a blast, blowout spin. High vitality: soft
  glow outline and a sparkle trail.
- **Biffy:** Y-shaped light-blue Bifidobacterium (`#7fd3ff`), two branch "ears", big eyes, bouncy.
- **Gut Bugs:** round blobs in many colours with cilia and eyes; families: Yogurt Bloomers (cream, sleepy),
  Kimchi Crew (red, loud), Natto Stringers (tan, tangled).
- **Baron Von Processo:** pear-shaped, beige suit, beige top hat, huge beige mustache, monocle, cane. Pompous,
  never scary. **Popo:** grey bun, round glasses, red cardigan, jade earrings, phone. **Golem:** boxy car-plant
  robot, hazard stripes, assembly arms, mouth hatch, big red button on its head, LED eyes. **Snax Bot:** beige cube
  on little legs with one grumpy eye and "SNAX" on it. **Snax Drone:** beige blimp with a mustache logo.
- **Food icons:** each food drawn as a vector icon, cached to small canvases (also used in the Dex via
  `toDataURL`). No emoji in play.
- **Backgrounds** (3 parallax layers each): home (wallpaper, sunny windows, kitchen, TV, family photos; yard with
  sky); Detroit market (Renaissance Center towers far, red-brick market sheds mid, striped stalls near);
  commute (freeway pillars, park trees, Ambassador Bridge far, Snax blimps); rooftops (dusk, skyline close,
  elevated People Mover track with a train passing); factory (gears, conveyor, beige haze); mouth (pink cave,
  uvula, glistening highlights); village (belly-pink sky, villi hills, huts).
- **Gross-o-Meter** (settings): Mild = rainbow sparkles, boing/whoosh sounds; Medium (default) = puffy tan-brown
  cartoon clouds, paint-like splats; Max = bigger green-brown clouds, more splatter, gas masks in the crowd,
  foghorn. Thanksgiving test applies.
- Particles: exhaust, dust, sparkles, splats (decals that fade), petals, confetti.
- HUD (canvas, minimal): lantern icon with tears, Gut Bug count (3 dots), bites found. Meters only in Gut Check or
  when switched on. On-screen prompts are glyph icons floating near Gus with the voice line.
- Accessibility: settings for screen shake, flashing (no white flashes when off), music volume, sounds volume,
  voice on/off, meters, game speed (100/80/60 %), colour-blind-safe meter colours. `prefers-reduced-motion` →
  shake off by default.

## Music and sound (`audio.js`, all original, Web Audio, started only from a button press)

Look-ahead scheduler (25 ms timer, 0.12 s horizon), 16 steps per bar. Buses: music (→ lowpass "brightness"
filter → gain) and sfx, both → compressor → destination. Instruments synthesised per note: bass (triangle + sub,
pluck), organ (detuned sines + square partial), brass stab (saw → lowpass envelope), uke pluck (triangle, fast
decay), glockenspiel (sine + high partial), marimba, tuba (saw → lowpass 600 Hz, slow attack), drums (kick sine
drop, snare/clap noise bandpass, hat noise highpass, tambourine noise highpass with jingle repeats).
Melody notation: `note/16ths`, `-` rest. Bass and pads generated from the chord per bar.

**Adaptive:** tempo × (0.94 + 0.0013 × vit), brightness filter 1200 + 80 × vit Hz; a tuba layer plays chord
roots on beats 1 and 3 with gain rising from pressure 30 upwards, plus "gurgle" percussion (low wobbling sine
blips) above 50; a blowout detunes the music −80 cents for one beat and bends it back.

1. **Title "GUTS!"** F major, 132 bpm. Chords F | Dm | B♭ | C | F | Am | B♭ C | F.
   `c5/2 f5/2 a5/2 g5/2 f5/4 c5/2 d5/2 | f5/3 e5/1 d5/2 a4/2 d5/6 -/2 | bb4/2 d5/2 f5/2 bb5/2 a5/4 g5/2 f5/2 |
   g5/4 -/2 e5/2 c5/4 e5/2 g5/2 | c6/2 a5/2 f5/2 a5/2 c6/4 a5/2 f5/2 | e5/2 a5/2 c6/2 a5/2 e5/4 -/2 c5/2 |
   d5/2 f5/2 bb5/2 d6/2 c6/2 bb5/2 a5/2 g5/2 | f5/6 c5/2 f5/4 -/4` (brass lead, organ, bass, drums).
2. **Home** G major, 100 bpm, uke strum + glockenspiel. G | Em | C | D | G | Bm | C D | G.
   `b5/4 d6/2 b5/2 a5/4 g5/4 | e5/4 g5/2 b5/2 e6/4 -/4 | c6/2 b5/2 a5/2 g5/2 e5/4 g5/4 | a5/6 f#5/2 a5/4 -/4 |
   g5/2 a5/2 b5/2 d6/2 g6/4 d6/4 | f#6/4 d6/2 b5/2 f#5/4 -/4 | e5/2 g5/2 c6/4 d6/2 c6/2 a5/4 | g5/8 -/8`
3. **Detroit (Motown feel)** C major, 116 bpm: tambourine 8ths, snare + clap on 2 and 4, syncopated bass, organ
   chords on the off-beats, brass melody. C | Am | Dm | G | C | Am | F | G.
   `e5/2 g5/2 -/2 a5/2 g5/4 e5/2 c5/2 | -/2 e5/2 a5/2 c6/2 b5/2 a5/2 e5/4 | f5/2 a5/2 -/2 d6/2 c6/2 a5/2 f5/4 |
   g5/6 a5/2 b5/2 d6/2 -/4 | c6/2 -/2 g5/2 e5/2 g5/2 c6/2 e6/4 | d6/2 c6/2 a5/2 e5/2 a5/4 -/4 |
   f5/2 a5/2 c6/2 f6/2 e6/2 c6/2 a5/4 | g5/4 b5/4 d6/4 -/4`. Rooftops: same song, dusk mix (more organ, softer drums).
4. **Boss** D minor, 144 bpm, driving 8th bass, clanks. Dm | Dm | B♭ | C | Dm | Dm | Gm | A.
   `d5/2 d5/2 f5/2 d5/2 a5/4 g5/2 f5/2 | e5/2 f5/2 e5/2 d5/2 c5/4 a4/4 | bb4/2 d5/2 f5/2 bb5/2 a5/2 f5/2 d5/4 |
   c5/2 e5/2 g5/2 c6/2 bb5/4 g5/4 | d6/4 a5/4 f5/4 d5/4 | e5/2 f5/2 g5/2 a5/2 bb5/4 a5/4 |
   g5/2 bb5/2 d6/2 bb5/2 g5/4 d5/4 | c#5/4 e5/4 a5/4 -/4`
5. **Inside** E minor, 92 bpm, squelchy wobble bass, marimba, random drip plinks. Em | G | C | B.
   `e5/3 g5/1 b5/4 a5/2 g5/2 f#5/4 | g5/3 b5/1 d6/4 c6/2 b5/2 a5/4 | c6/4 e6/4 d6/2 c6/2 b5/4 | a5/2 f#5/2 d#5/4 b4/8`
6. **Gut Village** C major, 84 bpm: one lonely ukulele, then layers by population (bass at 3 bugs, shaker at 6,
   flute melody at 9, accordion at 12; each microbe family adds its instrument). C | F | G | C | Am | F | G | C.
   `e5/4 g5/4 c6/6 -/2 | a5/4 f5/4 c5/6 -/2 | b4/2 d5/2 g5/4 f5/2 e5/2 d5/4 | c5/8 -/8 | e5/2 a5/2 c6/4 b5/2 a5/2 e5/4 |
   f5/2 a5/2 c6/4 a5/4 f5/4 | d5/2 g5/2 b5/4 a5/2 g5/2 d5/4 | c5/4 e5/4 c5/8`
7. Jingles: stage clear (own arpeggio fanfare), medal sting, checkpoint chime, phone ring (two-tone), map theme
   (title song, lighter mix).

**SFX:** the **signature blast** (brand sound: saw ~110 Hz with fast 28 Hz amplitude flutter, pitch up then down,
resonant lowpass, plus noise; sustained version while held, stop on release; Mild = whoosh + slide whistle),
toot, jump boing, land thud, chomp-crunch eat, gurgle (state round), **tuba** (tight), **foghorn** (critical,
two detuned saws ~55 Hz with vibrato), splat, bloom sparkle, bubble pop, breathe in/out swell, Gut Bug chime,
stomp, crowd cheer/gasp, chant claps, lantern-post light, lever unplug + power-down sweep, brain-freeze shimmer,
fire burp, ground-pound boom. The gurgle → tuba → foghorn ladder must be readable with eyes closed.

## Page, shelf and publishing (after the game works)

- Standalone page per `CLAUDE.md` step 2 (doctype, lang, viewport-fit=cover, description, og tags with
  `https://magicmakersfamily.github.io/apps/guts/cover.png`, inline SVG favicon, base styles, `← All apps` link).
- Bottom of page: `Version 1.0 (beta) · Launched <time datetime="2026-10-26">October 26, 2026</time>` + the shelf
  footer (feedback `../feedback/?game=guts&v=1.0`, bug link with `&kind=bug`, Tell a friend, Ko-fi line, no-data
  line). The end-of-beta card also shows Ko-fi, Tell a friend and "More from the App Shelf".
- Shelf: add an `<article class="tile" data-slug="guts">` to the Games panel in `index.html` with an inline SVG
  icon (Gus's round face + belly on a warm orange `--tint`), "Beta" pill, title `GUTS<span lang="zh-TW">大胃之旅</span>`
  (check wording), promise "Eat, feel, blast off around the world.", age "Ages 5+", About detail (2–3 sentences,
  tags, meta: ages 5 and up, progress saved, sound on), version line `Version 1.0 (beta) · Launched October 26,
  2026`. Bump the Games count 8 → 9. README games table row: `GUTS (beta) | guts/ | 1.0 | 2026-10-26`, plus the
  folder in the README layout. Feedback page: add `guts: 'GUTS'` to `GAMES` and the game choices. TRACKER.md:
  add open items (e.g. `guts-F1` recorded voices, `guts-F2` Belle Isle Breeze + Mexico, `guts-B1` real PS4 pad
  untested on Safari/Firefox).
- Cover: `index.html#cover` renders a posed scene (Gus mid-blast over Eastern Market, crowd cheering, title) and
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars
  --window-size=1200,744 --virtual-time-budget=4000 --screenshot=guts/cover.png <file>`.
- Test before shipping: `node --test guts/belly.test.js`; serve the repo (`python3 -m http.server`), drive throwaway
  Chrome over CDP (`--user-data-dir` temp, `--remote-debugging-port`): no console errors on load, title → each
  stage loads, Gus moves/jumps/blasts/breathes with keyboard and with a stubbed standard gamepad, a stage can be
  completed (debug: `?stage=N` and a dev-only `?warp` to the goal), screenshots of each stage at 1280×720 and a
  400 px-wide phone viewport. Look at the screenshots.
- Git: repo has unrelated uncommitted work (`blow-up/PLAN.md` modified, `aquarium/PLAN.md` untracked) — do not
  stage those. Pull first. `git config user.email` must be the magicmakersfamily noreply address. Commit only
  `guts/` (minus the brief/prototype), `index.html`, `README.md`, `feedback/index.html`, `TRACKER.md`. Tag
  `guts-v1.0`, freeze with `tools/freeze-version.sh guts 1.0 guts-v1.0`, add a row to `versions/index.html`,
  push to `main`, then poll `https://magicmakersfamily.github.io/apps/guts/` until 200 and it contains
  "Version 1.0 (beta)".
- Update the App Shelf memory note (`project_game_shelf.md`) with the new game, its version and anything learned.

## Build order (each step runnable before the next)

1. `belly.js` + `belly.test.js` → green (show counts).
2. `index.html` shell + `game.js` core: canvas/camera, input (keys, pads, touch), Gus physics with placeholder
   art, the prologue level. Playable.
3. `art.js`: Gus with all states and the lantern, tiles, home background, food icons. Then the other themes.
4. Systems: compost + persistence, crates, Snax Bots, bubbles + butterflies, checkpoints + colour overlay, goal.
5. Stages 1–3, then the boss, then The Mouth.
6. `audio.js`: songs, adaptive layers, SFX.
7. Story cutscenes, narration queue, Popo call, Biffy, village, dex, map, results, settings, co-op.
8. Polish pass (feel: coyote time 0.1 s, jump buffer 0.12 s, variable jump, landing squash), phone layout, cover,
   shelf entry, test, publish.
