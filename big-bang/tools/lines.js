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
// each line is [key, text] spoken by Cosmo, or [key, text, 'prof'] spoken by Professor Know-A-Lot.
// Rule (family): the Professor explains the science (chapter stories c, bang, payoffs p, picture cards m, the one-year story cal);
// Cosmo asks the questions and handles play (talk-together t, help, final, orderok).
// Chapters with c.cast: Cosmo asks (ha<i><j>, q<i>, ga<i>) and the Professor answers (h<i><j>, qa<i>, gb<i>); hm<i><j> is his longer "Ask the Professor" answer.
CHAPTERS.forEach((c, i) => {
  out.push(['c' + i, c.mascotSpeech, 'prof']);
  if (c.afterBang) out.push(['bang', c.afterBang, 'prof']);
  out.push(['p' + i, c.payoff, 'prof']);
  c.hotspots.forEach((h, j) => {
    if (c.cast) { out.push([`ha${i}${j}`, h.ask]); out.push([`h${i}${j}`, h.body, 'prof']); if (h.more) out.push([`hm${i}${j}`, h.more, 'prof']); }
    else out.push([`h${i}${j}`, join(h.title, h.body)]);
  });
  if (c.cast) { out.push(['ma' + i, c.centre.ask]); out.push(['m' + i, c.centre.body, 'prof']); }
  else out.push(['m' + i, join(c.centre.title, c.centre.body), 'prof']);
  if (c.cast) { out.push(['q' + i, c.bigQ.q]); out.push(['qa' + i, `${c.bigQ.a} ${c.bigQ.f}`, 'prof']); }
  else out.push(['q' + i, `${c.bigQ.q} ${c.bigQ.a}`]);
  if (c.gloss) { out.push(['ga' + i, c.gloss.ask]); out.push(['gb' + i, c.gloss.answer, 'prof']); }
  out.push(['t' + i, c.talk]);
});
const u = UI[lang];
out.push(['final', u.v_final]);
out.push(['orderok', u.v_orderok]);
out.push(['help', u.v_help]);
out.push(['cal', u.v_cal, 'prof']);
out.forEach(([k, t, who]) => console.log(k + '\t' + (who || 'cosmo') + '\t' + clean(t)));
