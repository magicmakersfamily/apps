# Sequence Flow: notes for Claude

A routine builder and step runner (Utilities on the shelf, beta). Read `PLAN.md` first: it has the constraints, what has
shipped, the next work (PR 6 PWA and notifications, then the AI Flow Builder with the user's own API key), and the backlog.

- Files: `index.html` (page, styles, UI and engine), `logic.js` (pure logic), `logic.test.js`
  (`node --test sequence-flow/logic.test.js`), `tools/rebuild-css.sh` (recompiles the inlined Tailwind).
- Never break saved routines (`localStorage` v14 keys). Keep the shelf rules from the repo `CLAUDE.md` (static, no new
  third-party calls, version and tag and freeze on every release).
