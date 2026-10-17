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
  c.hotspots.forEach((h, j) => out.push([`h${i}${j}`, `${h.title}. ${h.body}`]));
  out.push(['m' + i, `${c.centre.title}. ${c.centre.body}`]);
});
out.push(['done', 'Awesome job! You finished this chapter’s challenge. Tap Next Chapter to keep going!']);
out.push(['final', 'You did it! You travelled all the way from the Big Bang to today!']);
out.push(['help', 'How to play and learn. In Chapter 1, tap the glowing core in the dark to start the Big Bang. Tap the floating things to finish each chapter’s challenge. Tap the glowing circles to learn a fun fact. Tap Cosmo to hear him again.']);
out.forEach(([k, t]) => console.log(k + '\t' + clean(t)));
