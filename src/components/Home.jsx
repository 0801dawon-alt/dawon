import { useEffect, useState } from 'react';
import { loadBank } from '../lib/bank.js';

// First screen: two doors (read in the library, speak in the mock interview) and today's question.
export default function Home({ entries, categories, today, onLibrary, onCategory, onMock, onToday }) {
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let on = true;
    loadBank().then(b => {
      if (!on) return;
      const qs = new Set(entries.flatMap(e => e.questions || []).map(q => q.replace(/\s+/g, '')));
      b.qs.forEach(x => qs.add(x.q.replace(/\s+/g, '')));
      setCounts({ q: qs.size, p: b.ps.length });
    }, () => {});
    return () => { on = false; };
  }, [entries]);
  const fmt = n => n.toLocaleString('ko-KR');
  return (
    <section className="home">
      <div className="home-eyebrow">INTERVIEW PREP · 면접 준비</div>
      <h1 className="home-title">면접장에서 꺼낼 생각을<br /><em>미리 쌓아 두는</em> 서재.</h1>
      <p className="home-lede">읽으며 생각을 쌓고, 말하며 다듬으세요.</p>
      <div className="doors">
        <div className="door door-read" role="button" tabIndex={0} onClick={onLibrary} onKeyDown={e => e.key === 'Enter' && onLibrary()}>
          <div className="door-k">01 · READ</div>
          <h2>지식서재</h2>
          <p>시사·가치 주제마다 배경과 쟁점, 찬반 논거, 관련 기사와 판례를 정리해 두었어요.</p>
          <div className="door-chips">
            {categories.slice(0, 9).map(c => (
              <span key={c} className="door-chip" onClick={ev => { ev.stopPropagation(); onCategory(c); }}>{c}</span>
            ))}
          </div>
          <div className="door-foot">
            <span className="door-num">{fmt(entries.length)}개 주제</span>
            <span className="door-btn line">둘러보기 →</span>
          </div>
          <div className="door-glyph" aria-hidden="true">讀</div>
        </div>
        <div className="door door-speak" role="button" tabIndex={0} onClick={() => onMock('questions')} onKeyDown={e => e.key === 'Enter' && onMock('questions')}>
          <div className="door-k">02 · SPEAK</div>
          <h2>모의면접</h2>
          <p>질문과 제시문을 고르고, 타이머에 맞춰 답하면 바로 채점해요. 기록이 쌓일수록 피드백이 정확해져요.</p>
          <div className="door-chips">
            {[['questions', '예상 질문'], ['passage', '제시문'], ['practice', '실전 연습'], ['records', '내 기록']].map(([k, l]) => (
              <span key={k} className="door-chip" onClick={ev => { ev.stopPropagation(); onMock(k); }}>{l}</span>
            ))}
          </div>
          <div className="door-foot">
            <span className="door-num">{counts ? `질문 ${fmt(counts.q)} · 제시문 ${fmt(counts.p)}세트` : '질문 · 제시문 · 실전 연습'}</span>
            <span className="door-btn light">시작하기 →</span>
          </div>
          <div className="door-glyph" aria-hidden="true">言</div>
        </div>
      </div>
      {today && (
        <div className="today-bar">
          <span className="today-k">TODAY</span>
          <span className="today-q">{today.q}</span>
          <button className="today-go" onClick={onToday}>오늘의 질문 답하기 →</button>
        </div>
      )}
    </section>
  );
}
