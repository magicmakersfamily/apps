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

  // The instant of "HH:MM" local time on the calendar day of `dayMs`, plus `plusDays`. Never rolls forward by itself:
  // crossing midnight has to be asked for (a block's `nextDay`, a routine's `anchorTomorrow`).
  function dayInstant(timeStr, dayMs, plusDays) {
    const p = (timeStr || '00:00').split(':');
    const t = new Date(dayMs);
    t.setHours(parseInt(p[0], 10) || 0, parseInt(p[1], 10) || 0, 0, 0);
    if (plusDays) t.setDate(t.getDate() + plusDays);
    return t.getTime();
  }
  // When a clock-deadline block must end, for a run whose day is `dayMs`.
  function deadlineMs(b, dayMs) {
    return dayInstant(b.targetEndTime || '08:30', dayMs, b.nextDay ? 1 : 0);
  }
  // The intended length of a deadline block in seconds, if it was recorded (0 = not known).
  function plannedSecsOf(b) {
    return Math.max(0, Math.floor(Number(b.plannedSecs)) || 0);
  }

  // Starting length of a block in seconds (0 for untimed blocks).
  function blockSeconds(b, now) {
    if (b.kind === 'pacer') return pacerSeconds(b);
    if (!b.timerEnabled) return 0;
    if (b.timerType === 'endtime') {   // a clock deadline is on the run's day; one that has passed is 0, never tomorrow
      const n = now === undefined ? Date.now() : now;
      return Math.max(0, Math.floor((deadlineMs(b, n) - n) / 1000));
    }
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

  // Lay steps out on the clock from `startMs`. A fixed-deadline step ends at its deadline on opts.dayMs (default: the day
  // of startMs); other timers last their remaining (or starting) length. A deadline that is already behind the step
  // before it is `late`: it gets no time and is never moved to tomorrow. Untimed steps take opts.untimedSecs (default 0)
  // and are flagged `estimated`.
  function projectSteps(steps, startMs, opts) {
    const untimed = (opts && opts.untimedSecs) || 0;
    const dayMs = opts && opts.dayMs !== undefined ? opts.dayMs : startMs;
    let cursor = startMs;
    return steps.map(s => {
      const from = cursor;
      let estimated = false, late = false, lateBySecs = 0, due = null;
      if (s.timerEnabled && s.timerType === 'endtime') {
        due = deadlineMs(s, dayMs);
        if (due > cursor) cursor = due;
        else { late = true; lateBySecs = Math.round((cursor - due) / 1000); }
      } else if (s.timerEnabled) {
        cursor += 1000 * (s.remainingSecs !== undefined ? s.remainingSecs : blockSeconds(s, from));
      } else if (untimed > 0) {
        cursor += untimed * 1000; estimated = true;
      }
      return { startMs: from, endMs: cursor, secs: Math.round((cursor - from) / 1000), estimated, late, lateBySecs, dueMs: due };
    });
  }

  // Deadline blocks that cannot be met if the steps start at `startMs`.
  function findConflicts(steps, startMs, opts) {
    return projectSteps(steps, startMs, opts).map((p, i) => Object.assign({ index: i, step: steps[i] }, p)).filter(p => p.late);
  }

  // Intended lengths (seconds) for deadline blocks. Uses `plannedSecs` when recorded; otherwise reads it off the original
  // plan: the gap from where the previous deadline (or opts.refStartMs, e.g. a Start at time) left the schedule.
  // Returns { id: secs | null }, null meaning "unknown, ask the person".
  function inferPlanned(steps, opts) {
    const dayMs = (opts && opts.dayMs) || Date.now();
    let ref = opts && opts.refStartMs !== undefined ? opts.refStartMs : null;
    const out = {};
    steps.forEach(s => {
      if (s.timerEnabled && s.timerType === 'endtime') {
        const end = deadlineMs(s, dayMs), known = plannedSecsOf(s);
        out[s.id] = known || (ref !== null && end > ref ? Math.round((end - ref) / 1000) : null);
        ref = end;
      } else if (ref !== null && s.timerEnabled) {
        ref += 1000 * (s.remainingSecs !== undefined ? s.remainingSecs : blockSeconds(s, ref));
      }
    });
    return out;
  }

  // "Shift the flow": start now and keep each deadline block's intended length. Every deadline block from the first
  // late one onward becomes a plain countdown of its intended length (`planned` maps id -> secs). Returns the new steps
  // and where the whole flow would now end.
  function shiftSteps(steps, startMs, planned, opts) {
    const first = findConflicts(steps, startMs, opts)[0];
    if (!first) return { steps: steps.slice(), endMs: projectSteps(steps, startMs, opts).slice(-1).map(p => p.endMs)[0] || startMs };
    const out = steps.map((s, i) => {
      if (i < first.index || !(s.timerEnabled && s.timerType === 'endtime')) return s;
      const secs = Math.max(1, Math.round(planned[s.id] || plannedSecsOf(s) || 60));
      return Object.assign({}, s, { timerType: 'duration', durationValue: secs, durationUnit: 'secs', remainingSecs: secs, plannedSecs: secs, shiftedSecs: secs });
    });
    const plan = projectSteps(out, startMs, opts);
    return { steps: out, endMs: plan.length ? plan[plan.length - 1].endMs : startMs };
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

  // Which of the remaining steps are marked skippable, and how many seconds skipping all of them would recover
  // (their planned lengths from projectSteps). Only reports; it never changes the steps.
  function squeezeSavings(steps, plan) {
    const ids = [];
    let savedSecs = 0;
    steps.forEach((s, i) => {
      if (!s || s.skippable !== true || s.isSection || !plan[i]) return;
      if (ids.indexOf(s.id) < 0) ids.push(s.id);
      savedSecs += Math.round((plan[i].endMs - plan[i].startMs) / 1000);
    });
    return { ids, savedSecs };
  }

  // Seconds left for a timer that ends at `endsAt` (epoch ms); never negative.
  function remainingSecs(endsAt, now) {
    return Math.max(0, Math.ceil((endsAt - now) / 1000));
  }

  // A saved routine must never share an id with a built-in starter (the starter would win every lookup and hide the
  // person's edits). Give any saved copy with a starter id (or a 'starter_' prefix) a fresh unique 'routine_' id.
  // Pure: inputs are not modified. `renamed` maps old id to new id. Running it again on its output changes nothing.
  function repairStarterIds(savedRoutines, starterIds, lastId, nowMs) {
    const starters = new Set(starterIds || []);
    const isStarterId = id => starters.has(id) || (typeof id === 'string' && id.indexOf('starter_') === 0);
    const used = new Set(starters);
    (savedRoutines || []).forEach(r => { if (r && !isStarterId(r.id)) used.add(r.id); });
    let n = 0;
    const renamed = {};
    const routines = (savedRoutines || []).map(r => {
      if (!r || !isStarterId(r.id)) return r;
      let id;
      do { id = 'routine_' + (nowMs + n++); } while (used.has(id));
      used.add(id);
      renamed[r.id] = id;
      return Object.assign({}, r, { id });
    });
    const newLast = (lastId != null && Object.prototype.hasOwnProperty.call(renamed, lastId)) ? renamed[lastId] : lastId;
    return { routines, lastId: newLast, renamed };
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

  // "Save as new routine": a title that clashes (case-insensitive, trimmed) gets " (2)", " (3)", ... (first free number).
  function uniqueTitle(title, existingTitles) {
    const taken = new Set((existingTitles || []).map(t => String(t == null ? '' : t).trim().toLowerCase()));
    const base = String(title == null ? '' : title).trim();
    if (!taken.has(base.toLowerCase())) return title;
    let n = 2;
    while (taken.has((base + ' (' + n + ')').toLowerCase())) n++;
    return base + ' (' + n + ')';
  }
  // A deep copy with a brand-new id and a unique title; the input is never touched.
  function asNewRoutine(routine, existingTitles, nowMs) {
    const copy = JSON.parse(JSON.stringify(routine));
    copy.id = 'routine_' + nowMs;
    if (copy.id === routine.id) copy.id += '_2';
    copy.title = uniqueTitle(copy.title, existingTitles);
    return copy;
  }

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

  const api = { dayInstant, deadlineMs, plannedSecsOf, findConflicts, inferPlanned, shiftSteps, blockKind, pacerPattern, pacerSeconds, pacerPhase, secondsToTarget, anchorInstant, projectSteps, backPlan, paceBehind, squeezeSavings, blockSeconds, remainingSecs, expandRoutine, totals, formatDuration, summarizeRoutine, plural, uniqueTitle, asNewRoutine };
  api.repairStarterIds = repairStarterIds;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SeqLogic = api;
})(typeof self !== 'undefined' ? self : globalThis);
