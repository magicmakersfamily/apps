# Prompts for the Cosmic Journey cockpit characters

For the "we are all inside a spaceship" look (see PLAN.md, "Cockpit"). Use the two existing pictures
(the steampunk owl and the kitten in the space helmet) as **reference images** in every prompt so the
characters stay the same. Make each picture **portrait, about 1024 x 1536**, with a **plain solid mid-grey
background and soft light on the character** so the background can be cut out cleanly (macOS "lift
subject", see tools/cutout.swift). No text, no logos, no cockpit, no seat in these (we draw the ship in code).

Same style for all: soft painterly-realistic children's-storybook render, warm rim light, big expressive eyes,
the same fur colours, goggles, glasses, helmet and antenna as the reference.

## Cosmo the cosmic cat (kitten in a clear space helmet with a glowing blue antenna)

1. **cosmo-out.png** (looking out of the windshield)
   > Same kitten in the same clear space helmet with glowing blue antenna as the reference picture, seen from
   > BEHIND and slightly to the side (three-quarter rear view), sitting upright in a seat as if looking out of a
   > spaceship windshield. We see the back of the round helmet, one fluffy ear through the glass, the cheek and one
   > curious blue eye in profile edge, and the soft shoulders of the little space suit. Calm, wide-eyed wonder.
   > Solid plain mid-grey background, soft studio light, painterly storybook style, no text.

2. **cosmo-turn.png** (turned to talk to the Professor, mouth closed)
   > Same kitten in the same space helmet as the reference, sitting in a seat and turned to FACE RIGHT, side
   > profile to three-quarter view, looking at someone just out of frame on the right with a friendly, curious
   > expression, mouth gently closed, big blue eye shining through the visor, antenna glowing. Solid plain
   > mid-grey background, soft light, painterly storybook style, no text.

3. **cosmo-turn-talk.png** (same pose, mouth open)
   > Edit the previous image: keep the pose, helmet, lighting and framing EXACTLY the same; only change the
   > kitten's mouth to be open as if asking an excited question. Nothing else changes.

## Professor Know-A-Lot (wise owl with round glasses and steampunk goggles on his head)

4. **professor-out.png**
   > Same owl with the round brass glasses and brass goggles pushed up on his head, the leather collar with
   > gears, as the reference picture, seen from BEHIND and slightly to the side (three-quarter rear view), sitting
   > upright on a perch-seat as if looking out of a spaceship windshield. We see the back of the fluffy head and
   > the goggle strap, one tufted ear, and one round glasses lens and big amber eye in profile edge. Calm and
   > thoughtful. Solid plain mid-grey background, soft studio light, painterly storybook style, no text.

5. **professor-turn.png** (turned to talk to Cosmo, beak closed)
   > Same wise owl as the reference, perched and turned to FACE LEFT, side profile to three-quarter view, looking
   > at someone just out of frame on the left with a kind, thoughtful expression, beak closed, round glasses and
   > amber eye clearly visible, goggles on his head. Solid plain mid-grey background, soft light, painterly
   > storybook style, no text.

6. **professor-turn-talk.png** (same pose, beak open)
   > Edit the previous image: keep the pose, glasses, goggles, lighting and framing EXACTLY the same; only change
   > the beak to be slightly open as if explaining something. Nothing else changes.

Tips: generate 3 to 4 options for each and pick the one that matches the reference best; keep the head about the
same size and position in the frame across the closed and open versions so they swap without jumping.
Save as PNG with those file names, then drop them in big-bang/characters/ (or send them to Claude to cut out).

## Cockpit art (the "we are all in the spacecraft together" look)

Two pictures of the same cockpit: a **portrait** one for phones (about 1024 x 1792) and a **landscape** one for tablets
and laptops (about 1792 x 1024). Same style as the characters: soft painterly storybook render, dim and cosy, warm
amber and soft blue glow, rounded shapes, NOT a photograph, NOT gritty, few details. The cockpit is seen from the two
seats (a view from just behind and between the seats), with a big central windshield, two small side windows and a small
top window. **Every window pane must be one flat solid chroma-green (#00FF00) shape, nothing visible through it**, so
the window can be cut out and the real stars shown behind it. Leave both lower corners as empty dark seat backs (the
guides are added separately), and the lower middle as a smooth dashboard console with a few soft glowing buttons.
No people, no text, no flags, no badges, no logos, no real space-agency insignia.

Portrait:
> Cosy storybook spacecraft cockpit interior, portrait orientation, viewed from just behind two empty seats. A large
> rounded central windshield fills the upper half, a small round window at the top and two small round side windows.
> All window panes are flat solid chroma-green (#00FF00), nothing visible through them. Below the windshield a smooth
> curved dashboard with a few softly glowing amber and blue buttons and one small round display, calm and uncluttered.
> Dark empty seat backs fill both lower corners. Dim warm lighting, painterly children's-book style, rounded edges,
> no people, no text, no logos, no flags.

Landscape:
> Same cosy storybook spacecraft cockpit, landscape orientation, symmetrical, viewed from just behind two empty seats at
> the bottom left and bottom right. A wide curved central windshield, two angled side windows and a small top window,
> all panes flat solid chroma-green (#00FF00). A smooth dashboard across the lower middle with a few soft glowing
> buttons and one round display. Dim warm lighting, painterly children's-book style, no people, no text, no logos.

Tips: ask for 3 or 4 variations and pick the calmest, least cluttered one. Keep the central windshield as large and as
plain as you can: that is where the game is played. Save as PNG (cockpit-portrait.png, cockpit-landscape.png).
