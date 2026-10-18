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

  // Block kinds: timer, tap (untimed, optional target), checklist (optional timer), pacer (paced breathing).
  // Blocks saved before kinds existed are a timer when the timer toggle was on, otherwise a tap.
  function blockKind(b) {
    return b.kind || (b.timerEnabled ? 'timer' : 'tap');
  }
  const PHASES = ['inhale', 'hold1', 'exhale', 'hold2'];
  function pacerPattern(b) {
    const p = b.pattern || {};
    return { inhale: p.inhale === undefined ? 4 : p.inhale, hold1: p.hold1 === undefined ? 4 : p.hold1,
             exhale: p.exhale === undefined ? 4 : p.exhale, hold2: p.hold2 === undefined ? 4 : p.hold2 };
  }
  function pacerCycleSecs(b) {
    const p = pacerPattern(b);
    return PHASES.reduce((a, k) => a + (Number(p[k]) || 0), 0);
  }
  function pacerSeconds(b) {
    return Math.max(1, Math.floor(b.cycles) || 12) * pacerCycleSecs(b);
  }
  // Which breathing phase is it, `elapsedMs` into the exercise? Zero-length phases are skipped.
  function pacerPhase(pattern, elapsedMs) {
    const live = PHASES.map((k, i) => ({ k, i, len: Math.max(0, Number(pattern[k]) || 0) })).filter(x => x.len > 0);
    const cycleMs = live.reduce((a, x) => a + x.len * 1000, 0);
    if (!cycleMs) return null;
    const e = Math.max(0, elapsedMs);
    let t = e % cycleMs;
    for (const x of live) {
      if (t < x.len * 1000) {
        return { phase: x.k, phaseIndex: x.i, phaseLenSecs: x.len, leftSecs: Math.ceil((x.len * 1000 - t) / 1000),
                 progress: t / (x.len * 1000), cycle: Math.floor(e / cycleMs) + 1 };
      }
      t -= x.len * 1000;
    }
    return null;
  }

  // Starting length of a block in seconds (0 for untimed blocks).
  function blockSeconds(b, now) {
    if (b.kind === 'pacer') return pacerSeconds(b);
    if (!b.timerEnabled) return 0;
    if (b.timerType === 'endtime') return secondsToTarget(b.targetEndTime, now === undefined ? Date.now() : now);
    const v = Number(b.durationValue) || 0;
    return b.durationUnit === 'mins' ? v * 60 : v;
  }


  // The instant (epoch ms) of "HH:MM" local time. Today's if it passed no more than `graceSecs` ago (so starting a
  // few minutes late still counts as today's start), otherwise the next occurrence.
  function anchorInstant(timeStr, now, graceSecs) {
    const p = (timeStr || '00:00').split(':');
    const t = new Date(now);
    t.setHours(parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0, 0, 0);
    if (t.getTime() + (graceSecs || 0) * 1000 <= now) t.setDate(t.getDate() + 1);
    return t.getTime();
  }

  // Lay steps out on the clock from `startMs`. A fixed-deadline step ends at the next occurrence of its clock time
  // after the step before it ends; any other timer lasts its remaining (or starting) length. Untimed steps take
  // opts.untimedSecs (default 0) and are flagged `estimated`.
  function projectSteps(steps, startMs, opts) {
    const untimed = (opts && opts.untimedSecs) || 0;
    let cursor = startMs;
    return steps.map(s => {
      const from = cursor;
      let estimated = false;
      if (s.timerEnabled && s.timerType === 'endtime') {
        cursor = anchorInstant(s.targetEndTime, from + 1000, 0);
      } else if (s.timerEnabled) {
        cursor += 1000 * (s.remainingSecs !== undefined ? s.remainingSecs : blockSeconds(s, from));
      } else if (untimed > 0) {
        cursor += untimed * 1000; estimated = true;
      }
      return { startMs: from, endMs: cursor, secs: Math.round((cursor - from) / 1000), estimated };
    });
  }

  // Work backwards from a finish time: when must the routine start to end at finishMs?
  function backPlan(steps, finishMs, opts) {
    let start = finishMs;
    for (let i = 0; i < 4; i++) {   // deadlines depend on the start, so settle by repeating
      const plan = projectSteps(steps, start, opts);
      const len = plan.length ? plan[plan.length - 1].endMs - start : 0;
      if (start + len === finishMs) break;
      start = finishMs - len;
    }
    return { startMs: start, plan: projectSteps(steps, start, opts) };
  }

  // Seconds behind the plan (negative = ahead) given where the routine will really end.
  function paceBehind(plannedEndMs, projectedEndMs) {
    return Math.round((projectedEndMs - plannedEndMs) / 1000);
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
        const step = Object.assign({}, b, {
          sectionName: section, currentSet: round, totalSets: rounds, setIndex: s, setCount: sets
        });
        if (b.kind === 'pacer') {   // a pacer is a timer whose length comes from its breathing pattern
          step.timerEnabled = true; step.timerType = 'duration'; step.durationUnit = 'secs'; step.durationValue = pacerSeconds(b);
        }
        steps.push(step);
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

  const api = { blockKind, pacerPattern, pacerSeconds, pacerPhase, secondsToTarget, anchorInstant, projectSteps, backPlan, paceBehind, blockSeconds, remainingSecs, expandRoutine, totals, formatDuration, summarizeRoutine, plural };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SeqLogic = api;
})(typeof self !== 'undefined' ? self : globalThis);
