# The Game Shelf — notes for Claude

This repository is the family's public site of learning games for kids:
**https://magicmakersfamily.github.io/games/** (GitHub Pages, served from `main`, root folder).
Everything here is public, so never commit secrets, tokens, personal emails or private notes.

## Who it's for

James and his friends (about age 8–12). Games teach real science and systems thinking through play:
cause and effect, balance, feedback loops. James is learning **Chinese with Traditional characters**,
so games include Traditional Chinese words with pinyin where it fits naturally
(see "Chinese" below). Kid-facing text is plain, friendly and accurate — never babyish, never jargon
without a one-line explanation.

Younger players: James (5) can't read yet. Games for him need a spoken storyteller that sets each
scene and explains what happened, with the game clock waiting while it talks, and no step that needs
reading. `blow-up/` shows how (recorded voices in `blow-up/voice/`, re-recorded with `blow-up/tools/`).

## Layout

```
index.html          the shelf: one <article class="game"> card per game
<game>/index.html   each game in its own folder (short, lowercase, hyphenated name)
<game>/cover.png    1200×744 card image, also used for link previews (og:image)
README.md           human overview + games table (version, launch date)
.nojekyll           serve files as-is
```

Games are static: HTML, CSS and JavaScript only. No build step, no server, no tracking, no
analytics. Progress goes in `localStorage` (wrap every access in try/catch). External requests
only to Google Fonts. Exception, at the family's request: `get-ready/` calls free, keyless services,
and only after the user asks for them: weather by ZIP code (zippopotam.us for the ZIP, the National
Weather Service's latest station observation for current conditions, Open-Meteo for high/low/rain),
place search (Photon, OpenStreetMap) and drive time (OSRM). The page says so next to the ZIP box. Second exception, at the family's request: `renzi/` (Character Book) holds a new day's story every morning
(`renzi/content/`: character lists, titles and story pictures only, never a parent's marks or notes) and, on a
device a parent has set up once with a private link, posts which characters James wrote or tapped to the family's
own Google Sheet (an Apps Script web app). The URL and token are never in this repository; they live in that
device's `localStorage`. See `renzi/SETUP.md`. Graphics are drawn in code (canvas/SVG) and sound is generated with the Web
Audio API, started only from a button press.

## Adding or updating a game

1. **Draft privately first.** Build the game as a claude.ai artifact (private) and get the user's
   approval before anything goes into this repository. Pushing to `main` publishes to the world.
2. **Make it standalone.** Artifact pages lack a document shell. Each game page needs
   `<!doctype html>`, `<html lang="en">`, `<head>` with charset, viewport (`viewport-fit=cover`),
   description, `og:title` / `og:description` / `og:image` (absolute URL under
   `https://magicmakersfamily.github.io/games/<game>/cover.png`), an inline SVG favicon, and a small
   base style: `body { margin: 0 }`, `[hidden] { display: none !important }`, `img { max-width: 100% }`.
   Add an `<a href="../">← All games</a>` link at the top.
3. **Cover image.** Render the game in a good-looking state with headless Chrome at 1200×744:
   `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1200,744 --virtual-time-budget=4000 --screenshot=cover.png <file>`
4. **Version and launch date.** Every game shows `Version X.Y · Launched <Month D, YYYY>` under
   its title on the shelf card and at the bottom of the game page. New games start at 1.0 with
   today's date. The launch date never changes; bump the version on every release (minor for
   tweaks, major for big additions). Keep the README games table in sync.
   **Beta:** a game still being tested with kids shows a purple "Beta" badge next to its version on
   the shelf card and in the game's title, "(beta)" in the version line at the bottom of the page, and
   "(beta)" in the README table. Drop the badge when the family says it's done.
5. **Shelf card.** Add an `<article class="game">` to `index.html`, matching the existing card:
   cover link, title (with the game's Chinese name in a `lang="zh-TW"` span), version line,
   2–3 sentence description, topic tags, meta (ages, progress saved, sound), Play button.
6. **Commit and push** (see Git below), then verify the live site before reporting done:
   poll `https://magicmakersfamily.github.io/games/<game>/` until it returns 200 and contains the
   new version string (usually 30–60 seconds after the push).

## Versions: every release stays playable

- Tag each release `<game>-vX.Y` (annotated, with a one-line summary), then freeze it:
  `tools/freeze-version.sh <game> X.Y <game>-vX.Y`. This copies the tagged files to
  `versions/<game>/X.Y/`, drops dev-only files, fixes `../` links, gives the copy its own saved games
  (localStorage keys prefixed `<game>@X.Y:`), adds noindex, and adds a thin "old version" strip.
  Then add a row to `versions/index.html`.
- Frozen copies are never edited. To roll back, copy a frozen version (or `git checkout <tag> --
  <game>/`) into the live folder and release it as a new version number. To fork an old version in a
  new direction, start a new game folder from that tag.
- `versions/` is linked from the README, not from the kids' shelf.
- A game folder may have its own `CLAUDE.md`, `PLAN.md`, `DECISIONS.md` and `KNOWN-BUGS.md`
  (Blow Up does). Read them before working on that game. They, not chat history or memory, are the
  handoff between sessions.

## Character Book (`renzi/`): daily content

- The 7:20am Chinese-story routine adds `renzi/content/dayNN/` (story.json plus p1–p6.jpg), prepends the day to
  `content/days.json`, refreshes `content/known.json`, and bumps `v` when `strokes.json` changes. It only commits
  files under `renzi/content/` (and `strokes.json` when new characters need stroke data). App changes follow the
  normal version rules above.
- Everything under `renzi/content/` is public. No names beyond "James", no marks, no notes.

## Follow and support links

- The family's Ko-fi page is **https://ko-fi.com/magicmakers**. It is for grown-ups: plain links only (never the Ko-fi
  widget or any script, which would load third-party code and cookies), no pop-ups during play, and never
  an email box that kids could type into.
- Every game ends with the shelf footer ("Made by Magic Makers. More games are on the way. Like this? Buy us
  a mooncake: Ko-fi" / "These games don’t collect any information…") under its version line, and shows the
  Ko-fi links on its end screen, together with a "More from the Game Shelf" card for the other games. The shelf has a
  "For grown-ups" strip above the footer.
- Every game also has "Know someone who might like this? Tell a friend" (Web Share API with the game
  link, falling back to copying it), in its footer and end screen, and the shelf has one too. Games with
  an end screen can offer "Share my night": a picture drawn from the game canvas, shared through the
  share sheet or saved; nothing is sent to us.
- When a new game or a big update ships, draft a short Ko-fi post for the user to publish (what the game
  is, what James was curious about, the play link). Ko-fi notifies followers.

## Feedback page

- `feedback/index.html` is a form for players and parents (which game, what kind, rating, message,
  optional name and reply email, optional version and browser details). It is the one page allowed to
  send data out: on Send it posts to Web3Forms (`api.web3forms.com`), which emails the family. The
  `WEB3FORMS_KEY` in the page only allows sending; with it empty the page says feedback is not on yet.
- Games link to it from their bottom line and end screen as `../feedback/?game=<folder>&v=<version>`
  (add `&kind=bug` for "Report a bug"). Update the version in those links on every release, and add each
  new game to the page's game choices and `GAMES` map.

## Git

- Account: **magicmakersfamily** only. Commit identity for this repository is
  `magicmakersfamily <333827680+magicmakersfamily@users.noreply.github.com>` (already set in the
  local git config; check with `git config user.email` before committing).
- Push over HTTPS. The GitHub CLI lives at `/opt/homebrew/bin/gh` and may not be on the shell
  PATH; this clone has a local credential helper pointing at it. If a push fails with
  "could not read Username", re-add it:
  `git config --local credential.https://github.com.helper '!/opt/homebrew/bin/gh auth git-credential'`
  (after an empty-value entry that resets inherited helpers).
- If `gh auth status` shows a different active account, switch with
  `gh auth switch --hostname github.com --user magicmakersfamily`.
- Write real commit messages: what changed and why.

## Chinese

- Traditional characters, Mandarin, Hanyu Pinyin with tone marks (one syllable per character so
  pinyin can sit above each character as `<ruby>`).
- Mark Chinese text `lang="zh-TW"`; use the fonts "Noto Serif TC", "Songti TC", "PMingLiU".
- For spoken words use `speechSynthesis` with `lang = 'zh-TW'`, preferring a zh-TW voice, then
  zh-CN — never zh-HK or yue (that is Cantonese).
- Exception, at the family's request: `mid-autumn/` speaks Cantonese by default (zh-HK / yue voice,
  Jyutping over the characters) with a button to switch to Mandarin and pinyin. Other games stay Mandarin
  unless the user asks otherwise.
- Double-check every word: Traditional forms (龜 not 龟, 觀察 not 观察), and Chinese words rather
  than Japanese ones (氮 not 窒素, 光合作用 not 光合成).

## Quality bar

- Works on a phone (about 400 px wide) as well as a laptop; light and dark mode.
- If a game has a simulation or scoring model, run it headlessly with a few strategies to check
  the balance: good play should win, obvious mistakes should visibly hurt, nothing should be
  instantly fatal or impossible.
- Keep each game's model and its drawing code separate (the aquarium uses `sim.js` for the
  ecosystem and `index.html` for everything you see and hear).
