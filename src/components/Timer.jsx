import { forwardRef, useEffect, useRef } from 'react';
import { ACCENT, ACCENT2, ANSS, PREPS } from '../lib/constants.js';
import { pad } from '../lib/util.js';
import { Rail } from './Chrome.jsx';

const PHASE_LABEL = { idle: '대기', prep: '준비 시간', answer: '답변 시간', done: '종료' };

function PanelChips({ label, options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="label" style={{ color: 'var(--muted-2)' }}>{label}</span>
      <div className="chip-row tight">
        {options.map(([v, l]) => (
          <button key={l} className="chip dark tight" onClick={() => onChange(v)}
            style={v === value ? { background: 'var(--cream)', color: 'var(--ink)' } : undefined}>{l}</button>
        ))}
      </div>
    </div>
  );
}

const Timer = forwardRef(function Timer({ timer, question, setQuestion, onRandom, onStart, onSkip, onReset, setPrep, setAns }, ref) {
  const { phase, remain, running, prep, ans } = timer;
  // The ring fills exactly one turn over the set prep or answer time, drawn every frame from the clock.
  const wrapRef = useRef(null), live = useRef(timer);
  live.current = timer;
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const s = live.current, total = (s.phase === 'prep' ? s.prep : s.ans) * 1000;
      let f = s.phase === 'idle' ? 0 : s.phase === 'done' ? 1 : 1 - (s.running ? s.endsAt - Date.now() : s.leftMs) / total;
      f = Math.min(1, Math.max(0, f || 0));
      if (wrapRef.current) wrapRef.current.style.setProperty('--deg', (f * 360).toFixed(2) + 'deg');
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  const bar = phase === 'prep' ? ACCENT2 : ACCENT;
  const ring = `conic-gradient(${bar} var(--deg, 0deg), #e2dfd6 0deg)`;
  const warn = running && remain <= 10;
  const dot = phase === 'answer' ? ACCENT : phase === 'prep' ? ACCENT2 : '#c9c6bf';
  const paused = phase !== 'idle' && phase !== 'done' && !running;

  return (
    <section ref={ref} className="section" style={{ background: 'var(--cream)', paddingTop: 'clamp(56px,8vw,110px)', paddingBottom: 'clamp(40px,6vw,72px)', borderTop: '1px solid var(--line)' }}>
      <Rail no="04" label="TIMER" numColor="#c9c6bf" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="title-block">
            <h2 className="h2" data-reveal="1">면접 연습 타이머.</h2>
            <div className="accent-bar" />
          </div>
          <button className="btn-line" style={{ fontSize: 13, padding: '10px 16px' }} onClick={onRandom}>랜덤 질문 뽑기</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="label" style={{ color: 'var(--muted)' }}>연습할 질문</span>
          <textarea className="timer-q" rows={2} value={question} onChange={ev => setQuestion(ev.target.value)} placeholder="질문을 입력하거나, 위에서 ‘연습 →’을 누르세요." />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 'clamp(28px,5vw,64px)', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="timer-ring-wrap" data-reveal="1" ref={wrapRef}>
              <div className="timer-ring" style={{ background: ring }}>
                <div className="timer-face">
                  <div className="timer-phase"><span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />{PHASE_LABEL[phase] + (paused ? ' · 일시정지' : '')}</div>
                  <div className="timer-digits" style={{ color: warn ? ACCENT : 'var(--ink)' }}>{`${pad(Math.floor(remain / 60))}:${pad(remain % 60)}`}</div>
                </div>
              </div>
              <div className="timer-blob" />
              <div className="timer-overlay" style={{ background: ring }} />
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-solid" style={{ padding: '14px 28px', border: 'none', minWidth: 120 }} onClick={onStart}>{running ? '일시정지' : (phase === 'idle' || phase === 'done' ? '시작' : '계속')}</button>
              <button className="btn-line" style={{ padding: '14px 20px' }} onClick={onSkip}>답변 시작</button>
              <button className="btn-line" style={{ padding: '14px 20px' }} onClick={onReset}>초기화</button>
            </div>
          </div>
          <div className="timer-panel">
            <PanelChips label="준비 시간" options={PREPS} value={prep} onChange={setPrep} />
            <PanelChips label="답변 시간" options={ANSS} value={ans} onChange={setAns} />
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted-2)' }}>준비 시간이 끝나면 자동으로 답변 시간이 시작되고, 전환·종료 시 알림음이 울립니다.</div>
          </div>
        </div>
      </div>
    </section>
  );
});

export default Timer;
