import { loadJSON, saveJSON, uid } from './util.js';

// Questions and passage sets that viewers type in, upload or have Claude write join the question bank,
// so they are served again later without AI. They are kept in this browser and, on the claude.ai page,
// in the artifact's shared collection "bank" that everyone with the link reads.
const KEY = 'thoughtlib_userbank_v1';
const norm = s => (s || '').replace(/\s+/g, '');
const keyOf = x => (x.k === 'p' ? 'p:' + norm((x.ps || []).map(p => p.text).join('')).slice(0, 200) : 'q:' + norm(x.q));

let dbPromise = null;
const sharedCol = () => {
  if (!dbPromise) dbPromise = window.claude?.use ? window.claude.use('db').catch(() => null) : Promise.resolve(null);
  return dbPromise.then(db => (db ? db.collection('bank') : null));
};

export function localUserBank() { return loadJSON(KEY, []); }

export async function sharedUserBank() {
  try {
    const col = await sharedCol();
    if (!col) return [];
    const snap = await col.get();
    return snap.docs.map(d => d.data()).filter(x => x && (x.k === 'p' ? (x.ps || []).length : x.q));
  } catch { return []; }
}

// Adds an item once; returns false if the bank already holds the same text.
export function addToUserBank(item) {
  const list = localUserBank();
  const k = keyOf(item);
  if (list.some(x => keyOf(x) === k)) return false;
  const x = { ...item, id: item.id || 'u' + uid(), src: 'user', date: new Date().toISOString() };
  saveJSON(KEY, [...list, x].slice(-600));
  sharedCol().then(col => col && col.doc(x.id).set(JSON.parse(JSON.stringify(x)))).catch(() => {});
  window.dispatchEvent(new Event('tl-userbank'));
  return true;
}
