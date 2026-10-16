# Blow Up — playtest notes

## How to run it

- **Play:** open `index.html` in a browser (or https://magicmakersfamily.github.io/apps/blow-up/ once
  published). No install, no build. It needs `content.js`, `sim.js`, `css/game.css` and `js/*.js`
  next to it, so serve the folder (`python3 -m http.server`) rather than double-clicking if your
  browser blocks local scripts. Since PLAN B1, the game's own code that used to be inline in
  `index.html` (drawing, sound, cards, modals, the loop) lives in `js/*.js`, loaded as plain
  `<script src>` tags in the order the game needs them — see the file list in PLAN.md.
- **Engine tests:** `node --test` in this folder (Node 18 or newer, nothing to install). Includes
  `tests/golden.test.js`, a snapshot of both day styles × every `balance.js` strategy × 5 seeds
  (end pressure, blow-ups, phase sequence, jars, skills, receipt). If it fails after a deliberate
  engine change, regenerate it and say why: `UPDATE_GOLDEN=1 node --test tests/golden.test.js`.
- **Browser smoke test:** `node tests/smoke.mjs` (Node 22+, needs Google Chrome; no
  npm install). Drives the real page in headless Chrome over CDP with real mouse clicks: start →
  pick the Rushed school day → the first Say It Differently choice → taps Uh-oh cards to a
  blow-up → all five recovery stages → bedtime → the receipt → a saved day in `localStorage`.
  Screenshots land in `tests/out/` (gitignored) even on failure. Fails on any JS console
  error/exception or a file that fails to load. Takes about a minute. Add `DEBUG=1` to see each step.
  Step 5b taps a card while another is in the air, right before a Say It Differently pop-up, and
  checks the waiting card still plays after the choice (KNOWN-BUGS B2; it fails on 1.3's code).
  Step 5c fakes the tab going hidden for 3 s and checks the clock didn't move and the "Tap to
  continue" button is shown, then taps it (KNOWN-BUGS B1; it fails on pre-C2 code). Step 5d taps
  Flower and candle then clicks Skip, and checks neither the used nor the practised count moved
  (KNOWN-BUGS B4; it fails on pre-C3 code). Step 6b waits for the meter to say "Sleeping" right
  after the day ends (KNOWN-BUGS B5; it fails on pre-C4 code). The run also fails if any line
  played during it has no recorded clip (`BUDebug.voice().missing`; KNOWN-BUGS B3). Step 2b checks
  predict mode's default-on bucket-picture pop-up once, then turns it off (Settings) so the rest of
  the script's direct card taps behave as they did before predict mode was the default (PLAN C6).
  - It uses the `#debug` hook (`window.BUDebug`, only present with `#debug` in the URL) to read
    state (`state()`, returns the raw sim state) and skip quiet stretches (`ff(n)`, steps the
    engine directly without the UI); `voice()` returns the narration-fallback counters, and
    `loop()` exposes the frame loop's internal flags (`running`, `phase`, `clockPhase`, `narrHolding()`, …) for
    debugging why the clock isn't advancing. None of it is reachable without `#debug`.
  - Gotcha: the script serves the folder itself with Node. `python3 -m http.server` has a listen
    backlog of 5 and resets connections when the page fetches its 13 scripts and 10 voice files at
    once; a failed `<script src>` shows no JS error, the game just never starts. (Fine for playing
    by hand, flaky for automated runs.) Ports are picked fresh each run so a leftover browser from
    an earlier run can never answer instead.
  - Gotcha: a background browser tab gets `requestAnimationFrame` throttled by Chrome, which the
    game's clock depends on — the script calls `Page.bringToFront` after connecting. A modal (like
    the day picker) sits above the header, so clicks on header buttons (voice, speed) only land
    once it's closed.
- **Balance run:** `node balance.js` prints each day style × strategy × 8 seeds.
- **Cover image:** open `index.html#cover`.

## A day at a glance

Pick a day (Rushed school day or Child-led adventure day) → Pip lives 7:00 to 20:00 → drag 😬 Uh-oh
cards (trouble) and 💙 Helper cards (help Pip feel better) onto the scene. A tap works too. The
game pauses for "Say It Differently" moments. When the bucket overflows, Pip blows up. Then the
"After the storm" tray appears: Storm → Cooling down → Coming back → "No wonder!" screen → Fix it →
Grow. Bedtime ends the day with a lullaby and a Cost of the Day receipt. It takes about 7 minutes
at 1× without pauses, and 10 to 15 minutes with play.

## Playtest: ChatGPT, full Rushed school day on 1.3 (2026-09-28)

An automated full playthrough, 7:00 to 20:00, with one blow-up and the whole recovery. What it
found (checked against the code in KNOWN-BUGS.md):

- The day ran on from about 10:20 to 17:05 while it wasn't watching (B1).
- A card tap can be lost when a scheduled choice pops up (B2, confirmed in code).
- The backup browser voice was heard around Hug and Calm corner (B3, not yet reproduced).
- Flower and candle during recovery took 22 off the bucket, yet "Skills practised" was 0 (B4).
- Pip fell asleep at 69/88, still labelled "Almost boiling" (B5).
- The "Cost of the Day" receipt is text-heavy for pre-readers and feels like accounting (B6).
- Predict mode was one of the strongest moments but is hidden in Settings (B7).
- About 25–30 cards on screen at once is too many for a 4–7 year old. A full day is long for the
  youngest players, so short chapters would fit better.
- It kept: the bucket, Guard Dog and Wise Owl, "Blowing up isn't losing…", hidden pressure,
  grown-up language comparisons, the grown-up saying sorry, "No wonder", looking under anger, the
  five recovery stages, specific praise, repair together, local-only saving.

What we decided to do about it is in DECISIONS.md (2026-09-28) and PLAN.md. The next real test is
James playing one guided chapter (PLAN D8).

## Version 1.2: natural voices, more motion, calmer tapping

- **Recorded voices.** Every line is pre-recorded with Kokoro, an open-source neural voice
  (Apache-2.0) run locally: the storyteller (`af_heart`), Pip (`af_bella`, pitched up), the grown-up
  (`bf_emma`) and Professor Pickle (`bm_fable`, pitched up). Mandarin words use the macOS Taiwan voice
  "Meijia". Lists (what went wrong, the receipt) are recorded pieces played in a row. Any line
  without a recording falls back to the browser's voice.
  - Files: `voice/<speaker>-<n>.mp3` (a speaker's clips joined, in ~1.5 MB pieces) and
    `voice/manifest.json` (which piece and where each clip starts). About 600 clips, 10 MB, 64 kbps.
  - Quality notes: loudness is levelled with a plain gain (a one-pass loudness filter made short
    clips pump), and Pip and Professor Pickle are raised in pitch by resampling only (time-stretching
    made them warble).
  - If a recording can't load, the browser's voice reads the line and the storyteller bar shows
    "🤖 backup voice". Settings (⚙︎) has "🔊 Test the voices" and a status line saying how many lines
    came from recordings.
  - To re-record after changing a line in `content.js`:
    `node tools/voice-lines.js` then `python tools/render-voice.py <kokoro-model-dir>` (needs
    `pip install kokoro-onnx soundfile`, ffmpeg, and `brew install espeak-ng`). Unchanged lines are reused.
    To try a different voice, change `VOICES` in `tools/render-voice.py`, delete `tools/.cache`, re-run.
- **Moving mouths.** Pip's, the grown-up's, Professor Pickle's and the storyteller sun's mouths move
  with the loudness of their own voice. Everyone blinks.
- **Motion.** Cards fly to Pip, and drops fly from Pip into the bucket. Helpers make bubbles rise
  out of the bucket and bring the grown-up walking over (with hearts for a hug). Pip flinches,
  relaxes and hops, and walks in when going somewhere new. Each new place opens like an iris, and a
  blow-up shakes and flashes the screen. There are also swaying trees, drifting clouds, birds,
  butterflies, a moving swing, a ticking classroom clock, a bumpy bus, rising bath bubbles, a sloshing
  bucket, marbles dropping into jars, and a wobbly bucket when it's nearly full.
- **Rapid tapping.** One card at a time. Taps on the same card while it flies add up to one go
  (up to ×5), and each extra tap counts for less. The engine also makes any card used again within a
  few minutes work less ("getting used to it", half-life 10 sim-minutes). One more card can wait its
  turn; further taps get a little "nope" wiggle. The storyteller never repeats the same line within
  about 10 to 20 seconds, and a new card's reaction replaces the last card's unfinished one.

## Version 1.1: the storyteller (for kids who can't read yet)

- A storyteller voice is on by default (📣 Voice in the top bar turns it off). It introduces every
  scene, explains each card the first time it's used, says what went wrong when something backfires,
  talks through each stage of a blow-up, reads the "No wonder!" screen and the bedtime receipt, and
  reads both ways of saying it at "Say It Differently" moments.
- Pip, the grown-up and Professor Pickle have their own voice pitches, so James can tell who's
  talking without reading.
- While the storyteller introduces a scene or a blow-up stage, the clock waits, so the story never
  runs ahead of the voice.
- The first day starts with a spoken tour that highlights each part of the screen (❓ replays it).
- Tap Pip, the grown-up, the bucket, a jar, the head window or the clock to hear about it.
  🔁 repeats the last line. Every pop-up has a 🔁 hear-it-again button, and each choice has a 🔊.
- 🐢 slow speed (½×) for a calmer pace. After a blow-up, the cards that work right now glow.
- The first tap (the big ▶) unlocks sound and speech, because browsers only allow speech after a tap.
- All storyteller lines live in `content.js` (`NARR`, `NARR_SCENES`, `CARD_NARR`).

## What to watch for when a 5-year-old plays

1. **Does he try to make Pip blow up first?** Most kids will. That's fine and expected. It's the
   point of the Uh-oh tray. Watch whether he then *switches* to helping without being told.
2. **The "No wonder!" moment.** On the validation screen, does he connect the icons to what
   happened ("the sock!", "the cookie!")? Ask: "Why do you think Pip blew up?" Listen for more than
   one cause.
3. **The cookie.** When the broken cookie tips the bucket, does he get that it wasn't really
   about the cookie?
4. **Words bounce off.** Does he notice that the lecture, "Calm down!" and the silly voice in red
   make things worse? Does he start picking breathing, stomping or naming feelings instead?
5. **Say It Differently.** Does he choose the bossy option on purpose to see the puppet strings?
   Does he like snipping them?
6. **Skills.** After practising the flower breath or dinosaur stomp while Pip is calm (six times
   each), Pip starts using them on their own. Does he notice the sparkle and "I did it myself!"?
7. **Stopping at bedtime.** Does the lullaby and receipt feel like an ending? Can he stop without
   a fight, or does he ask for another day straight away? ("Play another day" is quiet on
   purpose, and nothing autoplays.)
8. **Reading.** Is anything blocked because he can't read it? The storyteller should carry it. Note
   any moment where he looks lost or asks "what does that say?", and which screen it was.
   Is the storyteller too chatty? Tell us which lines he tunes out.
9. **Scary or shaming?** Watch his face during a blow-up. It should be funny, not upsetting. If it
   upsets him, switch on 🐢 Less motion.

Grown-ups: open **Grown-Up View** for the load breakdown, cortisol, the equation and the science
cards. The **Compare days** button on the receipt puts two saved days side by side.

## Tuning knobs

All in `sim.js` → `CONFIG`, plus the content numbers in `content.js`.

| Knob | Default | What it does |
|---|---|---|
| `DECAY` | 0.003 | Share of the bucket that settles on its own each minute |
| `THRESH_*` | 60 / 2 / 1 / 1 | Threshold = 60 + 2·My Choice + I Can Do It + Together |
| `ZONE_YELLOW`, `ZONE_RED` | 0.40, 0.75 | Zone boundaries |
| `HUNGRY_AT`, `HUNGRY_SPIKE`, `HUNGRY_DRIFT` | 180 min, ×1.5, 0.08/min | Hunger |
| `TIRED_HELP`, `TIRED_DRIFT` | ×0.5, 0.03/min | Tiredness |
| `RUSHED_CONTROL` | ×1.3 | Rushing makes bossy moments hit harder |
| `CHOICE_SPIKE_CUT`, `TOGETHER_HELP_BOOST` | 30%, 30% | Jar effects |
| `REACTANCE` | ×1.25 | Pushback when My Choice is empty and pressure is high |
| `CORTISOL_BLOWUP`, `CORTISOL_DECAY`, `CORTISOL_FLOOR` | 35, 1.2%/min, 0.6 | How long recovery takes |
| `CORT_TALK`, `TALK_SPIKE` | 30, 14 | When talking tools bounce off, and how hard |
| `PHASE_TIMEOUT` | 15/40/30/20/15 min | Safety net so recovery never gets stuck |
| `MASK_HOLD`, `MASK_EFFORT` | 1.15, 0.04/min | Masking at school; restraint collapse after |
| `STRINGS_AT`, `FLAT_JAR`, `FLAT_MINUTES` | 3, 1, 30 | Puppet strings and Flat Mode |
| `XP_PER_LEVEL`, `SELF_USE`, `SELF_COOLDOWN` | 2, 80%, 30 min | Skills and self-use |
| `ADULT_CALM`, `ADULT_STRESSED`, `WAVE_BLUE`, `WAVE_RED` | 30, 60, 0.06, 0.08 | Co-regulation |
| `CHAOS_P`, `CHAOS_GAP` | 0.4%/min, 60 min | Random happenings |
| `HABIT_HELP`, `HABIT_UHOH`, `HABIT_HALF` | 0.6, 0.35, 10 min | Repeats work less; how fast that wears off |
| `MS_PER_MIN` (index.html) | 500 ms | Real time per sim-minute at 1× |

Balance at the time of writing (`node balance.js`, 8 seeds; averages):

| Day | No input | Good support | Unhelpful (lectures, "Calm down!", bossy phrasing) |
|---|---|---|---|
| Rushed school day | 1.25 blow-ups, peak 114% | 0 blow-ups, peak 34% | 4 blow-ups |
| Child-led adventure day | 0 blow-ups, peak 58% | 0 blow-ups, peak 12% | 2.25 blow-ups |

No style is tuned to win. The adventure day does better with no help because the model gives it
more sleep, movement, nature and choice. It still has failure modes (a lonely afternoon, leaving the
park, a late lunch), and unhelpful play makes it go badly.

## Known limits (MVP)

- Two playable day styles; the other five are described in `content.js` but have no scenes yet.
- One kid (Pip: loves hugs, calms with movement, hates loud noise). A second profile (Rio, needs
  space) exists for tests.
- Combos (recipe book) are not built yet; the engine's event log is ready for them.
- "Save picture" on the receipt is blocked inside the claude.ai preview but works on the shelf.
