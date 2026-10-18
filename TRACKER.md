# App Shelf tracker: features and bugs

One line per item, for every game and for the shelf itself. This file is public, so **never put a name, an email,
or a quote from a private message here**: summarise ("a parent said the timer was hard to see") and link to the
details inside the repo. Longer notes stay in each game's own `PLAN.md` / `KNOWN-BUGS.md`; the tracker is the index.

Check and list it with `node tools/tracker.mjs` (see "How to use" below).

## How to use

- **ID:** `<game-folder>-F<n>` for a feature or `<game-folder>-B<n>` for a bug (`shelf` for the shelf, feedback page
  and tools). Numbers are never reused. Next free number: the highest in this file for that game, plus one.
- **Type:** `feature` or `bug`. The letter in the ID must match.
- **Priority:** `P0` broken, unsafe, or loses saved data (fix first) · `P1` should be in the next release · `P2` worth
  doing · `P3` nice to have.
- **Status:** `idea` (not agreed) · `planned` (agreed, not started) · `doing` · `testing` (built, needs real-world
  testing, e.g. on a phone or with a real key) · `done` (released; "Fixed in" says which version) · `dropped` (decided
  against; say why in Notes).
- **Found:** where it came from: `family`, `playtest`, `feedback form`, `AI review`, `self` (found while building), or
  a version number. **Fixed in:** the version that shipped it, like `1.7`.
- Open items (idea, planned, doing, testing) go in **Open**, newest at the bottom. When an item is done or dropped,
  move its row to **Closed** and fill in "Fixed in". Every release note and commit can cite IDs.
- A bug fix should come with a test or a smoke-run step that fails before the fix (see the game's own notes).
- Feedback from the form arrives by email to the family. Add it here as a one-line summary, never the original.

## Open

| ID | Type | Game | Title | Priority | Status | Found | Fixed in | Notes |
|---|---|---|---|---|---|---|---|---|
| sequence-flow-F1 | feature | sequence-flow | Test the other AI providers (OpenAI, Gemini, DeepSeek, Groq, Mistral, xAI, OpenRouter, own server) | P2 | testing | self | | Built in `builder.js` (1.8), none tested. Model names are guesses; some providers may block calls from a web page (CORS). Mark each provider `tested` in `PROVIDERS` once it works. |
| sequence-flow-F2 | feature | sequence-flow | "Save as new routine" when applying an AI proposal | P2 | planned | self | | Today "Use this" replaces the routine on screen (Undo and the change chips are there). |
| sequence-flow-F3 | feature | sequence-flow | Squeeze: mark steps skippable and show the time skipping them recovers | P2 | planned | self | | Left over from the time-anchored routines plan (PLAN.md, PR 5b). Never auto-skip. |
| sequence-flow-F4 | feature | sequence-flow | Per-block time estimate for tap steps, and a School Morning starter using Finish by | P3 | planned | self | | Timetable assumes about 2 minutes for a tap step. |
| sequence-flow-F5 | feature | sequence-flow | Installable app and offline use (manifest, service worker, icons) | P2 | planned | self | | PLAN.md "PR 6a". Frozen copies under `versions/` must not register the worker. |
| sequence-flow-F6 | feature | sequence-flow | Notifications when a background timer ends while the page is hidden | P3 | idea | self | | PLAN.md "PR 6b". Only works installed on iOS. |
| sequence-flow-F7 | feature | sequence-flow | Export and import of routines (JSON and share link), with the v14 to v15 storage migration | P2 | planned | self | | Design with the v15 schema. Never delete v14 in the same release. |
| sequence-flow-F8 | feature | sequence-flow | Rename, duplicate and move-to-folder for saved routines | P3 | idea | self | | Today: delete only. |
| sequence-flow-F9 | feature | sequence-flow | Per-routine overrides of the cue settings | P3 | idea | self | | |
| sequence-flow-B2 | bug | sequence-flow | Pacer: +1m does not add a breathing cycle | P3 | planned | self | | Total could be set by duration instead of cycles. |
| sequence-flow-F10 | feature | sequence-flow | Replace `confirm()` and `alert()` with in-page dialogs | P3 | planned | self | | The restart confirmation blocks automated testers. |
| sequence-flow-B3 | bug | sequence-flow | Never tested on a real phone: wake lock, background timing, chimes, vibration, voice, Safari and Firefox | P1 | testing | self | | Scenarios are listed in PLAN.md "Known gaps". Also covers the AI Speak button. |
| sequence-flow-B4 | bug | sequence-flow | Cover image is out of date (header now has the AI Builder button) | P3 | planned | self | | Re-render `cover.png` with headless Chrome. |
| shelf-F4 | feature | shelf | Search or filter chips (by age, "for little kids", Chinese) | P3 | idea | AI review | | Not needed yet with 10 apps. |
| shelf-F5 | feature | shelf | "Continue where you left off" strip (needs each game to record what was last played) | P3 | idea | AI review | | Every app shares one origin, so a small shared key could work. |
| shelf-F6 | feature | shelf | A detail page per app (screenshots, what kids learn, privacy and storage) | P3 | idea | AI review | | Today the About panel holds this. |
| shelf-F7 | feature | shelf | Make the shelf installable (Add to Home Screen) | P3 | idea | AI review | | Same work as sequence-flow-F5. |

## Closed

| ID | Type | Game | Title | Priority | Status | Found | Fixed in | Notes |
|---|---|---|---|---|---|---|---|---|
| sequence-flow-B8 | bug | sequence-flow | A deadline that has passed is moved to tomorrow, so a restarted 20 minute sauna becomes a 22 hour timer | P0 | done | family | 1.8 | Deadlines stay on the run's day; the "Your flow needs adjusting" dialog offers Shift the flow, Keep the final deadline or Edit the schedule. Deadline blocks keep their intended length (`plannedSecs`). |
| sequence-flow-F13 | feature | sequence-flow | Explicit Tomorrow setting for deadlines and Start at / Finish by (crossing midnight on purpose) | P1 | done | family | 1.8 | `nextDay` on a block, `anchorTomorrow` on the routine. Old routines that relied on the silent roll now get the dialog and can tick Tomorrow. |
| sequence-flow-F14 | feature | sequence-flow | AI builder: cost explainer, provider choice, and an on/off switch | P1 | done | family | 1.8 | Only Anthropic is tested; see sequence-flow-F1. |
| shelf-F2 | feature | shelf | Feature and bug tracker (`TRACKER.md`, `tools/tracker.mjs`) | P2 | done | family | 1.8 | |
| shelf-F1 | feature | shelf | Ko-fi post for Sequence Flow 1.6 and 1.7 | P3 | dropped | self | | The family does not want Ko-fi post reminders. |
| sequence-flow-B1 | bug | sequence-flow | AI builder's real Anthropic call had never been run against the live service | P1 | done | self | 1.8 | Confirmed working by the family on the live page, 2026-10-18. Other providers are still untested (sequence-flow-F1). |
| shelf-F3 | feature | shelf | Redesigned shelf: Games and Utilities tabs, big icon tiles, expandable About, featured game, shelf version in the footer | P1 | done | family | 2.0 | Shelf 1.0 is frozen at `versions/shelf/1.0/`. |
| sequence-flow-B5 | bug | sequence-flow | Chained clock deadlines added up to over 12 hours and a wrong finish time | P1 | done | family | 1.6 | Deadlines are now laid end to end (`projectSteps`). |
| sequence-flow-B6 | bug | sequence-flow | A deadline block that auto-started after another used a stale duration | P1 | done | self | 1.6 | It now always ends at its clock time. |
| sequence-flow-B7 | bug | sequence-flow | Before starting, the first block counted down from now instead of from its planned start | P2 | done | family | 1.6 | Start at makes Run wait, then start by itself. |
| sequence-flow-F11 | feature | sequence-flow | Start at / Finish by, and a timetable in Build and Run | P1 | done | family | 1.6 | |
| sequence-flow-F12 | feature | sequence-flow | AI Flow Builder (bring your own Anthropic key) | P1 | done | family | 1.7 | Provider choice and the on/off switch are in the 1.8 draft. |

## Pointers to older notes

- Blow Up: `blow-up/KNOWN-BUGS.md` (B1, B2 fixed in 1.4) and `blow-up/PLAN.md`.
- Cosmic Journey: `big-bang/PLAN.md` ("START HERE" and the AI-feedback rounds).
- Ready To Go!: `get-ready/PLAN.md`. Toothbrush: `toothbrush/PLAN.md`.
  These are not copied here yet; add rows as items get picked up.
