import { forwardRef, useState } from 'react';
import { LAW_GUIDE, QUESTION_CRAFT, Q_STYLES, Q_TYPES } from '../lib/constants.js';
import { ask, markUnreadable } from '../lib/ai.js';
import { bankQuestions } from '../lib/bank.js';
import { ctx, pad, parseJSON, uid } from '../lib/util.js';
import { Rail } from './Chrome.jsx';
import { ConfirmLink } from './Detail.jsx';

const TYPE_GUIDE = {
  기본: '찬반이 갈리는 지점을 짚어 지원자의 입장과 근거를 요구하는 질문',
  심화: '두 가치(예: 효율 vs 형평, 자유 vs 안전)가 충돌하는 딜레마를 제시하고 우선순위를 묻는 질문. 필요하면 관련 시사 상식(주요 사회 현상, 수치·연도, 해외 사례)을 맥락으로 제시하되 법률 지식은 묻지 말 것',
  압박: '지원자가 택할 법한 입장의 약점·반례·부작용을 찌르며 반박을 요구하는 질문. 필요하면 관련 통계나 현실 사례를 들이밀며 압박하되 법률 지식은 묻지 말 것',
};
const COUNTS = [[1, '1개'], [2, '2개'], [3, '3개'], [5, '5개']];

async function generate(e, qType, qStyle, qCount, shown) {
  const QS = Q_STYLES.find(x => x.k === qStyle) || Q_STYLES[0];
  const avoid = (e.questions || []).map((q, i) => (i + 1) + '. ' + q).join('\n');
  const r = parseJSON(await ask(`너는 한국 로스쿨 구술면접 면접위원이다.\n${LAW_GUIDE}\n${QUESTION_CRAFT}\n[질문 방향] ${QS.k}: ${QS.g}\n아래 주제로 ${TYPE_GUIDE[qType]} ${qCount}개를 만들어라.\n[필수 조건]\n- 실제 면접에 출제될 가능성이 높은, 찬반이 명확히 대립하거나 구체적 의견 제시를 요구하는 질문일 것.\n- 단순 지식 확인, 막연한 '어떻게 생각하나요?' 식 질문 금지. 구체적 정책·제도·사례·수치·판례 등 맥락을 1문장 제시한 뒤 질문할 것(전체 2~3문장 허용).\n- 맥락이 실제 정책·법안·판결·사건·통계라면 실제로 존재하거나 논의·보도된 것만 쓰고, 가능하면 연도나 주체를 밝힐 것. 특정 기관이 실제로 하지 않은 일을 했다고 쓰지 말 것.\n- 사례를 만들어 써도 되며 가상이라고 밝힐 필요는 없지만, 한국의 현실과 맞아떨어져야 한다(실제로 있을 법한 상황·수치·제도 범위). '가령', '예를 들어'로 시작하는 가정 서술은 꼭 필요할 때만 쓴다.\n- 현실에 맞는 맥락이 마땅치 않으면 사례를 길게 풀지 말고, 대립 지점이 분명한 질문을 짧고 명료하게 던질 것.\n- 질문은 반드시 '~입니까?', '~하겠습니까?', '~생각합니까?' 등 '까?'로 끝나거나 '~답변해보시오.', '~제시해보시오.'로 끝낼 것.\n- 아래 기존 예상 질문과 쟁점·표현이 겹치지 않을 것:\n${avoid || '(없음)'}\n각 질문마다 면접관의 의도를 한 문장으로. JSON 배열만 출력: [{"q":"질문","intent":"의도"}]\n\n${ctx(e)}`));
  const list = Array.isArray(r) ? r.filter(x => x && x.q) : null;
  if (list && list.length) return { list, ai: true };
  const fromBank = await bankQuestions(e, qType, qCount, shown);
  if (!fromBank.length) markUnreadable();
  return { list: fromBank, ai: false };
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

const Questions = forwardRef(function Questions({ entries, topicId, setTopicId, qList, setQList, myQuestions, saveMyQuestions, onPractice, onFallback }, ref) {
  const [qStyle, setQStyle] = useState(Q_STYLES[0].k);
  const [qType, setQType] = useState('기본');
  const [qCount, setQCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [modelOpen, setModelOpen] = useState(null);

  const run = async () => {
    const e = entries.find(x => x.id === topicId);
    if (!e || loading) return;
    setLoading(true);
    const { list, ai } = await generate(e, qType, qStyle, qCount, qList.map(x => x.q));
    setLoading(false);
    if (list.length) { setQList(list); setModelOpen(null); }
    if (!ai && !list.length) onFallback();
  };
  const addManual = () => {
    const q = manualText.trim(); if (!q) return;
    saveMyQuestions([{ id: uid(), q, date: new Date().toISOString() }, ...myQuestions]); setManualText('');
  };
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState('');
  const saveEdit = () => {
    const q = editText.trim(); if (!q) return;
    saveMyQuestions(myQuestions.map(x => (x.id === editId ? { ...x, q } : x))); setEditId(null);
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
          {qList.length === 0 && myQuestions.length === 0 && (
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
                {x.model && <span className="link" style={{ fontSize: 12, color: 'var(--muted-2)', alignSelf: 'flex-start' }} onClick={() => setModelOpen(modelOpen === i ? null : i)}>{modelOpen === i ? '모범답안 접기' : '→ 모범답안'}</span>}
                {x.model && modelOpen === i && <div className="q-model">{x.model}</div>}
              </div>
              <button className="btn-practice-dark" onClick={() => onPractice(x.q)}>연습 →</button>
            </div>
          ))}
          {myQuestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: qList.length ? 28 : 0 }}>
              <span style={{ ...sub, paddingBottom: 6 }}>내가 입력한 질문 · {myQuestions.length}</span>
              {myQuestions.map((x, i) => (
                <div key={x.id} className="q-item">
                  <span className="mono" style={{ fontSize: 12, color: '#c9a3a0', paddingTop: 4 }}>{pad(i + 1)}</span>
                  {editId === x.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea className="manual-input" rows={3} value={editText} onChange={ev => setEditText(ev.target.value)} style={{ resize: 'vertical', lineHeight: 1.6 }} autoFocus />
                      <div style={{ display: 'flex', gap: 14, fontSize: 12.5 }}>
                        <span className="link" onClick={saveEdit}>저장</span>
                        <span className="link" style={{ color: 'var(--muted-2)' }} onClick={() => setEditId(null)}>취소</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="q-item-q">{x.q}</div>
                      <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: 'var(--muted-2)' }}>
                        <span className="link" onClick={() => { setEditId(x.id); setEditText(x.q); }}>수정</span>
                        <ConfirmLink label="삭제" armedLabel="한 번 더 누르면 삭제" onConfirm={() => saveMyQuestions(myQuestions.filter(y => y.id !== x.id))} />
                      </div>
                    </div>
                  )}
                  <button className="btn-practice-dark" onClick={() => onPractice(x.q)}>연습 →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

export default Questions;
