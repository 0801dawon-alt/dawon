// Questions, passage sets and model answers written ahead of time, so every feature works without AI.
// The files are loaded on first use to keep the main bundle small.
import { localUserBank, sharedUserBank } from './userBank.js';
import { fixQuestion, isProCon } from './util.js';
import STYLE_OF from '../data/question-styles.js';

const FILES = import.meta.glob('../data/bank/*.js');

let bankPromise = null;
// Items viewers added are read again whenever they add more.
if (typeof window !== 'undefined') window.addEventListener('tl-userbank', () => { bankPromise = null; });
export function loadBank() {
  if (!bankPromise) {
    bankPromise = Promise.all([...Object.values(FILES).map(load => load().then(m => m.default || [], () => [])), Promise.resolve(localUserBank()), sharedUserBank()]).then(parts => {
      const qs = [], ps = [], models = new Map(), answers = [];
      parts.flat().forEach(x => {
        if (x.k === 'a') answers.push(x);
        else if (x.k === 'p') { if (!ps.some(p => p.id === x.id)) ps.push(x); }
        else if (x.q) { qs.push(x); if (x.m) models.set(norm(x.q), x.m); }
      });
      ps.forEach(p => (p.qs || []).forEach((q, i) => { if (p.ms && p.ms[i]) models.set(norm(q), p.ms[i]); }));
      // Answers written later for bank questions, matched by topic and the question's opening words.
      answers.forEach(a => {
        const q = qs.find(x => x.t === a.t && !x.m && norm(x.q).startsWith(norm(a.h)));
        if (q) { q.m = a.m; models.set(norm(q.q), a.m); }
      });
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

// Question direction, judged from each question's content (question-styles.js). Questions written later
// and not yet judged fall back to their wording. 역할 수행형 and 전제 비판형 were folded into the others.
const PROCON = '찬반 입장형', SOLVE = '해결책 제시형';
const CODE = { c: PROCON, v: VALUE, s: SOLVE };
export function questionStyles(q, st = '', topicId = '', index = -1) {
  const out = new Set();
  if (st === VALUE || st === '역할 수행형' || st === '전제 비판형' || VALUE_TOPIC(topicId)) out.add(VALUE);
  const code = index >= 0 ? (STYLE_OF[topicId] || '')[index] : '';
  if (code) { out.add(CODE[code]); return out; }
  if (st === PROCON || st === SOLVE) { out.add(st); return out; }
  out.add(isProCon(q) ? PROCON : VALUE);
  return out;
}

// Topic ids that have value-judgement questions ready, for narrowing the topic list.
export async function valueTopicIds(entries = []) {
  const b = await loadBank();
  return new Set([
    ...b.qs.filter(x => questionStyles(x.q, x.st, x.t).has(VALUE)).map(x => x.t),
    ...entries.filter(e => (e.questions || []).some((q, i) => questionStyles(q, '', e.id, i).has(VALUE))).map(e => e.id),
  ]);
}

// Questions for a topic in the requested direction (only those), skipping ones already on screen.
// The 기본/심화 levels were merged into one.
export async function bankQuestions(entry, count, shown = [], style = '') {
  const b = await loadBank();
  const skip = new Set(shown.map(norm));
  const own = b.qs.filter(x => x.t === entry.id && !skip.has(norm(x.q)));
  const base = (entry.questions || []).filter(q => !skip.has(norm(q)) && !own.some(x => norm(x.q) === norm(q)))
    .map(q => ({ q, i: '서가 예상 질문', m: b.models.get(norm(q)) || '', st: '', n: (entry.questions || []).indexOf(q) }));
  const at = x => (x.n >= 0 ? x.n : (entry.questions || []).findIndex(q => norm(q) === norm(x.q)));
  const fits = x => !style || questionStyles(x.q, x.st, entry.id, at(x)).has(style);
  const ranked = [...shuffle(own), ...shuffle(base)].filter(fits);
  return ranked.slice(0, count).map(x => ({ q: fixQuestion(x.q), intent: x.i || '', model: x.m || '' }));
}

// Topic ids that have at least one stored passage set.
export async function passageTopicIds() {
  const b = await loadBank();
  return new Set(b.ps.flatMap(p => p.t || []));
}

// The passage set closest to what was asked: same topic or theme first, then shared keywords.
// Passage length as the generator names it, from the average length of a set's passages.
export const passageLength = p => { const a = (p.ps || []).reduce((n, x) => n + (x.text || '').length, 0) / Math.max(1, (p.ps || []).length); return a < 320 ? '짧게' : a < 380 ? '보통' : '길게'; };

export async function bankPassage({ mode, topicId, theme, words, related }, lawType, seen = [], len = '') {
  const b = await loadBank();
  const rel = new Set(related || []);
  // Only sets that are about the topic: the same topic or theme, a linked topic, or several of the
  // topic's own words in the passages. An unrelated set is never served as a stand-in.
  const relevance = p => {
    let s = 0;
    if (mode === '서재' && (p.t || []).includes(topicId)) s += 100;
    if (mode === '가치' && (p.th || []).includes(theme)) s += 100;
    s += (p.t || []).filter(id => rel.has(id)).length * 10;
    const hay = [p.title, ...(p.ps || []).map(x => x.text)].join(' ');
    s += (words || []).filter(w => w && hay.includes(w)).length * 3;
    return s;
  };
  const prefer = p => (p.lt === lawType ? 20 : 0) + (len && passageLength(p) === len ? 8 : 0) - (seen.includes(p.id) ? 50 : 0) + Math.random();
  const best = b.ps.map(p => [p, relevance(p)]).filter(([, r]) => r >= 9).map(([p, r]) => [p, r, r + prefer(p)]).sort((x, y) => y[2] - x[2])[0];
  if (!best) return null;
  const p = best[0];
  return { id: p.id, exact: best[1] >= 90, res: { title: p.title, passages: p.ps, questions: p.qs, followups: p.fu || [], models: p.ms || [], lawType: p.lt } };
}
