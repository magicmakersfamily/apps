# GUTS 1.7 team playtest (2026-11-04): merged findings

Four AI testers (5-year-old, first-time parent, platformer-feel expert, QA) played the live 1.7 site. Zero page errors,
nothing P0. Hit by several testers = ranked first. Evidence stays in the session scratchpad (team/<role>/).

## P1, fixing for 1.8
1. Gate overshoot (guts-B7): flying past the gate leaves Gus pinned at the right edge (James 14 s, QA, feel). [James, QA]
2. Full belly (85+ gas) cuts gravity to 0.35x: jump 112 px -> 293 px, boosts 3x taller; gas now stays full, so it's constant. [feel]
3. Jump buffer works only within 30 px of the ground (2 frames): an early press is lost, or becomes a boost. [feel]
4. Walking, letting go for 60-200 ms and pressing again starts a run by accident. [feel]
5. Words describe the old game: Little Guts "runs by himself", "How to play" table (Up jumps, X blasts), spoken "BLAST" hints,
   stuck helper "big blast", touch glyph "arrow buttons", results medals. [James, parent, QA]
6. Settings -> Controls switch is clipped ("Cla"); description never changes. [parent, QA]
7. Mashing jump skips the whole story and the heist scene in 4 s, so a child never hears the goal. [James]
8. Captions are replaced within 0.3-0.4 s as Gus moves. [parent]

## P2
- Floaty fall (fall gravity 1.4x rise) and tall tap-hops; no weight on the ground (150 ms to walk speed). [feel]
- Ledge step-up fails when flush against the wall. [feel]  - Quick second jump press (<0.1 s) lost. [feel]
- Wall-pushing stalls (14 s) have no picture hint. [James]  - Gym iPad: no idle picture of the drag area. [James]
- Down on the ground also breathes + steps the note. [QA]  - Second finger hijacks the drag stick. [QA]
- `?controls=classic` makes the Gym classic. [QA]  - Esc in full screen doesn't pause. [QA]  - Music button desync. [QA]
- Tap/Step switches do nothing with New controls and say nothing. [QA]  - Phone landscape hides Back to title. [QA]
- Sky-trail cloud is hard to land on and unmarked; the big gap doesn't need a run. [parent]
- REC tag covers captions; replay report misreads Gym laps as stalls. [parent, James]
- Food shifts speed/jump height (design call). [feel]  - First soda: 6 s slow motion. [feel]

## Great (keep)
Masher clears the level in ~41 s with no explosions and no auto-run; fridge no longer a wall; flying, notes and Gus's song
delight; touch drag works (22/24); input delay <= 1 frame in all browsers; tap-tap-hold reliable; exact replays everywhere.
