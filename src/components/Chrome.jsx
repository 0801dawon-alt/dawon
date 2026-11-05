import { useEffect, useState } from 'react';
import { CHAT_URL } from '../lib/constants.js';
import { inArtifact } from '../lib/ai.js';

// Logo (the original mark): line square (knowledge) overlapping a burgundy circle (thought); the overlap is olive.
const LOGO_OLIVE = '#5d6b3a', LOGO_BURGUNDY = '#7F4C4C';
export function Logo({ size = 34 }) {
  const k = size / 38;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} aria-hidden="true">
      <div style={{ position: 'absolute', right: 0, bottom: 0, width: 24 * k, height: 24 * k, borderRadius: '50%', background: LOGO_BURGUNDY }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 26 * k, height: 26 * k, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 14 * k, top: 14 * k, width: 24 * k, height: 24 * k, borderRadius: '50%', background: LOGO_OLIVE }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 26 * k, height: 26 * k, border: '1.5px solid #231719' }} />
    </div>
  );
}

export const NAV = [['home', '홈'], ['library', '지식서가'], ['mock', '모의면접']];

export function Header({ section, onNav, onSettings }) {
  return (
    <header className="site-header">
      <div className="brand" role="button" tabIndex={0} onClick={() => onNav('home')}>
        <Logo />
        <div className="brand-name">생각서재<small>Thought Library</small></div>
      </div>
      <nav className="site-nav">
        {NAV.map(([k, l]) => <span key={k} className={section === k ? 'on' : ''} onClick={() => onNav(k)}>{l}</span>)}
      </nav>
      <div className="header-right">
        {inArtifact() && <a className="nav-chat" href={CHAT_URL} target="_blank" rel="noopener noreferrer">Chat ↗</a>}
        <button className="header-settings" onClick={onSettings}>설정</button>
      </div>
    </header>
  );
}

// Phones get the three destinations as a tab bar at the bottom.
export function TabBar({ section, onNav }) {
  const icon = { home: '⌂', library: '讀', mock: '言' };
  return (
    <nav className="tab-bar">
      {NAV.map(([k, l]) => (
        <button key={k} className={section === k ? 'on' : ''} onClick={() => onNav(k)}><b>{icon[k]}</b>{l}</button>
      ))}
    </nav>
  );
}

export const MOCK_TABS = [['questions', '예상 질문'], ['passage', '제시문'], ['practice', '실전 연습'], ['records', '내 기록']];

export function MockHeader({ tab, onTab, recordCount }) {
  return (
    <div className="mock-head">
      <div className="home-eyebrow" style={{ textAlign: 'left' }}>MOCK INTERVIEW</div>
      <h1 className="mock-title">모의면접</h1>
      <p className="mock-lede">질문을 고르고 → 준비하고 → 답하고 → 피드백을 확인하세요.</p>
      <div className="mock-tabs" role="tablist">
        {MOCK_TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => onTab(k)}>
            {l}{k === 'records' && recordCount ? <small>{recordCount}회</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Intro({ onSkip }) {
  const pop = (style, delay) => <div className="intro-pop" style={{ ...style, animationDelay: delay + 's' }} />;
  return (
    <div className="intro" onClick={onSkip}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
        {pop({ width: 31, height: 31, border: '1.5px solid #231719' }, 0.1)}
        {pop({ width: 34, height: 34, borderRadius: '17px 17px 0 0', background: LOGO_OLIVE }, 0.25)}
        {pop({ width: 34, height: 34, marginLeft: -2, borderRadius: '50%', background: LOGO_BURGUNDY }, 0.4)}
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 'clamp(34px,5vw,60px)', letterSpacing: '-0.02em', color: 'var(--ink)', opacity: 0, animation: 'tlUp 1s cubic-bezier(.2,.7,.2,1) .7s forwards' }}>생각서재</div>
      <div style={{ width: 64, height: 2, background: 'var(--wine)', transformOrigin: 'left', transform: 'scaleX(0)', animation: 'tlLine .8s ease 1.1s forwards' }} />
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.3em', color: 'var(--brown)', opacity: 0, animation: 'tlUp .9s ease 1.2s forwards' }}>THOUGHT LIBRARY</div>
    </div>
  );
}

// Left column of each numbered section: big number, line, dot, vertical label.
export function Rail({ no, label, numColor, lineColor = '#151515' }) {
  return (
    <div className="rail" style={{ color: lineColor }}>
      <div className="rail-no" style={{ color: numColor }}>{no}</div>
      <div className="rail-line" />
      <div className="rail-dot" />
      <div className="rail-label">{label}</div>
    </div>
  );
}

export function Toast({ text }) {
  return text ? <div className="toast">{text}</div> : null;
}

// Chrome and Android offer to install the homepage as an app (desktop shortcut / home-screen icon).
let installEvent = null;
if (typeof window !== 'undefined') window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; window.dispatchEvent(new Event('tl-installable')); });

export function Footer({ onSettings, aiOn }) {
  const [canInstall, setCanInstall] = useState(!!installEvent);
  useEffect(() => {
    const on = () => setCanInstall(!!installEvent);
    window.addEventListener('tl-installable', on); window.addEventListener('appinstalled', on);
    return () => { window.removeEventListener('tl-installable', on); window.removeEventListener('appinstalled', on); };
  }, []);
  const install = async () => { if (!installEvent) return; installEvent.prompt(); await installEvent.userChoice; installEvent = null; setCanInstall(false); };
  return (
    <footer className="site-footer">
      <span>© 생각서재 · Thought Library</span>
      <span>
        {canInstall && <><span className="link" onClick={install}>앱으로 설치 (바탕화면·홈 화면)</span> · </>}
        {inArtifact()
          ? <>기록은 내 Claude 계정에 저장돼 어느 기기에서나 같아요 · <span className="link" onClick={onSettings}>설정</span></>
          : <>기록은 이 브라우저에 저장됩니다 · <span className="link" onClick={onSettings}>기록 옮기기 · {aiOn ? 'AI 연결됨' : 'AI 설정'}</span></>}
      </span>
    </footer>
  );
}
