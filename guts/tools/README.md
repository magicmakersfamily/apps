# GUTS browser checks (dev only, not shipped in frozen copies)

Run them all with `node tools/check.mjs` (quick) or `node tools/check.mjs --full` from the repo root; see
`tools/play/README.md`. Each script also runs on its own and serves the repo itself (no separate server).
`BROWSER=chromium|firefox|webkit` picks the browser, `SEED=n` fixes `Math.random`.

```
node guts/tools/smoke.mjs --browser all   # real click on Play, real arrow key moves Gus, phone screen has no sideways scroll
node guts/tools/route.mjs                 # plays "Morning at Home" start to gate with real physics, jumps only, at the lowest vitality
node guts/tools/ai-taps.mjs               # ?ai=1: on-screen buttons by mouse, single key taps through the first room
node guts/tools/ai-bot.mjs                # an AI-style helper finishes the level with single key taps, steered by GUTS.ai.nextHop
node guts/tools/personas.mjs              # four play styles x 3 seeds; --persona james --seed 7 --browser webkit replays one run
node guts/tools/replay.mjs <file>|--latest  # replay a real playtest recording (see ../PLAYTEST.md), report with pictures
node guts/tools/replay.mjs --tests        # replay every saved playtest in guts/tests/playtests/ and check its "expect"
node guts/tools/record-check.mjs          # records a real-time session with ?playtest=1, saves it, replays it: must be exact
```

**Recordings** (`guts/playtest.js`, on with `?playtest=1`) keep, per try, the frame times (to 0.1 ms), the inputs the
game reads in each update (`GUTS.playtest.inputRow`), the seed and a copy of the save. Gameplay randomness comes from
`Game.rand`, one seeded stream reseeded by every `Game.begin` (sound, art and screen shake keep `Math.random`), so a
replay is exact; checkpoints every 30 frames detect drift. Recordings replay exactly across Chrome, Firefox and
WebKit. `watch.js` holds the per-frame checks that personas and replays share.

**Personas** are behaviour policies, not children: `james` (Little Guts, PlayStation pad, mashes jump, wanders back,
gets distracted), `explorer` (roams, pokes things, heads for the gate late), `speedrunner` (holds right, jumps
every wall and gap), `cautious` (pad, short steps, breathes when full, backs off when stuck). Each run is a
fixed-timestep simulation inside the real page (`GUTS.Game.step(1/60)`, the page's own loop paused), so the same
persona + seed gives the same run in every browser. Every frame checks for broken states (exceptions in update or
draw, NaN, Gus inside a wall or outside the level, pressure over 100 for more than 3 frames, a scene that never
ends) and logs design data (20 s stalls, falls, blowouts, the stuck helper's snacks).

`route.mjs` plans a route with the same walkability rules as `levels.test.js`, then executes every hop with several
start positions and jump timings, so a pass means a human has room to succeed. `cdp.mjs` is now a thin wrapper
over the shared Playwright harness (`tools/play/harness.mjs`); the name stayed so older notes still work.
The model tests run with `node --test guts/belly.test.js guts/levels.test.js`.
