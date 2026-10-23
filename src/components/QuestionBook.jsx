import { useEffect, useMemo, useState } from 'react';
import { RecordBlock } from './Record.jsx';

const FILTERS = [['all', '전체'], ['mine', '직접 입력한 질문'], ['answered', '답변한 질문']];
const fmtDate = d => new Date(d).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
const minutes = s => Math.round(s / 60 * 10) / 10;

// One row per question: typed-in questions and every question answered, newest activity first.
function groupQuestions(myQuestions, attempts) {
  const map = new Map();
  const row = q => {
    const key = q.trim();
    if (!map.has(key)) map.set(key, { q: key, mine: false, attempts: [], last: '' });
    return map.get(key);
  };
  myQuestions.forEach(x => { const r = row(x.q); r.mine = true; if (x.date > r.last) r.last = x.date; });
  attempts.forEach(a => { if (!a.q || a.q === '(질문 없음)') return; const r = row(a.q); r.attempts.push(a); if (a.date > r.last) r.last = a.date; });
  return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
}

function AttemptDetail({ a }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 0 4px', borderTop: '1px dashed var(--line)' }}>
      <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtDate(a.date)} · {a.dur || 0}초{a.limit ? ` / ${minutes(a.limit)}분` : ''}{a.fb ? ` · ${a.fb.total}점` : ''}</div>
      <RecordBlock title="내 답변" boxed>{a.text || '(답변 없음)'}</RecordBlock>
      {a.fb ? (
        <>
          <RecordBlock title="피드백">
            {a.fb.summary}
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{Object.entries(a.fb.scores || {}).map(([k, v]) => `${k} ${v}/${(a.fb.max && a.fb.max[k]) || 20}`).join(' · ')}</div>
            {(a.fb.strengths || []).map((x, i) => <div key={'s' + i}>+ {x}</div>)}
            {(a.fb.weaknesses || []).map((x, i) => <div key={'w' + i}>− {x}</div>)}
          </RecordBlock>
          {a.fb.better && <RecordBlock title="이렇게 보완하면">{a.fb.better}</RecordBlock>}
          {a.fb.model && <RecordBlock title="모범답안" boxed serif>{a.fb.model}</RecordBlock>}
        </>
      ) : <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>피드백 전</div>}
      {(a.followups || []).length > 0 && <RecordBlock title="꼬리질문">{a.followups.map((q, i) => <div key={i}>{i + 1}. {q}</div>)}</RecordBlock>}
    </div>
  );
}

function QuestionCard({ row, onPractice }) {
  const [open, setOpen] = useState(false);
  const latest = row.attempts.find(a => a.fb) || null;
  const scores = row.attempts.filter(a => a.fb).map(a => a.fb.total);
  return (
    <div className="qbook-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {row.mine && <span className="qbook-tag">직접 입력</span>}
          {row.attempts.length > 0 ? <span className="qbook-tag">답변 {row.attempts.length}회</span> : <span className="qbook-tag muted">아직 답변 안 함</span>}
        </div>
        {scores.length > 0 && <span className="qbook-score">{scores[0]}<small>점{scores.length > 1 ? ` · 최고 ${Math.max(...scores)}` : ''}</small></span>}
      </div>
      <div className="qbook-q">{row.q}</div>
      {latest && (
        <div className="qbook-summary"><span className="qbook-summary-label">최근 피드백</span>{latest.fb.summary}</div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {row.attempts.length > 0 && (
          <button className="btn-line" style={{ fontSize: 12.5, padding: '8px 14px' }} onClick={() => setOpen(!open)}>
            {open ? '답변·피드백 접기' : `답변·피드백 전체 보기${row.attempts.length > 1 ? ` (${row.attempts.length})` : ''}`}
          </button>
        )}
        <button className="btn-small" style={{ padding: '8px 14px' }} onClick={() => onPractice(row.q, row.attempts[0] && row.attempts[0].context)}>연습 →</button>
      </div>
      {open && row.attempts.map(a => <AttemptDetail key={a.id} a={a} />)}
    </div>
  );
}

// Full-screen page listing the questions the viewer typed in or answered.
export default function QuestionBook({ myQuestions, attempts, onClose, onPractice }) {
  const [filter, setFilter] = useState('all');
  const rows = useMemo(() => groupQuestions(myQuestions, attempts), [myQuestions, attempts]);
  const shown = rows.filter(r => filter === 'all' || (filter === 'mine' ? r.mine : r.attempts.length > 0));
  useEffect(() => {
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);
  return (
    <div className="qbook">
      <div className="qbook-bar">
        <button className="qbook-back" onClick={onClose}>← 내 기록으로</button>
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--muted)' }}>QUESTION BOOK</span>
      </div>
      <div className="qbook-inner">
        <div className="title-block">
          <h2 className="h2">질문 모음</h2>
          <div className="accent-bar" />
          <p className="lede" style={{ color: 'var(--body)' }}>직접 입력한 질문과 답변해 본 질문을 모았어요. 질문마다 최근 피드백 요약이 보이고, 버튼을 누르면 답변과 피드백 전체가 펼쳐져요.</p>
        </div>
        <div className="chip-row">
          {FILTERS.map(([v, l]) => (
            <button key={v} className="chip" onClick={() => setFilter(v)} style={v === filter ? { background: 'var(--ink)', color: 'var(--cream)' } : undefined}>
              {l} {v === 'all' ? rows.length : v === 'mine' ? rows.filter(r => r.mine).length : rows.filter(r => r.attempts.length).length}
            </button>
          ))}
        </div>
        {shown.length === 0 && <div style={{ fontSize: 14, color: 'var(--muted)', padding: '24px 0' }}>아직 모인 질문이 없어요. 예상 질문에서 ‘질문 직접 입력’을 하거나 답변을 연습하면 여기에 쌓여요.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {shown.map(r => <QuestionCard key={r.q} row={r} onPractice={onPractice} />)}
        </div>
      </div>
    </div>
  );
}
