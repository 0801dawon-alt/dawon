// Questions, passage sets and model answers written ahead of time, so every feature works without AI.
// The files are loaded on first use to keep the main bundle small.
import { localUserBank, sharedUserBank } from './userBank.js';
import { fixQuestion, isProCon } from './util.js';

const FILES = import.meta.glob('../data/bank/*.js');

let bankPromise = null;
// Items viewers added are read again whenever they add more.
if (typeof window !== 'undefined') window.addEventListener('tl-userbank', () => { bankPromise = null; });
export function loadBank() {
  if (!bankPromise) {
    bankPromise = Promise.all([...Object.values(FILES).map(load => load().then(m => m.default || [], () => [])), Promise.resolve(localUserBank()), sharedUserBank()]).then(parts => {
      const qs = [], ps = [], models = new Map();
      parts.flat().forEach(x => {
        if (x.k === 'p') { if (!ps.some(p => p.id === x.id)) ps.push(x); }
        else if (x.q) { qs.push(x); if (x.m) models.set(norm(x.q), x.m); }
      });
      ps.forEach(p => (p.qs || []).forEach((q, i) => { if (p.ms && p.ms[i]) models.set(norm(q), p.ms[i]); }));
      return { qs, ps, models };
    });
  }
  return bankPromise;
}

const norm = s => (s || '').replace(/\s+/g, '');

export async function bankModel(q) {
  const b = await loadBank();
  return b.models.get(norm(q)) || '';
}

const shuffle = a => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

// Value-judgement subtopics whose own questions all count as 가치 판단형.
const VALUE_TOPIC = id => /^k(18[3-9]|19\d|20[0-3])$/.test(id);
const VALUE = '가치 판단형';
// The old 압박 level was folded into 심화.
const level = ty => (ty === '압박' ? '심화' : ty || '기본');

// Question direction from the wording: anything answerable 찬성/반대 is 찬반 입장형; the rest is
// 가치 판단형 unless it clearly asks for a remedy (해결책 제시형) or attacks a premise (전제 비판형).
// 역할 수행형 was folded into 가치 판단형.
const PROCON = '찬반 입장형', SOLVE = '해결책 제시형', PREMISE = '전제 비판형';
export function questionStyles(q, st = '', topicId = '') {
  const out = new Set();
  if (st === VALUE || st === '역할 수행형' || VALUE_TOPIC(topicId)) out.add(VALUE);
  if (isProCon(q)) { out.add(PROCON); return out; }
  if (st === SOLVE || st === PREMISE) out.add(st);
  else if (/전제|한계는|한계를|모순|반례/.test(q)) out.add(PREMISE);
  else if (/대안|해결책|방안|개선책|정책을 (제시|제안)|어떻게 (줄|막|해결|보완|개선)/.test(q)) out.add(SOLVE);
  out.add(VALUE);
  return out;
}

// Topic ids that have value-judgement questions ready, for narrowing the topic list.
export async function valueTopicIds(entries = []) {
  const b = await loadBank();
  return new Set([
    ...b.qs.filter(x => questionStyles(x.q, x.st, x.t).has(VALUE)).map(x => x.t),
    ...entries.filter(e => (e.questions || []).some(q => questionStyles(q, '', e.id).has(VALUE))).map(e => e.id),
  ]);
}

// Questions for a topic in the requested direction (only those), the requested level first,
// skipping ones already on screen.
export async function bankQuestions(entry, type, count, shown = [], style = '') {
  const b = await loadBank();
  const skip = new Set(shown.map(norm));
  const own = b.qs.filter(x => x.t === entry.id && !skip.has(norm(x.q)));
  const base = (entry.questions || []).filter(q => !skip.has(norm(q)) && !own.some(x => norm(x.q) === norm(q)))
    .map(q => ({ q, i: '서가 예상 질문', m: b.models.get(norm(q)) || '', st: '' }));
  const fits = x => !style || questionStyles(x.q, x.st, entry.id).has(style);
  const score = x => (level(x.ty) === type ? 1 : 0);
  const ranked = [...shuffle(own), ...shuffle(base)].filter(fits).map((x, n) => [x, score(x), n]).sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(([x]) => x);
  return ranked.slice(0, count).map(x => ({ q: fixQuestion(x.q), intent: x.i || '', model: x.m || '' }));
}

// The passage set closest to what was asked: same topic or theme first, then shared keywords.
// Passage length as the generator names it, from the average length of a set's passages.
export const passageLength = p => { const a = (p.ps || []).reduce((n, x) => n + (x.text || '').length, 0) / Math.max(1, (p.ps || []).length); return a < 320 ? '짧게' : a < 380 ? '보통' : '길게'; };

export async function bankPassage({ mode, topicId, theme, words, related }, lawType, seen = [], len = '') {
  const b = await loadBank();
  const rel = new Set(related || []);
  const score = p => {
    let s = 0;
    if (mode === '서재' && (p.t || []).includes(topicId)) s += 100;
    if (mode === '가치' && (p.th || []).includes(theme)) s += 100;
    s += (p.t || []).filter(id => rel.has(id)).length * 10;
    const hay = [p.title, ...(p.ps || []).map(x => x.text)].join(' ');
    s += (words || []).filter(w => w && hay.includes(w)).length * 3;
    if (p.lt === lawType) s += 20;
    if (len && passageLength(p) === len) s += 8;
    if (seen.includes(p.id)) s -= 50;
    return s + Math.random();
  };
  const best = b.ps.map(p => [p, score(p)]).sort((x, y) => y[1] - x[1])[0];
  if (!best || best[1] < 1) return null;
  const p = best[0];
  return { id: p.id, exact: best[1] >= 90, res: { title: p.title, passages: p.ps, questions: p.qs, followups: p.fu || [], models: p.ms || [], lawType: p.lt } };
}
