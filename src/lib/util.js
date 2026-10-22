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
