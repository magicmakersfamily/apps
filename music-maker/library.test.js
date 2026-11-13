// Model tests for "My songs" (node --test): order, folders, stars, names, delete with undo, and damaged saves.
const test = require('node:test'), assert = require('node:assert/strict');
const L = require('./library.js');

const names = (st, f) => L.view(st, f || 'all').map((s) => s.name);
function three() { const st = L.empty(); L.add(st, { name: 'A' }, 1); L.add(st, { name: 'B' }, 2); L.add(st, { name: 'C' }, 3); return st; }

test('a new recording goes to the top, with a friendly name and its settings', () => {
  const st = L.empty(), a = L.add(st, { dur: 12.3, style: 'rock', voice: 'pop' }, 1000), b = L.add(st, {}, 2000);
  assert.deepEqual(names(st), ['My song 2', 'My song 1']);
  assert.equal(a.style, 'rock'); assert.equal(a.voice, 'pop'); assert.equal(a.dur, 12.3);
  assert.notEqual(a.id, b.id);
});

test('dragging up and down reorders the list', () => {
  const st = three();                                   // C B A
  const c = L.view(st, 'all')[0];
  assert.ok(L.move(st, c.id, 2, 'all'));
  assert.deepEqual(names(st), ['B', 'A', 'C']);
  assert.ok(!L.move(st, c.id, 2, 'all'), 'no change, no save');
  L.move(st, c.id, -5, 'all');                          // clamps to the top
  assert.deepEqual(names(st), ['C', 'B', 'A']);
});

test('reordering inside a folder leaves the other songs where they were', () => {
  const st = three(), [c, b, a] = L.view(st, 'all'), f = L.addFolder(st, 'Bedtime', 5);
  L.setFolder(st, c.id, f.id); L.setFolder(st, a.id, f.id);
  assert.deepEqual(names(st, f.id), ['C', 'A']);
  L.move(st, a.id, 0, f.id);
  assert.deepEqual(names(st, f.id), ['A', 'C']);
  assert.deepEqual(names(st), ['A', 'B', 'C'], 'B keeps the middle slot');
});

test('stars and the Starred view', () => {
  const st = three(), [c, , a] = L.view(st, 'all');
  L.star(st, a.id); L.star(st, c.id, true);
  assert.deepEqual(names(st, 'star'), ['C', 'A']);
  L.star(st, c.id);
  assert.deepEqual(names(st, 'star'), ['A']);
  assert.equal(L.counts(st).star, 1);
});

test('folders: file a song, rename, and removing a folder keeps its songs', () => {
  const st = three(), [c] = L.view(st, 'all'), f = L.addFolder(st, '  Car   songs ', 9);
  assert.equal(f.name, 'Car songs');
  assert.ok(L.setFolder(st, c.id, f.id)); assert.equal(L.counts(st)[f.id], 1);
  assert.ok(!L.setFolder(st, c.id, 'nope') || L.find(st, c.id).folder === null, 'an unknown folder files nowhere');
  L.setFolder(st, c.id, f.id);
  assert.ok(L.renameFolder(st, f.id, 'Road trip')); assert.equal(st.folders[0].name, 'Road trip');
  assert.ok(L.removeFolder(st, f.id));
  assert.equal(L.find(st, c.id).folder, null); assert.equal(L.view(st, 'all').length, 3);
});

test('names are tidy and never empty', () => {
  const st = three(), [c] = L.view(st, 'all');
  assert.ok(!L.rename(st, c.id, '   '));
  assert.equal(L.find(st, c.id).name, 'C');
  L.rename(st, c.id, 'x'.repeat(80) + '\n');
  assert.equal(L.find(st, c.id).name.length, 40);
});

test('delete can be undone, and purge says which recordings to drop', () => {
  const st = three(), [c, b] = L.view(st, 'all');
  L.remove(st, c.id, 100); L.remove(st, b.id, 200);
  assert.deepEqual(names(st), ['A']); assert.equal(L.counts(st).all, 1);
  L.undo(st, c.id);
  assert.deepEqual(names(st), ['C', 'A']);
  assert.deepEqual(L.purge(st, 150), [], 'B was deleted after 150');
  assert.deepEqual(L.purge(st), [b.id]);
  assert.equal(st.songs.length, 2);
});

test('re-opening keeps the latest band, energy, voice and magic words', () => {
  const st = three(), [c] = L.view(st, 'all');
  L.update(st, c.id, { style: 'lofi', energy: 3, voice: 'echo', words: 'rainy day', w: { rev: .35 }, junk: 1 }, 50);
  const s = L.find(st, c.id);
  assert.equal(s.style, 'lofi'); assert.equal(s.energy, 3); assert.equal(s.words, 'rainy day'); assert.equal(s.junk, undefined); assert.equal(s.updated, 50);
});

test('a damaged or old save never breaks the list', () => {
  assert.deepEqual(L.load(null).songs, []);
  assert.deepEqual(L.load('nonsense').songs, []);
  const st = L.load({ seq: 'x', songs: [null, { id: 'a', name: '', folder: 'gone', order: NaN }, { id: 'a' }, { id: 'b', star: 1, name: 'Hi' }], folders: [{ id: 'f', name: '' }, { id: 'f' }] });
  assert.equal(st.songs.length, 2); assert.equal(st.songs[0].name, 'My song'); assert.equal(st.songs[0].folder, null);
  assert.equal(st.songs[1].star, true); assert.equal(st.folders.length, 1); assert.equal(st.folders[0].name, 'Folder');
  const round = L.load(JSON.parse(JSON.stringify(three())));
  assert.deepEqual(names(round), ['C', 'B', 'A']);
});

test('frozen copies keep their own songs', () => {
  assert.equal(L.dbName('/apps/music-maker/'), 'music-maker');
  assert.equal(L.dbName('/apps/versions/music-maker/1.2/index.html'), 'music-maker@1.2');
});

test('the little picture of a tune fits in the box', () => {
  const notes = Array.from({ length: 100 }, (_, i) => ({ s: i * .3, e: i * .3 + .25, q: 60 + (i % 7) }));
  const th = L.thumb(notes, 30);
  assert.ok(th.length <= 48 && th.length > 20);
  assert.ok(th.every(([a, b, p]) => a >= 0 && b <= 1.0001 && a <= b && p >= 0 && p <= 1));
  assert.deepEqual(L.thumb([], 3), []);
});

test('the backup zip is a real zip that comes back byte for byte', () => {
  assert.equal(L.crc32(new TextEncoder().encode('hello')), 0x3610a686);
  const a = new Uint8Array(5000).map((_, i) => (i * 7) & 255), files = [{ name: 'Songs/01 Dragon söng.webm', data: a }, { name: 'x.txt', data: new Uint8Array(0) }];
  const z = L.zip(files, Date.UTC(2026, 10, 13, 12));
  assert.deepEqual([z[0], z[1], z[2], z[3]], [0x50, 0x4b, 3, 4]);
  const back = L.unzip(z);
  assert.equal(back.length, 2); assert.equal(back[0].name, 'Songs/01 Dragon söng.webm'); assert.deepEqual([...back[0].data], [...a]); assert.equal(back[1].data.length, 0);
  assert.equal(L.unzip(new Uint8Array([1, 2, 3])), null, 'not a zip');
  const bad = z.slice(); bad[200] ^= 255;                               // a damaged recording is skipped, not trusted
  assert.equal(L.unzip(bad).length, 1);
});

test('save all my songs, then bring them back into an empty browser', () => {
  const st = three(), [c, b, a] = L.view(st, 'all'), f = L.addFolder(st, 'Bedtime', 5);
  L.setFolder(st, b.id, f.id); L.star(st, a.id); L.rename(st, c.id, 'Dragon: song?'); L.update(st, a.id, { style: 'rock' }, 9);
  L.remove(st, b.id, 10); L.undo(st, b.id);
  const audio = {}; for (const [s, t] of [[c, 'audio/webm;codecs=opus'], [b, 'audio/mp4'], [a, 'audio/wav']]) audio[s.id] = { type: t, data: new Uint8Array([1, 2, s.name.length]) };
  const files = L.backupFiles(st, audio, 99);
  assert.deepEqual(files.map((x) => x.name), ['my-songs.json', 'Songs/01 Dragon- song-.webm', 'Songs/02 B.m4a', 'Songs/03 A.wav']);
  const fresh = L.empty(), got = L.restore(fresh, L.unzip(L.zip(files)));
  assert.equal(got.length, 3); assert.deepEqual(names(fresh), ['Dragon: song?', 'B', 'A']);
  assert.equal(got[1].type, 'audio/mp4'); assert.deepEqual([...got[2].data], [...audio[a.id].data]);
  assert.equal(fresh.folders[0].name, 'Bedtime'); assert.deepEqual(names(fresh, f.id), ['B']); assert.deepEqual(names(fresh, 'star'), ['A']);
  assert.equal(L.find(fresh, a.id).style, 'rock');
  assert.deepEqual(L.restore(fresh, L.unzip(L.zip(files))), [], 'bringing back twice makes no copies');
  assert.equal(L.add(fresh, {}, 200).name, 'My song 4', 'new songs keep counting up');
});

test('bringing back adds to the songs already here, and ignores other files', () => {
  const old = three(), audio = {}; for (const s of old.songs) audio[s.id] = { type: 'audio/webm', data: new Uint8Array([9]) };
  const files = L.backupFiles(old, audio);
  const here = L.empty(); L.add(here, { name: 'New one' }, 50);
  assert.equal(L.restore(here, files).length, 3);
  assert.deepEqual(names(here), ['New one', 'C', 'B', 'A']);
  assert.equal(L.restore(here, [{ name: 'my-songs.json', data: new TextEncoder().encode('{"app":"other"}') }]), null);
  assert.equal(L.restore(here, [{ name: 'photo.jpg', data: new Uint8Array(3) }]), null);
  const noAudio = L.backupFiles(old, { [old.songs[0].id]: audio[old.songs[0].id] });
  assert.equal(noAudio.length, 2, 'a song whose recording is missing is left out');
});
