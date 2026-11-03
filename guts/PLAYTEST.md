# Recording a GUTS playtest (for grown-ups)

A recording lets us replay a child's real session, exactly, frame by frame: see where they got stuck, look at the
screen at that moment, and keep the session as a test so a fix is proven, not guessed.

## Record

1. On the device the child plays on, open the game once with **`?playtest=1`** at the end of the address:
   `https://magicmakersfamily.github.io/apps/guts/?playtest=1`. The device remembers it. A small red
   **● REC · Save playtest** tag shows in the bottom-left corner while recording is on.
2. Let the child play normally. Don't help unless they ask: the moments they get stuck are what we want.
3. Something worth a look (a laugh, a frown, "I can't get up there")? Press **M** on the keyboard. It adds a marker
   at that moment.
4. When they are done, click the **REC tag** (or **Pause → Save playtest recording**). A file like
   `guts-playtest-2026-11-04-1730.json` lands in Downloads. If the page was closed first, the last session is
   still kept on the device: reopen the game and click the tag.
5. Tell Claude "replay my latest playtest" (it runs `node guts/tools/replay.mjs --latest`), plus anything you noticed.

Turn recording off with `?playtest=0`.

## What is in the file

Only what the game needs to play the session again: the time of each frame, the buttons as the game saw them, the
random seed, the screen size, the browser name and a copy of the game's own saved progress (Food Dex, gardens,
settings). No names, no camera, no microphone, no typing. Nothing is sent anywhere; the file is saved only when you
click. A copy of the last session (up to about 1 MB) stays in the browser's storage until the next session replaces it.

## What happens next

- `node guts/tools/replay.mjs <file>` replays it and writes a short report with pictures: how far each try got,
  where the child was stuck and for how long, markers, blowouts, and whether the replay was **exact** (it checks
  Gus's position and belly every half second against the recording).
- `--save <short-name> --expect reach:<tile>` (or `status:clear`, `noStallNear:<tile>`) keeps it in
  `guts/tests/playtests/` as a test that `node tools/check.mjs` runs every time. Use a short description as the
  name, never a child's name. A saved recording keeps only the browser engine, not the full browser details.
- After the game changes, an old recording no longer replays exactly (it says "drifted"), but its button presses
  still play against the new game, which is how a test proves that a stuck spot is fixed.
