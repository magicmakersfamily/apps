/*  Sound Builder — pure logic
 *
 *  This file is inert: it never touches the DOM, the network, audio hardware or
 *  localStorage.  It only builds and inspects plain data.  In a browser it
 *  publishes `SoundBuilderLogic`; under Node it exports the same object so the
 *  rules can be tested offline (`node --test spellicious/sound-builder-logic.test.mjs`).
 *
 *  ── English sound conventions used here ──────────────────────────────────
 *
 *  This slice is deliberately narrow.  It models the five *short* vowels
 *  (a as in cat, e as in bed, i as in sit, o as in cot — American /ɑ/, and
 *  u as in sun) and the ordinary consonant sounds.  It does NOT model long
 *  vowels, "magic e", vowel teams, r-controlled vowels, schwa, silent letters
 *  or syllabification.  A letter sound is a *sound*, never the letter's name:
 *  B is "buh" (approximate), not "bee"; A is short /æ/, not "ay".
 *
 *  Context-dependent letters get a documented default policy:
 *
 *    C  hard /k/ by default.  Before e and i the curated blends ce/ci use
 *       /s/ ("soft c"), while ca/co/cu use /k/.  Other soft-c spellings
 *       (ocean, special) are not modelled.
 *    G  hard /g/ by default.  Before e and i the curated blends ge/gi use
 *       /dʒ/ ("soft g"), while ga/go/gu use /g/.  Other spellings (garage,
 *       giant for older speakers) are not modelled.
 *    Q  taught as /kw/.  English q is almost always followed by u, so the
 *       curated "qu" chunk is /kw/ rather than q + a short u.  U belongs to
 *       the digraph, so "qu" still applies when another vowel follows (quiz,
 *       quit) and its u is never sequenced as a short vowel of its own.  A
 *       bare q uses the same /kw/ fallback.
 *    X  taught as /ks/ as in box.  Initial /z/ (xylophone) and /ɡz/ (exam)
 *       are not modelled.
 *    Y  taught as the consonant /j/ as in yes.  Y as a vowel (/aɪ/ in my,
 *       /i/ in happy, /ɪ/ in gym) is not modelled.
 *
 *  These limitations are intentional: they are the rules of this small lab,
 *  not a claim to cover English spelling generally.
 *
 *  ── Curated blends and provenance ───────────────────────────────────────
 *
 *  BLENDS holds short-vowel CV chunks (pa, su, mi, ...) plus qu.  A chunk is
 *  used only when its two slots are contiguous and it does not run straight
 *  into another vowel.  At the end of a partial entry the lab's short-vowel
 *  convention applies (PA is "p" + short a), but a partial chunk is never a
 *  prediction of how an eventual word will be pronounced.  The blends are
 *  built from an explicit consonant table and the five short vowels; their
 *  phonemes are listed, not guessed.
 *
 *  Every phoneme, blend and dictionary word is marked
 *  `reviewStatus: 'needs-listening-review'`.  Nothing here is "verified":
 *  the synthesized respellings are a fallback for when no recorded clip is
 *  available, and a human must listen before these become shipped audio.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.SoundBuilderLogic = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const SUPPORTED_SLOT_COUNTS = Object.freeze([2, 3, 4]);
    const DEFAULT_SLOT_COUNT = 3;
    const REVIEW_STATUS = 'needs-listening-review';

    function deepFreeze(value) {
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            Object.freeze(value);
            for (const key of Object.keys(value)) deepFreeze(value[key]);
        }
        return value;
    }

    // ── Phonemes ─────────────────────────────────────────────────────────
    //
    // `synth` is a fallback only: a browser can say the respelling with the
    // Web Speech API when no recorded clip exists.  The respellings are
    // phonics approximations (consonants carry an audible schwa), not
    // phoneme-accurate audio.  They are also never letter names.

    function makePhoneme(id, label, ipa, kind, example, synthText, rationale) {
        return {
            id,
            label,
            ipa,
            kind,
            example,
            synth: {
                method: 'speech-synthesis',
                text: synthText,
                rate: 0.8,
                pitch: 1
            },
            reviewStatus: REVIEW_STATUS,
            rationale,
            provenance: 'General American phonics convention; IPA and synthesized respelling are pending human listening review, not verified.'
        };
    }

    const PHONEMES = deepFreeze({
        // Short vowels.  One sound per letter, no letter names.
        a_short: makePhoneme(
            'a_short', 'short a', 'æ', 'vowel', 'cat', 'ah',
            'Short-vowel convention: a sound, not the letter name "ay". Long a and vowel teams are outside this slice.'
        ),
        e_short: makePhoneme(
            'e_short', 'short e', 'ɛ', 'vowel', 'bed', 'eh',
            'Short-vowel convention: a sound, not the letter name "ee". Open-syllable long e is outside this slice.'
        ),
        i_short: makePhoneme(
            'i_short', 'short i', 'ɪ', 'vowel', 'sit', 'ih',
            'Short-vowel convention: a sound, not the letter name "eye". Long i and vowel teams are outside this slice.'
        ),
        o_short: makePhoneme(
            'o_short', 'short o', 'ɑ', 'vowel', 'cot', 'aw',
            'Short-vowel convention, American /ɑ/ as in cot. British /ɒ/ and the letter name "oh" are not used.'
        ),
        u_short: makePhoneme(
            'u_short', 'short u', 'ʌ', 'vowel', 'sun', 'uh',
            'Short-vowel convention: a sound, not the letter name "you". Long u and vowel teams are outside this slice.'
        ),

        // Consonants with one dominant sound.
        b: makePhoneme(
            'b', 'b sound', 'b', 'consonant', 'bat', 'buh',
            'Most common sound of the letter. The respelling adds a schwa so speech synthesis can pronounce it.'
        ),
        c_hard: makePhoneme(
            'c_hard', 'hard c', 'k', 'consonant', 'cat', 'kuh',
            'Default C: hard /k/ before a, o, u and consonants. Soft /s/ before e and i is handled by the ce/ci blends.'
        ),
        d: makePhoneme(
            'd', 'd sound', 'd', 'consonant', 'dog', 'duh',
            'Most common sound of the letter.'
        ),
        f: makePhoneme(
            'f', 'f sound', 'f', 'consonant', 'fun', 'fuh',
            'Most common sound of the letter.'
        ),
        g_hard: makePhoneme(
            'g_hard', 'hard g', 'ɡ', 'consonant', 'gum', 'guh',
            'Default G: hard /ɡ/ before a, o, u and consonants. Soft /dʒ/ before e and i is handled by the ge/gi blends.'
        ),
        h: makePhoneme(
            'h', 'h sound', 'h', 'consonant', 'hat', 'huh',
            'Most common sound of the letter; silent h is not modelled.'
        ),
        j: makePhoneme(
            'j', 'j sound', 'dʒ', 'consonant', 'jam', 'juh',
            'Most common sound of the letter; this phoneme is also reused for soft g.'
        ),
        k: makePhoneme(
            'k', 'k sound', 'k', 'consonant', 'kit', 'kuh',
            'Most common sound of the letter; silent k (knee) is not modelled.'
        ),
        kw: makePhoneme(
            'kw', 'qu sound', 'kw', 'consonant', 'quit', 'kwuh',
            'Q is taught as /kw/. English q is almost always followed by u, so the qu chunk is one sound.'
        ),
        ks: makePhoneme(
            'ks', 'x sound', 'ks', 'consonant', 'box', 'kss',
            'X is taught as /ks/. Initial /z/ (xylophone) and /ɡz/ (exam) are not modelled.'
        ),
        l: makePhoneme(
            'l', 'l sound', 'l', 'consonant', 'lamp', 'luh',
            'Most common sound of the letter.'
        ),
        m: makePhoneme(
            'm', 'm sound', 'm', 'consonant', 'map', 'muh',
            'Most common sound of the letter.'
        ),
        n: makePhoneme(
            'n', 'n sound', 'n', 'consonant', 'sun', 'nuh',
            'Most common sound of the letter; ng /ŋ/ is not modelled.'
        ),
        p: makePhoneme(
            'p', 'p sound', 'p', 'consonant', 'pan', 'puh',
            'Most common sound of the letter.'
        ),
        r: makePhoneme(
            'r', 'r sound', 'ɹ', 'consonant', 'run', 'ruh',
            'Most common sound of the letter; r-controlled vowels are not modelled.'
        ),
        s: makePhoneme(
            's', 's sound', 's', 'consonant', 'sun', 'suh',
            'Most common sound of the letter; this phoneme is also reused for soft c. Plural /z/ is not modelled.'
        ),
        t: makePhoneme(
            't', 't sound', 't', 'consonant', 'top', 'tuh',
            'Most common sound of the letter.'
        ),
        v: makePhoneme(
            'v', 'v sound', 'v', 'consonant', 'van', 'vuh',
            'Most common sound of the letter.'
        ),
        w: makePhoneme(
            'w', 'w sound', 'w', 'consonant', 'wet', 'wuh',
            'Most common sound of the letter.'
        ),
        y_consonant: makePhoneme(
            'y_consonant', 'y consonant', 'j', 'consonant', 'yes', 'yuh',
            'Y is taught here as the consonant /j/ in yes. Y as a vowel (/aɪ/, /i/, /ɪ/) is not modelled.'
        ),
        z: makePhoneme(
            'z', 'z sound', 'z', 'consonant', 'zip', 'zuh',
            'Most common sound of the letter.'
        )
    });

    // ── Letter sounds ────────────────────────────────────────────────────
    //
    // One deliberate default policy per A–Z key.  This is a sound map, not a
    // letter-name map.  Context-sensitive letters point at their default
    // sound; the curated blends below carry the context-specific variants.

    const LETTER_SOUNDS = deepFreeze({
        A: 'a_short', B: 'b', C: 'c_hard', D: 'd', E: 'e_short',
        F: 'f', G: 'g_hard', H: 'h', I: 'i_short', J: 'j',
        K: 'k', L: 'l', M: 'm', N: 'n', O: 'o_short', P: 'p',
        Q: 'kw', R: 'r', S: 's', T: 't', U: 'u_short', V: 'v',
        W: 'w', X: 'ks', Y: 'y_consonant', Z: 'z'
    });

    // ── Curated short-vowel blends ───────────────────────────────────────
    //
    // Only consonant + short-vowel chunks are curated.  A chunk is selected
    // by the audio planner only when both slots are present, contiguous, and
    // the next letter (if any) is not another vowel.  Nothing is generated
    // for spellings outside this table.

    const CV_CONSONANTS = deepFreeze({
        b: 'b', d: 'd', f: 'f', h: 'h', j: 'j', k: 'k', l: 'l',
        m: 'm', n: 'n', p: 'p', r: 'r', s: 's', t: 't', v: 'v',
        w: 'w', y: 'y_consonant', z: 'z'
    });

    const SHORT_VOWELS = deepFreeze({
        a: 'a_short', e: 'e_short', i: 'i_short', o: 'o_short', u: 'u_short'
    });

    function makeBlend(id, phonemes, kind, rationale) {
        return {
            id,
            letters: id.toUpperCase(),
            phonemes,
            kind,
            reviewStatus: REVIEW_STATUS,
            rationale,
            provenance: 'Curated short-vowel chunk built from the explicit consonant table and the five short vowels; not a prediction of an eventual word and not verified by a human listener.'
        };
    }

    const blendTable = {};

    for (const [letter, sound] of Object.entries(CV_CONSONANTS)) {
        for (const [vowel, vowelSound] of Object.entries(SHORT_VOWELS)) {
            const id = letter + vowel;
            blendTable[id] = makeBlend(
                id,
                [sound, vowelSound],
                'cv-short',
                'Short-vowel CV convention: the consonant sound followed by the short vowel. Used only while the pair is contiguous and does not run into another vowel.'
            );
        }
    }

    for (const [vowel, vowelSound] of Object.entries(SHORT_VOWELS)) {
        const soft = vowel === 'e' || vowel === 'i';
        blendTable['c' + vowel] = makeBlend(
            'c' + vowel,
            [soft ? 's' : 'c_hard', vowelSound],
            'cv-short',
            'C is hard /k/ before a, o, u and soft /s/ before e, i. The chunk records which sound applies.'
        );
        blendTable['g' + vowel] = makeBlend(
            'g' + vowel,
            [soft ? 'j' : 'g_hard', vowelSound],
            'cv-short',
            'G is hard /ɡ/ before a, o, u and soft /dʒ/ before e, i. The chunk records which sound applies.'
        );
    }

    blendTable.qu = makeBlend(
        'qu',
        ['kw'],
        'qu-digraph',
        'U is part of the /kw/ sound after Q, so qu is one chunk rather than q plus a short u.'
    );

    const BLENDS = deepFreeze(blendTable);

    // ── Default dictionary ───────────────────────────────────────────────
    //
    // Each entry is an explicit phoneme sequence, so a complete-word plan
    // never has to guess a pronunciation.  The arrays also carry
    // non-enumerable review metadata: every sequence is
    // `needs-listening-review`, never "verified".  Lists are made iterable
    // over their words and gain an `includes` helper, so callers can treat
    // DEFAULT_WORDS as either a dictionary or a word list.

    function makeWord(phonemes) {
        const sequence = phonemes.slice();
        Object.defineProperties(sequence, {
            reviewStatus: {
                value: REVIEW_STATUS,
                enumerable: false
            },
            rationale: {
                value: 'Explicit short-vowel phonics decomposition; the whole word is spoken as one unit after every slot is filled.',
                enumerable: false
            },
            provenance: {
                value: 'Hand-listed short-vowel phonics sequence; pending human listening review, not verified.',
                enumerable: false
            }
        });
        return Object.freeze(sequence);
    }

    const wordTable = {
        am: makeWord(['a_short', 'm']),
        in: makeWord(['i_short', 'n']),
        at: makeWord(['a_short', 't']),
        up: makeWord(['u_short', 'p']),
        cat: makeWord(['c_hard', 'a_short', 't']),
        bat: makeWord(['b', 'a_short', 't']),
        can: makeWord(['c_hard', 'a_short', 'n']),
        sun: makeWord(['s', 'u_short', 'n']),
        pan: makeWord(['p', 'a_short', 'n']),
        map: makeWord(['m', 'a_short', 'p']),
        hat: makeWord(['h', 'a_short', 't']),
        fun: makeWord(['f', 'u_short', 'n']),
        hand: makeWord(['h', 'a_short', 'n', 'd']),
        lamp: makeWord(['l', 'a_short', 'm', 'p']),
        sand: makeWord(['s', 'a_short', 'n', 'd']),
        milk: makeWord(['m', 'i_short', 'l', 'k'])
    };

    Object.defineProperties(wordTable, {
        [Symbol.iterator]: {
            value: function* words() {
                yield* Object.keys(wordTable);
            },
            enumerable: false
        },
        includes: {
            value: function includesWord(word) {
                return typeof word === 'string' &&
                    Object.prototype.hasOwnProperty.call(wordTable, word.trim().toLowerCase());
            },
            enumerable: false
        }
    });

    const DEFAULT_WORDS = deepFreeze(wordTable);

    // ── State helpers ────────────────────────────────────────────────────

    function isSupportedCount(value) {
        return value === 2 || value === 3 || value === 4;
    }

    // Single ASCII letters only, case-insensitively.  Anything else is not a
    // letter for this lab (no accents, digits, emoji or multi-character text).
    function normalizeLetter(raw) {
        if (typeof raw !== 'string' || !/^[A-Za-z]$/.test(raw)) return null;
        return raw.toUpperCase();
    }

    // Reads any state-shaped value into a clean internal copy.  Invalid slot
    // values become empty; an invalid selectedIndex becomes no selection.
    // Returns null only when the value cannot be a state at all.
    function readState(state) {
        if (!state || typeof state !== 'object' || !Array.isArray(state.slots)) return null;
        if (!isSupportedCount(state.slots.length)) return null;

        // `Array.from`, unlike `map`, visits sparse holes and turns them into
        // undefined, so a hole is read as an empty slot rather than skipped.
        const slots = Array.from(state.slots, slot => (slot == null ? null : normalizeLetter(slot)));
        const hasSelection = Number.isInteger(state.selectedIndex) &&
            state.selectedIndex >= 0 &&
            state.selectedIndex < slots.length;

        return {
            slots,
            selectedIndex: hasSelection ? state.selectedIndex : null
        };
    }

    function createState(slotCount = DEFAULT_SLOT_COUNT) {
        const count = isSupportedCount(slotCount) ? slotCount : DEFAULT_SLOT_COUNT;
        return {
            slots: new Array(count).fill(null),
            selectedIndex: 0
        };
    }

    function selectSlot(state, index) {
        const current = readState(state);
        if (!current) return state;
        if (!Number.isInteger(index) || index < 0 || index >= current.slots.length) return state;
        if (current.selectedIndex === index) return state;

        // Selection is presentation state; no audio plan is requested here.
        return {
            slots: current.slots.slice(),
            selectedIndex: index
        };
    }

    function enterLetter(state, letter) {
        const current = readState(state);
        if (!current) return state;

        const normalized = normalizeLetter(letter);
        if (!normalized) return state;

        let index;
        if (current.selectedIndex !== null) {
            // An explicit selection always receives the letter.
            index = current.selectedIndex;
        } else {
            // With no selection, fill the first empty slot; a full board waits.
            index = current.slots.indexOf(null);
            if (index === -1) return state;
        }

        const wasEmpty = current.slots[index] === null;
        if (!wasEmpty && current.slots[index] === normalized) return state;

        const slots = current.slots.slice();
        slots[index] = normalized;

        let selectedIndex;
        if (wasEmpty) {
            // Filling an empty slot moves on to the first remaining empty slot.
            const nextEmpty = slots.indexOf(null);
            selectedIndex = nextEmpty === -1 ? null : nextEmpty;
        } else {
            // Replacing a filled slot keeps it selected for further exploring.
            selectedIndex = index;
        }

        return { slots, selectedIndex };
    }

    function clearState(state) {
        const current = readState(state);
        if (!current) return state;

        const alreadyClear = current.selectedIndex === 0 &&
            current.slots.every(slot => slot === null);
        if (alreadyClear) return state;

        return {
            slots: current.slots.map(() => null),
            selectedIndex: 0
        };
    }

    function resizeState(state, slotCount) {
        const current = readState(state);
        if (!current) return state;
        if (!isSupportedCount(slotCount)) return state;
        if (current.slots.length === slotCount) return state;

        // A new slot count starts a fresh board rather than truncating letters.
        return {
            slots: new Array(slotCount).fill(null),
            selectedIndex: 0
        };
    }

    // ── Dictionary and recognition ───────────────────────────────────────

    function normalizeSequence(value) {
        let sequence = null;
        if (Array.isArray(value)) sequence = value;
        else if (value && typeof value === 'object' && Array.isArray(value.phonemes)) {
            sequence = value.phonemes;
        }
        if (!sequence) return null;

        const phonemes = sequence.filter(id => typeof id === 'string' && id.length > 0);
        return phonemes.length ? phonemes.slice() : null;
    }

    function defaultSequence(word) {
        return Object.prototype.hasOwnProperty.call(DEFAULT_WORDS, word)
            ? DEFAULT_WORDS[word]
            : null;
    }

    function addDictionaryEntry(map, word, sequence) {
        if (typeof word !== 'string') return;
        const key = word.trim().toLowerCase();
        if (!/^[a-z]+$/.test(key)) return;

        const explicit = normalizeSequence(sequence) || normalizeSequence(defaultSequence(key));
        map.set(key, explicit);
    }

    // Accepts the default map, an array/Set of words, a Map, or a plain
    // object word → sequence.  Sequences may be arrays or { phonemes: [...] }.
    function normalizeDictionary(dictionary) {
        if (dictionary == null) dictionary = DEFAULT_WORDS;

        const map = new Map();
        if (typeof dictionary === 'string') {
            addDictionaryEntry(map, dictionary, null);
        } else if (Array.isArray(dictionary) || dictionary instanceof Set) {
            for (const word of dictionary) addDictionaryEntry(map, word, null);
        } else if (dictionary instanceof Map) {
            for (const [word, sequence] of dictionary) addDictionaryEntry(map, word, sequence);
        } else if (typeof dictionary === 'object') {
            for (const [word, sequence] of Object.entries(dictionary)) {
                addDictionaryEntry(map, word, sequence);
            }
        } else {
            return normalizeDictionary(DEFAULT_WORDS);
        }
        return map;
    }

    // Returns the lowercase word when every slot is filled and the entire
    // word is a dictionary entry; otherwise null.
    function recognizeWord(slots, dictionary = DEFAULT_WORDS) {
        if (!Array.isArray(slots) || slots.length === 0) return null;

        // Sparse arrays have holes; `Array.from` reads each hole as an empty
        // slot.  Skipping holes would let ['C', , 'A', 'T'] masquerade as CAT.
        const letters = Array.from(slots, slot => (slot == null ? null : normalizeLetter(slot)));
        if (letters.some(letter => letter === null)) return null;

        const word = letters.join('').toLowerCase();
        return normalizeDictionary(dictionary).has(word) ? word : null;
    }

    // ── Audio plan ───────────────────────────────────────────────────────

    function silentPlan() {
        return { kind: 'silent', units: [] };
    }

    function letterUnit(letter) {
        return { type: 'phoneme', id: LETTER_SOUNDS[letter] };
    }

    // A gap is a missing slot before the last present letter, including a
    // leading empty slot.  Gaps never collapse: every present letter is
    // sequenced separately.
    function hasGap(slots) {
        const present = [];
        for (let i = 0; i < slots.length; i += 1) {
            if (slots[i] !== null) present.push(i);
        }
        if (present.length === 0) return false;
        if (present[0] !== 0) return true;
        for (let i = 1; i < present.length; i += 1) {
            if (present[i] !== present[i - 1] + 1) return true;
        }
        return false;
    }

    // A true digraph: its second letter belongs to the sound, so the usual
    // "do not run into another vowel" guard does not apply.
    const DIGRAPH_BLENDS = new Set(['qu']);

    function blendContextMatches(slots, index, id) {
        // qu is always the /kw/ chunk when q and u are contiguous (the caller
        // has checked that).  The following vowel is sequenced separately.
        if (DIGRAPH_BLENDS.has(id)) return true;

        const follower = slots[index + 2];
        // End of the entered prefix (trailing empty slots are not a gap in
        // this path): the lab's short-vowel convention applies.
        if (follower == null) return true;
        // Closed by a consonant is a short-vowel context; another vowel is not.
        return !/[AEIOU]/.test(follower);
    }

    function sequenceUnits(slots) {
        if (hasGap(slots)) {
            return slots.filter(slot => slot !== null).map(letterUnit);
        }

        const units = [];
        let index = 0;
        while (index < slots.length) {
            const letter = slots[index];
            if (letter === null) break; // only trailing empties remain

            const next = slots[index + 1];
            if (next != null) {
                const id = (letter + next).toLowerCase();
                if (Object.prototype.hasOwnProperty.call(BLENDS, id) &&
                    blendContextMatches(slots, index, id)) {
                    units.push({ type: 'blend', id });
                    index += 2;
                    continue;
                }
            }

            units.push(letterUnit(letter));
            index += 1;
        }
        return units;
    }

    // Units never carry browser objects — only the identifiers a player can
    // resolve against PHONEMES or BLENDS.
    function wordUnits(word, dictionaryMap) {
        const explicit = dictionaryMap.get(word) || normalizeSequence(defaultSequence(word));
        if (explicit) {
            return explicit.map(id => ({ type: 'phoneme', id }));
        }

        // Injected words without a curated sequence fall back to constituent
        // letter sounds.  This is a spelling fallback, not a pronunciation
        // prediction, and it is not applied to the curated default words.
        return [...word.toUpperCase()].map(letter => letterUnit(letter));
    }

    function selectAudio(state, dictionary = DEFAULT_WORDS) {
        const current = readState(state);
        if (!current) return silentPlan();

        const slots = current.slots;
        if (slots.every(slot => slot === null)) return silentPlan();

        const word = recognizeWord(slots, dictionary);
        if (word !== null) {
            return {
                kind: 'word',
                word,
                units: wordUnits(word, normalizeDictionary(dictionary))
            };
        }

        return {
            kind: 'sequence',
            units: sequenceUnits(slots)
        };
    }

    return {
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
        BLENDS,
        SUPPORTED_SLOT_COUNTS
    };
}));
