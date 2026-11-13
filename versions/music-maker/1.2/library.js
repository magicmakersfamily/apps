/* Magic Music Maker: "My songs", the list of recordings kept on this device.
   The model (ordering, folders, stars, names, delete with undo) is pure and tested with node (library.test.js).
   L.Store keeps it in IndexedDB in the browser: the list as one record, each recording as a Blob.
   Nothing here ever leaves the device. */
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
