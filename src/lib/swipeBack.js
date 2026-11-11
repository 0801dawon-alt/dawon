// iPhone home-screen app: dragging from the left edge slides the current screen (or the open panel)
// to the right, like Safari's back gesture, and going past a third of the width goes back one step.
import { useEffect, useRef } from 'react';

const EDGE = 28;

export function useSwipeBack(onBack) {
  const cb = useRef(onBack); cb.current = onBack;
  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return undefined;
    // Safari and Android browsers already have their own back gesture or button, which follows the
    // history entries the app adds, so this drag is only for the iPhone home-screen app, which has none.
    const ios = /iP(hone|od|ad)/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    const standalone = navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (!ios || !standalone) return undefined;
    let s = null;
    const target = () => {
      const ov = document.querySelectorAll('.overlay');
      return ov.length ? ov[ov.length - 1] : document.querySelector('.page');
    };
    const reset = (el, animate) => {
      el.style.transition = animate ? 'transform .28s cubic-bezier(.2,.7,.2,1), box-shadow .28s' : '';
      el.style.transform = ''; el.style.boxShadow = '';
      if (animate) setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; }, 300);
    };
    const start = e => {
      if (e.touches.length !== 1 || window.innerWidth > 900) return;
      const t = e.touches[0];
      if (t.clientX > EDGE) return;
      s = { x: t.clientX, y: t.clientY, t: Date.now(), dx: 0, on: false, el: null };
    };
    const move = e => {
      if (!s) return;
      const t = e.touches[0]; const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (!s.on) {
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) { s = null; return; }
        if (dx < 10) return;
        s.on = true; s.el = target(); if (!s.el) { s = null; return; }
        s.el.style.willChange = 'transform'; s.el.style.transition = 'none';
      }
      s.dx = Math.max(0, dx);
      s.el.style.transform = `translateX(${s.dx}px)`;
      s.el.style.boxShadow = '-18px 0 32px -12px rgba(35,23,25,.22)';
      if (e.cancelable) e.preventDefault();
    };
    const end = () => {
      if (!s) return;
      const { el, dx, t, on } = s; s = null;
      if (!on || !el) return;
      const fast = dx > 40 && dx / Math.max(1, Date.now() - t) > 0.5;
      if (dx > window.innerWidth / 3 || fast) {
        el.style.transition = 'transform .22s ease-out';
        el.style.transform = `translateX(${window.innerWidth}px)`;
        setTimeout(() => { reset(el, false); el.style.willChange = ''; cb.current(); }, 220);
      } else reset(el, true);
    };
    window.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end); window.addEventListener('touchcancel', end);
    return () => {
      window.removeEventListener('touchstart', start); window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', end); window.removeEventListener('touchcancel', end);
    };
  }, []);
}
