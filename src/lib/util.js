import { FILLERS } from './constants.js';

export function parseJSON(t) {
  if (!t) return null;
  const tries = [t.trim()];
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) tries.push(fence[1]);
  // Start from whichever bracket opens first, so an object's inner array is never taken alone.
  const pairs = [['[', ']'], ['{', '}']].filter(([o]) => t.includes(o)).sort((x, y) => t.indexOf(x[0]) - t.indexOf(y[0]));
  for (const [o, c] of pairs) {
    const a = t.indexOf(o), b = t.lastIndexOf(c);
    if (b > a) tries.push(t.slice(a, b + 1));
  }
  for (const s of tries) { try { return JSON.parse(s); } catch { /* try next */ } }
  return null;
}

export const pad = n => String(n).padStart(2, '0');

export const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Topic context block handed to every AI prompt.
export function ctx(e) {
  return `제목: ${e.title}\n분류: ${e.category}\n요약: ${e.summary || ''}\n배경: ${e.background || ''}\n쟁점: ${(e.issues || []).join(' / ')}\n찬성: ${(e.pro || []).join(' / ')}\n반대: ${(e.con || []).join(' / ')}\n원문: ${(e.body || '').slice(0, 3500)}`;
}

export function countFillers(t) {
  const c = {};
  (t || '').split(/\s+/).forEach(x => {
    const y = x.replace(/[.,!?…]/g, '');
    if (FILLERS.includes(y)) c[y] = (c[y] || 0) + 1;
  });
  return c;
}

export function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}

export function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function scrollToEl(el) {
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
}

// Counts one use of a feature in the homepage's visitor statistics (GoatCounter); nothing about the visitor is sent.
export function track(name, title) {
  try { window.goatcounter?.count?.({ path: 'event/' + name, title: title || name, event: true }); } catch { /* counter blocked */ }
}

// A question that starts as an instruction ('…답변하고,') and ends as a question ('…줄이겠습니까?') reads
// awkwardly; it is turned into one instruction: '…밝히고, …줄일지 답변해보시오.'
const DIRECTIVE = /(답변|제시|설명|서술|논증)하고, /;
const withL = stem => {
  const last = stem.charCodeAt(stem.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return null;
  const jong = (last - 0xac00) % 28;
  if (jong === 0) return stem.slice(0, -1) + String.fromCharCode(last + 8) + '지'; // add ㄹ
  if (jong === 8) return stem + '지';
  return stem + '을지';
};
export function fixQuestion(q) {
  if (typeof q !== 'string' || !DIRECTIVE.test(q)) return q;
  const m = q.match(/^(.*?)(\S+?)겠습니까\?\s*$/s);
  if (!m) return q;
  const verb = withL(m[2]);
  if (!verb) return q;
  return (m[1] + verb).replace(/답변하고, /, '밝히고, ').replace(/(는|은) 어떻게 (\S+지)$/, (_, p, v) => (p === '는' ? '를' : '을') + ' 어떻게 ' + v) + ' 답변해보시오.';
}
