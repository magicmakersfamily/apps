# Cosmic Journey: plan and decisions

## START HERE (handoff written 2026-10-17, end of session)

**Live now: version 4.0 (beta)** at https://magicmakersfamily.github.io/apps/big-bang/ (tag `big-bang-v4.0`, frozen under `versions/big-bang/4.0/`).
**In progress: version 5.0 = the "grown-ups layer" (Tier 2 below).** Nothing of it is in the game yet. Only the *text content* is written and committed:

- `tools/i18n/content_en.py` and `tools/i18n/content_yue.py` now end with `EXTRAS` / `EXTRAS_Y`. Per chapter: `because` (one sentence: "X happened, so Y could happen next"),
  `prompts` (2 talking points for grown-ups), `words` (3 vocabulary items), `known`, `open` (what scientists know vs what is still open), and per fact circle a `more`
  paragraph for older kids. They are merged into `chapters` / `YUE` already (checked: both modules import and merge). **Not yet run through `build.py`, so `index.html` does not contain
  them; `JP` (Jyutping) is not yet extended to the new strings.** To include Jyutping for `because` and `more`, add them to `all_yue_strings()` in `content_yue.py`
  (it currently lists title, shortTitle, orderName, timeLabel, gapNote, mascotSpeech, afterBang, minigameTitle, minigameDesc, payoff, talk, cal, hotspots, centre, bigQ and UI strings).
- Cantonese for these extras is machine-assisted writing and unreviewed by a native speaker (as is the rest of the Cantonese).

### How to work (so you don't have to rediscover it)
1. Read this file, then `CLAUDE.md` in this folder, then the repo root `CLAUDE.md` (shelf rules: version bump, tag `big-bang-vX.Y`, `tools/freeze-version.sh big-bang X.Y big-bang-vX.Y`, README table, shelf card, `versions/index.html` row, verify the live site).
2. Local test: `cd /Users/ab/apps && python3 -m http.server 8765`, open `http://localhost:8765/big-bang/`. **Use a visible real Chrome tab** for anything animated: hidden tabs and the built-in preview pane do not run `requestAnimationFrame`, so overlap/animation tests there are meaningless.
3. Text changes: edit `tools/i18n/content_en.py` + `content_yue.py` (both languages), then
   `python3 -m venv /tmp/jpenv && /tmp/jpenv/bin/pip install pycantonese && /tmp/jpenv/bin/python big-bang/tools/i18n/build.py`, then `big-bang/tools/render-voice.sh` (re-records changed clips; ~1–2 minutes for a full set; run it in the background),
   then `big-bang/tools/rebuild-css.sh` if Tailwind classes changed. Code changes go straight into `index.html`.
4. Voice note: browser speech was unreliable on this Mac, so all narration is recorded files (`voice/` English, `voice/yue/` Cantonese). New spoken lines need new keys in `tools/lines.js`.

### The 5.0 design (agreed direction; build it in this order)
**A. Grown-ups panel** (button in the footer: "For grown-ups"; full-screen scrollable panel, built from the `EXTRAS`): what it is and ages (about 5 to 12, 20–30 min for a full play); privacy (no ads, no accounts, no tracking, nothing leaves the device;
settings/stickers saved only in this browser); ways to use it (5 min: start the Big Bang, light the first star, open "One year"; 15 min: chapters 1 to 3 with the Talk-together questions; 30 min: whole journey, order game, postcard);
per-chapter talking points, vocabulary, and "known vs still open"; "About the science" (follows mainstream science as presented by NASA, ESA, the Natural History Museum etc., dates rounded and simplified, **honestly state it has not yet been checked by a professional science educator** and link "report a mistake" to the feedback page with `kind=bug`);
comfort and access tips; a button "Print the story-line poster". Panel text is plain (no Jyutping). Needs UI keys in both languages (`ga_*`).
**B. Printable poster:** build a `#print-poster` element from `CHAPTERS` (icon, title, `timeLabel`, `cal` one-year date, `because`) and call `window.print()`; `@media print` hides everything else (note `body` is `height:100dvh; overflow:hidden`, override it for print). Test with headless Chrome `--print-to-pdf` plus a `#poster` hash that builds it without printing, then `sips -s format png` to look at it.
**C. Story Journey vs Free Explore** (Settings switch, saved as `big-bang:mode`, default **story**): in story mode chapter *i* is open only when chapter *i-1* is complete (`isUnlocked(i)`); guard it once, at the top of `changeChapter()`, so pills, timeline, dropdown and Next all obey it; locked ones show 🔒 and a toast ("Finish the chapter before to open this one"); the Next button waits until the chapter is complete (the last chapter's "Restart Journey" is always allowed). Free mode opens everything.
**D. Accessibility:** (1) captions that highlight the sentence being spoken in Cosmo's box (split into sentences; map `audio.currentTime/duration` to the sentence by character share; slice the Jyutping with an offset since `JP` is keyed by the whole string); (2) "Larger text" switch (html font-size 125%); (3) "Freeze floating things" switch (entities and star drift stop); (4) keyboard path: canvas `tabindex=0`, arrow keys cycle through the floating things with a visible ring, Enter/Space catches (refactor the click handler into `collect(ent)`); (5) "Watch again ↻" button in Cosmo's box after a chapter's payoff (restarts `payoff` and re-plays the `p<i>` clip).
**E. Finale:** after the order game: Cosmo's recap (play the six `because` sentences in turn as new clips `b0`..`b5`, highlighting each); a "What comes next?" choice of six picture cards (alien life, giant telescope, caring for Earth, a city on Mars, other galaxies, a cure for a sickness); and a **Postcard from Space**: a canvas picture (title, "I travelled 13.8 billion years", the stickers earned, the chosen next-discovery card, "Cosmic Journey · Magic Makers") saved or shared with `navigator.share({files})` (fallback: download the PNG). No typing, no names, nothing sent anywhere.
**F. "More ▸" layer:** the fact-circle modal gets a "More ▸" button that reveals the `more` paragraph (text only, no new voice clip; Jyutping applies).
Ship as 5.0 (tag, freeze, shelf card text, README, `versions/index.html`, root CLAUDE.md untouched). After release, update the checkboxes below.


Where development stands and what is next. Read `CLAUDE.md` first for how the game is built.

## Decisions (from the family, 2026-10-17)

- English is the default language. Cantonese (Traditional Chinese, 繁體粵語) is chosen in Settings or on the welcome screen; **Jyutping starts OFF** when Cantonese is on.
- **Do not add more languages yet.** First get the core build and revisions right; languages come after.
- One tap starts everything: the welcome screen is a single glowing dot that starts sound, music and the Big Bang.
- Playtests with children: parked, possible later (observation sheet for ages 4–5, 6–7, 8–10, incl. Cantonese-dominant and heritage learners).
- No data collection, so no "teacher sees what each child did". A "My journey" summary on the child's own device (viewable or printable) is acceptable.

## Feedback compiled from three AI reviewers (round 2)

### Tier 1: released in 4.0
- [x] Bugs: chapter dropdown stayed in the old language; the "Touch here to trigger the Big Bang" text was invisible but still in the page for chapters 2–6; tap targets under 44 px.
- [x] Visible cause and effect in every mini-game (tap sparkles and landing rings; hydrogen orbits then fuses to "H+H+H+H → He + light"; Earth grows and a dark crust spreads; the world clears and a blue air ring grows as oxygen builds; generations strip; asteroid, dust and survivors; ideas ladder 🔥🗣️🔭🚀).
- [x] Easy & calm mode (slower, bigger things, bigger tap areas, no pulsing; on by default when the device asks for reduced motion). Taps are forgiving in every mode (nearest thing within a generous circle).
- [x] One-tap start.
- [x] Time scale: "The universe in one year" (zoom: year → December → New Year's Eve) plus a one-year date under the story line for each chapter.
- [x] "Talk together" question after every chapter (spoken, not a quiz).
- [x] Science wording: earliest life "at least 3.5 billion years ago"; dinosaurs "about 230 to 66 million years ago"; chapter 4 is "Ocean Life Grows, Then Life Reaches Land"; "The Big Bang was not a bomb going off inside space."
- [x] Settings panel (language, sound, voice, music, Jyutping, easy mode) replaces the crowded header.

### Tier 2: next release (grown-ups layer, see START HERE for the design; text content written, code not started)
- [ ] Grown-ups panel: how to use it in 5, 15 or 30 minutes; discussion prompts; vocabulary; "established science vs open questions"; no ads or data; age range; science sources.
- [ ] Printable timeline / one-year poster.
- [ ] Story Journey (chapters in order) and Free Explore (jump anywhere) modes.
- [ ] Accessibility: captions that highlight in step with the voice, text-size option, pause/replay for animations, keyboard path.
- [ ] Finale: Cosmo recaps the story chain after the order game; "what comes next?" card; a "Postcard from Space" picture (stickers on a picture, saved or shared through the share sheet; nothing is sent to us).
- [ ] "More" layer: a second tap for deeper detail for older kids.

### Tier 3: later
- [ ] More languages (Mandarin with pinyin is the natural next one for James; each needs a fluent writer/reviewer, not word-for-word translation).
- [ ] Narration styles (calm/slow "bedtime" tempo); a better English voice (Kokoro, like Blow Up).
- [ ] Art pass: more recognisable shapes instead of abstract glows.
- [ ] Replay variety and a quiz sticker.
- [ ] Observed playtests with children (see above).
- [ ] Jyutping: a "learn Cantonese" mode with phrase highlighting; tap a phrase to hear it again; Cantonese speaker review of text, Jyutping and audio.

## Known limits
- Cantonese text and Jyutping are machine-assisted (Jyutping from the rime-cantonese dictionary), not native-reviewed.
- Voices are macOS `say` (Samantha English, Sinji Cantonese); good enough for beta.
