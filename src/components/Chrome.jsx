import { useEffect, useState } from 'react';
import { ACCENT, BURGUNDY } from '../lib/constants.js';

// Logo 5a: line square (knowledge) overlapping a burgundy circle (thought); the overlap is olive.
export function Logo() {
  return (
    <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
      <div style={{ position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: '50%', background: BURGUNDY }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 14, top: 14, width: 24, height: 24, borderRadius: '50%', background: ACCENT }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, border: '1.5px solid #151515' }} />
    </div>
  );
}

export function Header({ go }) {
  return (
    <header className="site-header">
      <div className="brand">
        <Logo />
        <div className="brand-name">Thought<br />Library</div>
      </div>
      <nav className="site-nav">
        <span onClick={go.lib}>Library</span>
        <span onClick={go.q}>Questions</span>
        <span onClick={go.p}>Passage</span>
        <span onClick={go.t}>Timer</span>
        <span onClick={go.m}>My Page</span>
      </nav>
    </header>
  );
}

export function Intro({ onSkip }) {
  const pop = (style, delay) => <div className="intro-pop" style={{ ...style, animationDelay: delay + 's' }} />;
  return (
    <div className="intro" onClick={onSkip}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
          {pop({ width: 31, height: 31, border: '1.5px solid #b5b2ac' }, 0.1)}
          {pop({ width: 34, height: 34, borderRadius: '17px 17px 0 0', background: ACCENT }, 0.25)}
          {pop({ width: 34, height: 34, marginLeft: -2, borderRadius: '50%', background: BURGUNDY }, 0.4)}
        </div>
      </div>
      <div style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 'clamp(34px,5vw,60px)', letterSpacing: '-0.02em', color: 'var(--cream)', opacity: 0, animation: 'tlUp 1s cubic-bezier(.2,.7,.2,1) .7s forwards' }}>Thought Library</div>
      <div style={{ width: 64, height: 1, background: '#9a9893', transformOrigin: 'left', transform: 'scaleX(0)', animation: 'tlLine .8s ease 1.1s forwards' }} />
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.3em', color: '#b5b2ac', opacity: 0, animation: 'tlUp .9s ease 1.2s forwards' }}>ARCHIVING PAGE</div>
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
      <span>© Thought Library</span>
      <span>
        {canInstall && <><span className="link" onClick={install}>앱으로 설치 (바탕화면·홈 화면)</span> · </>}
        항목은 이 브라우저에 저장됩니다 · <span className="link" onClick={onSettings}>{aiOn ? 'AI 연결됨' : 'AI 설정'}</span>
      </span>
    </footer>
  );
}
