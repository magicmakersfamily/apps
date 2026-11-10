import test from 'node:test';
import assert from 'node:assert/strict';
import logic from './sound-builder-logic.js';

const {
    createState,
    selectSlot,
    enterLetter,
    clearState,
    resizeState,
    recognizeWord,
    selectAudio,
    DEFAULT_WORDS,
    PHONEMES,
    LETTER_SOUNDS,
    BLENDS
} = logic;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DEFAULT_WORD_LIST = [
    'am', 'in', 'at', 'up', 'cat', 'bat', 'can', 'sun',
    'pan', 'map', 'hat', 'fun', 'hand', 'lamp', 'sand', 'milk'
];

function enterAll(state, text) {
    let current = state;
    for (const character of text) current = enterLetter(current, character);
    return current;
}

function phonemeIds(units) {
    return units.map(unit => unit.id);
}

// ── State creation ───────────────────────────────────────────────────────

test('createState starts with three empty slots and slot 0 selected', () => {
    assert.deepEqual(createState(), { slots: [null, null, null], selectedIndex: 0 });
    assert.deepEqual(createState(undefined), { slots: [null, null, null], selectedIndex: 0 });
});

test('createState supports two, three and four slots', () => {
    assert.deepEqual(createState(2), { slots: [null, null], selectedIndex: 0 });
    assert.deepEqual(createState(3), { slots: [null, null, null], selectedIndex: 0 });
    assert.deepEqual(createState(4), { slots: [null, null, null, null], selectedIndex: 0 });
});

test('createState falls back to three slots for unsupported counts', () => {
    for (const count of [0, 1, 5, -1, 2.5, '3', null, NaN, {}]) {
        assert.deepEqual(createState(count), { slots: [null, null, null], selectedIndex: 0 });
    }
});

// ── Letters ──────────────────────────────────────────────────────────────

test('enterLetter normalizes single ASCII letters case-insensitively', () => {
    assert.deepEqual(enterLetter(createState(), 'p').slots, ['P', null, null]);
    assert.deepEqual(enterLetter(createState(), 'P').slots, ['P', null, null]);
});

test('enterLetter ignores anything that is not one ASCII letter', () => {
    const base = createState();
    for (const value of ['', 'ab', '1', 'é', 'ß', '  ', '😀', null, undefined, 5, {}, ['a']]) {
        assert.equal(enterLetter(base, value), base, `expected no-op for ${String(value)}`);
    }
});

test('enterLetter advances to the first remaining empty slot', () => {
    const afterP = enterLetter(createState(), 'p');
    assert.deepEqual(afterP, { slots: ['P', null, null], selectedIndex: 1 });

    const afterA = enterLetter(afterP, 'a');
    assert.deepEqual(afterA, { slots: ['P', 'A', null], selectedIndex: 2 });

    const afterN = enterLetter(afterA, 'n');
    assert.deepEqual(afterN, { slots: ['P', 'A', 'N'], selectedIndex: null });
});

test('an explicitly selected empty slot receives the next letter', () => {
    let state = selectSlot(createState(), 2);
    state = enterLetter(state, 'x');
    assert.deepEqual(state.slots, [null, null, 'X']);
    // First remaining empty slot wins, even when it is earlier in the word.
    assert.equal(state.selectedIndex, 0);
});

test('filling all slots clears the selection and further input is a no-op', () => {
    const full = enterAll(createState(), 'cat');
    assert.deepEqual(full, { slots: ['C', 'A', 'T'], selectedIndex: null });
    assert.equal(enterLetter(full, 's'), full);
});

test('replacing a filled slot keeps that slot selected', () => {
    let state = enterLetter(createState(), 'p');
    state = selectSlot(state, 0);
    state = enterLetter(state, 'b');

    assert.deepEqual(state, { slots: ['B', null, null], selectedIndex: 0 });
    // The retained selection receives the next letter, replacing again.
    assert.deepEqual(enterLetter(state, 'a'), {
        slots: ['A', null, null],
        selectedIndex: 0
    });
});

test('entering the same letter again is a no-op', () => {
    // After P, selection has advanced to empty slot 1. Select the filled
    // slot explicitly so the next letter targets the slot that holds P.
    const state = selectSlot(enterLetter(createState(), 'p'), 0);
    assert.deepEqual(state, { slots: ['P', null, null], selectedIndex: 0 });

    assert.equal(enterLetter(state, 'P'), state);
    assert.equal(enterLetter(state, 'p'), state);
});

test('selectSlot changes selection only and never touches slots', () => {
    const state = enterLetter(createState(), 'p');
    const selected = selectSlot(state, 2);

    assert.notEqual(selected, state);
    assert.deepEqual(selected, { slots: ['P', null, null], selectedIndex: 2 });
    assert.deepEqual(Object.keys(selected).sort(), ['selectedIndex', 'slots']);
});

test('selectSlot ignores invalid indexes and the current index', () => {
    const state = selectSlot(createState(), 1);
    for (const index of [-1, 3, 1.5, '1', null, undefined, NaN, {}]) {
        assert.equal(selectSlot(state, index), state);
    }
    assert.equal(selectSlot(state, 1), state);
});

test('state functions never mutate their input', () => {
    const frozen = Object.freeze({
        slots: Object.freeze([null, null, null]),
        selectedIndex: 0
    });

    const next = enterLetter(frozen, 'c');
    assert.notEqual(next, frozen);
    assert.notEqual(next.slots, frozen.slots);
    assert.deepEqual(frozen, { slots: [null, null, null], selectedIndex: 0 });

    const selected = selectSlot(frozen, 2);
    assert.notEqual(selected, frozen);
    assert.deepEqual(frozen.slots, [null, null, null]);

    const cleared = clearState(enterAll(createState(), 'ca'));
    assert.deepEqual(cleared, { slots: [null, null, null], selectedIndex: 0 });
});

// ── Clear and resize ─────────────────────────────────────────────────────

test('clearState empties every slot, keeps the count and selects slot 0', () => {
    const state = enterAll(createState(), 'ca');
    const cleared = clearState(state);

    assert.deepEqual(cleared, { slots: [null, null, null], selectedIndex: 0 });
    assert.equal(state.slots[0], 'C', 'the original state is unchanged');

    const four = clearState(enterAll(createState(4), 'sand'));
    assert.deepEqual(four, { slots: [null, null, null, null], selectedIndex: 0 });
});

test('clearState is a no-op when the board is already empty and slot 0 is selected', () => {
    const empty = createState();
    assert.equal(clearState(empty), empty);

    const reselected = selectSlot(empty, 2);
    const cleared = clearState(reselected);
    assert.notEqual(cleared, reselected);
    assert.equal(cleared.selectedIndex, 0);
});

test('resizeState resets the board when the count changes', () => {
    const full = enterAll(createState(), 'cat');
    const grown = resizeState(full, 4);

    assert.deepEqual(grown, { slots: [null, null, null, null], selectedIndex: 0 });
    assert.notEqual(grown, full);
    assert.deepEqual(full.slots, ['C', 'A', 'T'], 'the original state is unchanged');

    const shrunk = resizeState(createState(), 2);
    assert.deepEqual(shrunk, { slots: [null, null], selectedIndex: 0 });
});

test('resizeState ignores the current count and unsupported counts', () => {
    const state = enterAll(createState(), 'ca');
    assert.equal(resizeState(state, 3), state);
    for (const count of [0, 1, 5, -1, '4', null, undefined, NaN]) {
        assert.equal(resizeState(state, count), state);
    }
});

// ── Recognition ──────────────────────────────────────────────────────────

test('every curated dictionary word is recognized when its slots are full', () => {
    for (const word of DEFAULT_WORD_LIST) {
        assert.equal(recognizeWord([...word.toUpperCase()]), word);
    }
    assert.equal(recognizeWord([...'CAT']), 'cat');
    assert.equal(recognizeWord([...'BAT']), 'bat');
    assert.equal(recognizeWord([...'HAT']), 'hat');
    assert.equal(recognizeWord([...'PAN']), 'pan');
    assert.equal(recognizeWord([...'CAN']), 'can');
    assert.equal(recognizeWord([...'SUN']), 'sun');
    assert.equal(recognizeWord([...'FUN']), 'fun');
});

test('incomplete or unknown combinations are not recognized', () => {
    assert.equal(recognizeWord(['C', 'A', null]), null);
    assert.equal(recognizeWord(['C', 'A']), null);
    assert.equal(recognizeWord(['C']), null);
    assert.equal(recognizeWord([]), null);
    assert.equal(recognizeWord(null), null);
    assert.equal(recognizeWord(['C', 'O', 'W']), null);
    assert.equal(recognizeWord(['D', 'O', 'G']), null);
    assert.equal(recognizeWord(['P', 'A', 'T']), null);
    assert.equal(recognizeWord(['C', 'A', 'T', 'S']), null);
});

test('recognizeWord tolerates lowercase slots and rejects invalid slot values', () => {
    assert.equal(recognizeWord(['c', 'a', 't']), 'cat');
    assert.equal(recognizeWord(['c', 'a', '1']), null);
    assert.equal(recognizeWord(['c', 'a', 3]), null);
});

test('recognizeWord accepts an injected dictionary in several shapes', () => {
    assert.equal(recognizeWord(['D', 'O', 'G'], ['dog']), 'dog');
    assert.equal(recognizeWord(['D', 'O', 'G'], ['DOG']), 'dog');
    assert.equal(recognizeWord(['D', 'O', 'G'], ['cat']), null);
    assert.equal(recognizeWord(['D', 'O', 'G'], new Set(['dog'])), 'dog');
    assert.equal(recognizeWord(['D', 'O', 'G'], new Map([['dog', ['d', 'o_short', 'g_hard']]])), 'dog');
    assert.equal(
        recognizeWord(['D', 'O', 'G'], { dog: { phonemes: ['d', 'o_short', 'g_hard'] } }),
        'dog'
    );
    assert.equal(recognizeWord(['C', 'A', 'T'], { dog: ['d', 'o_short', 'g_hard'] }), null);
    // Injection does not enlarge the default dictionary.
    assert.equal(recognizeWord(['D', 'O', 'G']), null);
});

// ── Audio plans ──────────────────────────────────────────────────────────

test('selectAudio returns silence for empty or unusable input', () => {
    const silent = { kind: 'silent', units: [] };
    assert.deepEqual(selectAudio(createState()), silent);
    assert.deepEqual(selectAudio(createState(2)), silent);
    assert.deepEqual(selectAudio(createState(4)), silent);
    assert.deepEqual(selectAudio(null), silent);
    assert.deepEqual(selectAudio({}), silent);
    assert.deepEqual(selectAudio({ slots: [] }), silent);
});

test('selectAudio follows P → PA → PAN from letters to blend to word', () => {
    const p = enterLetter(createState(), 'p');
    assert.deepEqual(selectAudio(p), {
        kind: 'sequence',
        units: [{ type: 'phoneme', id: 'p' }]
    });

    const pa = enterLetter(p, 'a');
    assert.deepEqual(selectAudio(pa), {
        kind: 'sequence',
        units: [{ type: 'blend', id: 'pa' }]
    });

    const pan = enterLetter(pa, 'n');
    assert.deepEqual(selectAudio(pan), {
        kind: 'word',
        word: 'pan',
        units: [
            { type: 'phoneme', id: 'p' },
            { type: 'phoneme', id: 'a_short' },
            { type: 'phoneme', id: 'n' }
        ]
    });
});

test('selectAudio follows S → SU → SUN from letters to blend to word', () => {
    const s = enterLetter(createState(), 's');
    assert.deepEqual(selectAudio(s), {
        kind: 'sequence',
        units: [{ type: 'phoneme', id: 's' }]
    });

    const su = enterLetter(s, 'u');
    assert.deepEqual(selectAudio(su), {
        kind: 'sequence',
        units: [{ type: 'blend', id: 'su' }]
    });

    const sun = enterLetter(su, 'n');
    assert.deepEqual(selectAudio(sun), {
        kind: 'word',
        word: 'sun',
        units: [
            { type: 'phoneme', id: 's' },
            { type: 'phoneme', id: 'u_short' },
            { type: 'phoneme', id: 'n' }
        ]
    });
});

test('PAN and CAN are different word plans that differ at the first sound', () => {
    const pan = selectAudio(enterAll(createState(), 'pan'));
    const can = selectAudio(enterAll(createState(), 'can'));

    assert.equal(pan.kind, 'word');
    assert.equal(pan.word, 'pan');
    assert.equal(can.kind, 'word');
    assert.equal(can.word, 'can');
    assert.deepEqual(phonemeIds(pan.units), ['p', 'a_short', 'n']);
    assert.deepEqual(phonemeIds(can.units), ['c_hard', 'a_short', 'n']);
    assert.notDeepEqual(pan.units, can.units);
});

test('a recognized word plan uses its explicit curated sequence', () => {
    const cat = selectAudio(enterAll(createState(), 'cat'));
    const milk = selectAudio(enterAll(createState(4), 'milk'));

    assert.deepEqual(phonemeIds(cat.units), ['c_hard', 'a_short', 't']);
    assert.deepEqual(phonemeIds(milk.units), ['m', 'i_short', 'l', 'k']);
    for (const unit of cat.units) assert.equal(unit.type, 'phoneme');
});

test('unknown full combinations use curated blends or constituent letters', () => {
    // COW is not a dictionary word. "co" is a curated short-o chunk whose
    // context (followed by a consonant) matches, so it is used.
    const cow = enterAll(createState(), 'cow');
    assert.equal(recognizeWord(cow.slots), null);
    assert.deepEqual(selectAudio(cow), {
        kind: 'sequence',
        units: [
            { type: 'blend', id: 'co' },
            { type: 'phoneme', id: 'w' }
        ]
    });

    // No curated chunk exists for "pt", so letters are sequenced in order.
    const pt = enterAll(createState(2), 'pt');
    assert.deepEqual(selectAudio(pt), {
        kind: 'sequence',
        units: [
            { type: 'phoneme', id: 'p' },
            { type: 'phoneme', id: 't' }
        ]
    });
});

test('a blend is not used when it runs into another vowel', () => {
    const pai = enterAll(createState(), 'pai');
    assert.deepEqual(selectAudio(pai), {
        kind: 'sequence',
        units: [
            { type: 'phoneme', id: 'p' },
            { type: 'phoneme', id: 'a_short' },
            { type: 'phoneme', id: 'i_short' }
        ]
    });
});

test('QU keeps u inside the /kw/ digraph even before another vowel', () => {
    // qu is a true digraph: the u belongs to /kw/, so it is never sequenced
    // as a short vowel of its own when another vowel follows.
    const qu = enterAll(createState(2), 'qu');
    assert.deepEqual(selectAudio(qu), {
        kind: 'sequence',
        units: [{ type: 'blend', id: 'qu' }]
    });

    const qui = enterAll(createState(), 'qui');
    assert.deepEqual(selectAudio(qui), {
        kind: 'sequence',
        units: [
            { type: 'blend', id: 'qu' },
            { type: 'phoneme', id: 'i_short' }
        ]
    });

    const qua = enterAll(createState(), 'qua');
    assert.deepEqual(selectAudio(qua), {
        kind: 'sequence',
        units: [
            { type: 'blend', id: 'qu' },
            { type: 'phoneme', id: 'a_short' }
        ]
    });

    const quit = enterAll(createState(4), 'quit');
    assert.deepEqual(selectAudio(quit), {
        kind: 'sequence',
        units: [
            { type: 'blend', id: 'qu' },
            { type: 'phoneme', id: 'i_short' },
            { type: 'phoneme', id: 't' }
        ]
    });

    // A bare Q still falls back to /kw/.
    const q = enterLetter(createState(), 'q');
    assert.deepEqual(selectAudio(q), {
        kind: 'sequence',
        units: [{ type: 'phoneme', id: 'kw' }]
    });
});

test('sparse slot arrays treat holes as empty slots, never as letters', () => {
    // A hole must not be skipped across: C _ A T is not CAT.
    assert.equal(recognizeWord(['C', , 'A', 'T']), null);
    assert.equal(recognizeWord(['P', , 'N']), null);

    const plan = selectAudio({ slots: ['P', , 'N'], selectedIndex: 0 });
    assert.deepEqual(plan, {
        kind: 'sequence',
        units: [
            { type: 'phoneme', id: 'p' },
            { type: 'phoneme', id: 'n' }
        ]
    });

    const catWithHole = selectAudio({ slots: ['C', , 'A', 'T'], selectedIndex: 0 });
    assert.equal(catWithHole.kind, 'sequence');
    assert.deepEqual(phonemeIds(catWithHole.units), ['c_hard', 'a_short', 't']);

    // A hole is an empty slot when editing too, not a filled one.
    const filled = enterLetter({ slots: ['P', , 'N'], selectedIndex: 1 }, 'a');
    assert.deepEqual(filled, { slots: ['P', 'A', 'N'], selectedIndex: null });
    assert.equal(recognizeWord(filled.slots), 'pan');
});

test('gaps never collapse into a word or a blend', () => {
    let state = selectSlot(createState(), 2);
    state = enterLetter(state, 'n');
    state = selectSlot(state, 0);
    state = enterLetter(state, 'p');

    assert.deepEqual(state.slots, ['P', null, 'N']);
    assert.equal(recognizeWord(state.slots), null);
    assert.deepEqual(selectAudio(state), {
        kind: 'sequence',
        units: [
            { type: 'phoneme', id: 'p' },
            { type: 'phoneme', id: 'n' }
        ]
    });

    // A gap between letters that would otherwise form a blend.
    let pThenA = selectSlot(createState(), 0);
    pThenA = enterLetter(pThenA, 'p');
    pThenA = selectSlot(pThenA, 2);
    pThenA = enterLetter(pThenA, 'a');
    assert.deepEqual(selectAudio(pThenA), {
        kind: 'sequence',
        units: [
            { type: 'phoneme', id: 'p' },
            { type: 'phoneme', id: 'a_short' }
        ]
    });
});

test('selection does not change the audio plan', () => {
    const state = enterAll(createState(), 'pa');
    const reselected = selectSlot(state, 0);
    assert.deepEqual(selectAudio(reselected), selectAudio(state));
});

test('injected words get a word plan; unknown sequences fall back to letters', () => {
    const dog = enterAll(createState(), 'dog');

    const withWords = selectAudio(dog, ['dog']);
    assert.equal(withWords.kind, 'word');
    assert.equal(withWords.word, 'dog');
    assert.deepEqual(phonemeIds(withWords.units), ['d', 'o_short', 'g_hard']);

    const withSequence = selectAudio(dog, {
        dog: ['d', 'o_short', 'g_hard']
    });
    assert.deepEqual(withSequence, withWords);

    // Without the injected dictionary, DOG is not a word plan.
    assert.equal(selectAudio(dog).kind, 'sequence');
});

test('audio units are declarative data with no browser objects', () => {
    const plans = [
        selectAudio(enterAll(createState(), 'pa')),
        selectAudio(enterAll(createState(), 'pan')),
        selectAudio(enterAll(createState(), 'cow'))
    ];

    for (const plan of plans) {
        assert.deepEqual(JSON.parse(JSON.stringify(plan)), plan);
        for (const unit of plan.units) {
            assert.deepEqual(Object.keys(unit).sort(), ['id', 'type']);
            assert.equal(typeof unit.id, 'string');
        }
    }
});

// ── Data coverage ────────────────────────────────────────────────────────

test('DEFAULT_WORDS contains exactly the curated entries and sequences', () => {
    assert.deepEqual(Object.keys(DEFAULT_WORDS), DEFAULT_WORD_LIST);
    assert.equal(Object.keys(DEFAULT_WORDS).length, 16);

    for (const word of DEFAULT_WORD_LIST) {
        const sequence = DEFAULT_WORDS[word];
        assert.ok(Array.isArray(sequence), `${word} has a sequence`);
        assert.match(word, /^[a-z]{2,4}$/);
        assert.equal(sequence.length, word.length, `${word} has one entry per letter`);
        assert.equal(sequence.reviewStatus, 'needs-listening-review');
        assert.notEqual(sequence.reviewStatus, 'verified');
        for (const id of sequence) {
            assert.ok(PHONEMES[id], `${word} references known phoneme ${id}`);
        }
    }
});

test('DEFAULT_WORDS also works as an iterable word list', () => {
    assert.deepEqual([...DEFAULT_WORDS], DEFAULT_WORD_LIST);
    assert.equal(DEFAULT_WORDS.includes('cat'), true);
    assert.equal(DEFAULT_WORDS.includes('COW'), false);
});

test('LETTER_SOUNDS has a deliberate sound for every A–Z key', () => {
    assert.equal(Object.keys(LETTER_SOUNDS).length, 26);

    for (const letter of ALPHABET) {
        assert.ok(Object.prototype.hasOwnProperty.call(LETTER_SOUNDS, letter), letter);
        const id = LETTER_SOUNDS[letter];
        assert.ok(PHONEMES[id], `${letter} references ${id}`);
    }

    // Context-dependent letters use a documented default, not a letter name.
    assert.equal(LETTER_SOUNDS.C, 'c_hard');
    assert.equal(LETTER_SOUNDS.G, 'g_hard');
    assert.equal(LETTER_SOUNDS.Q, 'kw');
    assert.equal(LETTER_SOUNDS.X, 'ks');
    assert.equal(LETTER_SOUNDS.Y, 'y_consonant');
});

test('every phoneme is a sound with a synthesized fallback and review status', () => {
    for (const [id, phoneme] of Object.entries(PHONEMES)) {
        assert.equal(phoneme.id, id);
        assert.ok(['vowel', 'consonant'].includes(phoneme.kind), id);
        assert.ok(phoneme.ipa, id);
        assert.ok(phoneme.label, id);
        assert.ok(phoneme.rationale, id);
        assert.ok(phoneme.provenance, id);
        assert.equal(phoneme.reviewStatus, 'needs-listening-review');
        assert.notEqual(phoneme.reviewStatus, 'verified');

        assert.equal(phoneme.synth.method, 'speech-synthesis');
        assert.equal(typeof phoneme.synth.text, 'string');
        assert.ok(phoneme.synth.text.length > 0);
        assert.ok(Number.isFinite(phoneme.synth.rate));
    }
});

test('every curated blend is explicit, documented and resolvable', () => {
    assert.deepEqual(BLENDS.pa.phonemes, ['p', 'a_short']);
    assert.deepEqual(BLENDS.su.phonemes, ['s', 'u_short']);
    assert.deepEqual(BLENDS.ca.phonemes, ['c_hard', 'a_short']);
    assert.deepEqual(BLENDS.ce.phonemes, ['s', 'e_short']);
    assert.deepEqual(BLENDS.gi.phonemes, ['j', 'i_short']);
    assert.deepEqual(BLENDS.qu.phonemes, ['kw']);

    for (const [id, blend] of Object.entries(BLENDS)) {
        assert.equal(blend.id, id);
        assert.equal(blend.letters, id.toUpperCase());
        assert.ok(blend.phonemes.length > 0, id);
        for (const phoneme of blend.phonemes) {
            assert.ok(PHONEMES[phoneme], `${id} references ${phoneme}`);
        }
        assert.ok(blend.rationale, id);
        assert.ok(blend.provenance, id);
        assert.equal(blend.reviewStatus, 'needs-listening-review');
        assert.notEqual(blend.reviewStatus, 'verified');
    }
});
