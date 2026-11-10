/*  Sound Builder — audio adapter tests
 *
 *  Deterministic fakes only: a fake speech synthesiser, fake AudioContext and
 *  nodes, fake utterances and a fake timer scheduler.  These tests never use
 *  the network, `ps`, `sudo` or loopback sockets, so no test needs a skip.
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

function createScheduler() {
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
            now += Math.max(0, Number(milliseconds) || 0);
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
    const calls = { speak: 0, cancel: 0 };

    const speech = {
        getVoices() {
            return voices.slice();
        },
        speak(utterance) {
            calls.speak += 1;
            spoken.push(utterance);
        },
        cancel() {
            calls.cancel += 1;
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
        setVoices(next) {
            voices = Array.isArray(next) ? next.slice() : [];
        },
        emitVoices(next) {
            if (Array.isArray(next)) voices = next.slice();
            for (const handler of [...listeners]) handler();
        }
    };
}

function createFakeContext() {
    const allNodes = [];
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
        state: 'running',
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
            return Promise.resolve();
        },

        close() {
            this.closeCalls += 1;
            this.state = 'closed';
            return Promise.resolve();
        }
    };

    return context;
}

function makeAudio(options = {}) {
    const scheduler = options.scheduler || createScheduler();
    const context = options.context || createFakeContext();
    const speechKit = options.speechKit || createSpeech(options.voices);
    const speech = Object.prototype.hasOwnProperty.call(options, 'speech')
        ? options.speech
        : speechKit.speech;

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
            : 100
    });

    return { audio, scheduler, context, speechKit, speech };
}

function assertClean({ context, scheduler, speechKit }) {
    assert.equal(scheduler.pending(), 0, 'no timers remain');
    for (const node of context.allNodes) {
        assert.equal(node.disconnected, true, `${node.kind} node was disconnected`);
    }
    if (speechKit) {
        assert.equal(speechKit.listenerCount(), 0, 'no voiceschanged listeners remain');
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

test('an English voice with unknown locality is still eligible', async () => {
    const unknown = { name: 'English', lang: 'en-AU' };
    const kit = createSpeech([unknown]);
    const { audio, speechKit } = makeAudio({ speechKit: kit });

    const result = audio.play(planFor('cat'));
    assert.equal(speechKit.spoken.length, 1);
    assert.equal(speechKit.spoken[0].voice, unknown);
    speechKit.spoken[0].onend();
    assert.equal(await result, RESULT.COMPLETED);
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
