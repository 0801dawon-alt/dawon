import { useEffect, useRef } from 'react';
import { ACCENT, BURGUNDY } from '../lib/constants.js';

// Constellation: drifting points that link up when close, a few with a soft glow.
// Fades in as the intro closes and leans slightly toward the pointer.
function useConstellation(canvasRef, t0) {
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const g = c.getContext('2d'); const host = c.parentElement;
    const N = 64, pts = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random());
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8, vx: (Math.random() - 0.5) * 0.0011, vy: (Math.random() - 0.5) * 0.0011, ph: Math.random() * 6.283, sp: Math.random() < 0.14 });
    }
    let W = 0, H = 0, dpr = 1, raf = 0;
    const size = () => { const bb = host.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = bb.width; H = bb.height; c.width = W * dpr; c.height = H * dpr; };
    size();
    const ro = new ResizeObserver(size); ro.observe(host);
    let mx = 0, my = 0, tx = 0, ty = 0;
    const onMove = e => { const bb = host.getBoundingClientRect(); tx = (e.clientX - bb.left) / bb.width - 0.5; ty = (e.clientY - bb.top) / bb.height - 0.5; };
    const onLeave = () => { tx = 0; ty = 0; };
    host.addEventListener('mousemove', onMove); host.addEventListener('mouseleave', onLeave);
    const frame = now => {
      raf = requestAnimationFrame(frame); if (!W) return;
      mx += (tx - mx) * 0.03; my += (ty - my) * 0.03;
      const t = now * 0.001;
      // Keep the cluster centred in the empty space above the index list.
      const li = host.querySelector('[data-index-list]'), fr = li && li.firstElementChild;
      const top = fr ? fr.getBoundingClientRect().top - host.getBoundingClientRect().top - 12 : H * 0.5;
      const R = Math.min(W * 0.42, top * 0.46), ox = W * 0.5 + mx * 18, oy = top * 0.5 + my * 12, link = R * 0.42;
      const k = Math.min(1, Math.max(0, (now - t0 - 2300) / 1600)), ease = 1 - Math.pow(1 - k, 3);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.globalAlpha = ease;
      const S = pts.map(p => { p.x += p.vx; p.y += p.vy; if (Math.hypot(p.x, p.y / 0.8) > 1) { p.vx -= p.x * 0.0004; p.vy -= p.y * 0.0004; } return [ox + p.x * R, oy + p.y * R]; });
      g.globalCompositeOperation = 'lighter'; g.lineWidth = 0.7;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const d = Math.hypot(S[i][0] - S[j][0], S[i][1] - S[j][1]); if (d > link) continue;
        const a = (1 - d / link) * 0.32 * (0.6 + 0.4 * Math.sin(t * 1.2 + pts[i].ph));
        g.strokeStyle = 'rgba(243,236,224,' + a.toFixed(3) + ')'; g.beginPath(); g.moveTo(S[i][0], S[i][1]); g.lineTo(S[j][0], S[j][1]); g.stroke();
      }
      for (let i = 0; i < N; i++) {
        const p = pts[i], tw = 0.5 + 0.5 * Math.sin(t * 1.8 + p.ph), r = p.sp ? 2.2 : 1.2;
        if (p.sp) {
          const gr = g.createRadialGradient(S[i][0], S[i][1], 0, S[i][0], S[i][1], 14);
          gr.addColorStop(0, 'rgba(255,240,220,' + (0.5 * tw).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,240,220,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(S[i][0], S[i][1], 14, 0, 6.283); g.fill();
        }
        g.fillStyle = 'rgba(250,244,234,' + (p.sp ? 0.95 : 0.4 + 0.4 * tw).toFixed(3) + ')'; g.beginPath(); g.arc(S[i][0], S[i][1], r, 0, 6.283); g.fill();
      }
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); host.removeEventListener('mousemove', onMove); host.removeEventListener('mouseleave', onLeave); };
  }, [canvasRef, t0]);
}

export default function Hero({ t0, categories, today, hasAttempts, onToday, onContinue, onCategory }) {
  const canvasRef = useRef(null);
  useConstellation(canvasRef, t0);
  return (
    <section className="hero">
      <div className="hero-left">
        <div className="mark-row">
          <div className="mark-row-shapes">
            <div style={{ width: 14.5, height: 14.5, border: '1px solid #6b6966' }} />
            <div style={{ width: 16, height: 16, borderRadius: '8px 8px 0 0', background: ACCENT }} />
            <div style={{ width: 16, height: 16, marginLeft: -1, borderRadius: '50%', background: BURGUNDY }} />
          </div>
          <div style={{ height: 1, background: '#c9c6bf' }} />
        </div>
        <div className="hero-kicker">Archiving Page</div>
        <h1 data-reveal="1">당신의 생각은<br />무엇인가요?</h1>
        <p className="hero-copy">주제별 지식 카드를 통해 쟁점과 관점을 읽고, <br />예상 질문과 제시문을 확인해, 타이머로 답변을 연습할 수 있습니다.</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn-solid" onClick={onToday}>오늘의 질문으로 연습</button>
          <button className="btn-line" onClick={onContinue}>{hasAttempts ? '내 기록 이어보기' : '지식 서재 둘러보기'}</button>
        </div>
        {today && (
          <div className="hero-today">
            <span className="label" style={{ color: 'var(--muted)' }}>오늘의 질문 · {today.cat}</span>
            <span className="hero-today-q">{today.q}</span>
          </div>
        )}
      </div>
      <div className="hero-right">
        <canvas ref={canvasRef} className="hero-orb" />
        <div className="rail-label" style={{ position: 'relative', color: '#9a9893' }}>INDEX</div>
        <div className="index-list" data-index-list="1">
          {categories.map(c => (
            <div key={c} className="index-item" onClick={() => onCategory(c)}>
              <span className="index-name"><span className="index-arch" />{c}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
