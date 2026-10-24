// Questions, passage sets and model answers written ahead of time, so every feature works without AI.
// The files are loaded on first use to keep the main bundle small.
const FILES = import.meta.glob('../data/bank/*.js');

let bankPromise = null;
export function loadBank() {
  if (!bankPromise) {
    bankPromise = Promise.all(Object.values(FILES).map(load => load().then(m => m.default || [], () => []))).then(parts => {
      const qs = [], ps = [], models = new Map();
      parts.flat().forEach(x => {
        if (x.k === 'p') ps.push(x);
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

// Questions for a topic, preferring the requested type and skipping ones already on screen.
export async function bankQuestions(entry, type, count, shown = []) {
  const b = await loadBank();
  const skip = new Set(shown.map(norm));
  const own = b.qs.filter(x => x.t === entry.id && !skip.has(norm(x.q)));
  const same = shuffle(own.filter(x => x.ty === type)), rest = shuffle(own.filter(x => x.ty !== type));
  const base = (entry.questions || []).filter(q => !skip.has(norm(q)) && !own.some(x => norm(x.q) === norm(q)))
    .map(q => ({ q, i: '서재 예상 질문', m: b.models.get(norm(q)) || '' }));
  return [...same, ...rest, ...shuffle(base)].slice(0, count).map(x => ({ q: x.q, intent: x.i || '', model: x.m || '' }));
}

// The passage set closest to what was asked: same topic or theme first, then shared keywords.
export async function bankPassage({ mode, topicId, theme, words, related }, lawType, seen = []) {
  const b = await loadBank();
  const rel = new Set(related || []);
  const score = p => {
    let s = 0;
    if (mode === '서재' && (p.t || []).includes(topicId)) s += 100;
    if (mode === '가치' && (p.th || []).includes(theme)) s += 100;
    s += (p.t || []).filter(id => rel.has(id)).length * 10;
    const hay = [p.title, ...(p.ps || []).map(x => x.text)].join(' ');
    s += (words || []).filter(w => w && hay.includes(w)).length * 3;
    if (p.lt === lawType) s += 5;
    if (seen.includes(p.id)) s -= 50;
    return s + Math.random();
  };
  const best = b.ps.map(p => [p, score(p)]).sort((x, y) => y[1] - x[1])[0];
  if (!best || best[1] < 1) return null;
  const p = best[0];
  return { id: p.id, exact: best[1] >= 90, res: { title: p.title, passages: p.ps, questions: p.qs, followups: p.fu || [], models: p.ms || [], lawType: p.lt } };
}
