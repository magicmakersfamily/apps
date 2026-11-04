# GUTS 2.0: the vision

Agreed with the family on 2026-11-03. This is the north star for every GUTS session; `PLAN.md` is the step-by-step
handoff and `TRACKER.md` the list of items. Read this first when deciding *what* to build, and keep each change true to it.

## What the greats share (and we keep)

1. **The toy comes before the game.** Moving and jumping is fun in an empty room: momentum, arcs, landings.
2. **The level is the teacher.** One idea per section in four beats: introduce safely, develop, twist, celebrate.
   No reading needed.
3. **Something every few seconds.** No empty stretch longer than about 8 s: a secret, a reaction, a glimpse.
4. **Failure is quick, kind and funny.** Instant recovery; getting stuck never feels like punishment.
5. **The mechanic means something.** Our controls carry the story: feelings and food become motion.
6. **The world reacts to you.** Things burn, bloom, tip, scatter, cheer.
7. **Easy to finish, deep to master.** A 5-year-old finishes; a grown-up chases secrets and medals in the same level.
8. **A destination you care about.** The trip around the world to Popo's Mid-Autumn feast; a village that grows.

## What only GUTS has

**A platformer where your feelings are the physics.** Food becomes motion, breath is a superpower, calm and chaos
are both valid ways to play, and kids learn self-regulation by feel, not by being told.

## Five pillars

1. **Inner Weather.** A storybook diorama in five parallax layers (light shafts, drifting dust, depth haze, life in
   the background) that reacts to Gus's mood: calm breathing makes the world bloom and reveals faint platforms and
   hidden doors; panic brings wind and storm clouds. Each level runs from morning to dusk lanterns. The background
   stays paler and softer than anything you can stand on, and its layers are drawn once and reused (fast in Firefox).
2. **The Belly Band.** Every toot is a note in the song's key, so blast chains play melodies; each world has a rhythm
   stretch where boosting on the beat gives a perfect launch, with the crowd and Gut Bugs dancing.
3. **You Are What You Eat.** Diving inside Gus, the meal you ate outside becomes the terrain: broccoli a bouncy
   forest, soda geysers, beans a hover-cloud cave, chili lava vents. Gut Bugs live there; the village grows.
4. **Fail Funny, Share Proud.** Built on the playtest recorder: a blooper reel of every blowout after each level,
   ghosts of earlier tries (or a parent's best run), and a postcard clip for Popo, saved on the device and shared by a
   grown-up.
5. **Playing Together.** A helper co-op (a parent on the iPad as Biffy: hold a platform, grab a snack, steady Mimi;
   no one can make the other lose) and later a level maker whose levels a robot cat plays first to prove they can be
   beaten.

## Controls

- One **Jump** button: press to jump (hold for higher); a second press in the air **boosts** (hold for a rocket).
- One **Calm** button: hold to breathe.
- **Hold to walk**, building smoothly into a run; double-tap or a full stick push runs at once.
- Forgiving underneath: a moment of grace after running off a ledge, early presses remembered just before landing,
  a slight hang at the top of a jump, and edge nudging (a jump that barely misses a ledge slides onto it).
- The same feel on a controller (stick, ✕ jump, ○ calm), a keyboard (arrows, Space, C) and an iPad (drag anywhere on
  the left half, two big buttons on the right). The AI-tester modes stay behind `?ai=1`.

## Healthy, not hooked

Addictive through mastery, discovery and love. No streak guilt, no prizes behind chance, no tracking. Every level
ends at a natural stopping point (Popo says goodnight).

## Phases

- **A, The Toy:** the new controls and game feel in a "Gus's Gym" test room; James plays it with `?playtest=1`; tune
  until he laughs.
- **B, The Slice:** Morning at Home rebuilt as a 3–4 minute four-beat level with Inner Weather, Mimi's calm and
  chaotic routes and the blooper reel. The proof.
- **C, The Inside:** the meal-built inside level.
- **D, Together:** helper co-op, ghosts, the postcard to Popo.
- **E, The Trip:** the world map, Detroit (with its rhythm level), then onward to the feast.

## Rules the tests enforce

- Every required step is a plain jump (`tools/route.mjs`, `levels.test.js`).
- No dead stretch over about 8 s along the main route (a bot will measure it in phase B).
- Nothing broken in any persona run, in Chrome, Firefox and WebKit (`node tools/check.mjs --full`).
- James's recordings decide whether a phase feels better (`PLAYTEST.md`).
