// Proves the whole level can be finished with Turn-mode moves only (the moves an AI helper or the Turn-mode buttons make).
// The bot looks two moves ahead using snapshot/restore and picks the move that gets furthest without falling or getting hit.
// Usage: node robot-journey/tools/ai-bot.mjs [--w 1280 --h 800] [--remix]   (exit 1 if it can't reach the Bright Spot)
import { launch, baseUrl, record } from '../../tools/play/harness.mjs';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const w = +arg('--w', 1280), h = +arg('--h', 800), remix = process.argv.includes('--remix');
const p = await launch({ url: (await baseUrl()) + 'robot-journey/?ai=1', w, h, seed: 7 });
await p.ready('!!window.RobotJourney');
const res = await p.eval(`(() => {
  const RJ = window.RobotJourney, D = RJ.debug;
  RJ.start({ turn: true, remix: ${remix} });
  const MOVES = [['right'], ['wait'], ['left'], ['jumpRight', 1], ['jumpRight', 2], ['jumpRight', 3], ['jumpUp', 3], ['jumpLeft', 2], ['jumpLeft', 3]];
  const play = (m) => { if (m[1]) RJ.ai.act('power' + m[1]); return RJ.ai.run(m[0]); };
  const value = (ev) => {
    const st = RJ.ai.state();
    if (st.state !== 'PLAYING') return 1e9;   // reached the portal
    let v = st.robot.x + st.robot.feet * 0.15 + st.gears.got * 4;
    ev.forEach((e) => { if (e.startsWith('fell')) v -= 3000; if (e.includes('knocked back')) v -= 400; if (e.startsWith('bonked')) v += 40; });
    return v;
  };
  const log = []; let best = 0, stuck = 0, turns = 0;
  while (turns < 500 && D.gameState === 'PLAYING') {
    const snap = D.snapshot(); let pick = null, pickV = -1e12;
    for (const a of MOVES) {
      D.restore(snap); play(a); const evA = (RJ.ai.state().lastMove || { events: [] }).events.slice();
      if (D.gameState !== 'PLAYING') { pick = a; pickV = 1e9; break; }
      const snap2 = D.snapshot(); let bestB = -1e12;
      for (const b of MOVES) {
        D.restore(snap2); play(b); const evB = (RJ.ai.state().lastMove || { events: [] }).events;
        bestB = Math.max(bestB, value(evA.concat(evB)));
      }
      const v = Math.max(bestB, value(evA)) + (stuck > 6 ? Math.random() * 400 : 0);
      if (v > pickV) { pickV = v; pick = a; }
    }
    D.restore(snap); play(pick); turns++;
    const st = RJ.ai.state();
    log.push(pick.join('') + '@' + st.robot.x + (st.lastMove.events.some((e) => e.startsWith('fell')) ? '!FELL' : ''));
    if (st.robot.x > best + 20) { best = st.robot.x; stuck = 0; } else stuck++;
  }
  const st = RJ.ai.state();
  return { turns, state: D.gameState, x: st.robot.x, gears: st.gears, falls: log.filter((l) => l.includes('FELL')).length, log: log.join(' ') };
})()`);
const failures = [];
if (!['PORTAL_FINALE', 'WIN'].includes(res.state)) failures.push({ type: 'route', where: 'x ' + res.x, text: 'Turn-mode moves did not reach the Bright Spot within 500 turns' });
failures.push(...p.errors.map((e) => ({ type: 'error', where: e.kind, text: e.text })));
console.log('turns', res.turns, 'state', res.state, 'x', res.x, 'gears', JSON.stringify(res.gears), 'falls', res.falls, `(${w}x${h}${remix ? ', remix' : ''})`);
if (process.argv.includes('--log')) console.log(res.log);
record({ game: 'robot-journey', scenario: 'ai-bot' + (remix ? '-remix' : '') + '-' + w + 'x' + h, browser: p.browserName, turns: res.turns, failures });
console.log('AI BOT', failures.length ? 'FAILED' : 'OK');
process.exitCode = failures.length ? 1 : 0;
await p.close();
