import { forwardRef, useState } from 'react';
import { LAW_GUIDE, QUESTION_CRAFT, LAW_TYPES, P_COUNTS, P_LENS, P_MODES, VALUE_THEMES } from '../lib/constants.js';
import { ask, markUnreadable } from '../lib/ai.js';
import { bankPassage } from '../lib/bank.js';
import { pad, parseJSON } from '../lib/util.js';
import { Rail } from './Chrome.jsx';

const LEN_GUIDE = { 짧게: '각 제시문 400자 내외', 보통: '각 제시문 650자 내외', 길게: '각 제시문 950자 내외' };

// What a real top-tier passage set looks like, so the model writes original material at that level
// instead of rephrasing library summaries.
const EXAM_LEVEL = `[출제 수준 기준 — 서울대·고려대 로스쿨 기출 수준]
- 제시문은 서재 요약을 옮긴 글이 아니라, 그 자체로 읽을 가치가 있는 독립된 글이어야 한다. 서재 자료는 소재와 쟁점을 고르는 데만 쓰고, 문장이나 요약을 그대로 가져오지 마라.
- 제시문마다 성격이 달라야 한다. 다음 중 서로 다른 종류를 조합한다.
  ① 이론·학술 제시문: 실제 사상가나 학설의 핵심 논리를 압축해 재구성한 글(예: 밀의 위해의 원칙, 롤스의 차등의 원칙, 노직의 소유권리론, 하버마스의 공론장, 푸코의 규율 권력, 벡의 위험사회, 샌델의 공동체주의). 사상가 이름은 실제 주장일 때만 붙이고, 개념을 정의한 뒤 그 개념에서 결론이 도출되는 논증 구조를 보여 준다.
  ② 사례 제시문: 등장인물(갑·을·병, A·B 등)과 그들의 지위·이해관계·수치·약속·행위가 구체적으로 주어진 가상 상황. 한 가지 정답이 없고 입장에 따라 판단이 갈리도록, 판단을 흔드는 사실(동의 여부, 정보 비대칭, 예상하지 못한 결과, 선한 의도와 나쁜 결과 등)을 넣는다.
  ③ 규범·자료 제시문: 'A국'의 가상 법률 조문이나 회사 내규(제1조 ①②…), 또는 설문·통계 표. 수험생은 법을 몰라도 제시된 조문만 읽고 적용할 수 있어야 한다. 실제 통계를 쓸 때는 확실한 것만 쓰고, 아니면 가상의 설문이라고 밝힌다.
  ④ 대립 논거 제시문: 하나의 쟁점에 대한 찬성 A·반대 B 입장의 논거를 번호를 붙여 5~7개 섞어 나열한 글(분류형 문항용).
- 제시문끼리는 서로를 비판하거나 적용할 수 있게 연결되어야 한다: 이론이 사례를 판단하는 기준이 되거나, 규범이 사례에 적용되거나, 한 제시문의 원리가 다른 제시문의 주장을 반박할 수 있어야 한다.
- 문체는 학술적이고 압축적으로 쓴다. 개념어를 쓰되 정의 없이 던지지 말고, 수험생이 읽고 따라올 수 있게 논증의 단계를 보여 준다.
[참고 구조 — 강원대 기출]
- 2025: <제시문1> 지분 40%·40%·5%를 가진 이사 갑·을·병, 갑이 외부 인재 P에게 대표이사직과 '원하는 대로 하게 해 주겠다'는 약속(어기면 10억 배상)을 하고 AI X를 이사로 선임하려는 계획, 을·병의 반대. <제시문2> A국 법과 회사 내규(권리 주체, 의결권 비례, 주총·이사회 의결 요건, 이사의 성실 의무와 배상 책임). <제시문3> 알파고와 이세돌의 대국으로 본 AI의 우수성과 '인간다움의 벽'. 문항: 약속의 정당성을 갑·P·을·병 각각의 입장에서 근거를 들어 설명 / 제시문2를 참고해 AI 이사 선임 가능 여부를 각 입장에서 서술 / 제시문2를 무시하고 AI 이사 선임의 합리성을 각 입장에서 서술. 추가질문: 법인처럼 AI에 관한 법이 생기면 이사가 될 수 있는가, 회사도 책임이 있지 않은가.
- 2024: <제시문1> 상위 1%가 부의 1/3을 차지하는 불평등에 대한 두 견해와 부자세 찬반 논증(재분배 효과 vs 근로 의욕·투자 위축·강제적 재산 박탈). <제시문2> A국의 개 식용 금지 법률(목적, 금지 조항, 벌칙). <제시문3> 개 식용에 대한 A·B 입장의 논거 7개(전통문화론, 일반적 행동자유권, 공중보건, 위생 규제로 충분, 국가의 보호 의무, 국가 관리 체계, 설문 결과). 문항: 두 제시문을 연결하는 제목 / 부자 증세와 기회 제공 중 더 바람직한 방법 / 제시문3의 논거를 지지·비지지로 분류. 추가질문: 기회 제공의 재원도 결국 부자의 세금 아닌가, 본인의 입장은.`;

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
  // Library topics only point the model at the issues; their text is kept short so it is not copied.
  const ctxs = list.map(e => `- ${e.title}: ${e.summary || ''}${(e.issues || []).length ? ' (쟁점: ' + e.issues.slice(0, 3).join(' / ') + ')' : ''}`).join('\n');
  const r = parseJSON(await ask(`한국 로스쿨 구술면접 제시문 문제를 만들어라.
${LAW_GUIDE}
${QUESTION_CRAFT}
${EXAM_LEVEL}
[출제 유형] ${LT.k}: ${LT.g}
[대주제] ${title}
이 대주제에서 서로 충돌하는 가치(예: 형평 vs 효율, 자유 vs 안전, 개인 vs 공동체, 약속의 구속력 vs 공정)를 하나 정하고, 그 충돌이 드러나도록 제시문 ${n}개((${labels.join('), (')}))를 ${LEN_GUIDE[len]}로 작성하라. 제시문 ${n}개 중 적어도 하나는 이론·학술 제시문, 하나는 구체적 사례 또는 규범·자료 제시문이어야 한다.
사실성: 실존하는 법령·결정·통계·학자·저서를 언급할 때는 실제로 있는 것만 쓰고, 확실하지 않은 수치·사건번호·인용문은 지어내지 마라. 가상의 사례·법조문·설문은 'A국', '갑', '가상의 설문' 등으로 실제와 구분되게 쓴다. 실제 기관·인물이 하지 않은 일을 했다고 쓰지 않는다.
문항: 출제 유형에 맞게 3~4개를 만든다. 한 문항은 제시문을 분류·요약·비교하게 하고, 한 문항은 한 제시문의 원리나 규범을 다른 제시문(사례)에 적용해 판단하게 하고, 한 문항은 이해관계가 다른 당사자 각각의 입장에서 근거를 들어 서술하게 하거나 두 해결책 중 하나를 골라 논증하게 한다. 단순히 '어떻게 생각하는가'만 묻지 마라. 문항은 '~하시오.'로 끝낸다.
추가질문(followups) 3개: 수험생의 예상 답변을 전제로 그 기준을 다른 사례에 적용했을 때의 모순, 재원·실현 가능성, 입장을 바꾸게 만드는 사실을 묻는다.
대주제와 관련된 서재 주제(소재와 쟁점 파악용 — 문장을 옮기지 말 것):
${ctxs || '(없음)'}
JSON 객체만 출력: {"title":"제시문 세트 제목","passages":[{"label":"가","source":"제시문 성격과 출처 형식(예: 롤스, 『정의론』 재구성 / 가상 사례 / A국 법률)","text":"본문(조문·논거 목록은 줄바꿈으로 구분)"}],"questions":["문항"],"followups":["추가질문"]}`));
  if (r && Array.isArray(r.passages) && r.passages.length) return { res: r, ai: true };
  return { ai: false };
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
  const [seen, setSeen] = useState([]);
  const [modelOpen, setModelOpen] = useState(null);

  const linked = linkedTopics(entries, mode, topicId, theme, custom);
  const linkedLabel = mode === '서재' ? '' : linked.list.length
    ? '연결된 서재 주제 ' + linked.list.length + '개: ' + linked.list.slice(0, 3).map(e => e.title).join(', ') + (linked.list.length > 3 ? ' 외' : '')
    : '연결된 서재 주제 없음 — AI가 일반 지식으로 작성합니다';

  const run = async () => {
    if (loading) return;
    if (!linked.title) { flash('주제를 입력하세요'); return; }
    setLoading(true); setOpen(false);
    let { res, ai } = await generate(linked, lawType, count, len);
    let meta = `${lawType} · ${count}개 · ${len}`;
    if (!ai) {
      // No Claude: serve a passage set written ahead of time for the closest topic.
      const words = mode === '직접' ? custom.split(/[\s,·와과및]+/).filter(w => w.length >= 2) : linked.list.flatMap(e => [e.title, ...(e.keywords || [])]);
      const b = await bankPassage({ mode, topicId, theme, words, related: linked.list.map(e => e.id) }, lawType, seen);
      if (!b) { markUnreadable(); setLoading(false); onFallback(); return; }
      res = b.res; setSeen(s => [...s, b.id]);
      meta = `${b.res.lawType || lawType} · 저장된 문제${b.exact ? '' : ' · 가장 가까운 주제'}`;
    }
    setResult({ ...res, meta }); setLoading(false); setModelOpen(null);
    // Let the closed arch paint once so the width/radius transition runs.
    setTimeout(() => setOpen(true), 40);
  };
  const close = () => { setOpen(false); setTimeout(() => setResult(null), 850); };

  const items = result ? [
    ...(result.questions || []).map((q, i) => ({ no: pad(i + 1), q, model: (result.models || [])[i] || '' })),
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
                      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <button className="btn-small" onClick={() => onPractice(x.q, result.passages.map(ps => `(${ps.label}) ${ps.text}`).join('\n\n'))}>연습 →</button>
                        {x.model && <span className="link" style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setModelOpen(modelOpen === i ? null : i)}>{modelOpen === i ? '접기' : '→ 모범답안'}</span>}
                      </span>
                      {x.model && modelOpen === i && <div className="p-model">{x.model}</div>}
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
