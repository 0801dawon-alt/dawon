// Moves records between the claude.ai page (artifact db) and the recording homepage (localStorage),
// which cannot see each other. Records travel as one compact token in a link hash or in copied text.

const b64 = bytes => { let s = ''; bytes.forEach(c => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// 'TL1:' is deflate-compressed JSON; 'TL0:' plain JSON where the browser lacks CompressionStream.
export async function encodeSync(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'undefined') return 'TL0:' + b64(raw);
  return 'TL1:' + b64(await pipe(raw, new CompressionStream('deflate-raw')));
}

// Same token without compression, built synchronously so a click can copy it right away.
export const encodeSyncPlain = obj => 'TL0:' + b64(new TextEncoder().encode(JSON.stringify(obj)));

export const SYNC_RE = /TL[01]:[A-Za-z0-9_-]+/;

export async function decodeSync(text) {
  const m = (text || '').match(SYNC_RE);
  if (!m) return null;
  try {
    let bytes = unb64(m[0].slice(4));
    if (m[0][2] === '1') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

// Union of two attempt lists by id. When both sides hold an attempt, the one with feedback wins,
// then the one with the longer answer; newest first.
export function mergeAttemptLists(mine, theirs) {
  const map = new Map(mine.map(a => [a.id, a]));
  (theirs || []).forEach(a => {
    if (!a || !a.id) return;
    const cur = map.get(a.id);
    if (!cur) { map.set(a.id, a); return; }
    const better = (!cur.fb && a.fb) || (!!cur.fb === !!a.fb && (a.text || '').length > (cur.text || '').length);
    if (better) map.set(a.id, { ...cur, ...a });
  });
  return [...map.values()].sort((x, y) => (y.date || '').localeCompare(x.date || ''));
}
