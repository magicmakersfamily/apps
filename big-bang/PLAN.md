# Cosmic Journey: plan and decisions

## START HERE (updated 2026-10-17, session 3: **5.1 released**: Cosmo asks, the Professor explains; the grown-ups layer is now 6.0)

**Two tracks are open. Do them in this order, and ask the family before starting track 2 build work.**

### Track 1: finish the voice audition, then build the characters (version 5.0 or 6.0)
**The idea (family's, agreed in principle):** make Cosmo the time-and-space-travelling cat a sweet, kid-like voice who ASKS the questions, and add a second character,
**Professor Know-A-Lot, a wise OWL WITH GLASSES (🦉), with a deep, authoritative adult voice** who ANSWERS and explains hard words. Questions are voiced by Cosmo, answers by the Professor.
My recommendations, not yet confirmed by the family: Cosmo keeps narrating the chapter stories; the Professor takes the fact circles, definitions, Big questions and "More"; the Professor
models honesty ("scientists think...", "we don't know yet"); Cosmo voices common wrong ideas ("Did the Big Bang explode from the middle?") and the Professor corrects them kindly; tappable
glossary words in the story text ("fusion" -> Cosmo asks, Professor explains); "More ▸" becomes "Ask the Professor". Keep answers to one idea (about 15 to 25 seconds) or kids skip them.
Possible Cantonese name for the Professor: 知得多教授 (suggested, not decided). Pilot it in ONE chapter (fact circles, one Big question, one glossary word) before rolling out to all six.
Scale: roughly 60 extra clips per language; every future text change means re-recording both voices; the layout for two characters on a phone must be worked out (the stage is already tight).

**Design principle (family, 2026-10-17):** the Professor *knows a lot*, never *knows it all*. Even experts don't know everything, so he says "scientists think..." and "we don't know yet" and models curiosity. His Cantonese name is 知得多教授 ("knows a lot"), not 乜都知 ("knows everything"). Keep every future Professor line consistent with this.

**Voice picks (made 2026-10-17, final for the pilot):** Cosmo = macOS Samantha pitched up 1.28 (Cantonese: Sinji up 1.30); Professor = Daniel (British), natural (Cantonese: Sinji down 0.80).
`tools/render-voice.sh` now holds these settings (all Cosmo clips in the whole game were re-recorded in the new voice). Audition page: `tools/audition.sh` + `tools/audition-page.html` (see git history of this file for the recipe).
If the pitched Samantha is not child-like enough after real listening, Kokoro is still the fallback (about 300 MB download, ask first, no Cantonese).

**CAST STATUS (built locally, NOT committed, NOT released; needs the family's listening and approval first):** the pilot was in chapter 1; on 2026-10-17 it was rolled out to **all six chapters** (`cast: True` in both content files).
- Fact circles: Cosmo asks (`ha00`, `ha01`), the Professor answers (`h00`, `h01`, body text only). Big question: Cosmo asks (`q0`), Professor answers (`qa0`, answer plus closing line).
  Glossary: the word **fusion** (核聚變) in the chapter-1 payoff text is a tappable button; Cosmo asks (`ga0`), Professor answers (`gb0`).
- Text lives in `content_en.py` / `content_yue.py` (`ask` per hotspot, `gloss`, `cast`; UI keys `prof`, `b_word`, `asks`). `tools/lines.js` now emits `key<TAB>role<TAB>text`; Cantonese names: 宇宙貓 and 知得多教授 (not yet confirmed by the family).
- Code (`index.html`): `castTalk()` plays ask then answer and lights the speaking character's box in the info modal; `openModal(hs, key, cast)`; `richGloss()`/`openGloss()`; chapters without `cast` behave exactly as before. Browser-voice fallback uses lower pitch for the Professor.
- Checked in the browser pane (English and Cantonese, phone width, both rows, plain cards unchanged). Not checked: real-device listening, the 5-year-old's reaction, and whether two characters feel right in the modal.
- **"Ask the Professor" button (built 2026-10-17, replaces the planned "More ▸"):** every fact-circle card in a cast chapter has an "Ask the Professor ▸" button (問吓教授). Tapping it opens a second Professor box with the longer `more` paragraph (text, Jyutping, and his voice: clips `hm<chapter><n>`, 12 per language, longest about 21 s). It is only on fact circles, not on Big question or glossary cards. Code: `#btn-ask-prof`, `#modal-more`, `askMore` in `index.html`; the `more` text is in `EXTRAS`/`EXTRAS_Y`.
- Glossary words (each appears in that chapter's payoff text): fusion (核聚變), Theia (忒伊亞), oxygen (氧氣), evolution (演化), asteroid (小行星), universe (宇宙). Longest Professor clip is about 23 s (Cantonese big question, chapter 4).
- Checked in the browser pane for all six chapters: every clip exists in both languages, every glossary button opens its Cosmo-asks / Professor-answers card, and the card fits a phone with Jyutping on. Not checked: listening on a real device.
- Still open from the idea list: "Ask the Professor" instead of "More", Cosmo voicing common wrong ideas, Professor in the stage layout (he lives in pop-ups only, because the stage is tight on phones), and a version bump (5.0 or 6.0) with the usual release steps.
- A Cantonese speaker should check the new Cantonese lines and the two character names.

### Voice roles (family rule, 2026-10-17, released as 5.1)
**The Professor explains all the science; Cosmo asks all the questions and handles play.** Professor: chapter stories (`c`), the Big Bang explanation (`bang`), payoffs (`p`), centre-picture answers (`m`), fact-circle and Big-question answers, glossary answers, the one-year story (`cal`). Cosmo: fact-circle, centre-picture, Big and glossary questions (`ha`, `ma`, `q`, `ga`), Talk-together (`t`), `help`, `final`, `orderok`. The mascot box in the stage swaps to 🦉 "Professor" (button "Hear the Professor") whenever he is the speaker (`isProf()` / `paintSpeaker()` in `index.html`; roles per clip in `tools/lines.js`). The centre-picture cards are now cast too (Cosmo asks first).

### Feedback from the third round of AI testing (ChatGPT, Grok, Grok), noted, NOT yet acted on
Themes, most repeated first. Triage before building; some points are wrong (reviewers say the mini-games "still mostly count taps", but 4.0 already shows each cause and effect) or clash with repo rules (a typed name on a certificate; anything that sends data).
1. **Child agency / "what happens if…?"**: one tiny experiment per chapter (drag dots apart to see no centre; squeeze hydrogen until a star shines; rocks from different sides make a round Earth; sunlight vs shade for oxygen bubbles; wet/shallow/deep water across generations; small vs giant asteroid; telescope before rocket). Cosmo asks a *prediction* first ("What do you think will happen?"), then reacts to the child's try ("You guessed they'd bounce; gravity pulled them together!").
2. **Interactive calendar**: tap a date to jump to the chapter; dates light up as chapters finish; a "Where am I?" view (Big Bang 1 Jan, dinosaurs 25 to 29 Dec, people 11:49 pm 31 Dec, your family's lifetime = the last blink); optional slider.
3. **Finale**: a "Future Page"/Next-Discovery postcard (already in the 6.0 design, section E), "Cosmic Explorer" card to save or share. Drop the typed name idea unless it stays only on the device.
4. **Grown-up / projector mode** (already the 6.0 design): large captions, pause points, 5/15/30-minute routes, one discussion prompt per chapter, printable timeline; no accounts.
5. **Tiny recall, no scores**: "point to where Earth appears on the story line", order three pictures, "which is still around: T. rex, trilobite or bird?"; Cosmo only helps ("Almost! Let's slide them around").
6. **Real-world bridge**: one off-screen invitation per chapter ("Tonight, look for the Moon"; "find a bird, it is a dinosaur cousin").
7. **Juice and polish**: tap sparkles and haptics, hyperspace transition between chapters, brighter early-universe scenes, draggable stickers on a space wallpaper, recognisable silhouettes. Optional: pinch-to-zoom scale (atom to galaxy), supernova toy.
8. **Languages**: native-written scripts per language, expressive native recordings, tap a science word to hear it in another language; keep Jyutping an intentional layer.
9. **Be ruthless about NOT adding**: badges and streaks, pressure, an AI chat in the child experience, accounts or classroom admin, rankings, "wrong answer" punishment, trivia card piles.
10. **Confirmed working for them**: Cosmo asks / Professor answers, "Ask the Professor", the one-year calendar, Easy & calm, the "not a bomb" Big Bang wording, honest Big questions. Silly-banter idea (popcorn on a star) is a no: keep the Professor accurate and humble.
Suggested build order if the family agrees: (a) 5.1 voice roles, (b) the six "what happens if" experiments with Cosmo's prediction moments, (c) the 6.0 grown-ups layer plus interactive calendar and "Where am I?", (d) finale and Future Page, (e) polish pass, (f) quiet playtests with children.

### Options to decide later: more ways to "Ask the Professor" (discussed 2026-10-17, nothing decided, nothing built)
**Option A: tappable question chips (no AI).** About 6 to 8 picture-and-word questions per chapter ("Why is the Sun hot?"); tapping one plays Cosmo's question and the Professor's recorded answer, like the existing fact circles. Safe, free, offline, fits every repo rule, no privacy change; works for James (5) because it needs no reading or speech. Cost: about 50 new clips per language, re-recorded on every text change. Natural fit for 6.0 alongside the grown-ups layer. Keep each answer to one idea (15 to 25 s) and keep it honest ("scientists think...", "we don't know yet").
**Option B: live AI chat with the Professor (microphone, opt-in beta, later).** What it needs:
- *Voice in:* the browser's speech recognition (Chrome sends the audio to Google); poor for small children and for Cantonese.
- *The AI:* an API call to a small, cheap model, with a system prompt that makes it the Professor, answers only from the game's content, stays short and kind, says "we don't know yet", and refuses off-topic or unsafe requests.
- *A server in the middle:* the site is static and the repo is public, so the API key cannot be in the page. Use a small proxy (for example a Cloudflare Worker, free tier) that holds the key as a secret and enforces rate limits, a daily cap and a bot check. The key and proxy URL never go in this repository.
- *Voice out:* recorded clips cannot say new sentences. Either the browser's own voice (unreliable on the family Mac) or a paid text-to-speech service; neither will match the recorded Professor.
- *Credits:* billed separately from any Claude subscription. Create an API key with prepaid credits and a monthly spend limit; roughly a fraction of a cent to about a cent per short question (check current pricing before deciding). The real risk is abuse of a public endpoint, so caps matter more than the price. Ko-fi could help cover it.
- *Decisions it forces:* (1) a privacy change: the site says it collects nothing, and this sends questions (maybe voice) off the device, so it needs an opt-in, new wording, a family-approved exception written into the root `CLAUDE.md` (like `get-ready/` and `renzi/`), and a check of children's-privacy rules and the API provider's terms for apps used by kids; (2) accuracy: AI can be confidently wrong, the opposite of "knows a lot, not everything", so ground it in the game's text, filter outputs, and consider showing the answer as text a grown-up can check; (3) who pays and the monthly budget.
- *Suggested shape if chosen:* a grown-up-gated switch in Settings (off by default), text-first with the voice as an extra, English first (Cantonese speech recognition is weakest), and a prototype with a tiny daily cap before any release. Round-3 reviewers (ChatGPT) advised against an AI chat inside the child experience; weigh that.
**Option C (not recommended): an in-browser small model** (WebGPU, 1 to 2 GB download, weak answers on phones).
Suggested order if the family wants it: A first (ships with 6.0), then decide on B after seeing how kids use A.

### Feedback from the fourth round of AI testing (ChatGPT, Grok, Gemini; about reach, "App of the Day" and 1M downloads), noted, NOT yet acted on
- **Agreed or already planned:** one unforgettable signature moment = the one-year calendar as a cinematic zoom (year, then 31 December, then the last minutes: people at 11:49 pm, rockets in the final second); six "Universe Lab" experiments (same list as round 3); a shareable end card ("We travelled 13.8 billion years", the stickers earned; nothing sent to us); the grown-ups and projector layer with printable timeline and prompts; native-feeling languages; a short trust page ("no ads, no tracking, no streaks", science sources, and honestly that it is not yet reviewed by a professional science educator); original music later instead of the borrowed Vivaldi; observed playtests with children.
- **Conflicts with the family's decisions (keep as noted, do not follow):** ChatGPT wants ONE guide (Cosmo only, drop the Professor); the family chose two characters on purpose (Cosmo asks, the Professor explains, and models "knows a lot, not everything"). Gemini's daily notifications and quests, avatar outfits, streak-like hooks and a "Create your own universe" sandbox clash with the no-pressure, no-tracking rules (a sandbox could be a calm Lab idea later). Gemini's "GDPR/COPPA certified" badge must not be claimed without an actual review. Haptics, tilt parallax and spatial audio are optional polish only.
- **Real finding:** Grok says the Cosmo/Professor switch is unclear on screen and Settings still says "Cosmo's voice". Fix: rename that switch to "Voices" (or "Cosmo and Professor") in both languages, and see the next section.
- **Not a build item:** launch and marketing advice (App Store featuring nomination, STEM influencer outreach). This is a web game on GitHub Pages; a native iPhone/iPad app is a separate decision.

### Speaker presentation: who is talking, and where (family discussion 2026-10-17, to decide)
Family asks: a clear "voice imagery" near the speaker's face so it is always obvious who talks even when the text box is gone; maybe Cosmo always lower left and the Professor always lower right; maybe they look as if peering down into the simulation; dialog boxes must be useful but never interfere with the simulation.
Recommendation (not built): two fixed "perches" in the lower corners, Cosmo left and the Professor right (questions from the left, answers from the right); the speaker lights up (coloured glow ring, radiating sound arcs, a gentle bounce driven by the real audio loudness) and "leans in" (scales up and rises toward the scene) while the other dims and recedes, which gives the peering-in perspective without moving the top controls; each speaker has its own colour (Cosmo indigo, Professor warm brown and gold) shared by the ring, name tag and caption bubble so colour tells non-readers who talks; captions show one sentence at a time beside the speaker, fade out soon after the voice ends, and sit in the keep-out zones so nothing to tap is ever under them; easy and calm mode swaps the moving arcs for a steady glow. Open points: top-corner "looking down" vs lower-corner "leaning in" (the top right holds the mini-game panel), real drawn characters (SVG: a cat, and an owl with glasses) instead of emoji, and how much phone height the perches may use. A static mock-up page should be shown to the family before touching the game.

### Track 2: the grown-ups layer (version 5.0), design below, text content already written
Nothing of it is in the game yet. Only the *text content* is written and committed (see the next section). The Professor characters could take over the "More" layer (F) and the vocabulary (words) in A.

---

## (earlier handoff, still accurate) START HERE: grown-ups layer details (handoff written 2026-10-17)

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
