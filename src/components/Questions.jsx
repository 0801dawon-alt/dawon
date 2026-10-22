import { forwardRef, useState } from 'react';
import { LAW_GUIDE, Q_STYLES, Q_TYPES } from '../lib/constants.js';
import { ask } from '../lib/ai.js';
import { ctx, pad, parseJSON } from '../lib/util.js';
import { Rail } from './Chrome.jsx';

const TYPE_GUIDE = {
  기본: '찬반이 갈리는 지점을 짚어 지원자의 입장과 근거를 요구하는 질문',
  심화: '두 가치(예: 효율 vs 형평, 자유 vs 안전)가 충돌하는 딜레마를 제시하고 우선순위를 묻는 질문. 일부는 관련 상식(제도·법률의 정확한 명칭, 핵심 개념의 정의, 주요 수치·연도, 해외 사례)을 먼저 확인한 뒤 그 지식을 근거로 판단을 요구할 것',
  압박: '지원자가 택할 법한 입장의 약점·반례·부작용을 찌르며 반박을 요구하는 질문. 필요하면 지원자가 알고 있어야 할 기본 상식(관련 통계, 제도 내용)을 확인하며 압박할 것',
};
const COUNTS = [[1, '1개'], [2, '2개'], [3, '3개'], [5, '5개']];

async function generate(e, qType, qStyle, qCount) {
  const QS = Q_STYLES.find(x => x.k === qStyle) || Q_STYLES[0];
  const avoid = (e.questions || []).map((q, i) => (i + 1) + '. ' + q).join('\n');
  const r = parseJSON(await ask(`너는 한국 로스쿨 구술면접 면접위원이다.\n${LAW_GUIDE}\n[질문 방향] ${QS.k}: ${QS.g}\n아래 주제로 ${TYPE_GUIDE[qType]} ${qCount}개를 만들어라.\n[필수 조건]\n- 실제 면접에 출제될 가능성이 높은, 찬반이 명확히 대립하거나 구체적 의견 제시를 요구하는 질문일 것.\n- 단순 지식 확인, 막연한 '어떻게 생각하나요?' 식 질문 금지. 구체적 정책·제도·사례·수치·판례 등 맥락을 1문장 제시한 뒤 질문할 것(전체 2~3문장 허용).\n- 질문에 넣는 맥락(정책·법안·제도·판결·사건·통계)은 실제로 존재하거나 실제로 논의·보도된 것만 쓸 것. 가능하면 연도나 주체(정부·국회·정당·법원·지자체)를 밝히고, 확실하지 않은 사실·수치·사례는 지어내지 말 것. 실제 사례가 떠오르지 않으면 '~라는 주장이 있다'처럼 일반화하거나, 가정이 필요하면 '가령 ~한다면'처럼 가정임을 분명히 밝힐 것.\n- 질문은 반드시 '~입니까?', '~하겠습니까?', '~생각합니까?' 등 '까?'로 끝나거나 '~답변해보시오.', '~제시해보시오.'로 끝낼 것.\n- 아래 기존 예상 질문과 쟁점·표현이 겹치지 않을 것:\n${avoid || '(없음)'}\n각 질문마다 면접관의 의도를 한 문장으로. JSON 배열만 출력: [{"q":"질문","intent":"의도"}]\n\n${ctx(e)}`));
  const list = Array.isArray(r) ? r.filter(x => x && x.q) : null;
  if (list && list.length) return { list, ai: true };
  const t = e.title, iss = e.issues || [];
  const base = [
    ...iss.map(x => `'${x.replace(/[?]$/, '')}'라는 쟁점에 대해 찬성과 반대 중 한쪽 입장을 택하고, 반대 측의 가장 강력한 논거를 반박해보시오.`),
    `${t} 문제에서 효율성과 형평성이 충돌한다면 어느 가치를 우선하겠습니까? 구체적 정책 사례를 들어 답변해보시오.`,
    `${t}에 대해 본인이 제시한 해결책이 가져올 수 있는 가장 큰 부작용은 무엇이며, 이를 어떻게 보완하겠습니까?`,
    `${t}와 관련해 정부, 기업, 개인 중 가장 큰 책임을 져야 할 주체는 누구라고 생각합니까?`,
  ];
  return { list: base.slice(0, qCount).map(q => ({ q, intent: '쟁점 기반 기본 질문 (AI 미연결 시)' })), ai: false };
}

function DarkChips({ options, value, onChange }) {
  return (
    <div className="chip-row">
      {options.map(([v, l]) => (
        <button key={l} className="chip dark" onClick={() => onChange(v)}
          style={v === value ? { background: 'var(--cream)', color: 'var(--ink)' } : undefined}>{l}</button>
      ))}
    </div>
  );
}

const Questions = forwardRef(function Questions({ entries, topicId, setTopicId, qList, setQList, onPractice, onFallback }, ref) {
  const [qStyle, setQStyle] = useState(Q_STYLES[0].k);
  const [qType, setQType] = useState('기본');
  const [qCount, setQCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');

  const run = async () => {
    const e = entries.find(x => x.id === topicId);
    if (!e || loading) return;
    setLoading(true);
    const { list, ai } = await generate(e, qType, qStyle, qCount);
    setQList(list); setLoading(false);
    if (!ai) onFallback();
  };
  const addManual = () => {
    const q = manualText.trim(); if (!q) return;
    setQList([...qList, { q, intent: '직접 입력한 질문' }]); setManualText('');
  };
  const sub = { fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted-2)' };

  return (
    <section ref={ref} className="section sec-dark">
      <Rail no="02" label="QUESTIONS" numColor="#4a4845" lineColor="#f3f1e8" />
      <div className="q-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div className="title-block">
            <h2 className="h2" data-reveal="1">예상 질문 만들기.</h2>
            <div className="accent-bar" />
            <p className="lede" style={{ color: 'var(--muted-3)' }}>서재의 주제를 바탕으로 면접관이 던질 법한 질문을 만듭니다.</p>
          </div>
          <label className="field-label" style={{ color: 'var(--muted-2)' }}>주제
            <select className="select-dark" value={topicId} onChange={ev => setTopicId(ev.target.value)}>
              {entries.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={sub}>질문 방향</span>
            <DarkChips options={Q_STYLES.map(t => [t.k, t.k])} value={qStyle} onChange={setQStyle} />
            <span style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--muted-3)' }}>{(Q_STYLES.find(x => x.k === qStyle) || Q_STYLES[0]).d}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={sub}>유형</span>
            <DarkChips options={Q_TYPES.map(t => [t, t])} value={qType} onChange={setQType} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={sub}>개수</span>
            <DarkChips options={COUNTS} value={qCount} onChange={setQCount} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn-accent" onClick={run}>{loading ? '생성 중…' : '질문 생성'} →</button>
              <button className="btn-manual" onClick={() => setManualOpen(!manualOpen)}>질문 직접 입력</button>
            </div>
            {manualOpen && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <input className="manual-input" value={manualText} onChange={ev => setManualText(ev.target.value)}
                  onKeyDown={ev => { if (ev.key === 'Enter' && !ev.nativeEvent.isComposing) addManual(); }}
                  placeholder="연습하고 싶은 질문을 직접 적어주세요" />
                <button className="manual-add" onClick={addManual}>추가</button>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {qList.length === 0 && (
            <div className="q-empty">
              <div className="q-empty-arch" />
              <span style={{ maxWidth: 300, wordBreak: 'keep-all' }}>생성된 질문이 여기에 쌓입니다. 질문 옆의 ‘연습’을 누르면 아래 타이머로 바로 넘어갑니다.</span>
            </div>
          )}
          {qList.map((x, i) => (
            <div key={i} className="q-item">
              <span className="mono" style={{ fontSize: 12, color: 'var(--muted-2)', paddingTop: 4 }}>{pad(i + 1)}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="q-item-q">{x.q}</div>
                <div className="q-item-intent">{x.intent || ''}</div>
              </div>
              <button className="btn-practice-dark" onClick={() => onPractice(x.q)}>연습 →</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export default Questions;
