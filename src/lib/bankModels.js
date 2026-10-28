import { SEED_TOPICS } from './store.js';

const BY_ID = new Map(SEED_TOPICS.map(t => [t.id, t]));
const flat = s => (s || '').replace(/\s+/g, '');

// Model answers for a subtopic's own expected questions, listed in question order as [opening words, answer],
// starting at question `from`. An answer is dropped if its question has since been rewritten, so it never sits
// under the wrong question.
export const M = (id, list, from = 0) => list.map(([head, m], i) => {
  const q = ((BY_ID.get(id) || {}).questions || [])[from + i];
  return q && flat(q).startsWith(flat(head)) ? { k: 'q', t: id, ty: '기본', q, i: '서재 예상 질문', m } : null;
}).filter(Boolean);
