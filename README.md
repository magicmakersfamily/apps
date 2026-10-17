# The App Shelf

Learning games for curious kids, published with GitHub Pages:
**https://magicmakersfamily.github.io/apps/**

Every game is a self-contained static web page (HTML, CSS and JavaScript). There is no
server, no build step and no tracking. Progress is saved in each player's own browser
(`localStorage`).

## Layout

```
index.html          the shelf: one card per game
aquarium/           James's Nature Aquarium
  index.html        page, graphics, sound and interface
  sim.js            the ecosystem model (hour-by-hour simulation)
  cover.png         1200×744 card image, also used for link previews
mid-autumn/         Mid-Autumn Mayhem
  index.html        page, city scene, sound, Moon Tales and interface
  sim.js            the festival model (celebration score and trouble meters)
  cover.png         card image (render with index.html#cover)
blow-up/            Blow Up (beta)
  index.html        page, scenes, characters, storyteller, sound and interface
  sim.js            the feelings model (pressure bucket, jars, phases after a blow-up)
  content.js        all cards, days, science cards and spoken lines
  voice/            recorded storyteller voices (see PLAYTEST.md to re-record)
  sim.test.js       engine tests (node --test)
  PLAN.md           the 1.4 / 2.0 plan (with DECISIONS.md, KNOWN-BUGS.md, CLAUDE.md)
  cover.png         card image (render with index.html#cover)
spellicious/ Spellicious
  index.html        page, mic input, syllable/sound breakdown and interface
  cover.png         1200×744 card image
get-ready/          Ready To Go! (departure countdown with spoken steps)
  PLAN.md           handoff: where development stands and what is next (Apple Maps)
  index.html        page, timer, steps, destination ETA
  cover.png         1200×744 card image
sequence-flow/      Sequence Flow (beta utility: routine builder and step timer)
big-bang/           Cosmic Journey (beta): Big Bang to today, six chapters, a talking cosmic cat and a mini-game each
  index.html        the whole game (canvas scenes, mini-games, narrator, inlined Tailwind CSS)
  music/spring.mp3  background music: Vivaldi, Spring (Allegro), played by John Harrison, CC BY-SA 4.0 (credit in the game)
  voice/            Cosmo's recorded lines (re-record with tools/render-voice.sh; macOS say + ffmpeg)
  tools/            rebuild-css.sh (recompile the inlined Tailwind), render-voice.sh, lines.js
  cover.png         1200×744 card image (render with index.html#cover)
toothbrush/         Brush Buddy (beta; called Toothbrush Coach in 2.1–2.3, Toothbrush Timer before)
  PLAN.md           handoff: status, what is next, and the family's product notes
  lesson.js         the lesson model: cues, sugar bugs, brush pose, timeline
  lesson.test.js    model tests (node --test)
  index.html        page, mouth drawing, audio queue, settings
  lines.json        every spoken line (re-record with tools/render-voice.py)
  voice/            recorded lines (Kokoro-82M, af_heart)
  cover.png         1200×744 card image
renzi/              Character Book 認字簿 (beta): a daily Chinese story, a stroke-order writing pad, words I know
  index.html        the whole app (full-screen, iPad first)
  hanzi-writer.min.js  Hanzi Writer 3.7.2 (MIT), vendored so nothing loads from a CDN
  strokes.json      stroke outlines and centre lines for the characters in the stories (Make Me a Hanzi data)
  content/          the daily story: days.json, known.json, dayNN/story.json and p1–p6.jpg (updated every morning)
  SETUP.md          how a parent sets up the private progress log (no secrets in this repo)
  cover.png         1200×744 card image
versions/           past releases, still playable (versions/<game>/<X.Y>/), see versions/index.html
tools/              freeze-version.sh: freeze a tagged release into versions/
.nojekyll           serve files as-is
```

## Games

| Game | Folder | Version | Launched |
|---|---|---|---|
| James’s Nature Aquarium | `aquarium/` | 3.4 | 2026-09-24 |
| Mid-Autumn Mayhem | `mid-autumn/` | 1.7 | 2026-09-25 |
| Blow Up (beta) | `blow-up/` | 1.4 | 2026-09-27 |
| Spellicious | `spellicious/` | 4.40 | 2026-09-30 |
| Ready To Go! | `get-ready/` | 1.4 | 2026-10-02 |
| Brush Buddy (beta) | `toothbrush/` | 2.4 | 2026-10-03 |
| Cosmic Journey 宇宙之旅 (beta) | `big-bang/` | 2.1 | 2026-10-17 |
| Character Book 認字簿 (beta) | `renzi/` | 1.0 | 2026-10-12 |
| Sequence Flow (beta; a utility) | `sequence-flow/` | 1.5 | 2026-10-16 |

Past versions stay playable at https://magicmakersfamily.github.io/apps/versions/ (for
grown-ups; each keeps its own saved games). Every release is also a git tag (`blow-up-v1.3`, …).

## Adding a game

1. Put it in its own folder, with an `index.html` and a `cover.png` (1200×744).
2. Add a link back to the shelf (`<a href="../">← All apps</a>`).
3. Add an `<article class="game">` card to the root `index.html`, with a version line:
   `<p class="version"><b>Version 1.0</b> · Launched <time datetime="YYYY-MM-DD">Month D, YYYY</time></p>`.
   The launch date never changes; bump the version on each release (on the card and at the
   bottom of the game page).
4. Commit and push to `main`. GitHub Pages redeploys in about a minute.
