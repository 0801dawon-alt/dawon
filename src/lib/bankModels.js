import { SEED_TOPICS } from './store.js';

const BY_ID = new Map(SEED_TOPICS.map(t => [t.id, t]));
const flat = s => (s || '').replace(/\s+/g, '');

// Model answers for a subtopic's own expected questions, listed in question order as [opening words, answer],
// starting at question `from` (a question may carry added background before or after its original words). An answer is dropped if its question has since been rewritten, so it never sits
// under the wrong question.
export const M = (id, list, from = 0) => list.map(([head, m], i) => {
  const q = ((BY_ID.get(id) || {}).questions || [])[from + i];
  return q && flat(q).includes(flat(head)) ? { k: 'q', t: id, ty: '기본', q, i: '서가 예상 질문', m } : null;
}).filter(Boolean);

// Model answers for questions already in the bank (s-*.js), as [opening words, answer] for topic `t`.
// They attach to the first unanswered bank question of that topic that starts with those words.
export const A = (t, list) => list.map(([h, m]) => ({ k: 'a', t, h, m }));
