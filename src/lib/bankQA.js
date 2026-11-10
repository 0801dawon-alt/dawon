// Bank questions written together with their model answers: QA(topic, { c: [[question, answer], ...], v: [...], s: [...] }).
// c = 찬반 입장형, v = 가치 판단형, s = 해결책 제시형. No imports, so bank-check can load these files directly.
const ST = { c: '찬반 입장형', v: '가치 판단형', s: '해결책 제시형' };
export const QA = (t, sets) => Object.entries(sets).flatMap(([k, list]) =>
  list.map(([q, m]) => ({ k: 'q', t, st: ST[k], q, i: '서가 예상 질문 · ' + ST[k], m })));
