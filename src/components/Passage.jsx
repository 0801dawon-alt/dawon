import { forwardRef, useState } from 'react';
import { LAW_GUIDE, LAW_TYPES, P_COUNTS, P_LENS, P_MODES, VALUE_THEMES } from '../lib/constants.js';
import { ask } from '../lib/ai.js';
import { ctx, pad, parseJSON } from '../lib/util.js';
import { Rail } from './Chrome.jsx';

const LEN_GUIDE = { 짧게: '각 제시문 250자 내외', 보통: '각 제시문 450자 내외', 길게: '각 제시문 700자 내외' };
const FORMAT_GUIDE = '서로 다른 관점(찬성·반대·절충 등)을 담은';

// Library topics to feed the prompt: the chosen topic, or up to six keyword matches for a value theme / free input.
function linkedTopics(entries, mode, topicId, theme, custom) {
  if (mode === '서재') {
    const e = entries.find(x => x.id === topicId) || entries[0];
    return { title: e ? e.title : '', list: e ? [e] : [] };
  }
  const words = mode === '가치'
    ? (VALUE_THEMES.find(v => v.t === theme) || VALUE_THEMES[0]).k
    : custom.split(/[\s,·와과및]+/).filter(w => w.length >= 2);
  const title = mode === '가치' ? theme : custom.trim();
  const score = e => { const hay = [e.title, e.summary, ...(e.tags || []), ...(e.keywords || [])].join(' '); return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0); };
  return { title, list: entries.map(e => [e, score(e)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]) };
}

async function generate({ title, list }, lawType, n, len) {
  const labels = ['가', '나', '다', '라'].slice(0, n);
  const LT = LAW_TYPES.find(x => x.k === lawType) || LAW_TYPES[0];
  const ctxs = list.map(e => ctx(e).slice(0, 900)).join('\n---\n');
  const r = parseJSON(await ask(`한국 로스쿨 구술면접 제시문 문제를 만들어라.
${LAW_GUIDE}
[출제 유형] ${LT.k}: ${LT.g}
[대주제] ${title}
이 대주제는 개별 이슈가 아니라 가치 차원의 주제다. 서로 다른 가치(예: 형평 vs 효율, 자유 vs 안전, 개인 vs 공동체)가 드러나도록, 실제 로스쿨 기출 수준보다 '조금 어렵게'(학술적 어휘, 개념어, 압축된 논증, 함축적 문장) 작성하라. 근거는 최대한 사실에 기반할 것: 실존하는 법령·헌법재판소/대법원 결정·공식 통계(통계청, OECD 등)·학자와 저서만 인용하고, 확실하지 않은 수치나 사건번호는 지어내지 말고 '약 ~', '~로 알려져 있다'로 표현하거나 생략하라. 출처 표기도 실제 존재하는 형식으로 쓰고, 가상 사례는 반드시 '가상 사례'라고 명시하라. ${FORMAT_GUIDE} 제시문 ${n}개((${labels.join('), (')}))를 ${LEN_GUIDE[len]}로 작성하라. 제시문끼리 관점이 겹치지 않게 하고, 가능하면 철학·사회과학 개념이나 고전적 논의 하나를 포함하라.
이어서 출제 유형에 맞는 문항 3~4개를 '요약·비교 → 평가 → 적용/대안' 순으로 만들고, 예상 꼬리질문 3개를 followups에 넣어라. 문항은 '~하시오.' 또는 '~인가?'로 끝낼 것.
참고 자료(서재):
${ctxs || '(없음)'}
JSON 객체만 출력: {"title":"제시문 세트 제목","passages":[{"label":"가","source":"출처 형식(예: ○○일보 칼럼 재구성)","text":"본문"}],"questions":["문항"],"followups":["꼬리질문"]}`));
  if (r && Array.isArray(r.passages) && r.passages.length) return { res: r, ai: true };
  const pool = list.flatMap(e => [...(e.pro || []).map(x => [e, x]), ...(e.con || []).map(x => [e, x])]);
  const passages = labels.map((label, i) => {
    const e = list[i % Math.max(1, list.length)];
    const bits = pool.filter((p, j) => j % n === i).map(p => p[1]);
    return { label, source: e ? `서재 자료 재구성 · ${e.title}` : '서재 자료 재구성', text: [e && e.summary, e && e.background, ...bits].filter(Boolean).join(' ') || '관련 자료가 부족합니다. 서재에 항목을 추가해보세요.' };
  });
  return {
    ai: false,
    res: {
      title, passages,
      questions: [
        `제시문 (${labels.join('), (')})의 핵심 주장을 각각 요약하고 공통점과 차이점을 비교하시오.`,
        '제시문 중 가장 설득력 있는 입장을 하나 고르고, 나머지 제시문의 관점에서 제기될 반론을 재반박하시오.',
        `‘${title}’과 관련된 최근 한국 사회의 사례 하나를 들어, 제시문의 관점을 적용해 해결 방안을 제시하시오.`,
      ],
    },
  };
}

function BoxRow({ label, options, value, onChange }) {
  return (
    <div className="box-row">
      <span className="box-label">{label}</span>
      {options.map(([v, l]) => <button key={l} className={'box' + (v === value ? ' on' : '')} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

const Passage = forwardRef(function Passage({ entries, topicId, setTopicId, onPractice, onFallback, flash }, ref) {
  const [lawType, setLawType] = useState(LAW_TYPES[0].k);
  const [mode, setMode] = useState('서재');
  const [theme, setTheme] = useState(VALUE_THEMES[0].t);
  const [custom, setCustom] = useState('');
  const [count, setCount] = useState(3);
  const [len, setLen] = useState('보통');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const linked = linkedTopics(entries, mode, topicId, theme, custom);
  const linkedLabel = mode === '서재' ? '' : linked.list.length
    ? '연결된 서재 주제 ' + linked.list.length + '개: ' + linked.list.slice(0, 3).map(e => e.title).join(', ') + (linked.list.length > 3 ? ' 외' : '')
    : '연결된 서재 주제 없음 — AI가 일반 지식으로 작성합니다';

  const run = async () => {
    if (loading) return;
    if (!linked.title) { flash('주제를 입력하세요'); return; }
    setLoading(true); setOpen(false);
    const { res, ai } = await generate(linked, lawType, count, len);
    setResult({ ...res, meta: `${lawType} · ${count}개 · ${len}` }); setLoading(false);
    // Let the closed arch paint once so the width/radius transition runs.
    setTimeout(() => setOpen(true), 40);
    if (!ai) onFallback();
  };
  const close = () => { setOpen(false); setTimeout(() => setResult(null), 850); };

  const items = result ? [
    ...(result.questions || []).map((q, i) => ({ no: pad(i + 1), q })),
    ...(result.followups || []).map((q, i) => ({ no: '추가질문 ' + (i + 1), q })),
  ] : [];
  const showEmpty = !result || (!open && loading);

  return (
    <section ref={ref} className="section sec-passage">
      <Rail no="03" label="PASSAGE" numColor="#b5b2ac" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="title-block" style={{ maxWidth: 440 }}>
            <h2 className="h2" data-reveal="1">제시문 만들기.</h2>
            <div className="accent-bar" />
            <p className="lede" style={{ color: 'var(--body)' }}>제시문 기반 면접처럼 읽을거리와 문항을 함께 구성합니다.</p>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,360px),1fr))', gap: 'clamp(28px,4vw,56px)', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
            <BoxRow label="출제 유형" options={LAW_TYPES.map(t => [t.k, t.k])} value={lawType} onChange={setLawType} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, marginTop: -6 }}>
              <BoxRow label="주제" options={P_MODES} value={mode} onChange={setMode} />
              {mode === '서재' && (
                <select className="underline-field" value={topicId} onChange={ev => setTopicId(ev.target.value)}>
                  {entries.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              )}
              {mode === '가치' && (
                <select className="underline-field" value={theme} onChange={ev => setTheme(ev.target.value)}>
                  {VALUE_THEMES.map(v => <option key={v.t} value={v.t}>{v.t}</option>)}
                </select>
              )}
              {mode === '직접' && (
                <input className="underline-field" value={custom} onChange={ev => setCustom(ev.target.value)} placeholder="예: 자유와 안전의 충돌, 공정과 효율" />
              )}
              <span style={{ fontSize: 11.5, color: '#8a8780' }}>{linkedLabel}</span>
            </div>
            <button className="btn-accent" style={{ marginTop: -6, alignSelf: 'flex-start' }} onClick={run}>{loading ? '생성 중…' : '제시문 생성'} →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, minWidth: 0 }}>
            <BoxRow label="제시문 수" options={P_COUNTS} value={count} onChange={setCount} />
            <BoxRow label="분량" options={P_LENS.map(t => [t, t])} value={len} onChange={setLen} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <div className="arch" style={{ width: open ? 880 : 350, minHeight: open ? 600 : 440, borderRadius: '9999px 9999px 0 0', boxShadow: open ? '0 40px 80px -40px rgba(0,0,0,0.28)' : 'none' }}>
            {showEmpty && (
              <div className="arch-empty">
                <div style={{ fontFamily: 'var(--serif)', fontSize: 19 }}>{loading ? '제시문을 쓰는 중…' : '아직 제시문이 없습니다'}</div>
                <div style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{loading ? '잠시만 기다려주세요' : '주제와 형식을 고르고\n‘제시문 생성’을 누르세요.'}</div>
              </div>
            )}
            {result && !loading && (
              <article className="arch-body" style={{ opacity: open ? 1 : 0, transform: `translateY(${open ? 0 : 16}px)` }}>
                <div className="arch-title">
                  <span className="mono" style={{ fontSize: 10.5, letterSpacing: '0.18em', color: 'var(--muted)' }}>제시문 면접 · {result.meta}</span>
                  <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 'clamp(20px,2.4vw,26px)', letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>{result.title}</h3>
                </div>
                {result.passages.map((ps, i) => (
                  <div key={i} className="passage">
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className="passage-label">{ps.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{ps.source || ''}</span>
                    </div>
                    <p className="passage-text">{ps.text}</p>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid var(--ink)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="label" style={{ color: 'var(--muted)' }}>문항</div>
                  {items.map((x, i) => (
                    <div key={i} className="pq">
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 13, whiteSpace: 'nowrap', paddingTop: 2 }}>{x.no}</span>
                      <span style={{ fontSize: 15, lineHeight: 1.7, wordBreak: 'keep-all' }}>{x.q}</span>
                      <button className="btn-small" onClick={() => onPractice(x.q)}>연습 →</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span className="link" onClick={close} style={{ fontSize: 12.5, color: 'var(--muted)' }}>접기</span>
                </div>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

export default Passage;
