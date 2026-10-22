import { useRef, useState } from 'react';
import { NEUTRAL, tagLinks } from '../lib/constants.js';
import { pad } from '../lib/util.js';
import CASES from '../data/cases.js';

const sectionLabel = { fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)' };

// confirm() is unavailable inside an artifact frame, so deletion asks for a second click.
export function ConfirmLink({ label, armedLabel, onConfirm, style }) {
  const [armed, setArmed] = useState(false);
  return <span className="link" style={style} onClick={() => (armed ? onConfirm() : setArmed(true))} onMouseLeave={() => setArmed(false)}>{armed ? armedLabel : label}</span>;
}

export function DetailPanel({ entry: od, restructuring, onClose, onRestructure, onEdit, onDelete, onPractice, onMyView, onToQuestions, onToPassage }) {
  // Case links only where real rulings exist: 대법원 (S) and/or 헌법재판소 (C).
  const courts = CASES[od.id] || '';
  const keepCase = c => (c.label === '대법원 판례' ? courts.includes('S') : c.label === '헌법재판소 결정' ? courts.includes('C') : !!courts);
  const tags = (od.tags || od.keywords || []).slice(0, 4).map(tagLinks).map(t => ({ ...t, cases: t.cases.filter(keepCase) }));
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
        <div style={{ padding: 'clamp(28px,5vw,56px) clamp(20px,4vw,48px)', display: 'flex', flexDirection: 'column', gap: 40 }}>
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
          {((od.pro || []).length > 0 || (od.con || []).length > 0) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 1, background: 'var(--ink)', border: '1px solid var(--ink)' }}>
              <div style={{ background: 'var(--paper)', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 16 }}>찬성 · 긍정</div>
                {(od.pro || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>— {x}</div>)}
              </div>
              <div style={{ background: 'var(--charcoal)', color: 'var(--cream)', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 16 }}>반대 · 우려</div>
                {(od.con || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>— {x}</div>)}
              </div>
            </div>
          )}
          {(od.questions || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ ...sectionLabel, marginBottom: 6 }}>예상 질문</div>
              {od.questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' }}>
                  <span style={{ fontFamily: 'var(--serif)', fontSize: 15, lineHeight: 1.7 }}>{q}</span>
                  <span className="link" onClick={() => onPractice(q)} style={{ fontSize: 12, whiteSpace: 'nowrap', paddingTop: 4 }}>연습 →</span>
                </div>
              ))}
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
