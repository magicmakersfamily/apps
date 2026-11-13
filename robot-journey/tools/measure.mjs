// Measures how high and far each Turn-mode jump size goes (for JUMP_GUIDE in index.html) and a step's length. Dev only.
import { launch, baseUrl } from '../../tools/play/harness.mjs';
const p = await launch({ url: (await baseUrl()) + 'robot-journey/?ai=1', w: 1280, h: 800, seed: 1 });
await p.sleep(500);
const r = await p.eval(`(() => {
  const RJ = window.RobotJourney, out = {};
  RJ.start({ turn: true });
  for (let k = 0; k < 60; k++) RJ.debug.tick();
  const base = RJ.debug.snapshot();
  const measure = (move, pw) => {
    RJ.debug.restore(base);
    RJ.ai.act('power' + pw);
    const x0 = RJ.ai.state().robot.x; let top = 0, frames = 0;
    RJ.ai.act(move);
    while (RJ.ai.busy() && frames++ < 600) { RJ.debug.stepMove(); top = Math.max(top, RJ.ai.state().robot.feet); }
    return { up: top, across: RJ.ai.state().robot.x - x0, frames };
  };
  for (const pw of [1, 2, 3]) out['jump' + pw] = measure('jumpRight', pw);
  out.step = measure('right', 2);
  out.wait = measure('wait', 2);
  out.up3 = measure('jumpUp', 3);
  return out;
})()`);
console.log(JSON.stringify(r));
console.log('errors', JSON.stringify(p.errors));
await p.close();
