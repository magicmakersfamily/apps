# Play checks (dev only, never published)

One command runs every check on the shelf and writes one short report:

```
node tools/check.mjs            # quick, about 40 s: all model tests + each game's Chrome checks
node tools/check.mjs --full     # before a release: also Firefox and WebKit (Safari's engine), more seeds, slow bots
node tools/check.mjs --game guts
```

Setup once per machine: `(cd tools/play && npm ci && npx playwright install firefox webkit)`.
Chrome checks use the installed Google Chrome. Playwright and its browsers stay in `tools/play/node_modules`
and `~/Library/Caches/ms-playwright`, both outside git.

## Pieces

- `harness.mjs`: launches Chrome, Firefox or WebKit; serves the repo itself; replaces `Math.random` with a seeded
  generator before any game script runs (`seed`); can plug in a stub PlayStation pad (`pad: 'standard' | 'raw'`,
  then `window.__padSet({ cross: true, lx: 1 })`); blocks every outside request, so runs never depend on the
  network; collects page errors; writes one JSON **run record** per run.
- `report.mjs`: groups the records into `report.md`: **Broken** (grouped duplicates, ranked by severity, each with
  one command that reproduces it and a screenshot), **How the personas played** (design data), **Speed**.
- `../check.mjs`: runs every `*.test.js` / `*.test.mjs`, then each game's `<game>/tools/suites.json`
  (`quick` and `full` lists of scripts), then the report. Exit code 0 only when nothing is broken.
- `../../.githooks/pre-push`: runs the quick check before a push (skipped for `renzi/content/`, `versions/` and
  Markdown-only pushes). Turn it on per clone: `git config core.hooksPath .githooks`.

## Real playtests (GUTS)

A grown-up records a child's session with `?playtest=1` (`guts/PLAYTEST.md`), and `guts/tools/replay.mjs` replays it
exactly and reports where they got stuck, with pictures. `--save` keeps it in `guts/tests/playtests/` with an
`expect` (reach a tile, finish, no stall near a tile), and the check replays every saved one.
`guts/tools/record-check.mjs` proves on every check that recording and replay still match exactly.

## Broken vs. design data

- **Broken** fails the check: page errors, exceptions, impossible states (NaN position, Gus inside a wall, belly
  out of range), a scene that never ends, a required route that no longer works, controls that do nothing.
- **Design data** never fails anything: where personas stalled for 20 s, fell, blew out, or gave up; finish rates
  and times. It answers "where do different kinds of players struggle?", not "is it fun?" (only kids can answer that).

## Adding a game

Put its browser scripts in `<game>/tools/`, have each one exit non-zero when something is broken and call
`record({ game, scenario, browser, failures: [...] })`, and list them in `<game>/tools/suites.json`.
See `guts/tools/` for a full example. Every playtest report gets an automated check that proves its fix.
