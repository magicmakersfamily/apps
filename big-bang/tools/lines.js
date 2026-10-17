const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const lang = process.argv[3] === 'yue' ? 'yue' : 'en';
// the data blocks in index.html are plain JS: const NAME = ...;  (arrays end with "\n];", objects with "\n};")
function grab(name, close) { const a = src.indexOf('const ' + name + ' = '), b = src.indexOf(close, a) + close.length; return eval('(' + src.slice(a, b).replace('const ' + name + ' =', '').replace(/;\s*$/, '') + ')'); }
const CHAPTERS = grab(lang === 'yue' ? 'CHAPTERS_YUE' : 'CHAPTERS_EN', '\n];');
const UI = grab('UI', '\n}');
const clean = t => t.replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '').replace(/\s+/g, ' ').trim();
const join = (a, b) => /[.!?！？。]$/.test(a) ? a + ' ' + b : a + (lang === 'yue' ? '。' : '. ') + b;
const out = [];
CHAPTERS.forEach((c, i) => {
  out.push(['c' + i, c.mascotSpeech]);
  if (c.afterBang) out.push(['bang', c.afterBang]);
  out.push(['p' + i, c.payoff]);
  c.hotspots.forEach((h, j) => out.push([`h${i}${j}`, join(h.title, h.body)]));
  out.push(['m' + i, join(c.centre.title, c.centre.body)]);
  out.push(['q' + i, `${c.bigQ.q} ${c.bigQ.a}`]);
  out.push(['t' + i, c.talk]);
});
const u = UI[lang];
out.push(['final', u.v_final]);
out.push(['orderok', u.v_orderok]);
out.push(['help', u.v_help]);
out.push(['cal', u.v_cal]);
out.forEach(([k, t]) => console.log(k + '\t' + clean(t)));
