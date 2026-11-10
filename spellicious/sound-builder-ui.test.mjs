/*  Sound Builder — controller/view tests (S3)
 *
 *  Plain Node, no browser, no network, no sockets, no `ps`/`sudo`.  S1 is the
 *  real deterministic logic module; S2 is a fake audio adapter and the view is
 *  a fake that records every render, celebration and cancellation.  A fake
 *  document records the controller's visibility/pagehide listeners, so
 *  background and disposal behaviour is exercised without a DOM.
 *
 *  Run with:
 *      node --test spellicious/sound-builder-ui.test.mjs
 *
 *  These tests prove the *wiring*: state transitions, which actions make
 *  sound, when confetti is requested, mute/replay suppression, cleanup and
 *  repeated entry.  They cannot prove that synthesized phonemes are accurate
 *  or pleasant; that needs a human listening check on a real device.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import logic from './sound-builder-logic.js';
import SoundBuilderUI from './sound-builder-ui.js';

const { createController } = SoundBuilderUI;

// ── Fakes ────────────────────────────────────────────────────────────────

function createFakeAudio() {
    const calls = { play: [], stop: 0, setMuted: [] };
    let muted = false;

    return {
        calls,
        isMuted() {
            return muted;
        },
        play(plan, options) {
            calls.play.push({ plan, options: options || {} });
            return Promise.resolve(muted ? 'muted' : 'completed');
        },
        stop() {
            calls.stop += 1;
        },
        setMuted(value) {
            muted = !!value;
            calls.setMuted.push(muted);
        },
        dispose() {
            /* the controller does not own the adapter */
        }
    };
}

function createFakeView() {
    const calls = { render: [], celebrate: 0, stopCelebration: 0 };

    return {
        calls,
        render(state, settings) {
            calls.render.push({ state, settings });
        },
        celebrate() {
            calls.celebrate += 1;
        },
        stopCelebration() {
            calls.stopCelebration += 1;
        }
    };
}

function createFakeDocument() {
    const listeners = new Map();

    return {
        hidden: false,
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, new Set());
            listeners.get(type).add(handler);
        },
        removeEventListener(type, handler) {
            const set = listeners.get(type);
            if (set) set.delete(handler);
        },
        dispatch(type) {
            const set = listeners.get(type);
            if (!set) return;
            for (const handler of [...set]) handler({ type });
        },
        count(type) {
            return listeners.has(type) ? listeners.get(type).size : 0;
        }
    };
}

function createHarness(options = {}) {
    const view = createFakeView();
    const audio = createFakeAudio();
    const doc = options.document || null;
    const controller = createController({ logic, audio, view, document: doc });
    return { controller, view, audio, doc };
}

function resetCounts(harness) {
    harness.audio.calls.play.length = 0;
    harness.audio.calls.stop = 0;
    harness.audio.calls.setMuted.length = 0;
    harness.view.calls.render.length = 0;
    harness.view.calls.celebrate = 0;
    harness.view.calls.stopCelebration = 0;
}

function type(controller, text) {
    for (const letter of text) controller.inputLetter(letter);
}

function lastRender(harness) {
    return harness.view.calls.render[harness.view.calls.render.length - 1];
}

function lastPlay(harness) {
    return harness.audio.calls.play[harness.audio.calls.play.length - 1];
}

// ── Entry state ──────────────────────────────────────────────────────────

test('enter renders a fresh empty three-slot board with slot 1 selected', () => {
    const h = createHarness();
    h.controller.enter();

    const render = lastRender(h);
    assert.deepEqual(render.state.slots, [null, null, null]);
    assert.equal(render.state.selectedIndex, 0);
    assert.equal(render.settings.active, true);
    assert.equal(render.settings.slotCount, 3);
    assert.equal(render.settings.muted, false);
    assert.equal(render.settings.canReplay, false);

    // Entry is silent: it cancels leftovers but never plays.
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);
    assert.ok(h.audio.calls.setMuted.length >= 1);
});

test('a new entry always returns to empty three slots even after four were used', () => {
    const h = createHarness();
    h.controller.enter();
    h.controller.setSlotCount(4);
    type(h.controller, 'HAND');
    assert.equal(lastRender(h).settings.slotCount, 4);

    h.controller.leave();
    h.controller.enter();

    const render = lastRender(h);
    assert.deepEqual(render.state.slots, [null, null, null]);
    assert.equal(render.settings.slotCount, 3);
});

// ── Building and recognized words ───────────────────────────────────────

test('CAT fills left to right, plays partials, then celebrates the word once', () => {
    const h = createHarness();
    h.controller.enter();
    resetCounts(h);

    h.controller.inputLetter('C');
    assert.deepEqual(lastRender(h).state.slots, ['C', null, null]);
    assert.equal(lastRender(h).state.selectedIndex, 1);
    assert.equal(lastPlay(h).plan.kind, 'sequence');
    assert.equal(lastPlay(h).options.celebrate, false);
    assert.equal(h.view.calls.celebrate, 0);

    h.controller.inputLetter('A');
    assert.deepEqual(lastRender(h).state.slots, ['C', 'A', null]);
    assert.equal(lastPlay(h).plan.kind, 'sequence');
    assert.equal(lastPlay(h).plan.units[0].type, 'blend');
    assert.equal(lastPlay(h).plan.units[0].id, 'ca');
    assert.equal(h.view.calls.celebrate, 0);

    h.controller.inputLetter('T');
    assert.deepEqual(lastRender(h).state.slots, ['C', 'A', 'T']);
    assert.equal(lastRender(h).state.selectedIndex, null);
    assert.equal(lastPlay(h).plan.kind, 'word');
    assert.equal(lastPlay(h).plan.word, 'cat');
    assert.equal(lastPlay(h).options.celebrate, true);
    assert.equal(h.view.calls.celebrate, 1);

    // One confetti request per recognized transition, not per letter.
    assert.equal(h.view.calls.celebrate, 1);
});

const RECOGNIZED = ['CAT', 'BAT', 'HAT', 'PAN', 'SUN', 'FUN'];

for (const word of RECOGNIZED) {
    test(`${word} is recognized, played as a word and celebrated exactly once`, () => {
        const h = createHarness();
        h.controller.enter();
        resetCounts(h);

        type(h.controller, word);

        assert.deepEqual(lastRender(h).state.slots, [...word]);
        assert.equal(lastPlay(h).plan.kind, 'word');
        assert.equal(lastPlay(h).plan.word, word.toLowerCase());
        assert.equal(lastPlay(h).options.celebrate, true);
        assert.equal(h.view.calls.celebrate, 1);
    });
}

test('PAN to CAN celebrates CAN without clearing or losing the other letters', () => {
    const h = createHarness();
    h.controller.enter();
    resetCounts(h);

    type(h.controller, 'PAN');
    assert.equal(lastPlay(h).plan.word, 'pan');
    assert.equal(h.view.calls.celebrate, 1);

    // Replacing a letter starts with an explicit, silent selection.
    h.controller.selectSlot(0);
    assert.equal(lastRender(h).state.selectedIndex, 0);
    assert.equal(h.audio.calls.play.length, 3, 'selection must not play audio');
    assert.equal(h.view.calls.celebrate, 1, 'selection must not celebrate');

    h.controller.inputLetter('C');

    assert.deepEqual(lastRender(h).state.slots, ['C', 'A', 'N']);
    assert.equal(lastPlay(h).plan.kind, 'word');
    assert.equal(lastPlay(h).plan.word, 'can');
    assert.equal(lastPlay(h).options.celebrate, true);
    assert.equal(h.view.calls.celebrate, 2);
});

test('an unknown combination stays silent about correctness and never celebrates', () => {
    const h = createHarness();
    h.controller.enter();
    resetCounts(h);

    type(h.controller, 'ZZZ');

    assert.deepEqual(lastRender(h).state.slots, ['Z', 'Z', 'Z']);
    assert.equal(lastPlay(h).plan.kind, 'sequence');
    assert.equal(h.view.calls.celebrate, 0);

    const settings = lastRender(h).settings;
    assert.deepEqual(Object.keys(settings).sort(),
        ['active', 'canReplay', 'muted', 'slotCount'].sort());
    assert.equal(settings.canReplay, true);
});

// ── Selection and no-op suppression ─────────────────────────────────────

test('slot selection alone is silent and does not cancel or celebrate', () => {
    const h = createHarness();
    h.controller.enter();
    type(h.controller, 'CAT');
    resetCounts(h);

    h.controller.selectSlot(1);

    assert.equal(lastRender(h).state.selectedIndex, 1);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.audio.calls.stop, 0);
    assert.equal(h.view.calls.celebrate, 0);
    assert.equal(h.view.calls.stopCelebration, 0);
});

test('invalid, identical or full-board input is a complete no-op', () => {
    const h = createHarness();
    h.controller.enter();
    type(h.controller, 'CAT');
    h.controller.selectSlot(2);
    resetCounts(h);

    h.controller.inputLetter('T'); // identical to the selected slot
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.audio.calls.stop, 0);
    assert.equal(h.view.calls.render.length, 0);
    assert.equal(h.view.calls.celebrate, 0);

    h.controller.inputLetter('1'); // not an A-Z letter
    h.controller.inputLetter('');
    h.controller.selectSlot(99);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.audio.calls.stop, 0);
    assert.equal(h.view.calls.render.length, 0);
    assert.equal(h.view.calls.celebrate, 0);
});

// ── Clear and count changes ─────────────────────────────────────────────

test('clear stops audio and confetti, resets through S1, and permits a fresh celebration', () => {
    const h = createHarness();
    h.controller.enter();
    type(h.controller, 'CAT');
    resetCounts(h);

    h.controller.clear();

    assert.deepEqual(lastRender(h).state.slots, [null, null, null]);
    assert.equal(lastRender(h).state.selectedIndex, 0);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);
    assert.ok(h.audio.calls.stop >= 1);
    assert.ok(h.view.calls.stopCelebration >= 1);

    // The recognized-word memory was reset, so the same word celebrates again.
    type(h.controller, 'CAT');
    assert.equal(h.view.calls.celebrate, 1);
});

test('count changes stop everything, reset the board, and reject unsupported counts', () => {
    const h = createHarness();
    h.controller.enter();
    type(h.controller, 'CAT');
    resetCounts(h);

    h.controller.setSlotCount(4);

    assert.deepEqual(lastRender(h).state.slots, [null, null, null, null]);
    assert.equal(lastRender(h).settings.slotCount, 4);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);
    assert.ok(h.audio.calls.stop >= 1);
    assert.ok(h.view.calls.stopCelebration >= 1);

    type(h.controller, 'HAND');
    assert.equal(lastPlay(h).plan.word, 'hand');
    assert.equal(lastPlay(h).options.celebrate, true);
    assert.equal(h.view.calls.celebrate, 1);

    resetCounts(h);
    h.controller.setSlotCount(5); // unsupported: ignored
    h.controller.setSlotCount(4); // already four: ignored
    assert.equal(h.view.calls.render.length, 0);
    assert.equal(h.audio.calls.stop, 0);
});

// ── Replay ───────────────────────────────────────────────────────────────

test('replay plays the current plan without celebration; empty replay is silent', () => {
    const h = createHarness();
    h.controller.enter();
    resetCounts(h);

    h.controller.replay();
    assert.equal(h.audio.calls.play.length, 0);

    type(h.controller, 'PAN');
    resetCounts(h);

    h.controller.replay();
    assert.equal(h.audio.calls.play.length, 1);
    assert.equal(lastPlay(h).plan.kind, 'word');
    assert.equal(lastPlay(h).plan.word, 'pan');
    assert.equal(lastPlay(h).options.celebrate, false);
    assert.equal(h.view.calls.celebrate, 0);
    assert.ok(h.audio.calls.stop >= 1, 'replay replaces current playback');
});

// ── Mute ─────────────────────────────────────────────────────────────────

test('mute suppresses all audio, still allows visual discovery, and survives re-entry', () => {
    const h = createHarness();
    h.controller.enter();
    type(h.controller, 'PAN');
    h.controller.selectSlot(0);
    resetCounts(h);

    h.controller.setMuted(true);
    assert.deepEqual(h.audio.calls.setMuted, [true]);
    assert.equal(lastRender(h).settings.muted, true);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);

    // Replacing PAN with CAN while muted: no audio, but the discovery is shown.
    h.controller.inputLetter('C');
    assert.deepEqual(lastRender(h).state.slots, ['C', 'A', 'N']);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 1);

    // Replay while muted is silent too, and still does not celebrate.
    h.controller.replay();
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 1);

    h.controller.setMuted(false);
    assert.deepEqual(h.audio.calls.setMuted, [true, false]);
    assert.equal(h.audio.calls.play.length, 0, 'unmuting must not autoplay');
    assert.equal(h.view.calls.celebrate, 1);

    // A mute chosen earlier is retained across leave/enter in this page session.
    h.controller.setMuted(true);
    h.controller.leave();
    h.controller.enter();
    assert.equal(lastRender(h).settings.muted, true);
    assert.equal(h.audio.isMuted(), true);

    resetCounts(h);
    type(h.controller, 'SUN');
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 1);
});

// ── Visibility, pagehide, exit and disposal ─────────────────────────────

test('hiding the document cancels audio and confetti and never autoplays on return', () => {
    const doc = createFakeDocument();
    const h = createHarness({ document: doc });
    h.controller.enter();
    type(h.controller, 'CAT');
    resetCounts(h);

    doc.hidden = true;
    doc.dispatch('visibilitychange');

    assert.ok(h.audio.calls.stop >= 1);
    assert.ok(h.view.calls.stopCelebration >= 1);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);

    doc.hidden = false;
    doc.dispatch('visibilitychange');
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);
    assert.equal(h.view.calls.render.length, 0, 'returning is silent');
});

test('pagehide cancels activity audio and confetti', () => {
    const doc = createFakeDocument();
    const h = createHarness({ document: doc });
    h.controller.enter();
    type(h.controller, 'SUN');
    resetCounts(h);

    doc.dispatch('pagehide');

    assert.ok(h.audio.calls.stop >= 1);
    assert.ok(h.view.calls.stopCelebration >= 1);
    assert.equal(h.audio.calls.play.length, 0);
});

test('leave closes the view, stops output and does not restart anything', () => {
    const h = createHarness();
    h.controller.enter();
    type(h.controller, 'CAT');
    resetCounts(h);

    h.controller.leave();

    assert.equal(lastRender(h).settings.active, false);
    assert.equal(h.controller.isActive(), false);
    assert.ok(h.audio.calls.stop >= 1);
    assert.ok(h.view.calls.stopCelebration >= 1);
    assert.equal(h.audio.calls.play.length, 0);
    assert.equal(h.view.calls.celebrate, 0);

    // Inputs after leaving are ignored until the next enter().
    h.controller.inputLetter('B');
    assert.equal(h.view.calls.render.length, 1);
});

test('dispose removes listeners and makes further activity inert', () => {
    const doc = createFakeDocument();
    const h = createHarness({ document: doc });
    h.controller.enter();
    type(h.controller, 'CAT');
    assert.equal(doc.count('visibilitychange'), 1);
    assert.equal(doc.count('pagehide'), 1);
    resetCounts(h);

    h.controller.dispose();

    assert.equal(lastRender(h).settings.active, false);
    assert.ok(h.audio.calls.stop >= 1);
    assert.ok(h.view.calls.stopCelebration >= 1);
    assert.equal(doc.count('visibilitychange'), 0);
    assert.equal(doc.count('pagehide'), 0);

    doc.hidden = true;
    doc.dispatch('visibilitychange');
    doc.dispatch('pagehide');
    assert.equal(h.audio.calls.stop, 1, 'removed listeners must not fire');

    h.controller.enter();
    h.controller.inputLetter('C');
    h.controller.clear();
    h.controller.replay();
    assert.equal(h.view.calls.render.length, 1, 'only the closing render happened');
    assert.equal(h.audio.calls.play.length, 0);
});

test('repeated entry and exit neither duplicates listeners nor effects', () => {
    const doc = createFakeDocument();
    const h = createHarness({ document: doc });

    h.controller.enter();
    type(h.controller, 'CAT');
    assert.equal(h.view.calls.celebrate, 1);
    h.controller.leave();

    h.controller.enter();
    assert.equal(doc.count('visibilitychange'), 1);
    assert.equal(doc.count('pagehide'), 1);
    type(h.controller, 'CAT');

    assert.equal(h.view.calls.celebrate, 2, 'one celebration per entry, not two');
    assert.equal(h.audio.calls.play.length, 6);

    // One visibility event must still cause exactly one cancellation.
    resetCounts(h);
    doc.hidden = true;
    doc.dispatch('visibilitychange');
    assert.equal(h.audio.calls.stop, 1);
    assert.equal(h.view.calls.stopCelebration, 1);
});

// ── Rapid edits ──────────────────────────────────────────────────────────

test('rapid edits stop the previous operation before every new play', () => {
    const h = createHarness();
    h.controller.enter();
    resetCounts(h);

    type(h.controller, 'PAN');

    assert.equal(h.audio.calls.play.length, 3);
    assert.equal(h.audio.calls.stop, 3, 'each actual change invalidates the previous one');
    const words = h.audio.calls.play.map(entry => entry.plan.kind);
    assert.deepEqual(words, ['sequence', 'sequence', 'word']);
});
