# Sequence Flow: plan and handoff

Read this first. It is the handoff between sessions (chat history is not). Live at
https://magicmakersfamily.github.io/apps/sequence-flow/ , shown on the shelf under Utilities, still **beta**.
Current version: **1.8**. Each release is tagged `sequence-flow-vX.Y` and frozen in `versions/sequence-flow/`.

## What it is

A routine builder and step runner for grown-ups (workouts, cooking, mornings, work sprints). Build a sequence of
blocks and sections, run it one step at a time with big timers. One HTML file plus `logic.js`. Static, no tracking,
nothing leaves the device. Origin: built with Gemini and Claude, brought here as v1.4 of the original file.

## Hard constraints (from the v1.2 spec; keep them)

1. Static site. No third-party network calls except Google Fonts for Inter and, only when the person opts in with their
   own key, `api.anthropic.com` from the AI Flow Builder (family-approved exception; the footer says what is sent).
   The footer claim "This app doesn't collect any information" must stay true: nothing goes through us.
2. Never break saved data. Routines live in `localStorage` key `sequence_flow_routines_v14` (last-opened id in
   `sequence_flow_last_v14`). When the schema changes, migrate to `v15` non-destructively: read v15, else read v14 and
   convert, never delete v14 in the same release. New fields are optional with defaults that reproduce old behaviour.
3. Keep the look (dark, indigo, cards). Progressive disclosure: the default Build screen must not get busier.
4. Mobile first, usable at 375px with one thumb. Respect `prefers-reduced-motion`. Real `<button>`s and aria-labels.
5. Pure logic goes in `logic.js` (no DOM) with tests in `logic.test.js`. Run: `node --test sequence-flow/logic.test.js`.
6. Design the schema so export (JSON / share link) stays trivial. Not built yet.

## Working on it

- Edit `index.html` and `logic.js` directly. There is no build step except the inlined Tailwind CSS: after adding or
  changing any Tailwind class (in HTML or in JS template strings) run `sequence-flow/tools/rebuild-css.sh`.
  Icons are CSS masks (`.fa-solid .fa-name`), not Font Awesome; add new ones to the `.fa-*` rules by hand.
- Preview over http (`python3 -m http.server`), not `file://`, so `logic.js` loads.
- Test timing by faking the clock: `Date.now = () => real() + offset`, then call `engineTick()`.
- Release flow is in the repo `CLAUDE.md` (version bump in page header badge, footer, feedback links, shelf card,
  README row; tag; `tools/freeze-version.sh sequence-flow X.Y sequence-flow-vX.Y`; row in `versions/index.html`;
  push; poll the live URL). Every PR below ships as its own minor version.

## Shipped

| Version | What |
|---|---|
| 1.0 | Standalone page on the shelf (CDNs replaced by inlined CSS and SVG icons) |
| 1.1 | Run Again fix, restart-with-changes prompt, repeat-aware Library, Edit/Run buttons, aria-labels, last routine reopens |
| 1.2 | Timers use `endsAt` and the wall clock; silent in-order catch-up after the tab was hidden; cue settings popover (sound, 3-2-1 ticks, vibrate, voice, keep screen on); screen wake lock; flash on every step change; `logic.js` + tests; spec section 6 polish |
| 1.3 | Sets and rest-between per block (1 to 99), section Repeat 1x to 10x plus Custom up to 99, Round/Set labels, compact rest chips, Norwegian 4x4 and Tabata starters |
| 1.4 | Running-timers tray, Move on (timer keeps running), live chip time, "Done around" estimate, Got it / +1m alert, Resume or Discard after refresh (`sequence_flow_active_v1`, 6 hours) |
| 1.8 | Missed deadlines never roll to tomorrow (`dayInstant`/`deadlineMs`, `findConflicts`, `shiftSteps`, `inferPlanned`): Run stops and shows "Your flow needs adjusting" (Shift the flow / Keep the final deadline / Edit the schedule); deadline blocks keep `plannedSecs`; explicit `nextDay` per block and `anchorTomorrow` per routine. AI builder: explainer of cost, provider list (Anthropic tested; OpenAI, Gemini, DeepSeek, Groq, Mistral, xAI, OpenRouter, own server not), on/off switch (bell settings). Repo `TRACKER.md` added |
| 1.7 | AI Flow Builder (`builder.js`, opt-in, bring-your-own Anthropic key in `localStorage` `sequence_flow_ai_v1`, Haiku 5.5 default, Sonnet 5.5 optional): describe or speak a routine, preview with change chips, Use this / Not yet / Undo; edits start from the routine on screen. **The live API call was not tested against the real service before release** (no key in the build environment); first thing to do is paste a key and try it |
| 1.6 | Start at / Finish by anchor (Build, collapsed "Schedule"), timetable in Build and Run, waiting screen then auto-start, clock deadlines laid end to end (`projectSteps`) so totals/"Done around" are right, deadline blocks always end at their clock time, on-track/behind line. Not done from PR 5: Squeeze/`skippable`, per-block `estimate`, School Morning starter |
| 1.5 | Block kinds Timer / Tap (target) / Checklist (optional timer) / Pacer (breathing circle); new starters (Push Day, Sauna, Property Turnover, Weekly Reset, Kids Bedtime, Travel Day) |

## PR 5, time-anchored routines (shipped as 1.6, Squeeze and School Morning still open)

**Owner decision needed first:** the meaning of "Target Clock Deadline". Proposed (assumed unless the owner says
otherwise): the block counts down to the next occurrence of the chosen local time, rolling to tomorrow if already past.

### 5a. Fix Target Clock Deadline (bug)
Observed in 1.0: a block set to "Tomorrow 08:30 AM" still showed and counted down its old 5:00 duration, and the run
header total changed oddly. Required:
- The block counts down to the next occurrence of the time. The big timer shows the real remaining time
  (`h:mm:ss` when over an hour). The block completes when the clock time is reached.
- Before it starts, the display shows the real time to the deadline, not the stale duration.
- Handle DST changes and midnight rollover by recomputing from the wall clock each tick. `logic.js` already has
  `secondsToTarget(timeStr, now)`; Run mode must use it for display and for `endsAt` (the target instant, not now plus
  a duration).
- Header total: count an "until" block's remaining time from now; if the deadline is more than 12 hours away, show the
  deadline label instead of a giant total.
- Acceptance: a deadline 14 hours out shows about 14:00:00, not 5:00. Past times roll to tomorrow. Correct across a
  DST change (test with a fake clock in `logic.test.js`).

### 5b. Routine anchor: Finish by / Start at
- Optional routine-level `finishBy: "HH:MM"` or `startAt: "HH:MM"` in Build, collapsed under the title.
- Pure function `backPlan(steps, anchor, now) -> [{stepId, plannedStart, plannedEnd}]`. Tap steps use an `estimate`
  (default 2 minutes, editable per block, shown "about 2 min").
- Run shows a slim strip: "On track", "4 min behind", "6 min ahead", against the plan. When behind, a one-tap
  "Squeeze" highlights steps marked `skippable: true` and shows the time skipping them recovers. Never auto-skip.
- `startAt` shows a calm waiting screen with a countdown to the start time; keep the wake lock.
- Acceptance: "Finish by 8:15" started at 7:50 with 20 minutes of steps shows On track, and "4 min behind" after 4
  extra minutes (fake clock). Add the School Morning starter (uses Finish by).

## Then: PR 6, PWA, offline, notifications (release 1.7)

### 6a. Installable and offline
- `manifest.webmanifest`: name "Sequence Flow", short_name "Flow", `display: standalone`, theme/background from the
  dark theme, 192 and 512 icons plus a maskable icon, `start_url` and `scope` `/apps/sequence-flow/`.
- Service worker scoped to `/apps/sequence-flow/` caching the shell (HTML, `logic.js`, icons) with a versioned cache
  name, cleaning old caches on activate. It must not control other apps on the shelf. Remember frozen copies under
  `versions/` must not register it (the freeze script rewrites paths; check it).
- `apple-touch-icon` and iOS standalone meta tags.
- Show an "Add to Home Screen" hint only after a completed run, never on first load.
- Acceptance: in airplane mode the installed app loads and runs a saved routine.

### 6b. Notifications (stretch, behind a setting)
- When a background timer or step ends while the page is hidden, show a `Notification` if permission was granted.
  Ask for permission only from a user gesture (a toggle in the cue settings). On iOS this only works when installed.

## Backlog (not yet scheduled)

- **v14 to v15 storage migration** when the schema next changes (see constraint 2). Blocks now also carry `kind`,
  `sets`, `restBetween`, `restAutoStart`, `target`, `checklist`, `pattern`, `cycles`; all optional.
- **Saved-routine management:** rename, duplicate, move-to-folder (today: delete only; Build has the title and the
  Save dialog has the folder).
- **Per-routine overrides** of the cue settings (spec 1c, "later").
- **Pacer:** +1m does not add a breathing cycle; total can be set by duration instead of cycles.
- **Export / import** of routines (JSON and share link). Design with the v15 schema.
- **Replace `confirm()`/`alert()`** with in-page dialogs (the restart confirmation blocks automated testers).
- **Cross-device cover/preview:** `cover.png` is a plain screenshot of Build mode; refresh it when the look changes.

## Known gaps and untested

- Never tested on a real phone: screen lock and wake lock, background timing, audible chimes, vibration (Android),
  voice, and cross-browser behaviour (Safari, Firefox). Spec scenarios to run before calling it 1.0 for real:
  1. Lifter: Push Day with the screen untouched for 5 minutes. Screen stays on, rests auto-start, chime plays.
  2. Yoga: pacer cues with sound off and vibration on (Android); lock and unlock mid-run, timing still right.
  3. Deep work: Pomodoro with the tab backgrounded for a whole sprint; the break has started on return.
  4. Morning: "Finish by 8:15" behind and ahead states (needs PR 5).
  5. Cooking: two background timers alert independently; refresh and Resume works.
  6. Data safety: a profile with v14 routines loads and (later) migrates to v15.
- Resume saves a snapshot of the routine with the run; editing the same routine afterwards does not change a
  resumed run.
- Library "Starter" routines cannot be deleted or renamed (they are copies in code).

## Decisions made

- Block kind is a new field `kind` (the old `type` stays `activity`/`gap`). A block without `kind` is a Timer when the
  timer toggle was on and a Tap otherwise, so old routines behave identically.
- A pacer is a timer whose length comes from its pattern (`expandRoutine` fills in the duration), so totals, resume and
  catch-up work unchanged.
- Generated rests (from Sets and rest) are plain "Rest" steps with no notes.
- "Move on" from a running background timer marks the step done and keeps the timer in the tray; Skip cancels it.
- Version numbers are the shelf's, not the original file's: the first shelf release was 1.0, not 1.4.

## AI Flow Builder (shipped in 1.7): how it works and what is left

- `builder.js` (pure, tested in `builder.test.js`): the model sees a small "AI format" (`toAI`), answers by calling the
  `set_routine` tool with the COMPLETE routine (tool_choice stays `auto`: forced tool use is rejected by these models), and
  `fromAI` validates and clamps it into the app's own routine. Only ids that already exist are kept, so the diff chips
  (`diffRoutines`) work. A failed turn is shown in the chat but never sent back to the model.
- Request: `POST https://api.anthropic.com/v1/messages` with `x-api-key`, `anthropic-version: 2023-06-01`,
  `anthropic-dangerous-direct-browser-access: true`, `output_config.effort: low`, no thinking or sampling params.
- Open: verify with a real key (see the 1.7 row); Speak button (browser speech recognition, English only) untested on
  real devices; a "save as a new routine" option on Use this (today it replaces the routine on screen, with Undo);
  hosted free tier with a hard cap is a later decision.
