/*  Sound Builder — activity controller and DOM view (S3)
 *
 *  This file glues the pure rules (S1, `sound-builder-logic.js`) and the audio
 *  adapter (S2, `sound-builder-audio.js`) to a small activity panel.  It owns
 *  no rules of its own: every state transition is delegated to S1 and every
 *  sound is delegated to S2.  It never performs a lookup, a network request or
 *  a speech call with a constructed string.
 *
 *  Public shape:
 *
 *      const controller = SoundBuilderUI.createController({
 *          logic: SoundBuilderLogic,
 *          audio: SoundBuilderAudio.createAudio(),
 *          view
 *      });
 *
 *      controller.enter();          // fresh empty three-slot board
 *      controller.selectSlot(0);    // silent
 *      controller.inputLetter('P'); // cancel, render, play
 *      controller.setSlotCount(4);  // stop, reset, no audio
 *      controller.clear();          // stop, reset, no audio
 *      controller.replay();         // play the plan, never celebrates
 *      controller.setMuted(true);   // retained for this page session
 *      controller.leave();          // stop audio and confetti
 *      controller.dispose();        // remove document listeners
 *
 *  `view` is fully injected so the controller can run in plain Node:
 *
 *      view.render(state, settings)  state: { slots, selectedIndex }
 *                                    settings: { active, muted, slotCount,
 *                                                canReplay }
 *      view.celebrate()              start one brief confetti effect
 *      view.stopCelebration()        cancel any running confetti
 *
 *  `createDomView(options)` is the browser implementation used by
 *  `spellicious/index.html`.  It expects the panel markup in that page and
 *  exposes the three methods above plus `attach(controller)` and `dispose()`.
 *
 *  Two page-lifecycle helpers live here so plain-Node tests can exercise the
 *  exact sequences `index.html` relies on:
 *
 *      createRecognitionSessionGate()
 *          startSession() / restoreSession(token) / invalidate() /
 *          setActivityActive(value) / currentToken() / isCurrent(token)
 *
 *      createStartupSpeechGuard({ isActivityActive, getSpeechRunId, speak,
 *                                 setTimeout?, clearTimeout? })
 *          schedule(delay) / cancel()
 *
 *  They are pure and use injected timers/callbacks; they never touch the DOM.
 *
 *  Lifecycle rules implemented here:
 *  - Selection is silent.  Only an actual letter change touches audio.
 *  - On an actual letter change: stop the old operation, stop confetti,
 *    render, then play the new plan.
 *  - A change into a *different* recognized complete word celebrates once.
 *    Replay, repeated identical input, mute changes and selection never do.
 *  - Clear and slot-count changes stop everything and reset through S1.
 *  - A hidden document and the window's `pagehide` cancel activity audio
 *    and confetti but do not restart anything when the page becomes visible
 *    again.
 *  - The chosen mute setting survives `leave()`/`enter()` for this page
 *    session; no state is persisted anywhere.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SoundBuilderUI = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const ENTRY_SLOT_COUNT = 3;
    const DEFAULT_MUTE = false;

    function cloneState(state) {
        return {
            slots: Array.isArray(state && state.slots) ? state.slots.slice() : [],
            selectedIndex: state && Number.isInteger(state.selectedIndex) ? state.selectedIndex : null
        };
    }

    function planIsAudible(plan) {
        if (!plan || plan.kind === 'silent') return false;
        if (plan.kind === 'word') return true;
        return plan.kind === 'sequence' && Array.isArray(plan.units) && plan.units.length > 0;
    }

    // ── Page lifecycle guards ────────────────────────────────────────────
    //
    //  The Spellicious page uses these two helpers.  They are pure and take
    //  injectable timers/callbacks so plain-Node tests can prove the exact
    //  sequences that are hard to reproduce by hand in a browser.

    // Recognition sessions share one SpeechRecognition object, so a late
    // onstart/onresult/onerror/onend from an old session can otherwise land
    // on top of a new one.  Every start gets a fresh, never-reused token;
    // callbacks carry the token of the session that produced them and are
    // ignored unless that session is still the current one.
    function createRecognitionSessionGate() {
        let currentToken = 0;
        let issuedToken = 0;
        let activityActive = false;

        return {
            startSession() {
                issuedToken += 1;
                currentToken = issuedToken;
                return currentToken;
            },
            // A failed `recognition.start()` (an impatient double tap) leaves
            // the already-running session in charge.
            restoreSession(token) {
                currentToken = token;
            },
            invalidate() {
                currentToken = 0;
            },
            setActivityActive(value) {
                activityActive = !!value;
            },
            currentToken() {
                return currentToken;
            },
            isCurrent(token) {
                return token !== 0 && token === currentToken && !activityActive;
            }
        };
    }

    // The page speaks its first word after a short delay.  A guard captures
    // the speech generation when it schedules, so opening and closing the
    // activity inside that delay (which bumps the generation) cannot let the
    // stale callback speak after Back.  `cancel()` also removes the timer when
    // the activity opens.
    function createStartupSpeechGuard(options) {
        const settings = options || {};
        const setTimer = typeof settings.setTimeout === 'function'
            ? settings.setTimeout : setTimeout;
        const clearTimer = typeof settings.clearTimeout === 'function'
            ? settings.clearTimeout : clearTimeout;
        const isActivityActive = typeof settings.isActivityActive === 'function'
            ? settings.isActivityActive : function () { return false; };
        const getSpeechRunId = typeof settings.getSpeechRunId === 'function'
            ? settings.getSpeechRunId : function () { return 0; };
        const speak = typeof settings.speak === 'function'
            ? settings.speak : function () {};

        let timer = null;
        let scheduledRunId = null;

        function cancel() {
            if (timer !== null) clearTimer(timer);
            timer = null;
            scheduledRunId = null;
        }

        function schedule(delay) {
            cancel();
            scheduledRunId = getSpeechRunId();
            timer = setTimer(function () {
                const runId = scheduledRunId;
                timer = null;
                scheduledRunId = null;
                if (isActivityActive() || getSpeechRunId() !== runId) return;
                speak();
            }, delay);
        }

        return { schedule, cancel };
    }

    // ── Controller ───────────────────────────────────────────────────────

    function createController(options) {
        const settings = options || {};
        const logic = settings.logic;
        const audio = settings.audio;
        const view = settings.view;

        if (!logic || typeof logic.createState !== 'function' ||
            typeof logic.selectSlot !== 'function' ||
            typeof logic.enterLetter !== 'function' ||
            typeof logic.clearState !== 'function' ||
            typeof logic.resizeState !== 'function' ||
            typeof logic.selectAudio !== 'function') {
            throw new TypeError('createController needs an S1 logic module');
        }
        if (!audio || typeof audio.play !== 'function' || typeof audio.stop !== 'function' ||
            typeof audio.setMuted !== 'function') {
            throw new TypeError('createController needs an S2 audio adapter');
        }
        if (!view || typeof view.render !== 'function' || typeof view.celebrate !== 'function' ||
            typeof view.stopCelebration !== 'function') {
            throw new TypeError('createController needs a view with render/celebrate/stopCelebration');
        }

        const doc = settings.document ||
            (typeof document !== 'undefined' ? document : null);
        // `pagehide` is a Window event, not a Document event.  In a browser
        // `document.defaultView` is that window; tests (and unusual hosts) may
        // inject one explicitly.
        const win = settings.window ||
            (doc && doc.defaultView ? doc.defaultView : null) ||
            (typeof window !== 'undefined' ? window : null);

        let active = false;
        let disposed = false;
        let muted = DEFAULT_MUTE;
        let state = logic.createState(ENTRY_SLOT_COUNT);
        // The last recognized word of the current build.  A new word that
        // differs from this one is a transition worth celebrating; replay and
        // re-renders never touch it.
        let recognizedWord = null;

        function currentSettings() {
            return {
                active,
                muted,
                slotCount: state.slots.length,
                canReplay: state.slots.some(slot => slot !== null)
            };
        }

        function render() {
            if (!disposed) view.render(cloneState(state), currentSettings());
        }

        function stopOutput() {
            audio.stop();
            view.stopCelebration();
        }

        // Hidden tabs and bfcache navigation must never leave Sound Builder
        // audio or confetti running.  Reaching the front again is deliberately
        // silent: there is no `visible` branch and therefore no autoplay.
        function onVisibilityChange() {
            if (doc && doc.hidden) stopOutput();
        }

        function onPageHide() {
            stopOutput();
        }

        if (doc && typeof doc.addEventListener === 'function') {
            doc.addEventListener('visibilitychange', onVisibilityChange);
        }
        if (win && typeof win.addEventListener === 'function') {
            win.addEventListener('pagehide', onPageHide);
        }

        function removeDocumentListeners() {
            if (doc && typeof doc.removeEventListener === 'function') {
                doc.removeEventListener('visibilitychange', onVisibilityChange);
            }
            if (win && typeof win.removeEventListener === 'function') {
                win.removeEventListener('pagehide', onPageHide);
            }
        }

        function enter() {
            if (disposed) return;
            active = true;
            state = logic.createState(ENTRY_SLOT_COUNT);
            recognizedWord = null;
            stopOutput();
            audio.setMuted(muted);
            render();
        }

        function selectSlot(index) {
            if (disposed || !active) return;
            const next = logic.selectSlot(state, index);
            if (next === state) return;
            state = next;
            // Selection is silent: no audio call, no confetti change.
            render();
        }

        function inputLetter(letter) {
            if (disposed || !active) return;

            const next = logic.enterLetter(state, letter);
            if (next === state) return; // invalid, identical or full board

            state = next;

            // Every actual letter change invalidates whatever came before.
            stopOutput();

            const plan = logic.selectAudio(state);
            const word = plan && plan.kind === 'word' ? plan.word : null;
            const celebrate = word !== null && word !== recognizedWord;
            recognizedWord = word;

            render();
            if (celebrate) view.celebrate();

            // Muting is enforced here as well as in the adapter: a muted
            // activity still shows its discovery, but never schedules audio.
            if (!muted && planIsAudible(plan)) {
                audio.play(plan, { celebrate });
            }
        }

        function setSlotCount(count) {
            if (disposed || !active) return;
            if (count !== 2 && count !== 3 && count !== 4) return;
            if (count === state.slots.length) return;

            stopOutput();
            state = logic.resizeState(state, count);
            recognizedWord = null;
            render();
        }

        function clear() {
            if (disposed || !active) return;

            stopOutput();
            state = logic.clearState(state);
            recognizedWord = null;
            render();
        }

        function replay() {
            if (disposed || !active) return;

            // Replay replaces any current playback but never celebrates.
            audio.stop();
            const plan = logic.selectAudio(state);
            if (muted || !planIsAudible(plan)) return;
            audio.play(plan, { celebrate: false });
        }

        function setMuted(value) {
            if (disposed) return;
            muted = !!value;
            // S2 stops any current operation when muted, including a pending
            // positive tone.  Unmuting never starts audio by itself.
            audio.setMuted(muted);
            if (active) render();
        }

        function leave() {
            if (disposed || !active) return;
            active = false;
            stopOutput();
            recognizedWord = null;
            render();
        }

        function dispose() {
            if (disposed) return;
            if (active) {
                active = false;
                render();
            }
            stopOutput();
            removeDocumentListeners();
            // The audio adapter belongs to the page, but an optional view
            // dispose hook lets a browser view remove its own element listeners.
            if (typeof view.dispose === 'function') view.dispose();
            disposed = true;
        }

        function isActive() {
            return active && !disposed;
        }

        return {
            enter,
            selectSlot,
            inputLetter,
            setSlotCount,
            clear,
            replay,
            setMuted,
            leave,
            dispose,
            isActive
        };
    }

    // ── DOM view ─────────────────────────────────────────────────────────

    const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const CONFETTI_COLORS = ['#f97316', '#fbbf24', '#fb7185', '#34d399', '#60a5fa', '#a78bfa'];

    function createDomView(options) {
        const settings = options || {};
        const doc = settings.document ||
            (typeof document !== 'undefined' ? document : null);
        const onExit = typeof settings.onExit === 'function' ? settings.onExit : null;

        const panel = doc ? doc.getElementById('soundBuilderPanel') : null;
        const construction = doc ? doc.getElementById('sbConstruction') : null;
        const slotsGroup = doc ? doc.getElementById('sbSlots') : null;
        const keyboard = doc ? doc.getElementById('sbKeyboard') : null;
        const muteBtn = doc ? doc.getElementById('sbMute') : null;
        const countButtons = doc ? Array.from(doc.querySelectorAll('[data-count]')) : [];
        const clearBtn = doc ? doc.getElementById('sbClear') : null;
        const replayBtn = doc ? doc.getElementById('sbReplay') : null;
        const backBtn = doc ? doc.getElementById('sbBack') : null;
        const status = doc ? doc.getElementById('sbStatus') : null;
        const slotButtons = slotsGroup ? Array.from(slotsGroup.querySelectorAll('[data-slot]')) : [];

        let controller = null;
        let lastSettings = { active: false, muted: DEFAULT_MUTE, slotCount: ENTRY_SLOT_COUNT, canReplay: false };
        let lastActive = false;
        let confettiLayer = null;
        let confettiTimer = null;
        let confettiWindow = null;
        const listeners = [];

        function listen(element, type, handler) {
            if (!element || typeof element.addEventListener !== 'function') return;
            element.addEventListener(type, handler);
            listeners.push({ element, type, handler });
        }

        function buildKeyboard() {
            if (!keyboard || keyboard.dataset.sbReady === 'true') return;
            for (const letter of LETTERS) {
                const button = doc.createElement('button');
                button.type = 'button';
                button.className = 'sb-key';
                button.dataset.letter = letter;
                button.textContent = letter;
                button.setAttribute('aria-label', `Sound of ${letter}`);
                keyboard.appendChild(button);
            }
            keyboard.dataset.sbReady = 'true';
        }

        function setBackgroundInert(isActive) {
            if (!doc || typeof doc.querySelectorAll !== 'function') return;
            const regions = doc.querySelectorAll('body > header, body > main, body > footer');
            for (const region of regions) {
                if (isActive) region.setAttribute('inert', '');
                else region.removeAttribute('inert');
            }
        }

        function renderConstruction(state) {
            if (!construction) return;
            const fragment = doc.createDocumentFragment();
            const descriptions = [];

            state.slots.forEach((letter, index) => {
                const cell = doc.createElement('span');
                const filled = typeof letter === 'string' && letter.length > 0;
                cell.className = 'sb-display-slot ' + (filled ? 'is-filled' : 'is-empty');
                cell.textContent = filled ? letter : '';
                cell.setAttribute('aria-hidden', 'true');
                fragment.appendChild(cell);
                descriptions.push(`slot ${index + 1} ${filled ? letter : 'empty'}`);
            });

            construction.replaceChildren(fragment);
            construction.setAttribute('aria-label', `Build: ${descriptions.join(', ')}`);
        }

        function renderSlots(state) {
            slotButtons.forEach((button, index) => {
                const visible = index < lastSettings.slotCount;
                const letter = state.slots[index];
                const selected = state.selectedIndex === index;
                const filled = typeof letter === 'string' && letter.length > 0;

                button.hidden = !visible;
                button.textContent = filled ? letter : String(index + 1);
                button.classList.toggle('is-filled', filled);
                button.classList.toggle('is-selected', selected);
                button.setAttribute('aria-pressed', selected ? 'true' : 'false');
                button.setAttribute('aria-label',
                    `Slot ${index + 1}${filled ? `, ${letter}` : ', empty'}${selected ? ', selected' : ''}`);
            });
        }

        function renderControls() {
            for (const button of countButtons) {
                const count = Number(button.dataset.count);
                const pressed = count === lastSettings.slotCount;
                button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
            }

            if (muteBtn) {
                const muted = !!lastSettings.muted;
                muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
                muteBtn.textContent = muted ? 'Unmute' : 'Mute';
                muteBtn.setAttribute('aria-label',
                    muted ? 'Unmute Sound Builder audio' : 'Mute Sound Builder audio');
            }

            if (replayBtn) {
                // An empty replay is silent; keeping the button enabled avoids
                // extra state without pretending a disabled control exists.
                replayBtn.setAttribute('aria-disabled', lastSettings.canReplay ? 'false' : 'true');
            }
        }

        function render(state, renderSettings) {
            const nextSettings = renderSettings || {};
            const wasActive = lastActive;
            lastSettings = {
                active: !!nextSettings.active,
                muted: !!nextSettings.muted,
                slotCount: Number(nextSettings.slotCount) || ENTRY_SLOT_COUNT,
                canReplay: !!nextSettings.canReplay
            };
            lastActive = lastSettings.active;

            if (!panel) return;

            panel.hidden = !lastSettings.active;
            if (doc.body) doc.body.classList.toggle('sb-open', lastSettings.active);
            setBackgroundInert(lastSettings.active);

            if (!lastSettings.active) {
                stopCelebration();
                if (wasActive && status) status.textContent = '';
                return;
            }

            renderConstruction(state);
            renderSlots(state);
            renderControls();

            if (!wasActive) {
                if (status) status.textContent = 'Sound Builder opened. Choose a slot, then tap a letter.';
                const selected = Number.isInteger(state.selectedIndex) ? state.selectedIndex : 0;
                const target = slotButtons[selected] || slotButtons[0];
                if (target && typeof target.focus === 'function') target.focus();
            }
        }

        function stopCelebration() {
            if (confettiTimer !== null) {
                const clearer = confettiWindow && typeof confettiWindow.clearTimeout === 'function'
                    ? confettiWindow.clearTimeout.bind(confettiWindow)
                    : clearTimeout;
                clearer(confettiTimer);
                confettiTimer = null;
            }
            if (confettiLayer && confettiLayer.parentNode) {
                confettiLayer.parentNode.removeChild(confettiLayer);
            }
            confettiLayer = null;
            confettiWindow = null;
        }

        function celebrate() {
            stopCelebration();
            if (!doc || !doc.body) return;

            const win = doc.defaultView || null;
            if (win && typeof win.matchMedia === 'function' &&
                win.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return; // motion-sensitive players get the sound, not the shower
            }

            const layer = doc.createElement('div');
            layer.className = 'sb-confetti';
            layer.setAttribute('aria-hidden', 'true');

            for (let i = 0; i < 16; i += 1) {
                const piece = doc.createElement('span');
                piece.className = 'sb-confetti-piece';
                piece.style.setProperty('--x', `${(Math.random() * 2 - 1) * 42}vw`);
                piece.style.setProperty('--dx', `${(Math.random() * 2 - 1) * 18}vw`);
                piece.style.setProperty('--r', `${Math.random() * 360}deg`);
                piece.style.setProperty('--delay', `${Math.random() * 120}ms`);
                piece.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
                layer.appendChild(piece);
            }

            doc.body.appendChild(layer);
            confettiLayer = layer;
            confettiWindow = win;
            const schedule = win && typeof win.setTimeout === 'function'
                ? win.setTimeout.bind(win)
                : setTimeout;
            confettiTimer = schedule(stopCelebration, 1100);
        }

        function back() {
            if (controller) controller.leave();
            if (onExit) onExit();
        }

        buildKeyboard();

        listen(keyboard, 'click', event => {
            const button = event.target && typeof event.target.closest === 'function'
                ? event.target.closest('button[data-letter]')
                : null;
            if (!button || !controller) return;
            controller.inputLetter(button.dataset.letter);
        });

        listen(slotsGroup, 'click', event => {
            const button = event.target && typeof event.target.closest === 'function'
                ? event.target.closest('button[data-slot]')
                : null;
            if (!button || !controller) return;
            controller.selectSlot(Number(button.dataset.slot));
        });

        for (const button of countButtons) {
            listen(button, 'click', () => {
                if (!controller) return;
                controller.setSlotCount(Number(button.dataset.count));
            });
        }

        listen(clearBtn, 'click', () => {
            if (controller) controller.clear();
        });

        listen(replayBtn, 'click', () => {
            if (controller) controller.replay();
        });

        listen(muteBtn, 'click', () => {
            if (controller) controller.setMuted(!lastSettings.muted);
        });

        listen(backBtn, 'click', back);

        listen(doc, 'keydown', event => {
            if (!lastSettings.active) return;
            if (event.key !== 'Escape') return;
            event.preventDefault();
            back();
        });

        function attach(nextController) {
            controller = nextController || null;
        }

        function dispose() {
            for (const entry of listeners) {
                if (entry.element && typeof entry.element.removeEventListener === 'function') {
                    entry.element.removeEventListener(entry.type, entry.handler);
                }
            }
            listeners.length = 0;
            stopCelebration();
            setBackgroundInert(false);
            if (panel) panel.hidden = true;
            if (doc.body) doc.body.classList.remove('sb-open');
            controller = null;
        }

        return {
            render,
            celebrate,
            stopCelebration,
            attach,
            dispose
        };
    }

    return {
        createController,
        createDomView,
        createRecognitionSessionGate,
        createStartupSpeechGuard
    };
}));
