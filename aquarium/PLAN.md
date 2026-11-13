# James's Nature Aquarium — development roadmap

This file is the handoff between sessions for the aquarium game, same convention as `blow-up/PLAN.md`.
Read it together with `../CLAUDE.md` (repo-wide conventions: layout, versioning, Chinese, quality bar).

Status: ☐ to do · ◐ in progress · ☑ done

## Where we are (2026-09-28)

- Live version is 3.4 (`aquarium/index.html`, `aquarium/sim.js`), launched 2026-09-24.
- **No git tag or frozen copy exists for this game yet** — unlike Blow Up, which tags and freezes
  every release. Before starting new work below, do Phase 0 so 3.4 is permanently playable/forkable
  even as the frontier version keeps changing.

## Phase 0: version 3.4 (do first, before any other task here)

**☐ 0.1. Tag and freeze 3.4.**
Tag `aquarium-v3.4` (annotated, one-line summary), then run
`tools/freeze-version.sh aquarium 3.4 aquarium-v3.4`. Add the row to `versions/index.html`. This
gives 3.4 its own saved games (`aquarium@3.4:` localStorage prefix), noindex, and an "old version"
strip, per the repo convention in `../CLAUDE.md` ("Versions: every release stays playable"). From
here on, tag + freeze every release the same way (including 1.5/1.6/2.0-style milestones below) so
any version can always be played or forked later, even while the frontier version keeps moving.

## Source: ChatGPT playtest review (2026-09-28)

A ChatGPT review of a full playthrough (7 in-game weeks, Harmony 99, 6 plant groups, 9 cardinal
tetras, 31 shrimp, plus experiments with turtles, extra light, no plants, and weekly water changes).
Full text: ask the user, or see chat log 2026-09-28. Verdict: the science model is unusually strong
for a kids' game; the main opportunity is presentation, not more content. Organized into phases
below in the order the reviewer implied (science accuracy first, since it's user-facing wrong
information; bugs next; the redesign last, since it's the biggest lift).

## Phase A: science corrections (accuracy, not redesign)

**☐ A1. Fix the plant-respiration caption.**
Replace "plants breathe in CO₂ and breathe out oxygen" (the simplified chart caption) with: "In
light, plants use CO₂ and release oxygen through photosynthesis. Plants also use oxygen through
respiration all day and night." The detailed panel already teaches this correctly — only the
simplified caption is wrong.

**☐ A2. Separate ammonia and nitrite in the display.**
Replace the combined "Ammonia + nitrite: X ppm" reading with four separate values: total ammonia
(`NH₃ + NH₄⁺`), toxic un-ionized ammonia (`NH₃`, or a simple risk indicator derived from pH and
temperature), nitrite (`NO₂⁻`), and nitrate (`NO₃⁻`). A single "ideal under 0.25" combined number is
misleading since un-ionized ammonia toxicity depends on pH and temperature.

**☐ A3. Slow down or explain tank cycling.**
The tank showed "cycle complete" at Week 2; real biofilters typically take 3–8 weeks. Either make
cycling take 4–6 game weeks, or add an explicit line ("Several real days pass during each game week,
and this tank received starter bacteria"), or change "cycle complete" to "the biofilter is becoming
established" until ammonia and nitrite both stay near zero after a simulated waste challenge.

**☐ A4. Soften the "two teams" nitrifying-bacteria claim.**
Keep the Team 1 / Team 2 metaphor for kids, but the field guide currently names only *Nitrosomonas*
and *Nitrospira* as if that's the complete picture. Real aquarium biofilters can include
ammonia-oxidizing archaea and complete-ammonia-oxidizing *Nitrospira* too. Reword the field guide to:
"Different communities of tiny microbes do these jobs. We call them Team 1 and Team 2 in this game."

**☐ A5. Replace universal "ideal" bands with per-species needs.**
pH 6.4–7.6 is shown as universally ideal, but cardinal tetras' natural water is much more acidic
(~pH 4–6) and cherry shrimp tolerate a wider range; CO₂ up to 25 mg/L isn't uniformly "ideal" either
(context- and species-dependent). Replace single universal bands with: "Safe for everyone currently
in your tank," individual species preference strips, and a stability indicator (sudden change can
matter more than hitting one "perfect" number).

**☐ A6. Qualify the substrate-ammonia claim.**
"New aquarium soil releases ammonia" is true of nutrient-rich active aquasoils (e.g. ADA Amazonia),
not every substrate. Reword to "This nutrient-rich active aquasoil releases ammonium during setup."

**☐ A7. Explain same-day shrimp births.**
Babies appeared one simulated day after shrimp were added, which only makes sense if some arrived
already carrying eggs. Add an arrival animation/line: "One new shrimp is already carrying eggs!" Also
check the egg-development timer — real development is temperature-dependent (~12–21 days at
24–32°C), not a fixed month; adjust the sim if it's currently a flat duration.

## Phase B: simulation and UI bugs

**☐ B1. Fix plant-health threshold/label mismatch.**
At Week 1, plant health was 67% but labeled "Just right," despite the displayed ideal being over
70%. Find and fix the threshold used for the label vs. the one shown as the target.

**☐ B2. Fix "Bacteria power" reading safe when it isn't.**
"Bacteria power" showed 137%, labeled "Just right," while ammonia + nitrite was 0.93 ppm (unsafe).
A high bacteria score currently can imply animals are safe when they're not — decouple or re-derive
the label so it reflects actual water safety, not just biofilter capacity.

**☐ B3. Fix Experiment Lab stale results after restart.**
After restarting the game, the Experiment Lab kept showing results from the previous aquarium until
a new experiment was run. Clear or reset lab state on restart/new-game.

**☐ B4. Model predation/carrying-capacity loss from removed hiding cover.**
Removing all plants for two weeks lowered oxygen and raised nitrate (correct) but produced *more*
shrimp and left animal health at 100% — losing all hiding cover should increase baby predation and
reduce carrying capacity instead. Fix the shrimp survival/predation model to respond to cover.

**☐ B5. Fix Experiment Lab not reflecting water-change effects.**
Weekly water changes reduced nitrate from 8.1 to 2.1 ppm (a real 74% drop) but the lab reported
meters barely changed. Find why the lab's read of nitrate/meters doesn't track the actual sim state.

**☐ B6. Investigate intermittent prediction-target swap.**
One prediction appeared to change from "plant health" to "oxygen" in its result; a Week 7 repeat
worked correctly. Possibly intermittent or interaction-related — add logging or a repro script before
attempting a fix; don't guess blind.

**☐ B7. Make "Bacteria power: 300%" and "Harmony: 99" explain themselves.**
These read as precise scientific measurements without saying what they measure. Either switch to
qualitative stages (matches the redesign in Phase D) or expose the calculation behind them (e.g. a
tap-to-explain or Science view, once D exists).

## Phase C: sound and music polish

**☐ C1. Independent volume controls.** Separate sliders for music, water sounds, narration, and
pronunciation, plus a master mute.

**☐ C2. "Hear the difference" A/B button.** Short toggle to compare a sound state before/after a
change, with visual captions for meaningful sound changes (for players who can't hear or have sound
off).

**☐ C3. Distinct warning sounds.** Separate audio cues for low oxygen, toxicity, and crowding rather
than one generic alert.

**☐ C4. Parent-facing audio calibration scene.** A short setup screen to check levels before playing.

**☐ C5. Soften the "these five notes never clash" claim.** Change to "These five notes fit together
easily" — pentatonic collections reduce harsh clashes but don't eliminate them; "never" is an
overclaim.

## Phase D: the redesign — six voiced, visual discoveries

The reviewer's core recommendation: the game's content is already excellent, but the primary
experience is too dashboard-like for a non-reading child. Restructure into a short sequence of visual
chapters, each with one voiced question, three large picture choices, one visible action, a
5–8-second consequence, and one voiced causal explanation (same "wait for the child, one decision at
a time" shape as `blow-up/PLAN.md` Phase D — worth reading together since both games are converging
on this pattern). Chemistry numbers move to a parent/scientist drawer ("Science view"), separate from
the default "Play view."

**☐ D1. Chapter 1 — Wake the plants.** Turn on light; watch CO₂ enter leaves and oxygen bubbles
emerge.

**☐ D2. Chapter 2 — Meet the invisible cleaners.** Follow one glowing waste particle through
ammonia → nitrite → nitrate, animated as a traceable particle rather than only shown in meters.

**☐ D3. Chapter 3 — Welcome the shrimp.** Grazing, molting, eggs, babies, hiding behavior.

**☐ D4. Chapter 4 — Add a fish school.** Group size, respiration, waste, predation.

**☐ D5. Chapter 5 — Survive the night.** Watch oxygen fall after the light turns off (ties into the
already-correct day/night photosynthesis panel).

**☐ D6. Chapter 6 — Rescue a tank.** Apply the learned relationships in a short scenario; promote
rescue missions from an optional section below the tank to the main curriculum.

**☐ D7. Recurring characters.** A plant, a shrimp, a fish, and the two microbe teams as named,
consistent characters across chapters.

**☐ D8. Expressive behaviors.** Fish school tighter when stressed, shrimp hide, fish surface during
low oxygen, plants pale under low light, algae visibly competes for surfaces. Let children tap an
unhappy animal to reveal its need visually.

**☐ D9. Play view / Science view toggle.** Parents can switch between the simplified chapter
experience and the full numbers/diagrams/vocabulary/journal view that exists today.

**☐ D10. Replace red/green correctness with "What surprised us?"** So a failed prediction stays
rewarding rather than reading as wrong.

**☐ D11. One memorable causal moment per week**, replacing several journal entries below the fold.

## Risks

- **Phase A/B changes could shift game balance** (cycling time, shrimp survival, bacteria/health
  labels). Re-run the headless sim with a few strategies after each change, per `../CLAUDE.md`'s
  quality bar ("good play should win, obvious mistakes should visibly hurt").
- **Phase D is a big rewrite**, similar in shape to Blow Up's Phase D. Consider gating it behind a
  query param or setting the same way, so the current dashboard stays available until the redesign is
  ready, and tag/freeze a version before starting it (see Phase 0).
- **Scope creep.** Anything raised by future feedback that isn't in this file goes into a new
  numbered item here, not folded silently into an existing one.
