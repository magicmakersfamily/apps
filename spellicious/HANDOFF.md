# Spellicious — Handoff Note

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
