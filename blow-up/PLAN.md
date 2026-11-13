# Blow Up — plan for 1.4 and 2.0

This file is the handoff between sessions. Read it together with `CLAUDE.md` (in this folder),
`DECISIONS.md` and `KNOWN-BUGS.md`. **Do one task per session**, in order, and tick it off here in the
same commit that finishes it. If a task turns out bigger than described, or needs a decision that
isn't in DECISIONS.md, stop and ask.

Status: ☐ to do · ◐ in progress · ☑ done

## Where we are (2026-09-28)

- 1.3 is live at `blow-up/`. It's tagged `blow-up-v1.3` and frozen at `versions/blow-up/1.3/`
  (1.2 is there too).
- The engine (`sim.js`, `content.js`) has 21 tests (`node --test`) and a headless balance run
  (`node balance.js`).
- `index.html` is about 2,300 lines: CSS, SVG art and all the game UI in one IIFE. It has a
  `#debug` hook (`window.BUDebug`: `state()`, `ff(n)`, `voice()`).
- Voice re-recording needs Kokoro set up again: the model and venv from the 1.2 session are gone
  (task A3).

## Phase A: safety net (no behaviour changes)

**☑ A1. Golden-run snapshot of the engine.**
Add `tests/golden.test.js`. It runs `SIM.runDay` for both playable day styles × every strategy in
`balance.js` × seeds 1–5, reduces each run to a compact summary (end pressure, blow-up times and
types, phase sequence, jar totals, receipt lines, skills xp), and compares it with a committed
`tests/golden.json`. `UPDATE_GOLDEN=1 node --test` rewrites the file.
- Files: `tests/golden.test.js`, `tests/golden.json`. Nothing else changes.
- Done when: `node --test` passes, and changing any number in `sim.js` `CONFIG` makes it fail.

**☑ A2. Scripted browser playthrough (smoke test).**
Add `tests/smoke.mjs`: a Node script with no dependencies (Node 26 has a built-in `WebSocket`). It
starts `python3 -m http.server` and headless Chrome with a throwaway `--user-data-dir` and
`--remote-debugging-port`, then drives the real page over CDP with real clicks
(`Input.dispatchMouseEvent`). It uses `#debug` + `BUDebug.ff()` to skip quiet time. Steps: start
screen → ▶ → first Say It Differently choice → play Uh-oh cards until a blow-up → through all
recovery stages with helper cards → bedtime → receipt visible → a saved day in localStorage. At each
step it takes a screenshot into `tests/out/` (gitignored). At the end it prints `BUDebug.voice()`
stats and fails on any JS error in the console.
- It may add read-only fields to the `#debug` hook (phase, which modal is open). No other changes.
- Done when: `node tests/smoke.mjs` passes on 1.3 twice in a row and the screenshots look right.
  Note in PLAYTEST.md how to run it.

**☑ A3. Restore the voice pipeline.**
Set up kokoro-onnx in a venv at `~/.local/share/blowup-voice/venv`. Download the Kokoro-82M ONNX
model and voices file into `~/.local/share/blowup-voice/model` (check `tools/render-voice.py` for the
file names it expects), plus `brew install espeak-ng` and ffmpeg if they're missing. Render all
lines. Because `tools/.cache` is gone, every line re-renders: compare 3–4 old and new clips, and send
the user a couple of samples before replacing `voice/`. Keep the settings in PLAYTEST.md (64 kbps,
plain gain, resample-only pitch).
- Add `tests/voice.test.js`: every entry in `tools/lines.json` has a clip in `voice/manifest.json`.
- Done when: the render reproduces the current bank (or the user approves the new one), the voice
  test passes, and the setup steps are written in `CLAUDE.md` (this folder).

## Phase B: split index.html (zero behaviour change)

**☑ B1. Mechanical split.**
Move code out of `index.html` without changing it:
```
blow-up/
  index.html        markup only + <script> tags in order
  css/game.css      the two <style> blocks
  js/art.js         the ART script (SVG strings)
  js/core.js        $, esc, constants, store, prefs, game state vars (top of the GAME IIFE)
  js/audio.js       SOUND + storyteller voice
  js/scene.js       SCENE, control room, particles, blow-up effects, thought bubbles
  js/meters.js      BUCKET, JARS, GRAPH
  js/cards.js       TRAYS, DRAG AND DROP, one card at a time, doUse
  js/events.js      EVENTS FROM THE ENGINE + PROFESSOR PICKLE
  js/modals.js      MODALS (say, pick, validate, breathing, predict, science)
  js/grownup.js     GROWN-UP VIEW
  js/ending.js      BEDTIME, RECEIPT, SAVED DAYS, COMPARE, stickers, menu
  js/main.js        START, LOOP, CONTROLS, tour, tap-to-explain, boot (last)
  content.js sim.js (unchanged)
```
Remove the IIFE. Top-level `const`/`let` in classic scripts share one global scope, so cross-file
references keep working. Keep `'use strict'` in each file. Move the code in small commits (CSS first,
then art, then one section at a time) and run A1 + A2 after each one.
- Watch for: code that runs at load time and uses something defined later (it has to stay in
  `main.js`); `COVER` / `#cover` rendering; `tools/voice-lines.js` (it reads `content.js`, which
  doesn't change).
- Done when: golden + smoke pass. Screenshots of `index.html#cover` and the smoke steps are
  pixel-identical to 1.3 at 1280×800 and 390×844. `grep -c "" index.html` is under 150.

## Phase C: P0 fixes, shipped as 1.4 (still the simulator)

**☑ C1. One game phase at a time + event queue** (KNOWN-BUGS B2). *Hardest task: use Opus, or Sonnet
at high effort.*
Add a single `phase` variable in `main.js`: `PLAY`, `MODAL`, `STORY` (the storyteller holding the
clock), `BLOWUP`, `BEDTIME`, `AWAY`, `PAUSED`. Transitions go through one function. The clock
advances only in `PLAY`. Every modal opens through one function that enters `MODAL` and returns to
the previous phase on close. Automatic moments (`S.pending`, predict, Pickle) wait in a queue while
another is open. A waiting card tap (`ACT.next`) survives a modal and plays after it. Every accepted
tap gets instant feedback (the existing pop/queued outline).
- Tests: extend the smoke run with a tap during a card's flight right before a Say It Differently
  moment, and check that the card still plays after the choice.
- Done when: the smoke run passes, including the new step. The existing flags (`paused`,
  `isModal()`, `freezeUntil`, `narrHolding()`) are expressed through `phase` or documented as feeding
  into it.

  - Done 2026-09-28. `phase` + `setPhase()` + `clockPhase(now)` live at the top of `js/main.js`
    (with a comment mapping every old flag). `paused` is gone (it's the PAUSED phase); pop-ups set
    MODAL through `openModal`/`closeModal` in `js/modals.js`, and self-opening ones wait via
    `whenModalFree()`. BLOWUP (`freezeUntil`) and STORY (`narrHolding()`) are computed each frame,
    not stored, because they end on their own. `running` still means "a day is loaded" (false on the
    splash/day picker). The card fix is `cardsFree()`/`playWaitingCard()` in `js/cards.js`. C2 only
    needs to `setPhase('AWAY')` on hide and back on the Continue tap.

**☑ C2. Pause when away** (B1).
On `visibilitychange` → hidden, or window `blur` for more than 2 s: enter `AWAY` and stop speech. On
return, show one big ▶ with the spoken line "Tap to continue Pip's day". No catch-up.
- Test: smoke step that dispatches a hidden `visibilitychange`, waits 3 s, and checks the clock
  didn't move and the continue button is shown.
  - Done 2026-09-28. `goAway()`/`comeBack()` in `js/main.js`, wired to `visibilitychange` plus
    `blur`/`focus` (the 2 s grace period is a `setTimeout` cleared on `focus`). `awayFrom` remembers
    PLAY vs PAUSED so a deliberate pause survives a trip away. Returning always shows the continue
    screen and waits for a tap — it never guesses that a visibility flip means "resume". No
    catch-up needed as a separate fix: `frame()` already re-anchors `last` every call, so `dt` is
    capped at 120 ms regardless of how long the phase wasn't PLAY.
  - New narration line `CT.NARR.misc.continueDay` ("Tap to continue Pip's day."), rendered with the
    existing pipeline (PLAN A3) — one line, reused the cache, no re-render of anything else.
  - Test: `tests/smoke.mjs` step 5c fakes `document.hidden`/`visibilityState` (headless Chrome has
    no working CDP hook for real tab visibility — `Emulation.setEmulatedVisibilityState` isn't in
    this build) and dispatches the real event, so it's exercising the actual listener. Fails on the
    pre-C2 code, passes on this code, 3/3 clean runs.

**☑ C3. Tools used vs practised** (B4, DECISIONS D7).
In `sim.js`, record each completed calming tool with its phase and zone. `SIM.receipt` returns
`used: {toolId: n}` next to `practice`. The receipt shows "Tools that helped" and "Practised while
calm". Flower and candle counts only after the breathing guide finishes. If it's closed early, it
counts as neither.
- Tests in `sim.test.js`: a completed breathe while cooling → `used.breathe === 1`, `practice`
  unchanged; breathe in green → both go up. Update `tests/golden.json` deliberately in the same
  commit and say why.
  - Done 2026-09-28. `s.usedTool` (`sim.js`) increments on any completed skill-tool helper use (any
    phase/zone), right next to the existing `gainXp` practice gate — the two are now tracked side
    by side instead of practice being the only signal. `SIM.receipt` returns `used` (per-tool
    counts) and `usedCount` (their sum). `js/ending.js`'s receipt shows both rows: "Tools that
    helped" (`usedCount`) and "Practised while calm" (the old `practice` count, relabelled — it was
    shown as "SKILLS PRACTISED" before, which is what made 0 read as a bug rather than "you didn't
    practise while calm today").
  - Flower and candle's "closed early counts as neither": `breathingGuide()` (`js/modals.js`) now
    tracks whether its 15.2 s animation actually finished; `start()` (`cards.js`) and `askPredict()`
    (`modals.js`) only call `launch()` — meaning `SIM.use()` is never called at all — when it did.
    Skip, the ✕, and Escape all count as not finishing.
  - `tests/golden.json` regenerated (`UPDATE_GOLDEN=1 node --test tests/golden.test.js`) after
    adding `used`/`usedCount` to the snapshot; diffed old vs new first to confirm every other field
    (pressure, blow-ups, phases, jars, existing receipt fields) was unchanged — only the two new
    fields appeared.
  - `tests/smoke.mjs` step 5d taps breathe, waits for the guide, clicks Skip, and checks neither
    `usedTool.breathe` nor `skills.breathe.xp` moved. Fails on the pre-C3 code (crashes reading
    `usedTool`, which didn't exist yet), passes on this code.

**☑ C4. Bedtime settles the bucket** (B5, D8).
During bedtime, animate the meter down toward an overnight level over the lullaby and show
"Sleeping 💤" instead of the zone label. Add one narration line for a day that ended high, e.g.
"Sleep helps Pip's body rest. Some big feelings might still be there tomorrow, and that's okay. Pip
will have help." Read it aloud for double meanings.
- Done when: the smoke run's bedtime screenshot shows Sleeping 💤, and the line is recorded (A3).
  - Done 2026-09-28. `js/meters.js`'s `drawBucket()` now checks the UI `phase` (not the engine's
    `v.phase`) first: whenever it's `BEDTIME`, the pill always reads "💤 Sleeping", whatever zone or
    storm stage the day ended on — it can't show "Almost boiling" next to a sleeping Pip anymore.
  - `settleBucketForSleep()` (`js/ending.js`) drains the *displayed* bucket over ~2.8s (an
    `requestAnimationFrame` loop feeding scaled-down `load`/`pressure` values into `drawBucket()`,
    eased, never below ~15% of threshold and never above where the day actually ended). This is
    display-only — `SIM.receipt`/the saved day log still hold the real numbers, so the day's record
    can't go dishonest.
  - `CT.NARR.bedtimeHigh` (content.js) plays only when `SIM.zone(S) !== 'green'`. Read it aloud
    (mentally and via the sample) for double meanings per the repo's own rule; none found.
  - `tests/smoke.mjs` step 6b waits for the pill to say "Sleeping" right after the day ends. Fails
    on the pre-C4 code, passes on this code.

**☑ C5. Narration audit** (B3).
Reproduce B3 with `BUDebug.voice().missing` and add the missing lines to `tools/voice-lines.js`. The
smoke run fails if `missing` is not empty. The "🤖 backup voice" tag shows only when grown-up
settings have "Show voice details" on. Re-render voices.
- Done 2026-09-28. B3 turned out not to be reproducible as "missing recording": a scripted sweep of
  every card × every phase × tap counts 1–3 (164 clips played, narrator unlocked, queue drained
  between batches) came back `fallback: 0, missing: []`, matching `tests/voice.test.js`. Nothing was
  added to `tools/voice-lines.js` since there was nothing missing to add — see KNOWN-BUGS B3 for
  what's left if the fallback tag is ever seen again (the network, or a bad clip, not the
  recordings).
- `tests/smoke.mjs` now fails the run if a real playthrough's `BUDebug.voice().missing` is
  non-empty (it was only logged before), so this stays checked going forward.
- The "🤖 backup voice" tag (`robotTag()`, `js/audio.js`) now only shows when `prefs.voiceDetails`
  is on — a new Settings toggle ("🤖 Show voice details", off by default; `js/ending.js`). Verified
  directly: hidden with the setting off even when a fallback fires, visible only with it on and a
  fallback, hidden again with it on but no fallback.

**☑ C6. Small 1.4 polish.**
Predict mode on by default, with the 😌/😠 faces replaced by two big bucket pictures (fuller /
emptier). A wrong guess says "Let's see what Pip's body does." with no score. The receipt is renamed
"Day log", "COST OF THE DAY" becomes "PIP'S DAY", and the narration lines are updated to match.
- Done 2026-09-28. `prefs.predict` defaults true (`js/core.js`). `askPredict()`'s two options
  (`js/modals.js`) are now `miniBucketSVG()` icons (new helper in `js/art.js`, a simplified cousin
  of the main bucket) labelled Fuller/Emptier, not faces — this is what the mechanic is actually
  teaching. A wrong guess plays the new neutral line, and its burst icon changed from ❓ to 👀 (no
  "you got it wrong" marker); the Grown-Up View's "Predictions right x/y" became "Predictions
  tried" (a count, not a score). Every "cost"/"COST OF THE DAY" string is gone — the receipt title
  is now `PIP'S DAY`, the modal intro says "Here's the day log", and the share-sheet text, the
  receipt-PNG heading and the opening narration line all match.
  - Three narration lines changed content and were re-rendered (reused the cache for everything
    else): the predict question (now bucket-worded), the wrong-guess line, and the receipt's
    opening line. Read for double meanings; none found. I can't listen myself — samples were sent.
  - Predict mode being on by default changes every card tap (it now opens a choice pop-up first),
    which broke most of `tests/smoke.mjs`'s later steps (they assumed a tap plays a card
    immediately). Added step 2b: verifies the bucket-picture pop-up once, right after the day
    starts, then turns predict mode off through the real Settings toggle so the rest of the script
    — which is about other things — keeps working the way it did before this change existed.
  - 25/25 tests, 3/3 clean smoke runs.

**☑ C7. Release 1.4.**
Run everything, follow the shelf's release steps (version line, README table, feedback links,
`VERSION`), tag `blow-up-v1.4`, run `tools/freeze-version.sh blow-up 1.4 blow-up-v1.4`, add the row
to `versions/index.html`, push, and verify the live site.
- Done 2026-09-28. Version line bumped in four places (the shelf card, the game's footer and
  feedback links, `VERSION` in `js/core.js`) plus the README table; launch date unchanged, per the
  shelf's convention. Tagged `blow-up-v1.4`, frozen at `versions/blow-up/1.4/`, added to
  `versions/index.html`. All 25 tests and a clean smoke run before every commit in this phase.
  Verified the frozen copy actually works end to end (the smoke harness pointed at it, all steps
  pass) — a first screenshot attempt looked broken, which turned out to be `python3 -m
  http.server`'s 5-connection backlog, not a real bug; see the freeze commit. Live site confirmed
  serving 1.4.

## Phase D: P1, the guided redesign, shipped as 2.0

Build D1–D7 behind `?v2` (or a grown-up setting) so 1.4 stays playable on `main` until 2.0 ships.
Each task: new lines recorded, smoke run extended, screenshots checked at 390×844 and 1280×800.

**☐ D1. Body signals layer.** Animated clues on Pip, driven by the sim state: heart pulse speed,
faster breathing, fists, warm face, raised shoulders, and a "gone quiet" look (Pip can go quiet, not
only loud). Also background clutter/noise that grows with sensory load. Visual only, respects less
motion. Tapping a clue plays a short line, with a varied voice ("Pip's hands are getting tight",
"The grown-up notices it", "It's a very small clue").

**☐ D2. Guided loop.** For each scene `fx` event with `amount ≥ 5`: **Notice** (tap a body clue, or
"nobody notices yet") → **Predict** (fuller/emptier bucket) → **Watch** (the existing drop
animation, dog/owl reaction) → **Understand** (one short line; add `why` text to the scene events in
`content.js`). Say It Differently moments are the **Choose** step (two big picture buttons). At most
3 child choices on screen. Familiar events skip Notice/Predict after the second time. In guided
mode, quiet stretches run at 4× with a spinning clock. Free play (the 1.4 card wall) stays as a
start-screen choice.

**☐ D3. Chapters and saving.** Add `chapters` to the rushed and adventure day styles in `content.js`
(e.g. Morning rush 7:00–8:00 · School 8:00–15:00 · After school 15:00–16:45 · Dinner and bedtime
16:45–20:00). Show a chapter-end card (spoken, 2 pictures of what happened), save, and continue or
stop. Resuming restores the exact state (D5 in DECISIONS). The day picker appears after chapter 1 of
the first day.

**☐ D4. First-run onboarding.** Big ▶ → Pip says hello → "Tap Pip's heart" (pulses, responds) → one
drop falls into the bucket → "Fuller or emptier?" → chapter 1 starts. Target: a non-reader makes the
first real choice within 30 s. The old tour stays on ❓.

**☐ D5. Recovery by stage.** In guided mode each stage shows only its 2–3 tools (Storm: stay close,
few words, "I'm here". Cool: water, stomp, flower and candle, calm corner. Reconnect: name it, wish
it, space-or-company. Repair: grown-up says sorry, fix it together, check on others. Grow: specific
praise, practise a tool, plan for next time). Put the lists in `content.js`. After a Cool tool: "Did
that help?" [Yes, a little] [Not this time]. "Not this time" offers a different kind of tool.

**☐ D6. Child ending + grown-up summary.** Three spoken picture panels and the end actions (D9), and
the plain four-list grown-up summary with the numbers behind "How the game's model works" (D10). The
Day log stays in the grown-up area.

**☐ D7. Child header + grown-up area.** Header per D11. Press-and-hold grown-up button. Check
320×568, 390×844, 768×1024, 1024×768 and 200% zoom: no clipped dialogs, and targets at least 48 px.

**☐ D8. Playtest with James, then release 2.0.** Watch one chapter in guided mode, write notes in
PLAYTEST.md, fix what matters, then release as in C7 (tag, freeze, versions row, beta badge stays).

## Backlog (P2/P3, not scheduled)

Interactive calming activities (trace the flower breath, tap the dinosaur stomp to a slowing beat,
squeeze-and-release, drag the water cup) · connection choice (hug / hand / nearby / space) · Pip's
toolbox and stickers · customise Pip · more chapters (playground transition, child-led adventure) ·
preferred-tool discovery · visual narration for Deaf pre-readers · switch/keyboard pass · more
languages · other family structures and caregivers.

## External feedback (ChatGPT playtest review, 2026-09-28)

A ChatGPT review of a playthrough (full text: ask the user, or see chat log 2026-09-28) largely
converges with Phase D / DECISIONS D1–D13 — its "north-star sentence" (notice → choose → predict →
result → lesson, with a stayed-with-you adult and a fix-it step) is D2's guided loop and D9's ending
panels already. Cross-referenced below; only the genuinely new bits are new backlog items.

**Already covered by existing plan/decisions (no new task needed):**
- Three suggested cards + full "more ideas" drawer during normal play → D2 ("At most 3 child
  choices on screen", free play stays as a start-screen choice per D3).
- Recovery shows only its own tools, not the full card wall → D5.
- Event-driven day with chapter breaks, "Next: Lunch →" → D3.
- Child-readable bucket states + instant `+/− drops` feedback → D2's Predict/Watch steps; the
  fuller/emptier language is already in C6.
- Selective/contextual prediction, not every card → D2 ("Familiar events skip Notice/Predict after
  the second time").
- Full-screen five-stage recovery with one instruction + a few actions per stage → D5 (stage list is
  Storm/Cool/Reconnect/Repair/Grow — same shape, different labels; worth a naming pass against the
  feedback's "Storm / Help the body / Ready to talk / Make it right / Practise for next time" when D5
  is built).
- Body signals as active, tappable gameplay before overflow → D1.
- Picture-panel child ending, plain-language grown-up summary, numbers behind a toggle → D6, D9, D10.
- Small child header, grown-up stuff tucked away → D7, D11.
- Report mismatch (bucket vs. receipt numbers, ambiguous labels) → tracked in KNOWN-BUGS B6, partly
  fixed in C6 ("Day log" / "PIP'S DAY" renames); the specific 20/86-vs-45 discrepancy and "Total
  pressure" / "Tools that helped: 1" wording should be re-checked when D6 lands.

**New backlog items (not currently in D1–D8 or the P2/P3 backlog):**
- **Body Detective reward.** A small sticker/skill nudge for successfully noticing a body clue
  before overflow, on top of D1's tappable clues — makes noticing itself rewarded, not just
  narrated.
- **Named day-length/mode picker.** Rename the speed controls to something like Story Day / Quick
  Day / Sandbox (roughly 8–10 min full narrative, 4–5 min key scenes, free play) instead of turtle/1×/2×
  or an unlabeled guided/free toggle. Overlaps D3's chapters — decide whether this is a chapter-count
  variant or a separate pacing control when D3 is scoped.
- **"Storms weathered" / non-shaming scorekeeping language.** Audit remaining receipt and grown-up
  copy for count-style phrasing ("Blow-ups: 2") and reword to match D6/D9's non-shaming tone.
- **Real-world transfer moment.** After the ending panels, a 30-second "pick your tool for tomorrow"
  step where the child chooses ~2 tools from a short list, rendered as a simple take-home plan line
  ("When my body feels tight, I can ask for a quiet spot."). Natural add-on to D6, not currently
  scoped there.
- **Bilingual/Chinese language modes.** Offer English / English+Chinese words / bilingual narration
  as a setting, and reserve Chinese for emotionally-loaded moments (colors, feelings, "together",
  "choice") rather than pinyin on every dashboard element. Not mentioned anywhere in the current
  plan — needs a decision (DECISIONS.md) before scoping, since it touches content.js structure and
  the voice pipeline (A3).

## Risks

- **The split breaks something subtle** (load order, `#cover`, globals clashing with `content.js` /
  `sim.js` names). Mitigation: A1 + A2 first, small commits, pixel-compare screenshots.
- **Voice drift.** Re-rendering everything after the cache loss may change how familiar lines
  sound. Mitigation: A3 compares clips and asks the user before replacing.
- **Guided mode fights the simulator's clock.** Mitigation: C1's single `phase` lands before any
  guided work, and guided mode only adds phases.
- **Chapter saving.** Sim state might not be JSON-safe. Mitigation: fall back to seed + input log
  replay (D5).
- **Scope creep from the brief.** Anything not in this file goes to the backlog, not into a task.
