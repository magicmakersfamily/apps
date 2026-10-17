// Prints "key<TAB>spoken text" for every line Cosmo says. Used by render-voice.sh.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const a = src.indexOf('const CHAPTERS = ['), b = src.indexOf('\n];', a) + 3;
const CHAPTERS = eval(src.slice(a, b).replace('const CHAPTERS =', '(') .replace(/;$/, ')'));
const clean = t => t.replace(/[\p{Extended_Pictographic}️‍]/gu, '').replace(/\s+/g, ' ').trim();
const out = [];
CHAPTERS.forEach((c, i) => {
  out.push(['c' + i, c.mascotSpeech]);
  if (c.afterBang) out.push(['bang', c.afterBang]);
  out.push(['p' + i, c.payoff]);
  c.hotspots.forEach((h, j) => out.push([`h${i}${j}`, `${h.title}. ${h.body}`]));
  out.push(['m' + i, `${c.centre.title}. ${c.centre.body}`]);
  out.push(['q' + i, `${c.bigQ.q} ${c.bigQ.a}`]);
});
out.push(['final', 'You did it! You travelled all the way from the Big Bang to today! What do you want to discover next?']);
out.push(['orderok', 'You put the whole story in order. Great job, explorer!']);
out.push(['help', 'How to play and learn. Tap the glowing dot to start the Big Bang. In each chapter, tap the floating things and watch what you make happen. Tap the glowing circles for fun facts, and Cosmo’s Big question for a puzzle to think about. Collect stickers, and use the story line at the bottom to see how long ago things happened.']);
out.forEach(([k, t]) => console.log(k + '\t' + clean(t)));
