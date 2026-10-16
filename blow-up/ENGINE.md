# Blow Up — engine and 1.x design notes (originally PLAN.md for the 1.x build)

## Stack decision

The brief asks to match the existing family games when they exist, and they do: the Game Shelf
(`magicmakersfamily.github.io/apps`) is static HTML, CSS and JavaScript with no build step, no
dependencies and no tracking (see the repo's `CLAUDE.md`). So Blow Up follows the Aquarium and
Mid-Autumn Mayhem layout instead of Vite + React:

```
blow-up/
  index.html     everything you see and hear: SVG scene, characters, bucket, jars, trays,
                 control room, phases, receipt, compare view, sticker book, Grown-Up View, audio
  sim.js         the pure engine (no DOM): state, tick, loads, jars, zones, chemistry, phases,
                 skills, say-it-differently, event log, receipt. Deterministic from a seed.
  content.js     all data: load types, cards, recovery tools, locations, day styles, chaos
                 events, science cards, kid profiles, strings
  sim.test.js    engine tests, run with `node --test` (Node's built-in runner, no install)
  balance.js     headless balance run: every MVP day style × a few strategies
  PLAN.md, PLAYTEST.md
```

Mapping to the brief's suggested structure: `engine/` → `sim.js`; `content/` → `content.js`;
`scenes/`, `characters/`, `ui/`, `audio/` → sections of `index.html`. Zustand → one plain state
object plus a render function. Vitest → `node:test` with the same assertions.

## Engine model (sim.js)

- One tick = one sim-minute, 7:00 → 20:00 (780 ticks). Default speed 0.5 s per sim-minute.
- `load` per type (body, control, social, sensory, thinking, emotional); pressure is their sum.
- Every pressure change goes through one function that records the *actually applied* delta with a
  label and a source (life / rest / skill / support). The receipt and the Grown-Up equation are
  built from that log, so receipt total = end pressure − start pressure exactly.
- Jars 0–10 with labelled marbles. `threshold = 60 + 2·choice + can + together`.
- Zones from pressure / threshold: green < .40, yellow < .75, red < 1, blow-up ≥ 1.
- Body states: hungry (time since a meal), tired (sleep debt and evening), rushed (scene flag), sick.
- Chemistry: adrenaline (fast), cortisol (slow; builds in red, jumps at blow-up). Cortisol sets a
  pressure floor during recovery. Talking tools while cortisol is high cause a spike and can
  cause a second eruption.
- Phases after a blow-up: eruption → cooling → reconnect → (validation screen) → repair → learn →
  back to the day. Driven by pressure and cortisol, with gentle time-outs so there is no stuck state.
- Masking at school: the kid holds it together up to 115% of the threshold, then the stored
  pressure comes out after school (restraint collapse).
- Autonomy: marionette strings at My Choice ≤ 3, reactance at 0, Flat Mode when the jar is nearly
  empty and pressure stays low for 30 minutes.
- Say It Differently moments pause the day; both phrasings produce the same outcome (log line),
  with different jar and load effects. Headless runs use the day style's default phrasing.
- Skills (breathing, dinosaur stomp): practice in green/yellow earns XP; at level 3 the kid uses the
  skill on their own when entering yellow.
- Co-regulation: the adult has a stress meter; calm → blue waves drain the kid, stressed → red
  waves add load.
- Seeded RNG (mulberry32) for chaos events, so the same seed + inputs = the same day.

## Milestones

1. **M1 engine**: sim.js + content.js + tests + balance run.
2. **M2 playable day**: scene, kid and adult, bucket with drops, jars, drag-and-drop trays, thought
   bubbles, pause and speed, volcano and Hangry Monster blow-ups (plus noodle, tornado,
   steam-whistle and gavel variants).
3. **M3 recovery and autonomy**: phases with greyed-out tools, validation screen and iceberg,
   control room (Guard Dog and Wise Owl), co-regulation waves, Say It Differently, strings,
   Flat Mode, zone-sensitive backfires.
4. **M4 ending and learning**: bedtime ritual, Cost of the Day receipt with PNG, saved days,
   compare view, skills with auto-use, sticker book, Professor Pickle and science cards,
   Grown-Up View with graph, breakdown and equation.

The shelf publishes only after the family approves the private draft, so "commit after each
milestone" happens as one reviewed commit to the shelf repo.

## Shelf conventions applied

Standalone page shell, "← All games" link, version line and footer, Ko-fi and feedback links for
grown-ups only (hidden from the kid view during play), Tell a friend, a few Traditional Chinese
feeling words with pinyin (Mandarin, zh-TW voice), light and dark chrome, localStorage in try/catch.
