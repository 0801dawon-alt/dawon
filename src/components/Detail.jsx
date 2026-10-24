import { useEffect, useRef, useState } from 'react';
import { NEUTRAL, tagLinks } from '../lib/constants.js';
import { pad } from '../lib/util.js';
import CASES from '../data/cases.js';
import TAGFIX from '../data/tagfix.js';
import PROCON from '../data/procon.js';
import { ask, hasApiKey, inArtifact, lastAiIssue } from '../lib/ai.js';
import { LAW_GUIDE } from '../lib/constants.js';
import { ctx } from '../lib/util.js';

// Two minutes of speech is about 600 characters (spaces excluded).
const MODEL_CHARS = 600;
async function writeModelAnswer(entry, q) {
  const text = await ask(`너는 한국 로스쿨 구술면접을 준비하는 지원자의 코치다.\n${LAW_GUIDE}\n아래 질문에 대한 모범답안을 실제로 말하는 문장으로 써라.
- 분량: 말할 때 약 2분, 공백 제외 약 ${MODEL_CHARS}자.
- 구조: 결론(입장) → 근거 2~3개 → 반대 입장을 짚고 재반박 → 마무리(대안 또는 정리).
- 법률 지식(조문·판례·법리)에 기대지 말고, 상식 수준의 사례와 논리로 설득할 것. 지어낸 통계나 수치는 쓰지 말 것.
- 제목이나 머리말 없이 답안 본문만 출력.
[질문] ${q}
[주제 자료]
${ctx(entry)}`);
  return text ? text.trim() : null;
}

const NO_AI_MODEL = '이 홈페이지는 AI가 연결되어 있지 않아 모범답안을 새로 쓸 수 없어요. Claude 링크에서 이 질문의 ‘→ 모범답안’을 한 번 열어 두면, 그다음부터 ‘녹음되는 홈페이지 열기’로 넘어올 때 여기에도 그대로 보여요.';

function useModelAnswer({ entry, q, onSave }) {
  const saved = (entry.models || {})[q] || '';
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (saved || loading) return;
    // The homepage has no AI of its own; answers written on the claude.ai page come over with the records.
    if (!inArtifact() && !hasApiKey()) { setErr(NO_AI_MODEL); return; }
    setLoading(true); setErr('');
    const t = await writeModelAnswer(entry, q);
    setLoading(false);
    if (t) onSave(q, t); else setErr(lastAiIssue() || '모범답안을 만들지 못했어요. 다시 눌러 주세요.');
  };
  return { toggle, open, panel: open && (
    <div style={{ background: '#efede6', padding: '14px 16px', fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.9, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>
      <div style={{ fontFamily: 'var(--sans)', fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)', marginBottom: 6 }}>모범답안 · 약 2분 분량</div>
      {loading ? '모범답안을 쓰는 중…' : (saved || err)}
    </div>
  ) };
}

function QuestionRow({ entry, q, onPractice, onSaveModel }) {
  const m = useModelAnswer({ entry, q, onSave: onSaveModel });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start' }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7 }}>{q}</span>
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 4, flexShrink: 0 }}>
          <span className="link" onClick={() => onPractice(q)} style={{ fontSize: 12, whiteSpace: 'nowrap' }}>연습 →</span>
          <span className="link" onClick={m.toggle} style={{ fontSize: 12, whiteSpace: 'nowrap', color: 'var(--muted)' }}>{m.open ? '모범답안 접기' : '→ 모범답안'}</span>
        </span>
      </div>
      {m.panel}
    </div>
  );
}

// Article clippings: one slot per article, split by a rule, each with its source and text.
function Scraps({ items, onChange }) {
  // The empty slot shown before anything is saved keeps one id, so typing into it doesn't remount it.
  const blank = useRef('c' + Date.now().toString(36));
  const list = items.length ? items : [{ id: blank.current, source: '', text: '', blank: true }];
  const change = (id, patch) => onChange(list.map(({ blank, ...x }) => (x.id === id ? { ...x, ...patch } : x)));
  const add = () => onChange([...items.filter(x => x.source || x.text), { id: 'c' + Date.now().toString(36), source: '', text: '' }]);
  const remove = id => onChange(items.filter(x => x.id !== id));
  return (
    <div className="scraps">
      <div className="scraps-head"><span>기사 스크랩</span><span style={{ fontWeight: 400 }}>기사마다 한 칸씩 붙여 넣으세요</span></div>
      {list.map((x, i) => (
        <div key={x.id} className="scrap">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
            <input className="scrap-source" value={x.source} onChange={ev => change(x.id, { source: ev.target.value })} placeholder="출처 · 기사 제목이나 링크" />
            {!x.blank && <span className="link" style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => remove(x.id)}>삭제</span>}
          </div>
          <textarea className="scrap-text" rows={3} value={x.text} onChange={ev => change(x.id, { text: ev.target.value })} placeholder="기사에서 옮겨 둘 내용을 붙여 넣으세요." />
        </div>
      ))}
      <button className="scrap-add" onClick={add}>+ 스크랩 칸 추가</button>
    </div>
  );
}

// The user's Notion notes, grouped by topic id. Loaded on first use to keep the main bundle small.
let notesByTopic = null;
// The notes file is private: it is kept out of the public repository, so the homepage build has none.
const NOTE_FILES = import.meta.glob('../data/notion-notes.json');
const loadNotes = () => {
  if (notesByTopic) return Promise.resolve(notesByTopic);
  const load = Object.values(NOTE_FILES)[0];
  return (load ? load() : Promise.resolve({ default: [] })).then(m => {
    notesByTopic = {};
    (m.default || m).forEach(n => n.topics.forEach(id => { (notesByTopic[id] = notesByTopic[id] || []).push(n); }));
    return notesByTopic;
  }, () => (notesByTopic = {}));
};

function NotionNotes({ topicId }) {
  const [notes, setNotes] = useState(notesByTopic ? notesByTopic[topicId] || [] : null);
  const [open, setOpen] = useState(null);
  useEffect(() => { let on = true; setOpen(null); loadNotes().then(m => { if (on) setNotes(m[topicId] || []); }); return () => { on = false; }; }, [topicId]);
  if (!notes || !notes.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ ...sectionLabel, marginBottom: 6 }}>노션 정리 · {notes.length}</div>
      {notes.map(n => (
        <div key={n.id} className="note-item">
          <button className="note-head" onClick={() => setOpen(open === n.id ? null : n.id)}>
            <span style={{ fontWeight: 600, fontSize: 15, textAlign: 'left', wordBreak: 'keep-all' }}>{n.title}</span>
            <span style={{ fontSize: 11.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{n.page} {open === n.id ? '−' : '+'}</span>
          </button>
          {open === n.id && <div className="note-text">{n.text}</div>}
        </div>
      ))}
    </div>
  );
}

// One reason per row; wrapped lines start under the text, not under the check mark.
function Reasons({ items, dark }) {
  return items.map((x, i) => (
    <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', fontSize: 14, lineHeight: 1.7 }}>
      <span style={{ color: dark ? '#c9c6bf' : 'var(--accent)' }}>✓</span><span style={{ wordBreak: 'keep-all' }}>{x}</span>
    </div>
  ));
}

const sectionLabel = { fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)' };

// confirm() is unavailable inside an artifact frame, so deletion asks for a second click.
export function ConfirmLink({ label, armedLabel, onConfirm, style }) {
  const [armed, setArmed] = useState(false);
  return <span className="link" style={style} onClick={() => (armed ? onConfirm() : setArmed(true))} onMouseLeave={() => setArmed(false)}>{armed ? armedLabel : label}</span>;
}

export function DetailPanel({ entry: od, restructuring, onClose, onRestructure, onEdit, onDelete, onPractice, onSaveModel, onMyView, onScraps, onToQuestions, onToPassage }) {
  // Case links only where real rulings exist: 대법원 (S) and/or 헌법재판소 (C).
  const fix = PROCON[od.id];
  const pc = { motion: fix ? fix.motion : '', pro: fix ? fix.pro : (od.pro || []), con: fix ? fix.con : (od.con || []) };
  const courts = CASES[od.id] || '';
  const keepCase = c => (c.label === '대법원 판례' ? courts.includes('S') : c.label === '헌법재판소 결정' ? courts.includes('C') : !!courts);
  const tags = (TAGFIX[od.id] || od.tags || od.keywords || []).slice(0, 4).map(tagLinks).map(t => ({ ...t, cases: t.cases.filter(keepCase) }));
  return (
    <div className="overlay" style={{ zIndex: 50, justifyContent: 'flex-end' }}>
      <div className="overlay-dim" onClick={onClose} />
      <aside className="detail">
        <div className="detail-bar">
          <span className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, background: NEUTRAL }} />{od.category}
          </span>
          <div style={{ display: 'flex', gap: 16, fontSize: 13, alignItems: 'center' }}>
            <span className="link" onClick={onRestructure}>{restructuring ? '재구성 중…' : 'AI 재구성'}</span>
            <span className="link" onClick={onEdit}>편집</span>
            <ConfirmLink label="삭제" armedLabel="한 번 더 누르면 삭제" onConfirm={onDelete} />
            <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</span>
          </div>
        </div>
        <div className="detail-body" style={{ padding: 'clamp(28px,5vw,56px) clamp(20px,4vw,56px)', display: 'flex', flexDirection: 'column', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 'clamp(26px,3.4vw,36px)', lineHeight: 1.3, letterSpacing: '-0.03em', textWrap: 'pretty' }}>{od.title}</h2>
            <div className="accent-bar" />
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.8, color: '#2e2d2b', textWrap: 'pretty' }}>{od.summary}</p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(od.keywords || []).map(k => <span key={k} className="pill">{k}</span>)}
            </div>
          </div>
          {od.background && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={sectionLabel}>배경</div>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.85, textWrap: 'pretty' }}>{od.background}</p>
            </div>
          )}
          {(od.issues || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ ...sectionLabel, marginBottom: 6 }}>핵심 쟁점</div>
              {od.issues.map((t, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px minmax(0,1fr)', gap: 8, padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--muted)', paddingTop: 3 }}>{pad(i + 1)}</span>
                  <span style={{ fontSize: 15, lineHeight: 1.7 }}>{t}</span>
                </div>
              ))}
            </div>
          )}
          <NotionNotes topicId={od.id} />
          {(pc.pro.length > 0 || pc.con.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pc.motion && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={sectionLabel}>논제</div>
                  <div style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 17, lineHeight: 1.6, wordBreak: 'keep-all' }}>{pc.motion}</div>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 1, background: 'var(--ink)', border: '1px solid var(--ink)' }}>
                <div style={{ background: 'var(--paper)', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 16 }}>찬성 · 긍정</div>
                  <Reasons items={pc.pro} />
                </div>
                <div style={{ background: 'var(--charcoal)', color: 'var(--cream)', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 16 }}>반대 · 우려</div>
                  <Reasons items={pc.con} dark />
                </div>
              </div>
            </div>
          )}
          {(od.questions || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ ...sectionLabel, marginBottom: 6 }}>예상 질문</div>
              {od.questions.map((q, i) => <QuestionRow key={od.id + i} entry={od} q={q} onPractice={onPractice} onSaveModel={onSaveModel} />)}
            </div>
          )}
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <div style={sectionLabel}>{courts ? '관련 뉴스 · 칼럼 · 판례' : '관련 뉴스 · 칼럼'}</div>
                <div style={{ fontSize: 11.5, color: '#8a8780' }}>실시간 검색 연결 · 관련도순</div>
              </div>
              {tags.map(tg => (
                <div key={tg.tag} style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 0', borderTop: '1px solid var(--line-soft)' }}>
                  <div style={{ fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 17 }}>#{tg.tag}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
                    <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)', paddingTop: 5 }}>뉴스</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {tg.news.map(n => <a key={n.label} className="pill-link" href={n.url} target="_blank" rel="noopener noreferrer">{n.label}</a>)}
                    </div>
                    <span style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted)', paddingTop: 5 }}>칼럼·사설</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {tg.cols.map(n => <a key={n.label} className="pill-link" href={n.url} target="_blank" rel="noopener noreferrer">{n.label}</a>)}
                    </div>
                  </div>
                  {tg.cases.length > 0 && (
                    <div style={{ background: '#efede6', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--body)' }}>관련 판례 · #{tg.tag}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {tg.cases.map(n => <a key={n.label} className="case-link" href={n.url} target="_blank" rel="noopener noreferrer">{n.label} ↗</a>)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={sectionLabel}>나의 생각</div>
            <textarea value={od.myView || ''} onChange={ev => onMyView(ev.target.value)} rows={5} placeholder="이 주제에 대한 나의 입장, 근거, 경험을 적어두세요."
              style={{ font: 'inherit', fontSize: 15, lineHeight: 1.8, padding: 16, background: '#fff', border: '1px solid var(--line)', outline: 'none', resize: 'vertical', color: 'var(--ink)' }} />
            <Scraps items={od.scraps || []} onChange={onScraps} />
          </div>
          {od.body && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={sectionLabel}>원문 {od.source ? `· ${od.source}` : ''}</div>
              <div style={{ fontSize: 14, lineHeight: 1.85, color: '#2e2d2b', whiteSpace: 'pre-wrap', background: '#efede9', padding: 20, maxHeight: 420, overflowY: 'auto' }}>{od.body}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-solid" style={{ padding: '14px 20px', border: 'none' }} onClick={onToQuestions}>이 주제로 질문 만들기</button>
            <button className="btn-line" style={{ padding: '14px 20px' }} onClick={onToPassage}>제시문 만들기</button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function EntryForm({ form, setForm, uploading, onClose, onSave, onFiles }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const field = k => ({ value: form[k], onChange: ev => setForm({ ...form, [k]: ev.target.value }) });
  return (
    <div className="overlay" style={{ zIndex: 60, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="overlay-dim" style={{ background: 'rgba(20,20,20,0.5)' }} onClick={onClose} />
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 24 }}>{form.id ? '항목 편집' : '새 항목'}</h3>
          <span onClick={onClose} style={{ cursor: 'pointer', fontSize: 24, lineHeight: 1 }}>×</span>
        </div>
        <div onClick={() => fileRef.current && fileRef.current.click()}
          onDragOver={ev => { ev.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={ev => { ev.preventDefault(); setDrag(false); onFiles(ev.dataTransfer.files); }}
          style={{ border: '1px dashed var(--ink)', background: drag ? '#e8e6e1' : 'transparent', padding: 28, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', textAlign: 'center', cursor: 'pointer' }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17 }}>{uploading ? '불러오는 중…' : '파일을 끌어다 놓거나 클릭해 업로드'}</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>.txt · .md · .json — ‘# 제목’으로 나뉜 문서는 여러 항목으로 분리되고, AI가 요약·쟁점·관점으로 재구성합니다.</div>
          <input ref={fileRef} type="file" multiple accept=".txt,.md,.markdown,.json,text/plain" style={{ display: 'none' }}
            onChange={ev => { onFiles(ev.target.files); ev.target.value = ''; }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)' }}>
          <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />또는 직접 작성<span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        </div>
        <label className="form-label">제목<input className="form-input" style={{ fontSize: 16 }} placeholder="예: 저출산과 인구절벽" {...field('title')} /></label>
        <label className="form-label">분류<input className="form-input" placeholder="사회 / 법 / 정치 / 경제 / 과학 / 환경 / 문화 / 국제" {...field('category')} /></label>
        <label className="form-label">한 줄 요약<input className="form-input" {...field('summary')} /></label>
        <label className="form-label">키워드 (쉼표로 구분)<input className="form-input" {...field('keywords')} /></label>
        <label className="form-label">내용<textarea className="form-area" rows={6} placeholder="자료, 메모, 기사 내용을 붙여넣으세요." {...field('body')} /></label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn-line" style={{ padding: '12px 20px' }} onClick={onClose}>취소</button>
          <button className="btn-solid" style={{ padding: '12px 24px', border: 'none' }} onClick={onSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
