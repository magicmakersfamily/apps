// Sequence Flow: AI Flow Builder core (no DOM). Loaded by index.html and tested by builder.test.js.
// The model sees a small, friendly routine format ("AI format"); fromAI() validates it and turns it into the app's
// own routine (items with Sections and Blocks), so nothing the model says can break a saved routine.
(function (root) {
  'use strict';

  const MODELS = {
    'claude-haiku-5-5': { label: 'Haiku 5.5 (cheapest)', note: 'about a tenth of a cent per message' },
    'claude-sonnet-5-5': { label: 'Sonnet 5.5 (more careful)', note: 'about 1 to 3 cents per message' }
  };
  const DEFAULT_MODEL = 'claude-haiku-5-5';

  const SYSTEM = [
    'You build and edit routines for Sequence Flow, a step-by-step routine timer for grown-ups (workouts, cooking, mornings, work sprints).',
    'A routine is a list of items. An item is either a section (a heading whose repeatCount repeats the blocks after it, up to the next section) or a block.',
    'Block kinds: "timer" (counts down durationSecs, or ends at a clock time with deadline "HH:MM"), "tap" (no timer; the person taps Done; optional target text like "8 reps"), "checklist" (rows to tick; optional timer), "pacer" (paced breathing: inhale, hold1, exhale, hold2 seconds and cycles).',
    'A block can repeat with sets (1 to 99) and restSecs between sets. autoStart starts its timer when the step before ends; autoAdvance moves on when it ends. For flowing routines use autoStart true and autoAdvance true; for steps where the person must act or decide (taps, stops, anything with an unknown length) use false.',
    'The whole routine can have startAt ("HH:MM", 24-hour: Run waits for that time and begins) or finishBy ("HH:MM": the app works back to the start time). Use at most one, and only when the person gives a time.',
    'Use deadline only when a block must END at a clock time (for example "until 10:00"). Otherwise use durationSecs. Blocks that follow a deadline block start when it ends.',
    'When the person describes or changes a routine, call set_routine with the COMPLETE routine every time (not just the changes). When editing, keep the "id" of every block you leave in place so the app can show what changed. Give new blocks no id.',
    'Keep titles short (under 40 characters). Put a short tip in notes only when it helps (at most 2 per block). Do not add steps the person did not ask for, except a sensible short rest between hard intervals.',
    'If something essential is missing (for example total length for a workout), ask ONE short question and do not call the tool. Otherwise make reasonable assumptions and state them briefly after calling the tool.',
    'Reply in plain, friendly sentences, two or three at most. Use minutes and seconds the way people say them. Never ask for or repeat personal information.'
  ].join('\n');

  const TOOL = {
    name: 'set_routine',
    description: 'Create or replace the routine the person is building. Always send the complete routine.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        startAt: { type: 'string', description: '24-hour HH:MM. Optional.' },
        finishBy: { type: 'string', description: '24-hour HH:MM. Optional.' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Keep the existing id when editing; omit for new items.' },
              section: { type: 'boolean', description: 'True for a section heading (uses title and repeatCount only).' },
              title: { type: 'string' },
              repeatCount: { type: 'integer', description: 'Sections: how many times the blocks below repeat (1 to 99).' },
              kind: { type: 'string', enum: ['timer', 'tap', 'checklist', 'pacer'] },
              rest: { type: 'boolean', description: 'True if this is a rest or gap rather than an activity.' },
              durationSecs: { type: 'integer', description: 'Timer length in seconds. Omit for taps.' },
              deadline: { type: 'string', description: 'Timer ends at this 24-hour clock time HH:MM instead of after a length.' },
              sets: { type: 'integer' },
              restSecs: { type: 'integer', description: 'Rest between sets, in seconds.' },
              autoStart: { type: 'boolean' },
              autoAdvance: { type: 'boolean' },
              target: { type: 'string', description: 'Tap blocks: what to aim for, e.g. "8 reps".' },
              checklist: { type: 'array', items: { type: 'string' } },
              pacer: {
                type: 'object',
                properties: {
                  inhale: { type: 'integer' }, hold1: { type: 'integer' }, exhale: { type: 'integer' },
                  hold2: { type: 'integer' }, cycles: { type: 'integer' }
                }
              },
              notes: { type: 'array', items: { type: 'string' } }
            },
            required: ['title']
          }
        }
      },
      required: ['title', 'items']
    }
  };

  const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
  const clampInt = (v, lo, hi, dflt) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
  };
  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const pad = t => { const m = HHMM.exec(t); return m ? m[1].padStart(2, '0') + ':' + m[2] : ''; };

  // The model's routine -> the app's routine. Never throws; returns { routine, warnings }.
  // `prev` supplies the id and folder, and which ids the model may keep.
  function fromAI(ai, prev, opts) {
    const warnings = [];
    const keep = new Set(((prev && prev.items) || []).map(i => i.id));
    const used = new Set();
    const stamp = (opts && opts.stamp) || Date.now();
    let n = 0;
    const idFor = want => {
      if (want && keep.has(want) && !used.has(want)) { used.add(want); return want; }
      let id; do { id = 'ai_' + stamp + '_' + (n++); } while (used.has(id) || keep.has(id));
      used.add(id); return id;
    };

    const r = { id: (prev && prev.id) || 'routine_' + stamp, title: str(ai && ai.title, 80) || 'New routine',
                folder: (prev && prev.folder) || 'Workouts', items: [] };
    const sa = pad(str(ai && ai.startAt, 5)), fb = pad(str(ai && ai.finishBy, 5));
    if (sa) r.startAt = sa;
    else if (fb) r.finishBy = fb;
    if (sa && fb) warnings.push('Both Start at and Finish by were given, so only Start at was kept.');

    const src = Array.isArray(ai && ai.items) ? ai.items.slice(0, 60) : [];
    if (ai && Array.isArray(ai.items) && ai.items.length > 60) warnings.push('Only the first 60 steps were kept.');

    src.forEach(it => {
      if (!it || typeof it !== 'object') return;
      if (it.section) {
        r.items.push({ id: idFor(it.id), isSection: true, title: str(it.title, 40) || 'Section', repeatCount: clampInt(it.repeatCount, 1, 99, 1) });
        return;
      }
      const deadline = pad(str(it.deadline, 5));
      const secsIn = Math.floor(Number(it.durationSecs));
      let kind = ['timer', 'tap', 'checklist', 'pacer'].includes(it.kind) ? it.kind : (deadline || secsIn > 0 ? 'timer' : 'tap');
      if (kind === 'timer' && !deadline && !(secsIn > 0)) { kind = 'tap'; warnings.push('"' + (str(it.title, 40) || 'A step') + '" had no length, so it became a tap step.'); }

      const b = { id: idFor(it.id), isSection: false, type: it.rest ? 'gap' : 'activity', title: str(it.title, 40) || 'Step', kind,
                  timerEnabled: false, timerType: 'duration', durationValue: 60, durationUnit: 'secs',
                  autoStart: false, autoAdvance: true, backgroundTimer: false, targetEndTime: '08:30', details: [] };

      if (kind === 'pacer') {
        const p = it.pacer || {};
        b.pattern = { inhale: clampInt(p.inhale, 0, 60, 4), hold1: clampInt(p.hold1, 0, 60, 4), exhale: clampInt(p.exhale, 0, 60, 4), hold2: clampInt(p.hold2, 0, 60, 4) };
        if (!b.pattern.inhale && !b.pattern.exhale) { b.pattern.inhale = 4; b.pattern.exhale = 4; }
        b.cycles = clampInt(p.cycles, 1, 999, 12);
        b.timerEnabled = true;
        b.durationValue = b.cycles * (b.pattern.inhale + b.pattern.hold1 + b.pattern.exhale + b.pattern.hold2);
      } else if (kind === 'timer' || (kind === 'checklist' && (deadline || secsIn > 0))) {
        b.timerEnabled = true;
        if (deadline) { b.timerType = 'endtime'; b.targetEndTime = deadline; }
        else {
          const secs = clampInt(secsIn, 1, 86400, 60);
          if (secs >= 60 && secs % 60 === 0) { b.durationValue = secs / 60; b.durationUnit = 'mins'; }
          else { b.durationValue = secs; b.durationUnit = 'secs'; }
        }
      }
      if (kind === 'tap' && str(it.target, 80)) b.target = str(it.target, 80);
      if (kind === 'checklist') {
        const rows = (Array.isArray(it.checklist) ? it.checklist : []).map(x => str(x, 80)).filter(Boolean).slice(0, 30);
        b.checklist = (rows.length ? rows : ['Done']).map(text => ({ text }));
      }
      b.sets = clampInt(it.sets, 1, 99, 1);
      if (b.sets > 1) { b.restBetween = clampInt(it.restSecs, 0, 3600, 0); b.restAutoStart = true; }
      if (b.timerEnabled) {
        b.autoStart = it.autoStart === undefined ? true : !!it.autoStart;
        b.autoAdvance = it.autoAdvance === undefined ? true : !!it.autoAdvance;
      }
      b.details = (Array.isArray(it.notes) ? it.notes : []).map(x => str(x, 120)).filter(Boolean).slice(0, 2).map(text => ({ text }));
      r.items.push(b);
    });

    if (!r.items.some(i => !i.isSection)) warnings.push('The routine has no steps.');
    return { routine: r, warnings };
  }

  // The app's routine -> the model's format (sent with each message so edits start from what is on screen).
  function toAI(routine) {
    const out = { title: routine.title || '', items: [] };
    if (routine.startAt) out.startAt = routine.startAt;
    if (routine.finishBy) out.finishBy = routine.finishBy;
    (routine.items || []).forEach(i => {
      if (i.isSection) { out.items.push({ id: i.id, section: true, title: i.title, repeatCount: i.repeatCount || 1 }); return; }
      const o = { id: i.id, title: i.title, kind: i.kind || (i.timerEnabled ? 'timer' : 'tap') };
      if (i.type === 'gap') o.rest = true;
      if (o.kind === 'pacer') o.pacer = Object.assign({}, i.pattern, { cycles: i.cycles });
      else if (i.timerEnabled) {
        if (i.timerType === 'endtime') o.deadline = i.targetEndTime;
        else o.durationSecs = (Number(i.durationValue) || 0) * (i.durationUnit === 'mins' ? 60 : 1);
      }
      if (i.target) o.target = i.target;
      if (i.checklist) o.checklist = i.checklist.map(c => c.text);
      if (i.sets > 1) { o.sets = i.sets; o.restSecs = i.restBetween || 0; }
      if (i.timerEnabled) { o.autoStart = !!i.autoStart; o.autoAdvance = !!i.autoAdvance; }
      if (i.details && i.details.length) o.notes = i.details.map(d => d.text);
      out.items.push(o);
    });
    return out;
  }

  // What changed between two routines, matched by id. Returns lines for the preview.
  function diffRoutines(oldR, newR) {
    const a = toAI(oldR), b = toAI(newR);
    const byId = list => { const m = new Map(); list.items.forEach(i => m.set(i.id, i)); return m; };
    const am = byId(a), bm = byId(b);
    const lines = [];
    if (a.title !== b.title) lines.push({ type: 'changed', text: 'Title: ' + (b.title || '(none)') });
    if ((a.startAt || '') !== (b.startAt || '') || (a.finishBy || '') !== (b.finishBy || '')) {
      lines.push({ type: 'changed', text: b.startAt ? 'Start at ' + b.startAt : b.finishBy ? 'Finish by ' + b.finishBy : 'Set time removed' });
    }
    b.items.forEach(i => {
      const was = am.get(i.id);
      if (!was) lines.push({ type: 'added', text: i.title });
      else if (JSON.stringify(was) !== JSON.stringify(i)) lines.push({ type: 'changed', text: i.title });
    });
    a.items.forEach(i => { if (!bm.has(i.id)) lines.push({ type: 'removed', text: i.title }); });
    return lines;
  }

  // One-line description of a step for the preview list.
  function describeItem(i) {
    if (i.isSection) return (i.repeatCount > 1 ? i.repeatCount + ' rounds' : 'Section');
    const kind = i.kind || (i.timerEnabled ? 'timer' : 'tap');
    let s = '';
    if (kind === 'pacer') s = 'breathing, ' + i.cycles + ' cycles';
    else if (i.timerEnabled && i.timerType === 'endtime') s = 'until ' + i.targetEndTime;
    else if (i.timerEnabled) {
      const secs = (Number(i.durationValue) || 0) * (i.durationUnit === 'mins' ? 60 : 1);
      s = secs >= 60 && secs % 60 === 0 ? secs / 60 + ' min' : secs >= 60 ? Math.floor(secs / 60) + ' min ' + (secs % 60) + ' s' : secs + ' s';
    } else if (kind === 'checklist') s = 'checklist';
    else s = i.target || 'tap when done';
    if (i.sets > 1) s += ' × ' + i.sets + (i.restBetween ? ', rest ' + i.restBetween + ' s' : '');
    return s;
  }

  // The request body for POST /v1/messages. History is plain text; only the last user turn carries the routine.
  function buildRequest(model, history, userText, routine) {
    const msgs = history.slice(-12).map(m => ({ role: m.role, content: m.text }));
    msgs.push({ role: 'user', content: userText + '\n\n[Routine on screen now, as JSON]\n' + JSON.stringify(toAI(routine)) });
    return {
      model, max_tokens: 4096, system: SYSTEM, tools: [TOOL], tool_choice: { type: 'auto' },
      output_config: { effort: 'low' }, messages: msgs
    };
  }

  // Pull the reply text and routine out of a response. Returns { text, ai, refused }.
  function parseResponse(resp) {
    const out = { text: '', ai: null, refused: false };
    if (!resp || !Array.isArray(resp.content)) return out;
    if (resp.stop_reason === 'refusal') out.refused = true;
    resp.content.forEach(b => {
      if (b.type === 'text') out.text += (out.text ? '\n' : '') + b.text;
      else if (b.type === 'tool_use' && b.name === 'set_routine' && !out.ai) out.ai = b.input;
    });
    out.text = out.text.trim();
    return out;
  }

  // Plain-English message for a failed call.
  function errorMessage(status, body) {
    if (status === 401 || status === 403) return 'That key was not accepted. Check it in Settings and try again.';
    if (status === 429) return 'Too many requests right now. Wait a moment and try again.';
    if (status === 400 && body && /credit balance/i.test(JSON.stringify(body))) return 'The account behind this key is out of credits. Add credits in the Anthropic Console.';
    if (status >= 500 || status === 529) return 'The AI service is busy. Try again in a minute.';
    return 'Something went wrong (' + status + '). Your routine was not changed.';
  }

  // Send one message. `fetchFn` is injectable for tests and for the draft preview.
  async function ask(opts) {
    const f = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    if (!f) throw new Error('No network available.');
    let res;
    try {
      res = await f('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json', 'x-api-key': opts.key, 'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify(buildRequest(opts.model || DEFAULT_MODEL, opts.history || [], opts.text, opts.routine))
      });
    } catch (e) {
      throw new Error('Could not reach the AI service. Check your connection.');
    }
    let body = null;
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(errorMessage(res.status, body));
    return parseResponse(body);
  }

  const api = { MODELS, DEFAULT_MODEL, SYSTEM, TOOL, fromAI, toAI, diffRoutines, describeItem, buildRequest, parseResponse, errorMessage, ask };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.SeqAI = api;
})(typeof self !== 'undefined' ? self : globalThis);
