// Sequence Flow: pure logic (no DOM). Loaded by index.html and tested by logic.test.js.
(function (root) {
  'use strict';

  // Seconds from `now` (ms) until the next occurrence of "HH:MM" local time.
  function secondsToTarget(timeStr, now) {
    if (!timeStr) return 60;
    const p = timeStr.split(':');
    const nowD = new Date(now);
    const t = new Date(now);
    t.setHours(parseInt(p[0], 10), parseInt(p[1], 10), 0, 0);
    if (t <= nowD) t.setDate(t.getDate() + 1);
    return Math.max(0, Math.floor((t - nowD) / 1000));
  }

  // Starting length of a block in seconds (0 for untimed blocks).
  function blockSeconds(b, now) {
    if (!b.timerEnabled) return 0;
    if (b.timerType === 'endtime') return secondsToTarget(b.targetEndTime, now === undefined ? Date.now() : now);
    const v = Number(b.durationValue) || 0;
    return b.durationUnit === 'mins' ? v * 60 : v;
  }

  // Seconds left for a timer that ends at `endsAt` (epoch ms); never negative.
  function remainingSecs(endsAt, now) {
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  }

  // Turn a routine (sections with Repeat, blocks with optional Sets and Rest) into the flat list of steps
  // that Run mode walks through. Round = a section repeat; set = a block repeat. Rest steps are generated
  // between sets, never after the last one.
  function expandRoutine(routine) {
    const items = routine.items || [];
    const steps = [];
    let section = null;
    let i = 0;
    const push = (b, round, rounds) => {
      const sets = Math.max(1, Math.min(99, Math.floor(b.sets) || 1));
      const rest = Math.max(0, Number(b.restBetween) || 0);
      for (let s = 1; s <= sets; s++) {
        steps.push(Object.assign({}, b, {
          sectionName: section, currentSet: round, totalSets: rounds, setIndex: s, setCount: sets
        }));
        if (s < sets && rest > 0) {
          steps.push({
            id: b.id + '__rest' + s, isSection: false, type: 'gap', title: 'Rest',
            timerEnabled: true, timerType: 'duration', durationValue: rest, durationUnit: 'secs',
            autoStart: b.restAutoStart !== false, autoAdvance: true, backgroundTimer: false, details: [],
            generated: true, sectionName: section, currentSet: round, totalSets: rounds, setIndex: s, setCount: sets
          });
        }
      }
    };
    while (i < items.length) {
      const it = items[i];
      if (it.isSection) {
        section = it.title || 'Section';
        const rounds = Math.max(1, Math.min(99, Math.floor(it.repeatCount) || 1));
        const kids = [];
        let j = i + 1;
        while (j < items.length && !items[j].isSection) kids.push(items[j++]);
        for (let r = 1; r <= rounds; r++) kids.forEach(k => push(k, r, rounds));
        i = j;
      } else {
        push(it, 1, 1);
        i++;
      }
    }
    return steps;
  }

  // Time left across unfinished steps. Uses each step's live remainingSecs when it has one.
  function totals(steps, now) {
    let secs = 0, untimed = 0;
    steps.forEach(s => {
      if (s.status && s.status !== 'pending') return;
      if (!s.timerEnabled) { untimed++; return; }
      secs += s.remainingSecs !== undefined ? s.remainingSecs : blockSeconds(s, now);
    });
    return { secs, untimed };
  }

  function formatDuration(totalSecs) {
    if (totalSecs <= 0) return '00:00';
    const h = Math.floor(totalSecs / 3600), m = Math.floor((totalSecs % 3600) / 60), s = totalSecs % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // "3 steps (7 when repeated) · 9 min" for the Library.
  function summarizeRoutine(routine, now) {
    const base = (routine.items || routine.blocks || []).filter(i => !i.isSection).length;
    const steps = expandRoutine({ items: routine.items || routine.blocks || [] });
    let secs = 0;
    steps.forEach(s => { if (s.timerEnabled && s.timerType !== 'endtime') secs += blockSeconds(s, now); });
    let text = plural(base, 'step', 'steps');
    if (steps.length !== base) text += ' (' + steps.length + ' when repeated)';
    if (secs > 0) {
      const m = Math.floor(secs / 60), s = secs % 60;
      text += ' · ' + (m ? m + ' min' : '') + (m && s ? ' ' : '') + (s ? s + ' sec' : '');
    }
    return text;
  }

  const api = { secondsToTarget, blockSeconds, remainingSecs, expandRoutine, totals, formatDuration, summarizeRoutine, plural };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SeqLogic = api;
})(typeof self !== 'undefined' ? self : globalThis);
