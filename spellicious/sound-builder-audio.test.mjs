/*  Sound Builder — audio adapter tests
 *
 *  Deterministic fakes only: a fake speech synthesiser, fake AudioContext and
 *  nodes, fake utterances and a fake timer scheduler.  The fake AudioContext
 *  clock follows wall time only while the context is running, so suspending it
 *  mid-synthesis models a browser interruption and proves completion is judged
 *  on `currentTime` rather than a wall-clock timer.  Fake contexts can also
 *  start suspended and resume late, reject, or never settle, so the adapter's
 *  bounded readiness handling is exercised without real audio hardware.  These
 *  tests never use the network, `ps`, `sudo` or loopback sockets, so no test
 *  needs a skip.
 *
 *  Run with:
 *      node --test spellicious/sound-builder-audio.test.mjs
 *
 *  The renderer assertions prove that the adapter schedules the descriptors it
 *  claims to schedule.  They do NOT prove that the resulting sound is an
 *  intelligible or phonetically accurate English phoneme; that still needs a
 *  human listening check on real devices (notably iPad Safari).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import logic from './sound-builder-logic.js';
import SoundBuilderAudio from './sound-builder-audio.js';

const { createAudio, RESULT, SYNTH_DATA, planRender } = SoundBuilderAudio;

const LOCAL_EN = Object.freeze({
    name: 'Local English',
    lang: 'en-GB',
    localService: true
});

function planFor(text) {
    let state = logic.createState(text.length);
    for (const character of text) state = logic.enterLetter(state, character);
    return logic.selectAudio(state);
}

// ── Fakes ────────────────────────────────────────────────────────────────

function createScheduler(options = {}) {
    let now = 0;
    let nextId = 1;
    const tasks = new Map();

    function nextDue() {
        let due = null;
        for (const task of tasks.values()) {
            if (task.at <= now &&
                (!due || task.at < due.at || (task.at === due.at && task.id < due.id))) {
                due = task;
            }
        }
        return due;
    }

    return {
        setTimeout(callback, delay) {
            const id = nextId;
            nextId += 1;
            tasks.set(id, {
                id,
                at: now + Math.max(0, Number(delay) || 0),
                callback
            });
            return id;
        },
        clearTimeout(id) {
            tasks.delete(id);
        },
        advance(milliseconds) {
            const delta = Math.max(0, Number(milliseconds) || 0);
            now += delta;
            // Let the fake AudioContext clock follow wall time (its owner
            // decides whether the context is actually running).
            if (delta > 0 && typeof options.onTime === 'function') options.onTime(delta);
            let steps = 0;
            let due = nextDue();
            while (due && steps < 1000) {
                tasks.delete(due.id);
                due.callback();
                steps += 1;
                due = nextDue();
            }
        },
        pending() {
            return tasks.size;
        },
        now() {
            return now;
        }
    };
}

class FakeUtterance {
    constructor(text) {
        this.text = text;
        this.voice = null;
        this.lang = '';
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
        this.onend = null;
        this.onerror = null;
    }
}

function createSpeech(initialVoices) {
    let voices = Array.isArray(initialVoices) ? initialVoices.slice() : [];
    const listeners = new Set();
    const spoken = [];
    // Like a real synthesiser: utterances stay active/queued until they end
    // or `cancel` empties the queue.  Tests assert this is empty after every
    // cleanup path, which is what proves stop/mute/replacement really stops
    // speech rather than merely detaching handlers.
    const queue = [];
    const calls = { speak: 0, cancel: 0 };

    function dequeue(utterance) {
        const index = queue.indexOf(utterance);
        if (index !== -1) queue.splice(index, 1);
    }

    const speech = {
        getVoices() {
            return voices.slice();
        },
        speak(utterance) {
            calls.speak += 1;
            spoken.push(utterance);
            queue.push(utterance);
            // A manual onend() call finishes the utterance in the fake too.
            const end = utterance.onend;
            utterance.onend = function (...args) {
                dequeue(utterance);
                if (typeof end === 'function') return end.apply(this, args);
                return undefined;
            };
        },
        cancel() {
            calls.cancel += 1;
            queue.length = 0;
        },
        addEventListener(type, handler) {
            if (type === 'voiceschanged') listeners.add(handler);
        },
        removeEventListener(type, handler) {
            if (type === 'voiceschanged') listeners.delete(handler);
        }
    };

    return {
        speech,
        spoken,
        calls,
        listenerCount() {
            return listeners.size;
        },
        activeCount() {
            return queue.length;
        },
        setVoices(next) {
            voices = Array.isArray(next) ? next.slice() : [];
        },
        emitVoices(next) {
            if (Array.isArray(next)) voices = next.slice();
            for (const handler of [...listeners]) handler();
        }
    };
}

function createFakeContext(options = {}) {
    const behavior = options || {};
    const allNodes = [];
    const stateListeners = new Set();
    const created = {
        gains: [],
        oscillators: [],
        bufferSources: [],
        biquads: [],
        buffers: []
    };

    function makeParam(initial) {
        return {
            value: initial,
            events: [],
            setValueAtTime(value, time) {
                this.value = value;
                this.events.push(['set', value, time]);
            },
            linearRampToValueAtTime(value, time) {
                this.value = value;
                this.events.push(['ramp', value, time]);
            },
            cancelScheduledValues() {
                this.events.push(['cancel']);
            }
        };
    }

    function baseNode(kind, extra) {
        const node = Object.assign({
            kind,
            disconnected: false,
            connections: [],
            connect(target) {
                this.connections.push(target);
                return target;
            },
            disconnect() {
                this.disconnected = true;
            }
        }, extra);
        allNodes.push(node);
        return node;
    }

    const context = {
        state: behavior.state || 'running',
        sampleRate: 16000,
        currentTime: 0,
        destination: {
            isDestination: true,
            connect() {},
            disconnect() {}
        },
        resumeCalls: 0,
        closeCalls: 0,
        created,
        allNodes,

        addEventListener(type, handler) {
            if (type === 'statechange' && typeof handler === 'function') {
                stateListeners.add(handler);
            }
        },
        removeEventListener(type, handler) {
            if (type === 'statechange') stateListeners.delete(handler);
        },
        listenerCount() {
            return stateListeners.size;
        },
        setState(next) {
            context.state = next;
            for (const handler of Array.from(stateListeners)) handler();
        },

        createGain() {
            const gain = baseNode('gain', { gain: makeParam(0) });
            created.gains.push(gain);
            return gain;
        },

        createOscillator() {
            const oscillator = baseNode('oscillator', {
                type: 'sine',
                frequency: makeParam(440),
                startedAt: null,
                stoppedAt: null,
                start(time) {
                    this.startedAt = time;
                },
                stop(time) {
                    this.stoppedAt = time;
                }
            });
            created.oscillators.push(oscillator);
            return oscillator;
        },

        createBufferSource() {
            const source = baseNode('bufferSource', {
                buffer: null,
                startedAt: null,
                stoppedAt: null,
                start(time) {
                    this.startedAt = time;
                },
                stop(time) {
                    this.stoppedAt = time;
                }
            });
            created.bufferSources.push(source);
            return source;
        },

        createBiquadFilter() {
            const filter = baseNode('biquad', {
                type: 'lowpass',
                frequency: makeParam(350),
                Q: makeParam(1),
                gain: makeParam(0)
            });
            created.biquads.push(filter);
            return filter;
        },

        createBuffer(channels, length, sampleRate) {
            const data = new Float32Array(length);
            const buffer = {
                numberOfChannels: channels,
                length,
                sampleRate,
                data,
                getChannelData() {
                    return data;
                }
            };
            created.buffers.push(buffer);
            return buffer;
        },

        resume() {
            this.resumeCalls += 1;
            if (typeof behavior.resume === 'function') {
                return behavior.resume.call(this, this);
            }
            return Promise.resolve();
        },

        close() {
            this.closeCalls += 1;
            this.state = 'closed';
            for (const handler of Array.from(stateListeners)) handler();
            return Promise.resolve();
        }
    };

    return context;
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function flush() {
    return new Promise(resolve => setImmediate(resolve));
}

function makeAudio(options = {}) {
    const context = options.context || createFakeContext();
    const scheduler = options.scheduler || createScheduler({
        // The AudioContext clock advances with wall time only while the
        // context is actually running.  Suspending it freezes `currentTime`,
        // which is exactly the interruption the adapter must notice.
        onTime(deltaMs) {
            const state = context.state;
            if (state === 'running' || typeof state === 'undefined') {
                context.currentTime += deltaMs / 1000;
            }
        }
    });
    const speechKit = Object.prototype.hasOwnProperty.call(options, 'speechKit')
        ? options.speechKit
        : createSpeech(options.voices);
    const speech = Object.prototype.hasOwnProperty.call(options, 'speech')
        ? options.speech
        : (speechKit ? speechKit.speech : null);

    const audio = createAudio({
        speech,
        createUtterance: options.createUtterance || (text => new FakeUtterance(text)),
        createAudioContext: options.createAudioContext || (() => context),
        scheduler,
        voiceTimeoutMs: Object.prototype.hasOwnProperty.call(options, 'voiceTimeoutMs')
            ? options.voiceTimeoutMs
            : 50,
        speechTimeoutMs: Object.prototype.hasOwnProperty.call(options, 'speechTimeoutMs')
            ? options.speechTimeoutMs
            : 100,
        audioReadyTimeoutMs: Object.prototype.hasOwnProperty.call(options, 'audioReadyTimeoutMs')
            ? options.audioReadyTimeoutMs
            : 1000,
        synthStallTimeoutMs: Object.prototype.hasOwnProperty.call(options, 'synthStallTimeoutMs')
            ? options.synthStallTimeoutMs
            : 3000
    });

    return { audio, scheduler, context, speechKit, speech };
}

function assertClean({ context, scheduler, speechKit }) {
    assert.equal(scheduler.pending(), 0, 'no timers remain');
    for (const node of context.allNodes) {
        assert.equal(node.disconnected, true, `${node.kind} node was disconnected`);
    }
    if (typeof context.listenerCount === 'function') {
        assert.equal(context.listenerCount(), 0, 'no AudioContext statechange listeners remain');
    }
    if (speechKit) {
        assert.equal(speechKit.listenerCount(), 0, 'no voiceschanged listeners remain');
        assert.equal(
            speechKit.activeCount(),
            0,
            'no active or queued utterances remain (cancel/end emptied the queue)'
        );
        for (const utterance of speechKit.spoken) {
            assert.equal(utterance.onend, null, 'no late onend handler remains');
            assert.equal(utterance.onerror, null, 'no late onerror handler remains');
        }
    }
}

// ── Whole-word speech ────────────────────────────────────────────────────

test('a recognised word is spoken as the whole word, not as fragments', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));

    assert.equal(speechKit.spoken.length, 1);
    assert.equal(speechKit.spoken[0].text, 'pan');
    assert.equal(speechKit.spoken[0].voice, LOCAL_EN);
    assert.equal(context.created.oscillators.length, 0, 'no synthesized fallback while speech works');

    speechKit.spoken[0].onend();
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('an installed local English voice is preferred over an earlier remote voice', async () => {
    const remote = { name: 'Remote English', lang: 'en-US', localService: false };
    const local = { name: 'Local English', lang: 'en-US', localService: true };
    const other = { name: 'French', lang: 'fr-FR', localService: true };
    const kit = createSpeech([remote, other, local]);
    const { audio, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('cat'));
    assert.equal(speechKit.spoken.length, 1);
    assert.equal(speechKit.spoken[0].voice, local);

    speechKit.spoken[0].onend();
    assert.equal(await result, RESULT.COMPLETED);
});

test('a remote-only English voice is not deliberately selected; synthesis is used', async () => {
    const kit = createSpeech([{ name: 'Remote English', lang: 'en-US', localService: false }]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));
    assert.equal(speechKit.spoken.length, 0);
    assert.ok(context.created.bufferSources.length >= 1, 'synthesis started');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('a speech API without cancel is never selected; synthesis plays instead', async () => {
    // A partially available speech API (speak + getVoices but no cancel)
    // cannot honour stop, mute or replacement.  Choosing it would let a late
    // utterance overlap the synthesized fallback, so the adapter must ignore
    // it entirely.
    const spoken = [];
    const partialSpeech = {
        getVoices() {
            return [LOCAL_EN];
        },
        speak(utterance) {
            spoken.push(utterance);
        }
    };
    const { audio, context, scheduler } = makeAudio({
        speech: partialSpeech,
        speechKit: null
    });

    const result = audio.play(planFor('pan'));

    assert.equal(spoken.length, 0, 'partial speech is not used');
    assert.ok(context.created.bufferSources.length >= 1, 'synthesis fallback started');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit: null });
});

test('an English voice with unknown locality is not selected; synthesis is used', async () => {
    // `localService` missing means locality is unknown, not local.  Choosing
    // it would not establish installed local speech, so the whole-word plan
    // must fall back to its declared phoneme sequence instead.
    const unknown = { name: 'English', lang: 'en-AU' };
    const kit = createSpeech([unknown]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('cat'));
    assert.equal(speechKit.spoken.length, 0, 'no unknown-locality utterance');
    assert.ok(context.created.bufferSources.length >= 1, 'synthesis fallback started');
    assert.equal(speechKit.listenerCount(), 0, 'no voice listener was needed');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

// ── Voice lists ──────────────────────────────────────────────────────────

test('an empty voice list waits a bounded time, then uses synthesis', async () => {
    const kit = createSpeech([]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));
    assert.equal(speechKit.spoken.length, 0);
    assert.equal(scheduler.pending(), 1, 'exactly one bounded voice wait');

    scheduler.advance(50);
    assert.equal(speechKit.spoken.length, 0);
    assert.equal(speechKit.listenerCount(), 0, 'voice listener removed at the deadline');
    assert.ok(context.created.bufferSources.length >= 1, 'synthesis fallback started');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('a delayed voice list is used and its listener and timer are released', async () => {
    const kit = createSpeech([]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));
    assert.equal(scheduler.pending(), 1);

    kit.emitVoices([LOCAL_EN]);

    assert.equal(speechKit.spoken.length, 1);
    assert.equal(speechKit.spoken[0].voice, LOCAL_EN);
    assert.equal(speechKit.listenerCount(), 0);
    // The voice-wait timer is gone; the remaining timer is the speech stall
    // guard, which the utterance end will clear.

    speechKit.spoken[0].onend();
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('an onvoiceschanged-only speech object is supported and restored', async () => {
    const spoken = [];
    const speech = {
        voices: [],
        onvoiceschanged: null,
        getVoices() {
            return this.voices.slice();
        },
        speak(utterance) {
            spoken.push(utterance);
        },
        cancel() {}
    };
    const { audio, context, scheduler } = makeAudio({ speech });

    const result = audio.play(planFor('pan'));
    assert.equal(typeof speech.onvoiceschanged, 'function');

    speech.voices = [LOCAL_EN];
    speech.onvoiceschanged();

    assert.equal(spoken.length, 1);
    assert.equal(speech.onvoiceschanged, null, 'previous property handler restored');

    spoken[0].onend();
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit: null });
});

// ── Speech failure and fallback ──────────────────────────────────────────

test('a speech error falls back to the explicit phoneme sequence', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));
    speechKit.spoken[0].onerror({ error: 'synthesis-failed' });

    assert.equal(speechKit.listenerCount(), 0);
    assert.ok(speechKit.calls.cancel >= 1, 'stale utterance cancelled');
    assert.ok(context.created.bufferSources.length >= 1, 'synthesis fallback started');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('a throwing utterance constructor falls back to synthesis', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        createUtterance() {
            throw new Error('no utterance support');
        }
    });

    const result = audio.play(planFor('pan'));
    assert.equal(speechKit.spoken.length, 0);
    assert.ok(context.created.bufferSources.length >= 1);

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('a stalled utterance is cancelled at the deadline and replaced by synthesis', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        speechTimeoutMs: 100
    });

    const result = audio.play(planFor('pan'));
    const utterance = speechKit.spoken[0];
    const lateEnd = utterance.onend;

    scheduler.advance(100);

    assert.ok(speechKit.calls.cancel >= 1, 'stalled utterance cancelled');
    assert.equal(utterance.onend, null);
    assert.ok(context.created.bufferSources.length >= 1, 'synthesis fallback started');

    assert.doesNotThrow(() => lateEnd());
    assert.equal(context.created.oscillators.length > 0, true, 'synthesis is still the active stage');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

// ── Partial plans and the renderer ───────────────────────────────────────

test('a partial plan never speaks fragments and synthesizes its blend', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });
    const plan = planFor('pa');

    assert.equal(plan.kind, 'sequence');
    assert.deepEqual(plan.units, [{ type: 'blend', id: 'pa' }]);

    const timeline = planRender(plan.units);
    assert.deepEqual(timeline.entries.map(entry => entry.id), ['p', 'a_short']);
    assert.ok(
        timeline.entries[1].start <
            timeline.entries[0].start + timeline.entries[0].duration,
        'the blend has an explicit overlap'
    );

    const result = audio.play(plan);
    assert.equal(speechKit.spoken.length, 0, 'no browser speech for a partial plan');
    assert.ok(context.created.bufferSources.length >= 1, 'unvoiced release rendered');
    assert.ok(context.created.oscillators.length >= 1, 'voiced vowel rendered');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('a stop consonant descriptor schedules a release and no trailing vowel', async () => {
    const timeline = planRender([{ type: 'phoneme', id: 'p' }]);

    assert.equal(timeline.entries.length, 1);
    assert.equal(timeline.entries[0].id, 'p');
    assert.equal(timeline.entries[0].kind, 'stop');
    assert.equal(SYNTH_DATA.p.voiced, false);
    assert.equal(SYNTH_DATA.p.formants.length, 0, 'p has no vowel formants');

    const { audio, context, scheduler } = makeAudio({ speech: null });
    const result = audio.play({ kind: 'sequence', units: [{ type: 'phoneme', id: 'p' }] });

    assert.equal(context.created.oscillators.length, 0, 'no voiced/vowel source for unvoiced p');
    assert.equal(context.created.bufferSources.length, 1, 'exactly one noise release');
    assert.equal(context.created.biquads.length, 1);
    assert.equal(
        context.created.biquads[0].frequency.value,
        SYNTH_DATA.p.burst.frequency,
        'the release uses the p descriptor'
    );

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit: null });

    // This proves the descriptor/scheduler does not append a vowel. It does
    // not prove that the release is an audible, accurate /p/.
});

test('a synthesised word fallback follows the S1 explicit phoneme sequence', async () => {
    const { audio, context, scheduler } = makeAudio({ speech: null });
    const plan = planFor('pan');

    assert.equal(plan.kind, 'word');
    const timeline = planRender(plan.units, { connected: true });
    assert.deepEqual(timeline.entries.map(entry => entry.id), ['p', 'a_short', 'n']);

    const result = audio.play(plan);
    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit: null });
});

test('every S1 phoneme and blend resolves to a renderer descriptor', () => {
    for (const id of Object.keys(logic.PHONEMES)) {
        assert.ok(SYNTH_DATA[id], `${id} has synthesis data`);
    }
    for (const blend of Object.values(logic.BLENDS)) {
        for (const id of blend.phonemes) {
            assert.ok(SYNTH_DATA[id], `${blend.id} references renderable ${id}`);
        }
    }
});

test('planRender keeps the S1 contracts for compounds, blends and gaps', () => {
    const kw = planRender([{ type: 'phoneme', id: 'kw' }]);
    assert.deepEqual(kw.entries.map(entry => entry.id), ['k', 'w']);

    const ks = planRender([{ type: 'phoneme', id: 'ks' }]);
    assert.deepEqual(ks.entries.map(entry => entry.id), ['k', 's']);

    const qu = planRender([{ type: 'blend', id: 'qu' }]);
    assert.deepEqual(qu.entries.map(entry => entry.id), ['k', 'w']);

    const partial = planRender([
        { type: 'phoneme', id: 'p' },
        { type: 'phoneme', id: 'a_short' }
    ]);
    assert.deepEqual(partial.entries.map(entry => entry.id), ['p', 'a_short']);
    assert.ok(partial.entries[1].start >= partial.entries[0].start + partial.entries[0].duration);
});

// ── AudioContext readiness ───────────────────────────────────────────────
//
// These fakes start suspended, or resume late / reject / never settle.  They
// prove the adapter never schedules audio on a context that cannot run and
// never resolves "completed" for sound that never started.

test('creating an adapter is inert: no context, no speech until play', () => {
    let created = 0;
    const kit = createSpeech([LOCAL_EN]);
    createAudio({
        speech: kit.speech,
        createUtterance: text => new FakeUtterance(text),
        createAudioContext() {
            created += 1;
            return createFakeContext();
        },
        scheduler: createScheduler()
    });

    assert.equal(created, 0, 'no AudioContext before play');
    assert.equal(kit.calls.speak, 0, 'no speech before play');
});

test('a delayed AudioContext resume is awaited before synthesis', async () => {
    const resume = deferred();
    const context = createFakeContext({
        state: 'suspended',
        resume: () => resume.promise
    });
    const { audio, scheduler, speechKit } = makeAudio({
        speech: null,
        context,
        audioReadyTimeoutMs: 250
    });

    const result = audio.play(planFor('pa'));

    assert.equal(context.resumeCalls, 1, 'resume started inside play');
    assert.equal(context.created.bufferSources.length, 0, 'nothing scheduled while suspended');
    assert.equal(scheduler.pending(), 1, 'one bounded readiness timer');

    scheduler.advance(100);
    assert.equal(context.created.bufferSources.length, 0, 'still nothing before resume completes');

    resume.resolve();
    context.setState('running');
    await flush();

    assert.ok(context.created.bufferSources.length >= 1, 'synthesis starts once running');
    assert.equal(
        scheduler.pending(),
        2,
        'readiness timer replaced by the completion poll and its stall bound'
    );

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('a rejected AudioContext resume resolves unavailable and schedules no sound', async () => {
    const context = createFakeContext({
        state: 'suspended',
        resume() {
            return Promise.reject(new Error('resume blocked'));
        }
    });
    const { audio, scheduler, speechKit } = makeAudio({
        speech: null,
        context,
        audioReadyTimeoutMs: 250
    });

    const result = audio.play(planFor('pa'));
    assert.equal(context.resumeCalls, 1);

    assert.equal(await result, RESULT.UNAVAILABLE);
    assert.equal(context.created.bufferSources.length, 0, 'no noise scheduled');
    assert.equal(context.created.oscillators.length, 0, 'no voice scheduled');
    assertClean({ context, scheduler, speechKit });
});

test('a stalled AudioContext resume is bounded and resolves unavailable', async () => {
    const context = createFakeContext({
        state: 'suspended',
        resume: () => new Promise(() => {})
    });
    const { audio, scheduler, speechKit } = makeAudio({
        speech: null,
        context,
        audioReadyTimeoutMs: 120
    });

    const result = audio.play(planFor('pa'));
    assert.equal(scheduler.pending(), 1);

    scheduler.advance(119);
    assert.equal(context.created.bufferSources.length, 0, 'no sound before the deadline');

    scheduler.advance(1);
    assert.equal(await result, RESULT.UNAVAILABLE, 'bounded wait gives up');
    assert.equal(context.created.bufferSources.length, 0);

    // A very late state change must not resurrect the finished operation.
    context.setState('running');
    await flush();
    assert.equal(context.created.bufferSources.length, 0, 'late readiness schedules nothing');
    assertClean({ context, scheduler, speechKit });
});

test('cancelling during AudioContext readiness ignores a late resume', async () => {
    const resume = deferred();
    const context = createFakeContext({
        state: 'suspended',
        resume: () => resume.promise
    });
    const { audio, scheduler, speechKit } = makeAudio({
        speech: null,
        context,
        audioReadyTimeoutMs: 250
    });

    const result = audio.play(planFor('pa'));
    assert.equal(scheduler.pending(), 1);

    audio.stop();
    assert.equal(await result, RESULT.CANCELLED);
    assert.equal(scheduler.pending(), 0, 'readiness timer cleared');
    assert.equal(context.listenerCount(), 0, 'readiness listener removed');

    resume.resolve();
    context.setState('running');
    await flush();

    assert.equal(context.created.bufferSources.length, 0, 'late resume schedules nothing');
    assert.equal(scheduler.pending(), 0);
    assertClean({ context, scheduler, speechKit });
});

test('interrupting the audio clock mid-word never reports a truncated word as completed', async () => {
    // Wall time keeps passing while a suspended/interrupted AudioContext
    // freezes `currentTime`.  A wall-clock completion timer would fire here
    // and claim the word finished (and could then put the celebration tone
    // over phonemes that have not played).  Completion must follow the audio
    // clock, with a bounded stall fallback.
    const context = createFakeContext({ state: 'running' });
    const { audio, scheduler } = makeAudio({
        speech: null,
        context,
        synthStallTimeoutMs: 200
    });

    const plan = planFor('pan');
    assert.equal(plan.kind, 'word');
    const timeline = planRender(plan.units, { connected: true });
    const endTime = 0.02 + timeline.duration;

    const result = audio.play(plan, { celebrate: true });
    let settled = false;
    result.then(() => { settled = true; });

    scheduler.advance(60);
    assert.ok(context.currentTime > 0, 'the word started on the running clock');
    assert.ok(context.currentTime < endTime, 'interrupted before the word ended');
    const wordSources = context.created.bufferSources.length + context.created.oscillators.length;

    context.setState('suspended');

    // Almost the whole stall allowance passes with the clock frozen.
    scheduler.advance(199);
    await flush();
    assert.equal(settled, false, 'still not completed while the audio clock is paused');
    assert.equal(
        context.created.oscillators.filter(node => node.type === 'sine').length,
        0,
        'no celebration tone over unfinished phonemes'
    );

    scheduler.advance(1); // the bounded stall deadline
    assert.equal(await result, RESULT.UNAVAILABLE, 'interruption is reported honestly');

    assert.equal(
        context.created.bufferSources.length + context.created.oscillators.length,
        wordSources,
        'a bounded interruption schedules no extra sound'
    );
    assert.equal(
        context.created.oscillators.filter(node => node.type === 'sine').length,
        0,
        'still no tone after giving up'
    );
    assertClean({ context, scheduler, speechKit: null });
});

test('resuming before the stall bound completes the word and tones only after it', async () => {
    const context = createFakeContext({ state: 'running' });
    const { audio, scheduler } = makeAudio({
        speech: null,
        context,
        synthStallTimeoutMs: 1000
    });

    const plan = planFor('pan');
    const timeline = planRender(plan.units, { connected: true });
    const endTime = 0.02 + timeline.duration;

    const result = audio.play(plan, { celebrate: true });

    scheduler.advance(80);
    context.setState('suspended');
    scheduler.advance(150); // well inside the stall bound
    context.setState('running');
    scheduler.advance(1000); // the clock resumes and reaches the word's end
    await flush();
    scheduler.advance(500); // let the positive tone finish

    assert.equal(await result, RESULT.COMPLETED);

    const tones = context.created.oscillators.filter(node => node.type === 'sine');
    assert.equal(tones.length, 1, 'exactly one positive tone');
    assert.ok(
        tones[0].startedAt >= endTime,
        'the tone is scheduled at or after the synthesized word end'
    );
    assert.equal(
        context.created.oscillators.filter(node => node.type === 'sawtooth').length,
        timeline.entries.filter(entry => entry.kind !== 'stop').length,
        'only the word voices were synthesized'
    );
    assertClean({ context, scheduler, speechKit: null });
});

test('a speech-error fallback reuses the gesture-time context without creating or resuming again', async () => {
    let createCalls = 0;
    const context = createFakeContext({ state: 'suspended' });
    context.resume = function resumeInGesture() {
        this.resumeCalls += 1;
        this.setState('running');
        return Promise.resolve();
    };
    const kit = createSpeech([LOCAL_EN]);
    const { audio, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        context,
        createAudioContext() {
            createCalls += 1;
            return context;
        }
    });

    const result = audio.play(planFor('pan'));
    assert.equal(createCalls, 1, 'one context created inside play');
    assert.equal(context.resumeCalls, 1, 'one resume inside play');
    assert.equal(context.state, 'running');

    speechKit.spoken[0].onerror({ error: 'synthesis-failed' });

    assert.equal(createCalls, 1, 'fallback creates no second context');
    assert.equal(context.resumeCalls, 1, 'fallback resumes nothing');
    assert.ok(context.created.bufferSources.length >= 1, 'fallback uses the prepared context');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('audio readiness never blocks an already spoken word', async () => {
    const resume = deferred(); // deliberately never settles
    const context = createFakeContext({
        state: 'suspended',
        resume: () => resume.promise
    });
    const kit = createSpeech([LOCAL_EN]);
    const { audio, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        context,
        audioReadyTimeoutMs: 250
    });

    const result = audio.play(planFor('pan'));
    assert.equal(speechKit.spoken.length, 1, 'the word is spoken immediately');

    speechKit.spoken[0].onend();

    assert.equal(await result, RESULT.COMPLETED, 'no audio wait for a spoken word');
    assert.equal(scheduler.pending(), 0, 'no readiness timer was needed');
    assert.equal(context.listenerCount(), 0);
});

test('a late resume rejection from a cancelled play cannot poison the next play', async () => {
    const firstResume = deferred();
    let resumeNumber = 0;
    const context = createFakeContext({ state: 'suspended' });
    context.resume = function resume() {
        resumeNumber += 1;
        this.resumeCalls += 1;
        if (resumeNumber === 1) return firstResume.promise;
        this.setState('running');
        return Promise.resolve();
    };
    const { audio, scheduler, speechKit } = makeAudio({
        speech: null,
        context,
        audioReadyTimeoutMs: 250
    });

    const first = audio.play(planFor('pa'));
    audio.stop();
    assert.equal(await first, RESULT.CANCELLED);

    const second = audio.play(planFor('pa'));
    assert.equal(context.resumeCalls, 2, 'the new play resumes again inside its gesture');
    assert.ok(context.created.bufferSources.length >= 1, 'the new play synthesizes');

    firstResume.reject(new Error('late rejection'));
    await flush();

    assert.ok(context.created.bufferSources.length >= 1, 'the stale rejection changes nothing');
    scheduler.advance(1000);
    assert.equal(await second, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('the celebration tone reuses the gesture-time context and never resumes late', async () => {
    let createCalls = 0;
    const context = createFakeContext({ state: 'suspended' });
    context.resume = function resumeInGesture() {
        this.resumeCalls += 1;
        this.setState('running');
        return Promise.resolve();
    };
    const kit = createSpeech([LOCAL_EN]);
    const { audio, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        context,
        createAudioContext() {
            createCalls += 1;
            return context;
        }
    });

    const result = audio.play(planFor('pan'), { celebrate: true });
    assert.equal(context.resumeCalls, 1, 'resume happens inside play');
    assert.equal(context.created.oscillators.length, 0, 'no tone before the word ends');

    speechKit.spoken[0].onend();

    assert.equal(context.created.oscillators.length, 1, 'one tone after the word');
    assert.equal(context.resumeCalls, 1, 'the tone never resumes again');
    assert.equal(createCalls, 1, 'the tone never creates a context');

    scheduler.advance(1000);
    assert.equal(await result, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('celebration completes silently when audio cannot run, without a late resume', async () => {
    const context = createFakeContext({
        state: 'suspended',
        resume() {
            return Promise.reject(new Error('resume blocked'));
        }
    });
    const kit = createSpeech([LOCAL_EN]);
    const { audio, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        context,
        audioReadyTimeoutMs: 100
    });

    const result = audio.play(planFor('pan'), { celebrate: true });
    await flush(); // let the resume rejection settle before the word ends

    speechKit.spoken[0].onend();

    assert.equal(await result, RESULT.COMPLETED, 'the spoken word still succeeds');
    assert.equal(context.created.oscillators.length, 0, 'no tone when audio cannot run');
    assert.equal(context.resumeCalls, 1, 'no retry outside the gesture');
    assertClean({ context, scheduler, speechKit });
});

// ── One operation at a time ──────────────────────────────────────────────

test('rapid P -> PA -> PAN changes leave only the newest operation and clean up', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const first = audio.play(planFor('p'));
    const firstNodes = context.allNodes.slice();

    const second = audio.play(planFor('pa'));
    const secondNodes = context.allNodes.slice();

    const third = audio.play(planFor('pan'));

    assert.equal(await first, RESULT.CANCELLED);
    assert.equal(await second, RESULT.CANCELLED);

    assert.ok(firstNodes.every(node => node.disconnected), 'P nodes cleaned before PA');
    assert.ok(
        secondNodes.slice(firstNodes.length).every(node => node.disconnected),
        'PA nodes cleaned before PAN'
    );

    assert.equal(speechKit.spoken.length, 1, 'only the newest whole word is queued');
    assert.equal(speechKit.spoken[0].text, 'pan');
    assert.equal(speechKit.activeCount(), 1, 'only the newest whole word is in the speech queue');

    speechKit.spoken[0].onend();
    assert.equal(await third, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('replaying the same word cancels the first utterance and replaces it', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const first = audio.play(planFor('pan'));
    const firstUtterance = speechKit.spoken[0];

    const second = audio.play(planFor('pan'));

    assert.equal(firstUtterance.onend, null);
    assert.equal(firstUtterance.onerror, null);
    assert.equal(await first, RESULT.CANCELLED);
    assert.equal(speechKit.spoken.length, 2);
    assert.equal(speechKit.activeCount(), 1, 'the replaced utterance left the queue');

    speechKit.spoken[1].onend();
    assert.equal(await second, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

// ── Celebrate tone ───────────────────────────────────────────────────────

test('celebrate serialises a quiet tone after the word and can be cancelled during the tone', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const first = audio.play(planFor('pan'), { celebrate: true });
    assert.equal(context.created.oscillators.length, 0, 'tone does not start before the word ends');

    speechKit.spoken[0].onend();
    assert.equal(context.created.oscillators.length, 1, 'one tone oscillator after speech ends');
    const tone = context.created.oscillators[0];
    assert.equal(tone.type, 'sine');
    assert.equal(tone.frequency.value, SoundBuilderAudio.POSITIVE_TONE.frequency);

    const second = audio.play(planFor('p'));

    assert.equal(await first, RESULT.CANCELLED);
    assert.equal(tone.disconnected, true, 'tone node released when new input interrupts');

    scheduler.advance(1000);
    assert.equal(await second, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('celebrate on a partial plan does not add a tone', async () => {
    const { audio, context, scheduler } = makeAudio({ speech: null });

    const result = audio.play(planFor('pa'), { celebrate: true });
    scheduler.advance(1000);

    assert.equal(await result, RESULT.COMPLETED);
    assert.equal(context.created.oscillators.length, 1, 'one voiced vowel source only');
    assertClean({ context, scheduler, speechKit: null });
});

// ── Mute, stop and dispose ───────────────────────────────────────────────

test('mute stops immediately, blocks queued playback and unmute never replays', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const first = audio.play(planFor('pan'));
    const utterance = speechKit.spoken[0];

    audio.setMuted(true);

    assert.equal(await first, RESULT.MUTED);
    assert.equal(utterance.onend, null);
    assert.ok(speechKit.calls.cancel >= 1, 'utterance cancelled');
    assertClean({ context, scheduler, speechKit });

    const nodeCount = context.allNodes.length;
    assert.equal(await audio.play(planFor('pan')), RESULT.MUTED);
    assert.equal(context.allNodes.length, nodeCount, 'muted play creates no audio nodes');
    assert.equal(speechKit.spoken.length, 1, 'muted play queues no utterance');

    audio.setMuted(false);
    scheduler.advance(1000);
    assert.equal(speechKit.spoken.length, 1, 'unmute alone does not replay');
    assert.equal(context.allNodes.length, nodeCount);

    const afterUnmute = audio.play(planFor('pan'));
    assert.equal(speechKit.spoken.length, 2);
    speechKit.spoken[1].onend();
    assert.equal(await afterUnmute, RESULT.COMPLETED);
    assertClean({ context, scheduler, speechKit });
});

test('mute during synthesized playback stops and disconnects owned nodes', async () => {
    const { audio, context, scheduler } = makeAudio({ speech: null });

    const result = audio.play(planFor('pa'));
    assert.ok(context.allNodes.length > 0);

    audio.setMuted(true);

    assert.equal(await result, RESULT.MUTED);
    assertClean({ context, scheduler, speechKit: null });
});

test('stop cancels utterances, nodes and timers and is safe to repeat', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));
    const utterance = speechKit.spoken[0];

    audio.stop();

    assert.equal(await result, RESULT.CANCELLED);
    assert.equal(utterance.onend, null);
    assertClean({ context, scheduler, speechKit });
    assert.doesNotThrow(() => audio.stop());
});

test('dispose is idempotent, closes owned resources and prevents later playback', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pa'));
    assert.ok(context.created.oscillators.length > 0);

    audio.dispose();

    assert.equal(await result, RESULT.CANCELLED);
    assert.equal(context.closeCalls, 1);
    assertClean({ context, scheduler, speechKit });

    assert.doesNotThrow(() => audio.dispose());
    assert.equal(context.closeCalls, 1, 'repeated dispose closes nothing twice');

    assert.equal(await audio.play(planFor('pan')), RESULT.UNAVAILABLE);
    assert.equal(speechKit.spoken.length, 0, 'disposed adapter queues no speech');
    assert.equal(scheduler.pending(), 0);
});

// ── Missing APIs and bounded failures ────────────────────────────────────

test('missing speech and missing Web Audio resolve unavailable without throwing', async () => {
    const { audio } = makeAudio({
        speech: null,
        createAudioContext() {
            throw new Error('no audio context');
        }
    });

    assert.equal(await audio.play(planFor('pan')), RESULT.UNAVAILABLE);
    assert.equal(await audio.play(planFor('pa')), RESULT.UNAVAILABLE);
});

test('speech with no suitable voice and no Web Audio resolves unavailable after the bounded wait', async () => {
    const kit = createSpeech([]);
    const { audio, context, scheduler, speechKit } = makeAudio({
        speechKit: kit,
        createAudioContext() {
            throw new Error('no audio context');
        }
    });

    const result = audio.play(planFor('pan'));
    scheduler.advance(50);
    assert.equal(await result, RESULT.UNAVAILABLE);
    assertClean({ context, scheduler, speechKit });
});

test('a silent or malformed plan never starts audio', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    assert.equal(await audio.play({ kind: 'silent', units: [] }), RESULT.COMPLETED);
    assert.equal(await audio.play({ kind: 'sequence', units: [] }), RESULT.COMPLETED);
    assert.equal(await audio.play(null), RESULT.UNAVAILABLE);
    assert.equal(await audio.play({ kind: 'word', word: 'pan!', units: [] }), RESULT.UNAVAILABLE);

    assert.equal(speechKit.spoken.length, 0);
    assert.equal(context.allNodes.length, 0);
    assert.equal(scheduler.pending(), 0);
});

test('unavailable speech APIs never throw and fall back when Web Audio can run', async () => {
    const { audio, context, scheduler } = makeAudio({ speech: null });

    const promise = audio.play(planFor('pan'));
    scheduler.advance(1000);

    assert.equal(await promise, RESULT.COMPLETED);
    assert.ok(context.created.bufferSources.length >= 1);
    assertClean({ context, scheduler, speechKit: null });
});

// ── Late events after cancellation ───────────────────────────────────────

test('late speech callbacks after cancellation do nothing', async () => {
    const kit = createSpeech([LOCAL_EN]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'), { celebrate: true });
    const utterance = speechKit.spoken[0];
    const lateEnd = utterance.onend;
    const lateError = utterance.onerror;

    audio.stop();
    assert.equal(await result, RESULT.CANCELLED);

    const nodeCount = context.allNodes.length;
    assert.doesNotThrow(() => lateEnd());
    assert.doesNotThrow(() => lateError({ error: 'late' }));

    assert.equal(context.allNodes.length, nodeCount, 'late callbacks create no nodes');
    assert.equal(scheduler.pending(), 0, 'late callbacks create no timers');
    assertClean({ context, scheduler, speechKit });
});

test('late voiceschanged events after cancellation do not start speech', async () => {
    const kit = createSpeech([]);
    const { audio, context, scheduler, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('pan'));
    audio.stop();
    assert.equal(await result, RESULT.CANCELLED);

    assert.equal(speechKit.listenerCount(), 0);
    assert.doesNotThrow(() => kit.emitVoices([LOCAL_EN]));

    assert.equal(speechKit.spoken.length, 0);
    assert.equal(context.allNodes.length, 0);
    assert.equal(scheduler.pending(), 0);
    assertClean({ context, scheduler, speechKit });
});
