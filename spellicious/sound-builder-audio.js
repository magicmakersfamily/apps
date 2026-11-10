/*  Sound Builder — audio adapter
 *
 *  This file is inactive until a caller creates an adapter and calls `play`.
 *  It publishes `SoundBuilderAudio` in a browser and exports the same object
 *  under Node so the behaviour can be tested offline
 *  (`node --test spellicious/sound-builder-audio.test.mjs`).
 *
 *  It consumes the declarative plans produced by Sound Builder S1
 *  (`sound-builder-logic.js`):
 *
 *      { kind: 'silent', units: [] }
 *      { kind: 'word', word: 'pan', units: [{ type: 'phoneme', id: 'p' }, ...] }
 *      { kind: 'sequence', units: [{ type: 'blend', id: 'pa' }, ...] }
 *
 *  Public shape:
 *
 *      const audio = SoundBuilderAudio.createAudio(options)
 *      const result = await audio.play(plan, { celebrate: false })
 *      audio.stop()
 *      audio.setMuted(true)
 *      audio.dispose()
 *
 *  `play` resolves to one of the strings in `RESULT`:
 *  'completed', 'cancelled', 'muted' or 'unavailable'.  `play` never throws
 *  into the UI, even when speech or Web Audio is missing or misbehaves.
 *
 *  Browser speech policy:
 *  - A whole-word plan may use browser speech only when an installed local
 *    English voice is available.  Remote voices (`localService === false`) are
 *    never selected.  A voice list that is empty or arrives late is waited
 *    for at most `voiceTimeoutMs`, then the plan falls back to synthesis.
 *  - Partial plans (kind 'sequence') never use browser speech.  They always
 *    render their phoneme/blend descriptors with Web Audio.
 *  - Speech errors and stalls fall back to the plan's explicit phoneme
 *    sequence.  If neither speech nor synthesis can run, `play` resolves
 *    'unavailable' without throwing.
 *  - Web Audio is created or resumed only from the user-triggered `play`
 *    call, so a later synthesized fallback or celebration tone is not
 *    blocked by autoplay rules.
 *
 *  Dependency injection (all optional; useful for deterministic tests):
 *
 *      speech               browser speechSynthesis-like object
 *      createUtterance      (text) => SpeechSynthesisUtterance-like object
 *      createAudioContext   () => AudioContext-like object
 *      scheduler            { setTimeout(fn, ms), clearTimeout(id) }
 *      voiceTimeoutMs       bounded wait for a late voice list (default 700)
 *      speechTimeoutMs      bounded wait for a stalled utterance (default 4000)
 *      blends               S1 blend table, defaulting to sound-builder-logic.js
 *
 *  ── Synthesis approximation limits ──────────────────────────────────────
 *
 *  The Web Audio renderer is a small, deterministic stand-in, not a phonetic
 *  model.  It uses fixed formant pairs, filtered deterministic noise and
 *  short envelopes from the data in `SYNTH_DATA`.  It does not model
 *  coarticulation beyond simple overlaps, prosody, stress, syllable timing,
 *  consonant release variation, or a speaker's vocal tract.  Stops are short
 *  releases with no invented trailing vowel; fricatives are filtered noise;
 *  voiced sounds are a buzzy source through two formant filters.  These
 *  approximations are intentionally replaceable: when recorded assets exist,
 *  they can be swapped in behind `renderEntry`/`play` without changing the
 *  plan contract or the public adapter shape.
 *
 *  All synthesis parameters live in data (`SYNTH_DATA`, `TRANSITIONS`,
 *  `POSITIVE_TONE`) so tuning does not require touching the scheduler.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./sound-builder-logic.js'));
    } else {
        root.SoundBuilderAudio = factory(root.SoundBuilderLogic);
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function (logic) {
    'use strict';

    const RESULT = Object.freeze({
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        MUTED: 'muted',
        UNAVAILABLE: 'unavailable'
    });

    // ── Synthesis data ───────────────────────────────────────────────────
    //
    // `kind` selects the renderer:
    //   vowel/nasal/liquid/glide  voiced source + formant bank
    //   stop                      short noise release (plus a quiet voice
    //                             bar when `voiced`), never a trailing vowel
    //   fricative                 filtered deterministic noise
    //   affricate                 short burst followed by frication
    //   compound                  ordered `parts` expanded before rendering
    //
    // Formants are [frequency Hz, Q, branch gain].  No value in this table is
    // a claim of measured accuracy; see the header for the approximation
    // limits.

    function formantList(rows) {
        return Object.freeze(rows.map(row => Object.freeze({
            frequency: row[0],
            q: row[1],
            gain: row[2]
        })));
    }

    function voiced(kind, duration, gain, fundamental, rows) {
        return Object.freeze({
            kind,
            duration,
            gain,
            fundamental,
            attack: 0.02,
            release: 0.05,
            formants: formantList(rows)
        });
    }

    function fricative(duration, gain, frequency, q, voice) {
        return Object.freeze({
            kind: 'fricative',
            duration,
            gain,
            attack: 0.01,
            release: 0.03,
            noise: Object.freeze({ frequency, q }),
            voiced: !!voice,
            voiceGain: voice ? voice.gain : 0,
            fundamental: voice ? voice.fundamental : 0,
            formants: voice ? formantList(voice.formants) : formantList([])
        });
    }

    function stop(voicedRelease, duration, gain, frequency, q, voice) {
        return Object.freeze({
            kind: 'stop',
            duration,
            gain,
            attack: 0.001,
            release: Math.min(0.03, duration),
            voiced: !!voicedRelease,
            burst: Object.freeze({ frequency, q }),
            voiceGain: voice ? voice.gain : 0,
            fundamental: voice ? voice.fundamental : 0,
            formants: voice ? formantList(voice.formants) : formantList([])
        });
    }

    const SYNTH_DATA = Object.freeze({
        a_short: voiced('vowel', 0.16, 0.34, 120, [[730, 5, 0.8], [1090, 7, 0.5], [2440, 9, 0.2]]),
        e_short: voiced('vowel', 0.15, 0.34, 120, [[530, 5, 0.8], [1840, 8, 0.5], [2480, 9, 0.2]]),
        i_short: voiced('vowel', 0.14, 0.32, 120, [[390, 5, 0.8], [1990, 8, 0.5], [2550, 9, 0.2]]),
        o_short: voiced('vowel', 0.16, 0.34, 120, [[570, 5, 0.8], [840, 7, 0.5], [2410, 9, 0.2]]),
        u_short: voiced('vowel', 0.15, 0.32, 120, [[300, 5, 0.8], [870, 7, 0.5], [2240, 9, 0.2]]),

        b: stop(true, 0.07, 0.28, 700, 1.2, { gain: 0.10, fundamental: 110, formants: [[250, 5, 0.6]] }),
        d: stop(true, 0.07, 0.28, 3500, 1.5, { gain: 0.10, fundamental: 110, formants: [[250, 5, 0.6]] }),
        g_hard: stop(true, 0.07, 0.28, 1800, 1.4, { gain: 0.10, fundamental: 110, formants: [[250, 5, 0.6]] }),
        p: stop(false, 0.055, 0.30, 800, 1.2),
        t: stop(false, 0.055, 0.30, 3500, 1.5),
        c_hard: stop(false, 0.055, 0.30, 2000, 1.4),
        k: stop(false, 0.055, 0.30, 2000, 1.4),

        f: fricative(0.095, 0.18, 1800, 0.8),
        h: fricative(0.09, 0.14, 1200, 0.5),
        s: fricative(0.12, 0.20, 4500, 2),
        v: fricative(0.09, 0.20, 2000, 1, { gain: 0.08, fundamental: 110, formants: [[200, 4, 0.5]] }),
        z: fricative(0.10, 0.20, 4500, 2, { gain: 0.08, fundamental: 110, formants: [[200, 4, 0.5]] }),

        j: Object.freeze({
            kind: 'affricate',
            duration: 0.11,
            gain: 0.22,
            attack: 0.001,
            release: 0.03,
            voiced: true,
            voiceGain: 0.07,
            fundamental: 110,
            burst: Object.freeze({ frequency: 2500, q: 1.4 }),
            noise: Object.freeze({ frequency: 2200, q: 1.6 }),
            formants: formantList([[250, 4, 0.5]])
        }),

        l: voiced('liquid', 0.12, 0.30, 120, [[360, 6, 0.7], [1300, 8, 0.35]]),
        r: voiced('liquid', 0.12, 0.28, 120, [[310, 5, 0.5], [1060, 7, 0.5], [1600, 8, 0.2]]),
        m: voiced('nasal', 0.12, 0.26, 115, [[250, 4, 0.6], [1100, 6, 0.25]]),
        n: voiced('nasal', 0.12, 0.26, 115, [[250, 4, 0.6], [1500, 7, 0.3]]),
        w: voiced('glide', 0.08, 0.28, 120, [[300, 5, 0.6], [610, 6, 0.4]]),
        y_consonant: voiced('glide', 0.08, 0.28, 120, [[260, 5, 0.6], [2070, 7, 0.4]]),

        kw: Object.freeze({ kind: 'compound', parts: Object.freeze(['k', 'w']) }),
        ks: Object.freeze({ kind: 'compound', parts: Object.freeze(['k', 's']) })
    });

    // Explicit joins.  A blend's two phonemes overlap by the value for their
    // class pair; separate letters in a partial plan keep a small gap.  These
    // numbers are audible-approximation choices, not measured data.
    const TRANSITIONS = Object.freeze({
        'stop->vowel': 0.012,
        'stop->fricative': 0.008,
        'stop->liquid': 0.004,
        'stop->glide': 0.004,
        'fricative->vowel': 0.025,
        'fricative->stop': 0.012,
        'nasal->vowel': 0.03,
        'liquid->vowel': 0.03,
        'glide->vowel': 0.03,
        'vowel->vowel': 0.02,
        'vowel->stop': 0.02,
        'vowel->fricative': 0.02,
        'vowel->nasal': 0.025,
        'vowel->liquid': 0.025,
        'vowel->glide': 0.02,
        default: 0.015
    });

    const SEQUENCE_GAP = 0.02;

    const POSITIVE_TONE = Object.freeze({
        frequency: 660,
        duration: 0.18,
        attack: 0.015,
        gain: 0.05
    });

    const SPEECH = Object.freeze({
        rate: 0.85,
        pitch: 1,
        volume: 1,
        lang: 'en-US'
    });

    function transitionOverlap(from, to) {
        if (!from || !to) return 0;
        const key = from.kind + '->' + to.kind;
        return Object.prototype.hasOwnProperty.call(TRANSITIONS, key)
            ? TRANSITIONS[key]
            : TRANSITIONS.default;
    }

    function expandPhoneme(id) {
        const descriptor = SYNTH_DATA[id];
        if (!descriptor) return [];
        if (descriptor.kind === 'compound' && Array.isArray(descriptor.parts)) {
            const out = [];
            for (const part of descriptor.parts) out.push(...expandPhoneme(part));
            return out;
        }
        return [id];
    }

    // Pure, deterministic timeline used by the renderer and by tests.  It
    // never touches a browser object.  `connected` joins a recognised word's
    // explicit phoneme sequence with the same overlaps a blend uses; partial
    // plans keep a small gap between separately entered letters.
    function planRender(units, options) {
        const connected = !!(options && options.connected);
        const blendTable = (options && options.blends) || (logic && logic.BLENDS) || null;
        const entries = [];
        let cursor = 0;
        let previous = null;

        for (const unit of Array.isArray(units) ? units : []) {
            if (!unit || typeof unit !== 'object' || typeof unit.id !== 'string') continue;

            let parts;
            if (unit.type === 'blend') {
                parts = blendTable && blendTable[unit.id] ? blendTable[unit.id].phonemes : null;
            } else {
                parts = [unit.id];
            }
            if (!Array.isArray(parts) || parts.length === 0) continue;

            let continuedFromUnit = false;
            for (const phonemeId of parts) {
                const chain = expandPhoneme(phonemeId);
                for (const id of chain) {
                    const descriptor = SYNTH_DATA[id];
                    if (!descriptor) continue;

                    let start = cursor;
                    let transition = 0;
                    if (entries.length > 0) {
                        if (continuedFromUnit) {
                            transition = transitionOverlap(previous, descriptor);
                            start = Math.max(0, cursor - transition);
                        } else if (!connected) {
                            start = cursor + SEQUENCE_GAP;
                        } else {
                            transition = transitionOverlap(previous, descriptor);
                            start = Math.max(0, cursor - transition);
                        }
                    }

                    entries.push({
                        id,
                        kind: descriptor.kind,
                        start,
                        duration: descriptor.duration,
                        transition,
                        descriptor
                    });
                    cursor = start + descriptor.duration;
                    previous = descriptor;
                    continuedFromUnit = true;
                }
            }
        }

        return { entries, duration: entries.length ? cursor : 0 };
    }

    // ── Deterministic noise ──────────────────────────────────────────────

    const noiseBuffers = typeof WeakMap === 'function' ? new WeakMap() : null;

    function getNoiseBuffer(context) {
        if (noiseBuffers && noiseBuffers.has(context)) return noiseBuffers.get(context);

        const sampleRate = Number(context.sampleRate) || 44100;
        const length = Math.max(1, Math.floor(sampleRate * 0.5));
        const buffer = context.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        // A fixed LCG keeps the noise identical between runs and devices.
        let seed = 0x9e3779b9;
        for (let index = 0; index < data.length; index += 1) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            data[index] = (seed / 4294967296) * 2 - 1;
        }

        if (noiseBuffers) noiseBuffers.set(context, buffer);
        return buffer;
    }

    // ── Default dependencies ─────────────────────────────────────────────

    const globalScope = typeof globalThis !== 'undefined' ? globalThis : {};

    const defaultScheduler = {
        setTimeout(callback, delay) {
            return globalScope.setTimeout(callback, delay);
        },
        clearTimeout(id) {
            globalScope.clearTimeout(id);
        }
    };

    function defaultCreateUtterance(text) {
        const Constructor = globalScope.SpeechSynthesisUtterance;
        if (typeof Constructor !== 'function') throw new Error('Speech synthesis is not available.');
        return new Constructor(text);
    }

    function defaultCreateAudioContext() {
        const Constructor = globalScope.AudioContext || globalScope.webkitAudioContext;
        if (typeof Constructor !== 'function') throw new Error('Web Audio is not available.');
        return new Constructor();
    }

    function readGlobalSpeech() {
        return globalScope.speechSynthesis || null;
    }

    // ── The adapter ──────────────────────────────────────────────────────

    function createAudio(options) {
        const settings = options || {};
        const speech = Object.prototype.hasOwnProperty.call(settings, 'speech')
            ? settings.speech
            : readGlobalSpeech();
        const createUtterance = typeof settings.createUtterance === 'function'
            ? settings.createUtterance
            : defaultCreateUtterance;
        const createAudioContext = typeof settings.createAudioContext === 'function'
            ? settings.createAudioContext
            : defaultCreateAudioContext;
        const scheduler = settings.scheduler || defaultScheduler;
        const voiceTimeoutMs = Number.isFinite(settings.voiceTimeoutMs)
            ? Math.max(0, settings.voiceTimeoutMs)
            : 700;
        const speechTimeoutMs = Number.isFinite(settings.speechTimeoutMs)
            ? Math.max(0, settings.speechTimeoutMs)
            : 4000;
        const blends = settings.blends || (logic && logic.BLENDS) || null;

        let muted = false;
        let disposed = false;
        let current = null;
        let generation = 0;
        let audioContext = null;

        function isCurrent(operation) {
            return !disposed &&
                current === operation &&
                !operation.done &&
                operation.token === generation;
        }

        function ownNode(operation, node, source) {
            if (node) operation.nodes.push({ node, source: !!source });
            return node;
        }

        function cleanupNodes(operation) {
            for (const owned of operation.nodes) {
                if (owned.source && typeof owned.node.stop === 'function') {
                    try { owned.node.stop(0); } catch (error) { /* already stopped */ }
                }
                if (typeof owned.node.disconnect === 'function') {
                    try { owned.node.disconnect(); } catch (error) { /* already gone */ }
                }
            }
            operation.nodes.length = 0;
        }

        function clearUtterance(operation, cancelSpeech) {
            const utterance = operation.utterance;
            if (!utterance) return;
            operation.utterance = null;
            try {
                utterance.onend = null;
                utterance.onerror = null;
            } catch (error) { /* hostile utterance object */ }
            if (cancelSpeech && speech && typeof speech.cancel === 'function') {
                try { speech.cancel(); } catch (error) { /* ignore */ }
            }
        }

        function finish(operation, status) {
            if (!operation || operation.done) return;
            operation.done = true;
            generation += 1;

            if (operation.removeVoiceListener) {
                try { operation.removeVoiceListener(); } catch (error) { /* ignore */ }
                operation.removeVoiceListener = null;
            }

            for (const id of operation.timers) {
                try { scheduler.clearTimeout(id); } catch (error) { /* ignore */ }
            }
            operation.timers.clear();

            clearUtterance(operation, true);
            cleanupNodes(operation);

            if (current === operation) current = null;
            operation.resolve(status);
        }

        function later(operation, callback, delay) {
            let id = null;
            try {
                id = scheduler.setTimeout(function () {
                    if (id !== null) operation.timers.delete(id);
                    if (!isCurrent(operation)) return;
                    try {
                        callback();
                    } catch (error) {
                        finish(operation, RESULT.UNAVAILABLE);
                    }
                }, Math.max(0, delay));
            } catch (error) {
                finish(operation, RESULT.UNAVAILABLE);
                return null;
            }
            operation.timers.add(id);
            return id;
        }

        function invalidate(status) {
            const operation = current;
            if (!operation) return;
            finish(operation, status);
        }

        function ensureContext() {
            if (disposed) return null;
            if (audioContext) {
                if (audioContext.state === 'closed') return null;
                resumeContext(audioContext);
                return audioContext;
            }
            let context = null;
            try {
                context = createAudioContext();
            } catch (error) {
                return null;
            }
            if (!context || typeof context.createGain !== 'function') return null;
            audioContext = context;
            resumeContext(audioContext);
            return context;
        }

        function resumeContext(context) {
            try {
                if (context.state === 'suspended' && typeof context.resume === 'function') {
                    const resumed = context.resume();
                    if (resumed && typeof resumed.catch === 'function') {
                        resumed.catch(function () { /* a later gesture can resume */ });
                    }
                }
            } catch (error) { /* ignore */ }
        }

        // ── Web Audio renderer ───────────────────────────────────────────

        function envelope(context, operation, at, duration, peak, attack, release) {
            const gain = ownNode(operation, context.createGain(), false);
            gain.connect(context.destination);
            const param = gain.gain;
            const holdUntil = Math.max(at + attack, at + duration - release);
            param.setValueAtTime(0, at);
            param.linearRampToValueAtTime(peak, at + attack);
            param.linearRampToValueAtTime(peak, holdUntil);
            param.linearRampToValueAtTime(0, at + duration);
            return gain;
        }

        function noisePart(context, operation, noise, shape, at, duration, peak) {
            const durationSeconds = Math.max(0.005, duration);
            const source = ownNode(operation, context.createBufferSource(), true);
            source.buffer = getNoiseBuffer(context);

            const filter = ownNode(operation, context.createBiquadFilter(), false);
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(noise.frequency, at);
            filter.Q.setValueAtTime(noise.q, at);

            const output = envelope(
                context,
                operation,
                at,
                durationSeconds,
                peak,
                shape.attack,
                shape.release
            );

            source.connect(filter);
            filter.connect(output);
            source.start(at);
            source.stop(at + durationSeconds + 0.02);
        }

        function voicePart(context, operation, descriptor, at, duration, peak) {
            const durationSeconds = Math.max(0.005, duration);
            const output = envelope(
                context,
                operation,
                at,
                durationSeconds,
                peak,
                descriptor.attack || 0.01,
                descriptor.release || 0.03
            );

            const oscillator = ownNode(operation, context.createOscillator(), true);
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(descriptor.fundamental || 120, at);

            const formants = Array.isArray(descriptor.formants) ? descriptor.formants : [];
            for (const formant of formants) {
                const filter = ownNode(operation, context.createBiquadFilter(), false);
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(formant.frequency, at);
                filter.Q.setValueAtTime(formant.q, at);

                const branch = ownNode(operation, context.createGain(), false);
                branch.gain.setValueAtTime(formant.gain, at);

                oscillator.connect(filter);
                filter.connect(branch);
                branch.connect(output);
            }

            oscillator.start(at);
            oscillator.stop(at + durationSeconds + 0.02);
        }

        function renderEntry(context, operation, entry, at) {
            const descriptor = entry.descriptor;
            const duration = entry.duration;

            if (descriptor.kind === 'stop') {
                noisePart(
                    context,
                    operation,
                    descriptor.burst,
                    descriptor,
                    at,
                    duration,
                    descriptor.gain
                );
                if (descriptor.voiced) {
                    voicePart(
                        context,
                        operation,
                        descriptor,
                        at,
                        duration,
                        descriptor.voiceGain || 0.08
                    );
                }
                return;
            }

            if (descriptor.kind === 'fricative') {
                noisePart(
                    context,
                    operation,
                    descriptor.noise,
                    descriptor,
                    at,
                    duration,
                    descriptor.gain
                );
                if (descriptor.voiced) {
                    voicePart(
                        context,
                        operation,
                        descriptor,
                        at,
                        duration,
                        descriptor.voiceGain || 0.08
                    );
                }
                return;
            }

            if (descriptor.kind === 'affricate') {
                const burst = Math.max(0.02, duration * 0.4);
                noisePart(
                    context,
                    operation,
                    descriptor.burst,
                    descriptor,
                    at,
                    burst,
                    descriptor.gain
                );
                noisePart(
                    context,
                    operation,
                    descriptor.noise,
                    descriptor,
                    at + burst * 0.8,
                    duration - burst * 0.8,
                    descriptor.gain * 0.8
                );
                if (descriptor.voiced) {
                    voicePart(
                        context,
                        operation,
                        descriptor,
                        at,
                        duration,
                        descriptor.voiceGain || 0.07
                    );
                }
                return;
            }

            // vowel, nasal, liquid and glide all use the voiced formant path.
            voicePart(context, operation, descriptor, at, duration, descriptor.gain);
        }

        function schedulePlan(context, operation, timeline, lead) {
            for (const entry of timeline.entries) {
                renderEntry(context, operation, entry, lead + entry.start);
            }
        }

        function renderTone(context, operation) {
            const at = Math.max(0, Number(context.currentTime) || 0) + 0.01;
            const output = ownNode(operation, context.createGain(), false);
            output.connect(context.destination);
            output.gain.setValueAtTime(0, at);
            output.gain.linearRampToValueAtTime(POSITIVE_TONE.gain, at + POSITIVE_TONE.attack);
            output.gain.linearRampToValueAtTime(
                0,
                at + POSITIVE_TONE.duration
            );

            const oscillator = ownNode(operation, context.createOscillator(), true);
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(POSITIVE_TONE.frequency, at);
            oscillator.connect(output);
            oscillator.start(at);
            oscillator.stop(at + POSITIVE_TONE.duration + 0.02);
        }

        // ── Voice selection ──────────────────────────────────────────────

        function readVoices() {
            if (!speech || typeof speech.getVoices !== 'function') return [];
            try {
                const voices = speech.getVoices();
                return Array.isArray(voices) ? voices.slice() : [];
            } catch (error) {
                return [];
            }
        }

        function isEnglish(voice) {
            return !!voice && typeof voice.lang === 'string' &&
                /^en(?:$|[-_])/i.test(voice.lang.trim());
        }

        // Prefer an explicitly local English voice.  If a browser omits
        // `localService`, an English voice is still eligible because it is not
        // known to be remote.  An explicit remote voice is never chosen.
        function chooseVoice(voices) {
            const english = (voices || []).filter(isEnglish);
            for (const voice of english) {
                if (voice.localService === true) return voice;
            }
            for (const voice of english) {
                if (voice.localService !== false) return voice;
            }
            return null;
        }

        function registerVoicesListener(operation, handler) {
            let previousHandler = null;
            let mode = 'none';
            let removed = false;

            const remove = function () {
                if (removed) return;
                removed = true;
                try {
                    if (mode === 'event') {
                        speech.removeEventListener('voiceschanged', handler);
                    } else if (mode === 'property' && speech.onvoiceschanged === handler) {
                        speech.onvoiceschanged = previousHandler;
                    }
                } catch (error) { /* ignore */ }
                if (operation.removeVoiceListener === remove) operation.removeVoiceListener = null;
            };

            if (!speech) return remove;

            try {
                if (typeof speech.addEventListener === 'function' &&
                    typeof speech.removeEventListener === 'function') {
                    speech.addEventListener('voiceschanged', handler);
                    mode = 'event';
                    operation.removeVoiceListener = remove;
                } else if ('onvoiceschanged' in speech || typeof speech.onvoiceschanged !== 'undefined') {
                    previousHandler = speech.onvoiceschanged;
                    speech.onvoiceschanged = handler;
                    mode = 'property';
                    operation.removeVoiceListener = remove;
                }
            } catch (error) { /* no listener support; the timer still bounds the wait */ }

            return remove;
        }

        function waitForVoices(operation) {
            operation.stage = 'voices';
            let settled = false;
            let waitTimer = null;

            const settle = function () {
                if (settled) return false;
                settled = true;
                if (operation.removeVoiceListener) {
                    try { operation.removeVoiceListener(); } catch (error) { /* ignore */ }
                    operation.removeVoiceListener = null;
                }
                if (waitTimer !== null) {
                    try { scheduler.clearTimeout(waitTimer); } catch (error) { /* ignore */ }
                    operation.timers.delete(waitTimer);
                    waitTimer = null;
                }
                return true;
            };

            const useVoices = function () {
                if (settled || !isCurrent(operation)) return;
                const voices = readVoices();
                if (voices.length === 0) return;
                const voice = chooseVoice(voices);
                if (!settle()) return;
                if (voice) speakWord(operation, voice);
                else startSynth(operation);
            };

            registerVoicesListener(operation, useVoices);
            if (settled) return;

            waitTimer = later(operation, function () {
                if (settled || !isCurrent(operation)) return;
                const voice = chooseVoice(readVoices());
                if (!settle()) return;
                if (voice) speakWord(operation, voice);
                else startSynth(operation);
            }, voiceTimeoutMs);
        }

        // ── Playback paths ───────────────────────────────────────────────

        function startWord(operation) {
            if (!speech || typeof speech.speak !== 'function' ||
                typeof speech.getVoices !== 'function' ||
                typeof createUtterance !== 'function') {
                startSynth(operation);
                return;
            }

            const voices = readVoices();
            if (voices.length === 0) {
                waitForVoices(operation);
                return;
            }

            const voice = chooseVoice(voices);
            if (voice) speakWord(operation, voice);
            else startSynth(operation);
        }

        function speakWord(operation, voice) {
            if (!isCurrent(operation)) return;
            operation.stage = 'speech';

            let utterance = null;
            try {
                utterance = createUtterance(operation.plan.word);
                if (!utterance) throw new Error('No utterance.');
                utterance.text = operation.plan.word;
                utterance.lang = voice.lang || SPEECH.lang;
                utterance.voice = voice;
                utterance.rate = SPEECH.rate;
                utterance.pitch = SPEECH.pitch;
                utterance.volume = SPEECH.volume;
                utterance.onend = function () { handleSpeechEnd(operation); };
                utterance.onerror = function () { handleSpeechError(operation); };
            } catch (error) {
                startSynth(operation);
                return;
            }

            operation.utterance = utterance;

            try {
                speech.speak(utterance);
            } catch (error) {
                clearUtterance(operation, true);
                startSynth(operation);
                return;
            }

            // A test double may end the utterance synchronously; never leave a
            // stall timer behind for an operation that already finished.
            if (!isCurrent(operation)) return;

            later(operation, function () {
                if (!isCurrent(operation) ||
                    operation.stage !== 'speech' ||
                    operation.utterance !== utterance) {
                    return;
                }
                // A stalled utterance is cancelled and replaced by the
                // explicit phoneme sequence, not left queued forever.
                clearUtterance(operation, true);
                startSynth(operation);
            }, speechTimeoutMs);
        }

        function handleSpeechEnd(operation) {
            if (!isCurrent(operation) || operation.stage !== 'speech') return;
            clearUtterance(operation, false);
            operation.stage = 'speech-done';
            if (operation.celebrate) playPositiveTone(operation);
            else finish(operation, RESULT.COMPLETED);
        }

        function handleSpeechError(operation) {
            if (!isCurrent(operation) || operation.stage !== 'speech') return;
            clearUtterance(operation, true);
            startSynth(operation);
        }

        function startSynth(operation) {
            if (!isCurrent(operation)) return;
            operation.stage = 'synth';

            const context = ensureContext();
            if (!context) {
                finish(operation, RESULT.UNAVAILABLE);
                return;
            }

            let timeline = null;
            try {
                timeline = planRender(operation.plan.units, {
                    connected: operation.plan.kind === 'word',
                    blends: blends
                });
            } catch (error) {
                finish(operation, RESULT.UNAVAILABLE);
                return;
            }

            if (!timeline || timeline.entries.length === 0) {
                finish(operation, RESULT.UNAVAILABLE);
                return;
            }

            const lead = Math.max(0, Number(context.currentTime) || 0) + 0.02;
            try {
                schedulePlan(context, operation, timeline, lead);
            } catch (error) {
                cleanupNodes(operation);
                finish(operation, RESULT.UNAVAILABLE);
                return;
            }

            const totalMs = Math.ceil((timeline.duration + 0.06) * 1000);
            later(operation, function () {
                if (!isCurrent(operation) || operation.stage !== 'synth') return;
                if (operation.celebrate) playPositiveTone(operation);
                else finish(operation, RESULT.COMPLETED);
            }, totalMs);
        }

        function playPositiveTone(operation) {
            if (!isCurrent(operation)) return;
            operation.stage = 'tone';

            const context = ensureContext();
            if (!context) {
                finish(operation, RESULT.COMPLETED);
                return;
            }

            try {
                renderTone(context, operation);
            } catch (error) {
                finish(operation, RESULT.COMPLETED);
                return;
            }

            later(operation, function () {
                if (!isCurrent(operation) || operation.stage !== 'tone') return;
                finish(operation, RESULT.COMPLETED);
            }, Math.ceil(POSITIVE_TONE.duration * 1000) + 40);
        }

        // ── Plan validation ──────────────────────────────────────────────

        function normalizePlan(plan) {
            if (!plan || typeof plan !== 'object') return null;

            if (plan.kind === 'silent') {
                return { kind: 'silent', units: [] };
            }

            if (plan.kind === 'word') {
                if (typeof plan.word !== 'string') return null;
                const word = plan.word.trim().toLowerCase();
                if (!/^[a-z]+$/.test(word)) return null;
                return {
                    kind: 'word',
                    word,
                    units: Array.isArray(plan.units) ? plan.units.slice() : []
                };
            }

            if (plan.kind === 'sequence') {
                if (!Array.isArray(plan.units)) return null;
                return { kind: 'sequence', units: plan.units.slice() };
            }

            return null;
        }

        // ── Public API ───────────────────────────────────────────────────

        function play(plan, playOptions) {
            const celebrate = !!(playOptions && playOptions.celebrate);

            // Every play invalidates the previous operation first.
            invalidate(RESULT.CANCELLED);

            if (disposed) return Promise.resolve(RESULT.UNAVAILABLE);
            if (muted) return Promise.resolve(RESULT.MUTED);

            const normalized = normalizePlan(plan);
            if (!normalized) return Promise.resolve(RESULT.UNAVAILABLE);
            if (normalized.kind === 'silent' ||
                (normalized.kind === 'sequence' && normalized.units.length === 0)) {
                return Promise.resolve(RESULT.COMPLETED);
            }

            return new Promise(function (resolve) {
                const operation = {
                    token: generation + 1,
                    plan: normalized,
                    celebrate: celebrate && normalized.kind === 'word',
                    stage: 'init',
                    utterance: null,
                    removeVoiceListener: null,
                    timers: new Set(),
                    nodes: [],
                    done: false,
                    resolve
                };
                generation = operation.token;
                current = operation;

                try {
                    // Called from the user-triggered play stack so a later
                    // synthesized fallback or celebration tone is already
                    // unlocked on browsers that require a gesture.
                    ensureContext();
                    if (operation.plan.kind === 'word') startWord(operation);
                    else startSynth(operation);
                } catch (error) {
                    finish(operation, RESULT.UNAVAILABLE);
                }
            });
        }

        function stop() {
            invalidate(RESULT.CANCELLED);
        }

        function setMuted(value) {
            muted = !!value;
            if (muted) invalidate(RESULT.MUTED);
        }

        function dispose() {
            if (disposed) return;
            disposed = true;
            invalidate(RESULT.CANCELLED);

            if (audioContext) {
                const context = audioContext;
                audioContext = null;
                try {
                    if (typeof context.close === 'function') {
                        const closed = context.close();
                        if (closed && typeof closed.catch === 'function') {
                            closed.catch(function () { /* ignore */ });
                        }
                    }
                } catch (error) { /* ignore */ }
            }
        }

        return {
            play,
            stop,
            setMuted,
            dispose
        };
    }

    return {
        createAudio,
        RESULT,
        SYNTH_DATA,
        TRANSITIONS,
        POSITIVE_TONE,
        planRender
    };
}));
