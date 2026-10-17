# Cosmic Journey (big-bang/): notes for Claude

**New session? Read `PLAN.md` ("START HERE") first: it says what is live, what is half-built and how to build the rest.**
Beta on the shelf since 1.0 (2026-10-17); 2.0 (same day) acted on feedback from three AI reviewers. James is helping develop it; his first draft was a single claude.ai page.
Six chapters (Big Bang → today), each with a canvas scene, a tap mini-game, two hotspot fact cards, a centre-picture
card and a spoken intro from Cosmo the cat.

- **One file**: `index.html` holds the CHAPTERS data (all kid-facing text), drawing, mini-games and UI. Tailwind is compiled
  and inlined between `/* tw:start */` and `/* tw:end */`: run `big-bang/tools/rebuild-css.sh` after adding Tailwind classes.
  No CDN, no Font Awesome (icons are emoji).
- **5.2 look**: the guides sit on two perches (Cosmo lower left, Professor lower right) as inline-SVG characters that light up, lean in and show sound arcs while speaking; captions show one or two sentences at a time (`Speaker`, `Caption`, `splitCaption` in `index.html`; details in `PLAN.md`).
- **5.x characters**: Cosmo (🐱, pitched Samantha / Sinji) ASKS and Professor Know-A-Lot (🦉, Daniel / Sinji lowered; Cantonese 知得多教授) EXPLAINS (5.1: all science narration, payoffs, picture cards and answers; Cosmo keeps questions, talk-together and help). Fact circles, Big question and one tappable glossary word per chapter, plus an "Ask the Professor" second answer on fact circles. He *knows a lot, not everything*: keep his lines honest ("scientists think", "we don't know yet"). Data: `ask`, `gloss`, `cast` in `tools/i18n/content_*.py`; clips `ha/h/hm/q/qa/ga/gb`; see `render-voice.sh` and `PLAN.md`.
- **Voice (read this before touching it)**: spoken lines are recorded files `voice/<key>.mp3`, rendered by
  `tools/render-voice.sh` (macOS `say` + ffmpeg pitch shifting, one voice per character; keys come from `tools/lines.js`). Any text change in CHAPTERS needs a
  re-render. If a file can't play, the browser's `speechSynthesis` reads the same words. The original draft depended on
  `speechSynthesis` only and was silent: on this Mac the browser speech engine accepted `speak()` but never started
  (no `start` event, even for a bare utterance), so don't rely on it alone. Test voice with `window.bigBangNarrator`
  (`played`/`ended`/`fellBack`) after a real tap. Consider re-recording with Kokoro like Blow Up/Brush Buddy.
- **2.0 teaching structure** (keep it for every chapter): see it → do it (tap) → watch what changed (a ~3.8 s payoff drawn on the
  canvas, `payoff`/`pt()`) → name it (kid words first, then the science word) → connect it (fun fact, Big question) → remember it
  (sticker, story line). The Big Bang is *space stretching* (grid + dots, `drawBang`), never a blast from a centre; keep "there is no
  middle". Story line in the footer squashes the real gaps (`GAP_YEARS`). Stickers + seen cards live in `big-bang:stickers/seen`.
  End screen has a put-the-story-in-order game. Ideas not done yet: Story Journey vs Free Explore, "zoom in" detail cards, scale
  comparisons on more cards, Kokoro voice, (background music is done: see Music below).
- Never collectable before the Big Bang in chapter 1. Saved on device: sound/voice switches and finished chapters
  (`big-bang:` localStorage keys).
- Release rules are in the repo CLAUDE.md (version on card, page footer and feedback links; tag `big-bang-vX.Y`; freeze).
- **Music**: `music/spring.mp3` is John Harrison's violin recording of Vivaldi's Spring, 1st movement (Wikimedia Commons, CC BY-SA 4.0,
  converted from Ogg to 96 kbps MP3). The credit and licence link must stay in the About panel and the page footer; the share-alike
  licence applies to the converted file. It loads only after the first tap, loops at low volume, dips to 0.07 while Cosmo speaks
  and pauses when the tab is hidden; the 🎵 switch is saved as `big-bang:music`. Keep Wikimedia's source page in the credit.
- **Clear stage (2.2)**: tap targets must never sit under UI. `keepOutZones()` lists Cosmo's face/box, the mini-game panel and the fact circles;
  `steerAround()` pushes floating things out by the nearest side with room. Cosmo's box folds after speaking (`mascotFoldSoon`). The canvas is
  resized by a `ResizeObserver` (the footer wraps after fonts load; before 2.2 the canvas stayed taller than the stage). Test it in a *visible*
  browser tab: hidden tabs don't run `requestAnimationFrame`, so overlap tests there measure a frozen page.
- **Languages (3.0)**: `CHAPTERS_EN` and `CHAPTERS_YUE` hold all chapter text, `UI` holds every interface string (`t('key')`; static HTML uses
  `data-i18n`), `STICKER_TEXT` the sticker names, `JP` the Jyutping for every Cantonese string (one reading per character, `|`-separated, shown by
  `rich()` as `<ruby>`). Cantonese voice clips live in `voice/yue/` (macOS Sinji, `zh_HK`); the browser-voice fallback accepts only `zh-HK`/`yue`
  voices, never Mandarin. Default language: Cantonese when the browser says `zh-HK`/`yue`, else English; the choice is saved as `big-bang:lang`
  (Jyutping on/off as `big-bang:jp`). **When you change any text, change it in BOTH languages**, regenerate `JP` (it was made with the
  `pycantonese` package from the rime-cantonese dictionary: char readings can be wrong for words with several readings, so a Cantonese
  speaker should check) and re-run `tools/render-voice.sh`. Cantonese is written colloquially (嘅, 咗, 喺, 冇, 啲); the "Cosmo" name is 宇宙貓.
  Footer, credits and Ko-fi lines stay English (for grown-ups).
- **4.0**: read `PLAN.md` (decisions + what is next). One glowing dot starts everything (`btn-unlock-audio` unlocks audio, then fires the Big Bang).
  Settings (⚙️) holds language, sound, voice, music, Jyutping (default OFF) and Easy & calm mode (default on when the device asks for reduced motion;
  slower and bigger things, bigger tap area, no pulsing). Taps are forgiving (nearest thing within 62 px, 84 px in easy mode). Touch targets are at
  least 44 px: keep them that way. All panels are `fixed` over the whole screen (inside the stage they got clipped). Each chapter has a `talk`
  question (spoken after the payoff) and a `cal` line (its date in "the universe in one year"); the calendar modal zooms year → December → 31 December.
  **Edit text in `tools/i18n/content_en.py` and `content_yue.py` (not in index.html), then run `tools/i18n/build.py`** (see its docstring).
