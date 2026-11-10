# Spellicious — Handoff Note

## Sound Builder activity (development slice — not a release)

Version and release metadata were deliberately **not** changed in this slice. The current
page is still 4.40. Sound Builder is an additional activity inside `spellicious/index.html`;
it does not add a score, a level, a timer, a new round, a network call or any persistence.

### Files

- `sound-builder-logic.js` (S1, unchanged) — pure slot/word/audio-plan rules.
- `sound-builder-audio.js` (S2, unchanged) — audio adapter and plans.
- `sound-builder-ui.js` (new S3) — `createController({ logic, audio, view })`, the
  browser `createDomView()` used by `index.html`, and two small page-lifecycle guards
  (`createRecognitionSessionGate`, `createStartupSpeechGuard`) that live here so plain
  Node can test the sequences `index.html` relies on.
- `sound-builder-ui.test.mjs` (new) — plain-Node controller/view tests with fake audio,
  a fake view and a fake document.
- `index.html` — panel markup, styles, entry button, three script tags and small lifecycle
  guards only (speech timer, per-session recognition isolation, Space key). Existing app
  behaviour was not restructured.

### Controller contract

`SoundBuilderUI.createController({ logic, audio, view })` exposes:

```
enter()  selectSlot(index)  inputLetter(letter)  setSlotCount(count)
clear()  replay()           setMuted(value)      leave()  dispose()
```

The required view surface is `render(state, settings)`, `celebrate()` and
`stopCelebration()`; that is all the controller needs and all the fake view in the test
file supplies. `settings` is `{ active, muted, slotCount, canReplay }`.

Semantics preserved from S1:

- Fresh entry is an empty three-slot board with slot 1 selected.
- Selection only changes presentation state; it is silent.
- An actual letter change stops the previous operation and any confetti, renders, then plays
  the new S1 plan.
- A change into a recognized complete word that differs from the previous recognized word
  calls `view.celebrate()` once and plays with `{ celebrate: true }`. PAN → CAN therefore
  celebrates CAN without clearing.
- Replay, identical/rejected input, selection, re-render and mute changes never celebrate.
- Clear and 2/3/4-slot changes stop audio and confetti and reset through S1. Clear empties
  the board while keeping the chosen count; a count change starts an empty board at the new
  count.
- Replay never celebrates; an empty plan is silent.
- Mute is enforced in the controller (no `audio.play`) and in S2 (`setMuted` invalidates a
  running operation, including a pending or already-playing positive tone); visual discovery
  still occurs.
- `visibilitychange` (when hidden) cancels activity audio and confetti. `pagehide` is
  registered on the **window** (via `document.defaultView`, or an injected `window`), because
  it is a Window event, and is removed from that same target on disposal. Becoming visible
  again has no branch, so nothing autoplays.
- The mute choice is retained across leave/enter for the page session. State is not
  persisted anywhere; every entry starts at three empty slots.
- `dispose()` removes the controller's document **and window** listeners. The view also has
  its own `dispose()` for its element listeners.

### Entry/exit integration (actual app hooks inspected, not invented)

- Entry first invalidates any microphone-callback token, then runs `stopSpeaking()`
  (cancels `speechSynthesis`, bumps `speechRunId`, clears highlights and queued callbacks),
  `recognition.abort()` (falling back to `recognition.stop()`) and `stopListeningUI()`. No
  microphone capture is started.
- **Recognition sessions are isolated (review fix).** Every `toggleListening()` start
  creates a **new `SpeechRecognition` instance** and a fresh, never-reused token from
  `recognitionGate`. `bindRecognitionHandlersFor(instance, sessionToken)` installs that
  instance's `onstart` / `onresult` / `onerror` / `onend` closures, so a queued event from
  an earlier session is delivered to the earlier instance's handlers and cannot even be
  mistaken for an event from the current one. A callback is still accepted only when its
  own token is current and Sound Builder is closed. Entering the activity calls
  `invalidate()`, which sets the current token to 0; after Back a new session gets a new
  instance and token, so a late `onend`/`onerror` from the old session can no longer clear
  the new session's token or `isListening` state, and an old `onresult` cannot edit the
  page, start a translation or queue speech. The previous instance is aborted before the
  new one starts; if the new `start()` throws, the page restores the previous instance's
  token and handlers. The async translation continuation also checks both `speechRunId`
  and `soundBuilderActive` before rendering or speaking.
- `queueUtterance()` refuses to speak while the activity is open, so a late startup
  speech, translation result or old callback cannot talk over Sound Builder.
- The global Space handler and `toggleListening()` are guarded while the activity is open.
- **Startup speech is generation-guarded (review fix).** The 300 ms first-word timer is
  scheduled through `createStartupSpeechGuard`, which captures `speechRunId` at schedule
  time. Entry cancels the timer *and* `stopSpeaking()` bumps the generation, so opening and
  closing Sound Builder within the delay cannot let the stale callback speak after Back.
  If the optional Sound Builder script failed to load the activity cannot open, and the
  page falls back to the old `soundBuilderActive` check.
- Back/Escape calls `controller.leave()`; the page restores the normal interface, focuses
  the Sound Builder entry button, and never restarts the microphone or speech.
- S1 and S2 contracts were not changed.

### Layout and accessibility

- Centered large construction display that keeps every slot (including empty gaps), large
  slot buttons, 2/3/4-slot controls, Clear, Replay Sound, Mute and Back controls, and an
  A–Z keyboard pinned near the bottom.
- Real `<button>` elements throughout, `aria-pressed` for selection/count/mute, descriptive
  labels for slots and keys, a live region, visible `:focus-visible` rings, and gentle
  active-slot highlighting.
- Minimum 48 CSS-pixel targets (slots are larger); safe-area padding uses
  `env(safe-area-inset-*)`; the panel scrolls rather than clipping and compacts on short
  landscape heights.
- Confetti is skipped entirely under `prefers-reduced-motion: reduce`; the CSS animation is
  also disabled there.

### Automated tests

Command:

```
node --test spellicious/sound-builder-logic.test.mjs \
  spellicious/sound-builder-audio.test.mjs \
  spellicious/sound-builder-ui.test.mjs \
  spellicious/content-safety.test.mjs
```

`content-safety.test.mjs` is unchanged. The new S3 tests cover fill, selection,
replacement, clear, resize, mute, replay, recognized transitions, unknown combinations,
no-op suppression, visibility cleanup, pagehide, exit, disposal and repeated entry, with
CAT, BAT, HAT, PAN, CAN, SUN and FUN (including PAN → CAN). The event tests use a fake
document that carries a `defaultView` window, dispatch `visibilitychange` on the document
and `pagehide` on the window, and assert that pagehide is never registered on the document.
Two explicit cases were added after review: **Clear keeps the chosen 2/3/4 count** and
**mute during the positive tone cancels it without a replay or a new celebration**.

After the second review, seven lifecycle regressions were added for the two integration
gaps:

- **Recognition session isolation:** a stale callback from session one cannot act on, or
  clear the token of, session two after enter → Back → restart the mic; a failed start
  restores the session that was running; repeated entry/exit never revives an old session.
  Production uses the same `createRecognitionSessionGate` from `sound-builder-ui.js` (plus
  a fresh `SpeechRecognition` object per session, which the page owns and this plain-Node
  test cannot instantiate).
- **Startup speech generation:** opening and closing Sound Builder inside the 300 ms delay
  never speaks after Back (timer cancel and generation mismatch are tested separately), a
  stale generation is dropped even if cancel was missed, and the activity-open check and
  explicit cancel are covered. Production uses the same `createStartupSpeechGuard`.

The inline recognition and timer wiring in `index.html` is still not importable by these
plain-Node tests; the guards they call are tested directly, and the browser/iPad checklist
below must confirm the wiring on a real device.

**Run status in this development environment: NOT RUN — pending.** The environment's
permission layer refused every `node --test` / `node -e` / `node --check` invocation and
headless Chrome ("This command requires approval"); only `node --version` was permitted.
The prior review reported all 115 Node tests passing on the previous revision, which did
not include these seven lifecycle cases. The current tree is therefore **unverified by
execution**: a human or an environment that permits test execution must run the command
above (and the existing regression command) before this slice is treated as verified.

### Manual iPad Safari checklist (all items PENDING)

Record each result honestly; do not tick an item without running it.

- [ ] Portrait fit: no clipping; slots, controls, keyboard and safe-area padding visible.
- [ ] Landscape fit: same, including a short landscape height.
- [ ] Every control has at least a 48 CSS-pixel touch target and is reachable.
- [ ] P → PA → PAN: each tap sounds, the construction display keeps visible gaps.
- [ ] S → SU → SUN: same.
- [ ] Recognized words speak naturally (not letter names); no unwanted "uh" on consonants.
- [ ] PAN → CAN by selecting slot 1 and tapping C: CAN celebrates exactly once.
- [ ] Rapid edits: no overlapping, stale or truncated audio; no orphan confetti.
- [ ] Mute during word playback silences it immediately.
- [ ] Mute before a recognized word suppresses playback (visual confetti may show).
- [ ] Mute during the positive tone (just after a recognized word finishes) silences the
      tone; unmute never replays it and never re-celebrates.
- [ ] Clear during/after playback stops everything; the board empties but **keeps the
      selected 2/3/4 count** (e.g. Clear with 4 slots chosen leaves four empty slots,
      selected count still 4), with slot 1 selected.
- [ ] 2/3/4-slot changes stop everything and reset; 3 is the default on every entry.
- [ ] Leave (Back/Escape) during playback: audio and confetti stop; no mic restart.
- [ ] With Translate mode on, say a word, then open Sound Builder before the translation
      settles and press Back: a late result must not change the page or speak after Back.
- [ ] Enter Sound Builder, press Back, then tap the mic again. A late `onend`/`onerror`
      from the first session must not stop the new listening session, and a late
      `onresult` from the first session must not edit the page or speak.
- [ ] Open Sound Builder and press Back again within the first 300 ms: the delayed startup
      word must not speak after Back (check with speech audible and watch the console).
- [ ] Tap the mic twice quickly: the first session is retired, exactly one session ends up
      listening, and no stale `onend`/`onerror` stops it.
- [ ] Opening Sound Builder while the mic is listening aborts capture; Back never restarts
      the microphone by itself.
- [ ] Background the tab during playback: audio and confetti stop; foreground does not autoplay.
- [ ] Repeated entry/exit: no duplicate handlers, duplicate sounds or duplicate confetti.
- [ ] Speech synthesis unavailable: activity remains usable and silent where required.
- [ ] Web Audio unavailable: no crash; recognized words still show and celebrate visually.
- [ ] Regression: child-safe speech filter still blocks unsafe transcripts.
- [ ] Regression: normal microphone start/stop, Stop button and status messages still work.
- [ ] Regression: Translate mode recognition and readback still work after leaving and
      re-entering Sound Builder.
- [ ] Regression: language and Spell-mode switching preserve the displayed word.
- [ ] Regression: spell mode letter highlighting and click-to-speak.
- [ ] Regression: case cycling (lower/UPPER/random) and responsive word sizing.
- [ ] Regression: number phrases, speed selector/curve and voice styles.
- [ ] Regression: Space opens the mic only when Sound Builder is closed.
- [ ] Regression: Cantonese voice selection still never falls back to Mandarin.

### Human listening review (PENDING — required before calling it child-ready)

A person must explicitly assess:

1. **Phoneme accuracy** — short vowels, hard/soft c and g, qu, x, and consonants.
2. **Voice suitability** — child-friendly pace/pitch; no robotic or startling delivery.
3. **Fallback intelligibility** — both browser speech and the Web Audio fallback are
   understandable when the other is unavailable.

Pronunciation quality is **not** verified by this slice. Do not call the activity
child-ready, and do not treat synthesized respellings as verified audio, until this
listening review has passed.

## Update — Version 4.24

- **Child-safe speech:** Expands filtering across every language in the selector.
- **Evasion resistance:** Handles common inflections, compounds, punctuation, spaced letters,
  leetspeak, repeated letters, diacritics, full-width text, and Cyrillic/Greek lookalikes.
- **Phrase matching:** Finds blocked and threatening phrases inside longer transcripts.
- **Unicode:** Preserves combining marks in scripts such as Devanagari.
- **Fail closed:** An unavailable or malformed safety module can no longer pass unchecked speech.
- **Cache safety:** The filter script is versioned with the release URL.
- **Regression tests:** Covers direct profanity, obfuscation, multilingual input, threats, and
  innocent substring collisions.

## Update — Version 4.16

- **Live:** Spellicious 4.18 is the current game at /spellicious/.
- **Mode switching:** Changing language or Spell mode preserves the current displayed word instead of replacing it with a language default.
- **Spell mode:** Speaks each letter and stops when spelling is complete; it no longer repeats the whole word automatically.
- **Responsive display:** Short words remain oversized; longer phrases automatically shrink to fit the available screen width and resize on orientation changes.
- **Case control:** Cycles through lower, UPPER, and Random; Random independently mixes lowercase and uppercase letters in the displayed word.
- **Number phrases:** Embedded 3+ digit strings are spoken digit-by-digit, so “check 123” becomes “check one two three.”
- **Speed curve:** 1x remains natural; 1.5x is moderated and 2x stays within a reliable native speech rate.
- **Reliable word highlighting:** Adds a timing fallback for speech engines that fire only the first boundary event, so later words still turn orange in sequence.
- **Word timing:** Regular phrases use a small double-space pause for clearer word separation while staying in one continuous utterance.
- **Highlight mapping:** Orange word highlighting now follows the spoken-text character positions, including number-safe speech conversions.
- **Click-to-speak:** Each displayed word is clickable and keyboard-activatable; activating a word stops the current playback and speaks only that word.
- **Natural 1x speech:** Default voice now uses a normal human speaking rate, and regular multi-word phrases play as one continuous utterance instead of separate word utterances with browser-inserted pauses. Word-boundary events still drive the orange highlight.
- **Speed:** 2x is now the maximum; the artificial inter-word/inter-letter gap is tiny at 1x (about 15ms) and reaches zero at 2x.
- **Speech recovery:** All utterances go through a guarded queue that resumes the browser engine and reports playback failures.
- **Controls:** Language is a small top-right text dropdown; Voice and Speed are grouped into a compact shared control.
- **Speech stability:** Canceled runs cannot restart stale callbacks; speech resumes before playback; raw rates are kept in a reliable browser range while high-speed gaps still tighten.
- **Speed:** A compact selector offers 0.5x, 0.75x, 1x, 1.5x, 2x, 3x, 4x, 5x, and 10x speech speed; 1x is the default.
- **Spacebar:** Space overrides selector/button focus, cancels speech and highlights, and opens the microphone regardless of settings.
- **Highlighting:** Spell mode highlights each letter/number in both the large display and lower tiles; regular multi-word phrases highlight one large word at a time.
- **Numbers:** Short numbers speak naturally (10 becomes “ten”); longer digit strings remain isolated.
- **Voice styles:** The Voice dropdown offers Default, Robot, Chipmunk, Storyteller, and Slow Motion pitch/rate profiles.
- **Spacebar behavior:** During speech, pressing space cancels playback and opens the microphone; otherwise it toggles the mic.
- **Regular mode:** The large word turns orange while it is spoken and returns to its normal color afterward.
- **Spell mode:** Letters are spoken one at a time and the active letter turns orange; the full word is then spoken and the highlights clear.
- **Mic hint:** A smaller light-grey “space bar also works” line appears beneath “Tap Mic to Speak”.
- **Keyboard:** Pressing the space bar toggles the microphone when a form control is not focused.
- **Screen:** The app-store subtitle text is kept in metadata but removed from the visible game screen.
- **Wordmark:** “Spell” is bold in the standard orange; “icious” is thinner and lighter for a distinct visual pun.
- **Brand:** Official name is Spellicious; the logo hints at the pun with “Spell” + “icious”.
- **Title:** Spellicious: Say & Spell
- **Subtitle:** Free voice spelling, no ads
- **Design source:** This release replaces the previous Say It, Spell It! page with the reviewed Gemini design supplied by the user.
- **Interaction:** The page shows a large spoken word, clickable letter tiles, capitalization control, spell mode, language selection, sample words, and speech playback.
- **Display:** The main word is intentionally oversized for easy reading on phones and tablets.
- **Languages:** The selector includes Cantonese (`zh-HK`) with Cantonese sample words, and the
  initial case state is explicitly labeled lower.
- **Cantonese voice fix:** Cantonese now matches only `zh-HK`, `yue`, or explicitly Cantonese
  voices; it no longer silently picks a Mandarin voice.
- **English start:** English is the default, the first word is “hello,” and the page attempts to
  speak it after loading.
- **Dependencies:** The page uses Tailwind and Lucide from their CDN plus Google Fonts, as supplied by the design source.
- **Historical releases:** Earlier versions remain frozen under versions/speller/ and versions/word-deconstructor/.
- **Future work:** Add sentence mode, improve privacy copy around browser speech services, and consider bringing back a curated phonics bank if this design needs instructional breakdowns again.

## Release

- Current page: spellicious/index.html
- Current URL: https://magicmakersfamily.github.io/apps/spellicious/
- Compatibility redirect: speller/index.html → ../spellicious/
- Current version: 4.24
- Launch date: 2026-09-30
- Release tag: spellicious-v4.24
- Frozen archive: versions/spellicious/4.10/

Before future releases, update the shelf card, README table, feedback game map, versions/index.html, and the frozen release archive. Render spellicious/cover.png, run a browser smoke check, commit, tag, push, and verify the public URL.
