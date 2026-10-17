# Cosmic Journey (big-bang/): notes for Claude

Beta on the shelf since 1.0 (2026-10-17); 2.0 (same day) acted on feedback from three AI reviewers. James is helping develop it; his first draft was a single claude.ai page.
Six chapters (Big Bang → today), each with a canvas scene, a tap mini-game, two hotspot fact cards, a centre-picture
card and a spoken intro from Cosmo the cat.

- **One file**: `index.html` holds the CHAPTERS data (all kid-facing text), drawing, mini-games and UI. Tailwind is compiled
  and inlined between `/* tw:start */` and `/* tw:end */`: run `big-bang/tools/rebuild-css.sh` after adding Tailwind classes.
  No CDN, no Font Awesome (icons are emoji).
- **Voice (read this before touching it)**: Cosmo speaks recorded files `voice/<key>.mp3`, rendered by
  `tools/render-voice.sh` (macOS `say` Samantha + ffmpeg; keys come from `tools/lines.js`). Any text change in CHAPTERS needs a
  re-render. If a file can't play, the browser's `speechSynthesis` reads the same words. The original draft depended on
  `speechSynthesis` only and was silent: on this Mac the browser speech engine accepted `speak()` but never started
  (no `start` event, even for a bare utterance), so don't rely on it alone. Test voice with `window.bigBangNarrator`
  (`played`/`ended`/`fellBack`) after a real tap. Consider re-recording with Kokoro like Blow Up/Brush Buddy.
- **2.0 teaching structure** (keep it for every chapter): see it → do it (tap) → watch what changed (a ~3.8 s payoff drawn on the
  canvas, `payoff`/`pt()`) → name it (kid words first, then the science word) → connect it (fun fact, Big question) → remember it
  (sticker, story line). The Big Bang is *space stretching* (grid + dots, `drawBang`), never a blast from a centre; keep "there is no
  middle". Story line in the footer squashes the real gaps (`GAP_YEARS`). Stickers + seen cards live in `big-bang:stickers/seen`.
  End screen has a put-the-story-in-order game. Ideas not done yet: Story Journey vs Free Explore, "zoom in" detail cards, scale
  comparisons on more cards, Kokoro voice, background music (user asked for Vivaldi's Spring: needs a licensed recording, see below).
- Never collectable before the Big Bang in chapter 1. Saved on device: sound/voice switches and finished chapters
  (`big-bang:` localStorage keys).
- Release rules are in the repo CLAUDE.md (version on card, page footer and feedback links; tag `big-bang-vX.Y`; freeze).
