/* Magic Music Maker: "My songs", the list of recordings kept on this device.
   The model (ordering, folders, stars, names, delete with undo) is pure and tested with node (library.test.js).
   L.Store keeps it in IndexedDB in the browser: the list as one record, each recording as bytes plus its type.
   L.zip / L.backupFiles / L.restore make and read the "Save all my songs" file (a plain .zip), so songs can live somewhere safe.
   Nothing here ever leaves the device unless someone saves that file. */
(function (root) {
'use strict';
const L = {};
const NAME_MAX = 40, FOLDER_MAX = 24, SETTINGS = ['style', 'energy', 'voice', 'playback', 'words', 'w'];

L.empty = function () { return { v: 1, seq: 0, fseq: 0, songs: [], folders: [] }; };

// make a stored (or damaged) list safe to use
L.load = function (raw) {
  const st = L.empty();
  if (!raw || typeof raw !== 'object') return st;
  st.seq = Math.max(0, Number(raw.seq) || 0); st.fseq = Math.max(0, Number(raw.fseq) || 0);
  const fids = new Set();
  for (const f of Array.isArray(raw.folders) ? raw.folders : []) {
    if (!f || typeof f.id !== 'string' || fids.has(f.id)) continue;
    fids.add(f.id); st.folders.push({ id: f.id, name: cleanName(f.name, FOLDER_MAX) || 'Folder', created: Number(f.created) || 0 });
  }
  const ids = new Set();
  for (const s of Array.isArray(raw.songs) ? raw.songs : []) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id)) continue;
    ids.add(s.id);
    const song = { id: s.id, name: cleanName(s.name, NAME_MAX) || 'My song', created: Number(s.created) || 0, updated: Number(s.updated) || 0,
      star: !!s.star, folder: fids.has(s.folder) ? s.folder : null, order: Number.isFinite(s.order) ? s.order : 0,
      dur: Number(s.dur) || 0, mode: s.mode === 'rhythm' ? 'rhythm' : 'melody', thumb: Array.isArray(s.thumb) ? s.thumb.slice(0, 48) : [] };
    if (s.deleted) song.deleted = Number(s.deleted) || 1;
    for (const k of SETTINGS) if (k in s) song[k] = s[k];
    st.songs.push(song);
  }
  renumber(st);
  return st;
};

function cleanName(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function sorted(st) { return st.songs.slice().sort((a, b) => a.order - b.order); }
function renumber(st) { sorted(st).forEach((s, i) => { s.order = i; }); }
function find(st, id) { return st.songs.find((s) => s.id === id) || null; }
L.find = find;

// a new recording goes to the top of the list (and into the folder being looked at)
L.add = function (st, meta, now) {
  meta = meta || {}; st.seq++;
  const id = 's' + (now || Date.now()).toString(36) + '-' + st.seq;
  const song = { id, name: cleanName(meta.name, NAME_MAX) || 'My song ' + st.seq, created: now || Date.now(), updated: now || Date.now(), star: false,
    folder: st.folders.some((f) => f.id === meta.folder) ? meta.folder : null, order: -1, dur: Number(meta.dur) || 0,
    mode: meta.mode === 'rhythm' ? 'rhythm' : 'melody', thumb: Array.isArray(meta.thumb) ? meta.thumb.slice(0, 48) : [] };
  for (const k of SETTINGS) if (meta[k] !== undefined) song[k] = meta[k];
  st.songs.push(song); renumber(st);
  return song;
};

// what one view shows: 'all', 'star', or a folder id; deleted songs are hidden
L.view = function (st, filter) {
  return sorted(st).filter((s) => !s.deleted && (filter === 'star' ? s.star : filter && filter !== 'all' ? s.folder === filter : true));
};
L.counts = function (st) {
  const c = { all: 0, star: 0 };
  for (const f of st.folders) c[f.id] = 0;
  for (const s of st.songs) { if (s.deleted) continue; c.all++; if (s.star) c.star++; if (s.folder && s.folder in c) c[s.folder]++; }
  return c;
};

// drag up or down inside the view being looked at; songs outside the view keep their places
L.move = function (st, id, toIndex, filter) {
  const view = L.view(st, filter), from = view.findIndex((s) => s.id === id);
  if (from < 0) return false;
  toIndex = Math.max(0, Math.min(view.length - 1, Math.round(toIndex)));
  if (toIndex === from) return false;
  const all = sorted(st), slots = view.map((s) => all.indexOf(s)), moved = view.slice();
  const [song] = moved.splice(from, 1); moved.splice(toIndex, 0, song);
  slots.forEach((slot, k) => { all[slot] = moved[k]; });
  all.forEach((s, i) => { s.order = i; });
  return true;
};

L.star = function (st, id, on) { const s = find(st, id); if (!s) return false; s.star = on == null ? !s.star : !!on; return true; };
L.rename = function (st, id, name) { const s = find(st, id), n = cleanName(name, NAME_MAX); if (!s || !n) return false; s.name = n; return true; };
L.setFolder = function (st, id, folder) {
  const s = find(st, id); if (!s) return false;
  const f = folder && st.folders.some((x) => x.id === folder) ? folder : null;
  if (s.folder === f) return false; s.folder = f; return true;
};
// keep the band, energy, voice and magic words with the song, so it re-opens exactly as left
L.update = function (st, id, settings, now) {
  const s = find(st, id); if (!s) return false;
  for (const k of SETTINGS) if (settings && settings[k] !== undefined) s[k] = settings[k];
  s.updated = now || Date.now(); return true;
};

// delete is soft at first so "Undo" works; purge removes it for good and says which recordings to drop
L.remove = function (st, id, now) { const s = find(st, id); if (!s || s.deleted) return false; s.deleted = now || Date.now(); return true; };
L.undo = function (st, id) { const s = find(st, id); if (!s || !s.deleted) return false; delete s.deleted; return true; };
L.purge = function (st, before) {
  const gone = st.songs.filter((s) => s.deleted && (before == null || s.deleted <= before)).map((s) => s.id);
  st.songs = st.songs.filter((s) => !gone.includes(s.id)); renumber(st);
  return gone;
};

L.addFolder = function (st, name, now) {
  st.fseq++;
  const f = { id: 'f' + (now || Date.now()).toString(36) + '-' + st.fseq, name: cleanName(name, FOLDER_MAX) || 'Folder ' + st.fseq, created: now || Date.now() };
  st.folders.push(f); return f;
};
L.renameFolder = function (st, fid, name) { const f = st.folders.find((x) => x.id === fid), n = cleanName(name, FOLDER_MAX); if (!f || !n) return false; f.name = n; return true; };
// removing a folder never removes songs: they go back to "All"
L.removeFolder = function (st, fid) {
  const i = st.folders.findIndex((x) => x.id === fid); if (i < 0) return false;
  st.folders.splice(i, 1); for (const s of st.songs) if (s.folder === fid) s.folder = null; return true;
};

// a tiny picture of the tune for the list: up to 48 [start, end, pitch] bars, times 0..1, pitch 0..1
L.thumb = function (notes, dur) {
  if (!notes || !notes.length || !(dur > 0)) return [];
  let lo = Infinity, hi = -Infinity; for (const n of notes) { lo = Math.min(lo, n.q); hi = Math.max(hi, n.q); }
  const span = Math.max(4, hi - lo), t0 = notes[0].s, t1 = Math.max(notes[notes.length - 1].e, t0 + .1), step = Math.max(1, Math.ceil(notes.length / 48)), out = [];
  for (let i = 0; i < notes.length; i += step) { const n = notes[i]; out.push([+((n.s - t0) / (t1 - t0)).toFixed(3), +((n.e - t0) / (t1 - t0)).toFixed(3), +((n.q - lo) / span).toFixed(3)]); }
  return out;
};

/* ---------- "Save all my songs": one .zip file with every recording plus the list ---------- */
// a plain zip (stored, not squeezed: recordings are already compressed), so any computer can open it and play the songs
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
L.crc32 = function (u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const utf8 = (s) => new TextEncoder().encode(s), unutf8 = (u8) => new TextDecoder().decode(u8);

L.zip = function (files, now) {
  const d = new Date(now || Date.now()), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date = ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  const parts = [], central = []; let off = 0;
  for (const f of files) {
    const name = utf8(f.name), data = f.data, crc = L.crc32(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true);
    h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, time, true); c.setUint16(14, date, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
    c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    parts.push(new Uint8Array(h.buffer), name, data); central.push(new Uint8Array(c.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, p) => a + p.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  const all = parts.concat(central, [new Uint8Array(e.buffer)]), out = new Uint8Array(off + csize + 22); let p = 0;
  for (const a of all) { out.set(a, p); p += a.length; }
  return out;
};
// reads the zips L.zip makes (and any other zip whose files are stored); damaged or squeezed files are skipped
L.unzip = function (u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = [];
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return null;
  let p = dv.getUint32(e + 16, true); const n = dv.getUint16(e + 10, true);
  for (let k = 0; k < n && p + 46 <= u8.length && dv.getUint32(p, true) === 0x02014b50; k++) {
    const method = dv.getUint16(p + 10, true), crc = dv.getUint32(p + 16, true), size = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true);
    const name = unutf8(u8.subarray(p + 46, p + 46 + nl)), lo = dv.getUint32(p + 42, true);
    p += 46 + nl + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    if (method !== 0 || lo + 30 > u8.length || dv.getUint32(lo, true) !== 0x04034b50) continue;
    const start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u8.subarray(start, start + size);
    if (data.length === size && L.crc32(data) === crc) out.push({ name, data });
  }
  return out;
};

const EXT = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav' };
L.ext = function (type) { return EXT[String(type || '').split(';')[0].trim().toLowerCase()] || 'audio'; };
L.BACKUP = 'my-songs.json';
// audio: { [song id]: { type, data: Uint8Array } }; songs without a recording are left out
L.backupFiles = function (st, audio, now) {
  const songs = L.view(st, 'all').filter((s) => audio[s.id]), files = [], map = {}, used = new Set();
  songs.forEach((s, i) => {
    const base = String(i + 1).padStart(2, '0') + ' ' + (s.name.replace(/[\\/:*?"<>|.]+/g, '-').trim() || 'My song');
    let name = 'Songs/' + base + '.' + L.ext(audio[s.id].type);
    for (let k = 2; used.has(name); k++) name = 'Songs/' + base + ' (' + k + ').' + L.ext(audio[s.id].type);
    used.add(name); map[s.id] = { file: name, type: audio[s.id].type || '' }; files.push({ name, data: audio[s.id].data });
  });
  const keep = new Set(songs.map((s) => s.id)), list = JSON.parse(JSON.stringify(st));
  list.songs = list.songs.filter((s) => keep.has(s.id));
  const man = { app: 'magic-music-maker', backup: 1, saved: now || Date.now(), list, files: map };
  files.unshift({ name: L.BACKUP, data: utf8(JSON.stringify(man)) });
  return files;
};
// bring songs back from a backup into the list: songs already here are skipped, new ones go after the others, folders come too
// returns [{ song, data, type }] for the recordings to keep; the caller stores them, then the list
L.restore = function (st, files) {
  const byName = new Map((files || []).map((f) => [f.name, f.data])), raw = byName.get(L.BACKUP);
  if (!raw) return null;
  let man; try { man = JSON.parse(unutf8(raw)); } catch (e) { return null; }
  if (!man || man.app !== 'magic-music-maker' || !man.files) return null;
  const back = L.load(man.list), have = new Set(st.songs.map((s) => s.id)), out = [];
  for (const f of back.folders) if (!st.folders.some((x) => x.id === f.id)) st.folders.push(f);
  let order = st.songs.length;
  for (const s of L.view(back, 'all')) {
    const m = man.files[s.id], data = m && byName.get(m.file);
    if (have.has(s.id) || !data) continue;
    s.order = order++; st.songs.push(s); have.add(s.id);
    out.push({ song: s, data, type: typeof m.type === 'string' ? m.type : '' });
  }
  st.seq = Math.max(st.seq, back.seq, st.songs.length); st.fseq = Math.max(st.fseq, back.fseq, st.folders.length);
  renumber(st);
  return out;
};

/* ---------- keeping it in this browser (IndexedDB) ---------- */
// frozen copies under versions/ get their own database, like their own saved games
L.dbName = function (path) { const m = /\/versions\/music-maker\/([\d.]+)\//.exec(path || ''); return m ? 'music-maker@' + m[1] : 'music-maker'; };
L.Store = function (name) {
  const idb = typeof indexedDB !== 'undefined' ? indexedDB : null;
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!idb) { rej(new Error('no IndexedDB')); return; }
    const rq = idb.open(name, 1);
    rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio'); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); rq.onblocked = () => rej(new Error('blocked'));
  }));
  const tx = (store, mode, fn) => open().then((db) => new Promise((res, rej) => {
    const t = db.transaction(store, mode), os = t.objectStore(store); let out;
    const r = fn(os); if (r) r.onsuccess = () => { out = r.result; };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('aborted'));
  }));
  return {
    loadList: () => tx('meta', 'readonly', (os) => os.get('list')).then((raw) => L.load(raw)),
    saveList: (st) => tx('meta', 'readwrite', (os) => os.put(JSON.parse(JSON.stringify(st)), 'list')),
    // stored as plain bytes plus the type: Safari refuses Blobs in IndexedDB in private windows
    putAudio: (id, blob) => (blob.arrayBuffer ? blob.arrayBuffer() : new Response(blob).arrayBuffer()).then((buf) => tx('audio', 'readwrite', (os) => os.put({ type: blob.type || '', buf }, id))),
    getAudio: (id) => tx('audio', 'readonly', (os) => os.get(id)).then((r) => !r ? null : (typeof Blob !== 'undefined' && r instanceof Blob) ? r : r.buf ? new Blob([r.buf], { type: r.type || '' }) : null),
    dropAudio: (ids) => tx('audio', 'readwrite', (os) => { for (const id of ids) os.delete(id); return null; })
  };
};

if (typeof module !== 'undefined' && module.exports) module.exports = L; else root.MML = L;
})(typeof self !== 'undefined' ? self : this);
