import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SETS, CYC2, SCRIPTS, FINAL_TYPES, PERSONAL, CLOSING, PRACTICE, OTHER_NO } from '../data/cnu/index.js';
import AUDIO from '../data/cnu/audio.json';
import './cnu-room.css';

const BASE = (import.meta.env.BASE_URL || './') + 'cnu-audio/';
const STORE = 'tl-cnu-room-v2', THEME = 'tl-cnu-theme', SPEED = 'tl-cnu-speed';
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const mmss = s => { const a = Math.max(0, Math.ceil(s)); return String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); };
const BY_ID = Object.fromEntries(SETS.flat().map(q => [q.id, q]));
const TYPE_LABEL = { 찬반: '찬반형', 견해: '견해 제시형', 해결: '해결방안 제시형' };
const PHASE = { wait: '면접 대기실', r1: '1차 발언', r2: '2차 발언', fin: '마지막 1분', end: '면접 종료', solo: '개별 연습' };
const WHO = { j1: '면접위원 1', j2: '면접위원 2', j3: '면접위원 3' };
const whoName = w => WHO[w] || `지원자 ${w}`;

// 문항 배정: 가상 지원자 좌석(1·3·4·5)에는 그 좌석 목소리로 만든 답변이 있는 문항을, 남은 하나는 내 자리(2번)에.
function makeAssign(set) {
  const pos = Array(5).fill(null), left = [...set];
  shuffle([1, 3, 4, 5]).forEach(p => {
    const c = left.filter(q => q.v === p);
    const q = c.length ? pick(c) : pick(left);
    pos[p - 1] = q.id; left.splice(left.indexOf(q), 1);
  });
  pos[1] = left[0].id;
  return pos;
}

function loadStore() {
  const s = read(STORE, null);
  if (s && Array.isArray(s.opened) && s.opened.every(i => SETS[i]) && s.cur != null && s.assign && s.assign[s.cur] && s.assign[s.cur].length === 5) return s;
  const i = Math.floor(Math.random() * SETS.length);
  const n = { opened: [i], cur: i, assign: { [i]: makeAssign(SETS[i]) }, done: [] };
  write(STORE, n); return n;
}

// 전체면접 진행표. say = 음성 재생 후 자동으로 다음, user = 지원자 2의 직접 발언.
function buildSteps(setIdx, assign) {
  const q = p => BY_ID[assign[p - 1]];
  const S = [], say = (who, key, text, o = {}) => S.push({ t: 'say', who, key, text, ...o });
  say('j1', 'sc-intro', SCRIPTS.intro, { ph: 'r1', turn: true, sp: 'j1' });
  for (let n = 1; n <= 5; n++) {
    const o = { ph: 'r1', sp: n, qno: n };
    say('j1', `sc-c1-${n}`, SCRIPTS[`c1-${n}`], { ...o, turn: true });
    if (n === 2) { say('j1', q(2).id + '-q', q(2).q, o); S.push({ t: 'user', ...o, limit: 120, auto: true }); }
    else say(n, q(n).id + '-m1', q(n).m1, o);
  }
  say('j1', 'sc-r2', SCRIPTS.r2, { ph: 'r2', turn: true, sp: 'j1' });
  for (let n = 1; n <= 5; n++) {
    say('j1', `sc-c2-${n}`, SCRIPTS[`c2-${n}`], { ph: 'r2', sp: n, turn: true });
    if (n === 2) S.push({ t: 'user', ph: 'r2', sp: 2, limit: 120, auto: false, draw: true });
    else { const t = +Object.keys(CYC2).find(k => CYC2[k] === n); say(n, q(t).id + '-m2', q(t).m2, { ph: 'r2', sp: n, qno: t, target: t }); }
  }
  const [ft] = FINAL_TYPES[setIdx % 3];
  const k = Math.floor(setIdx / 3) % 4;
  const order = [5, 4, 3, 2, 1];
  if (ft === 'A') {
    say('j1', 'sc-fA', SCRIPTS.fA, { ph: 'fin', turn: true, sp: 'j1' });
    say('j3', `pq-${k}`, PERSONAL[k].q, { ph: 'fin', sp: 'j3' });
    order.forEach(n => {
      say('j1', `sc-cf-${n}`, SCRIPTS[`cf-${n}`], { ph: 'fin', sp: n, turn: true });
      if (n === 2) { say('j3', `pq-${k}`, PERSONAL[k].q, { ph: 'fin', sp: 2 }); S.push({ t: 'user', ph: 'fin', sp: 2, limit: 60, auto: false, tag: '인성질문', prompt: PERSONAL[k].q, replay: [`pq-${k}`, 'j3', PERSONAL[k].q] }); }
      else say(n, `pa-${k}-${n}`, PERSONAL[k].a[n], { ph: 'fin', sp: n });
    });
  } else if (ft === 'B') {
    say('j1', 'sc-fB', SCRIPTS.fB, { ph: 'fin', turn: true, sp: 'j1' });
    order.forEach(n => {
      say('j1', `sc-cf-${n}`, SCRIPTS[`cf-${n}`], { ph: 'fin', sp: n, turn: true });
      if (n === 2) { say('j1', 'sc-lastq', SCRIPTS.lastq, { ph: 'fin', sp: 2 }); S.push({ t: 'user', ph: 'fin', sp: 2, limit: 60, auto: false, tag: '마지막으로 하고 싶은 말', prompt: SCRIPTS.lastq, replay: ['sc-lastq', 'j1', SCRIPTS.lastq] }); }
      else say(n, `la-${k}-${n}`, CLOSING[k][n], { ph: 'fin', sp: n });
    });
  } else {
    say('j1', 'sc-fC', SCRIPTS.fC, { ph: 'fin', turn: true, sp: 'j1' });
    order.forEach(n => {
      const m = OTHER_NO[n];
      say('j1', `sc-cc-${n}`, SCRIPTS[`cc-${n}`], { ph: 'fin', sp: n, qno: m, turn: true });
      if (n === 2) { say('j1', q(m).id + '-q', q(m).q, { ph: 'fin', sp: 2, qno: m }); S.push({ t: 'user', ph: 'fin', sp: 2, qno: m, limit: 60, auto: false, tag: `${m}번 문제`, prompt: q(m).q, replay: [q(m).id + '-q', 'j1', q(m).q] }); }
      else say(n, q(m).id + '-s', q(m).s, { ph: 'fin', sp: n, qno: m });
    });
  }
  say('j1', 'sc-end', SCRIPTS.end, { ph: 'end', turn: true, sp: 'j1' });
  S.push({ t: 'end', ph: 'end' });
  return S;
}

// ── 한 번에 하나만 재생하는 오디오 ─────────────────────────────
function useAudio(speedRef) {
  const el = useRef(null);
  const [st, setSt] = useState({ key: '', state: 'idle', left: 0 });
  const cb = useRef({});
  if (!el.current && typeof Audio !== 'undefined') { el.current = new Audio(); el.current.preload = 'auto'; if (import.meta.env.DEV) window.__cnuAudio = el.current; }
  useEffect(() => {
    const a = el.current; if (!a) return undefined;
    const tick = () => setSt(s => ({ ...s, left: a.duration ? (a.duration - a.currentTime) / (a.playbackRate || 1) : s.left }));
    const end = () => { setSt(s => ({ ...s, state: 'ended', left: 0 })); const f = cb.current.end; cb.current = {}; f && f(); };
    const err = () => { if (!a.getAttribute('src')) return; setSt(s => ({ ...s, state: 'error' })); };
    a.addEventListener('timeupdate', tick); a.addEventListener('ended', end); a.addEventListener('error', err);
    return () => { a.pause(); a.removeEventListener('timeupdate', tick); a.removeEventListener('ended', end); a.removeEventListener('error', err); };
  }, []);
  const go = () => {
    const a = el.current;
    a.playbackRate = speedRef.current; try { a.preservesPitch = true; } catch { /* old browser */ }
    const p = a.play();
    if (p && p.catch) p.then(() => setSt(s => ({ ...s, state: 'playing' }))).catch(e => setSt(s => ({ ...s, state: e && e.name === 'NotAllowedError' ? 'blocked' : 'error' })));
    else setSt(s => ({ ...s, state: 'playing' }));
  };
  const play = (key, onEnd) => {
    const a = el.current; if (!a) return;
    cb.current = { end: onEnd };
    a.pause(); a.src = BASE + key + '.mp3'; a.currentTime = 0;
    setSt({ key, state: 'loading', left: (AUDIO[key]?.d || 0) / speedRef.current });
    go();
  };
  const pause = () => { const a = el.current; if (a && !a.paused) { a.pause(); setSt(s => ({ ...s, state: 'paused' })); } };
  const resume = () => { const a = el.current; if (a && a.getAttribute('src') && a.paused && !a.ended && st.state !== 'ended' && st.state !== 'idle') go(); };
  const stop = () => { const a = el.current; cb.current = {}; if (a) { a.pause(); a.removeAttribute('src'); a.load(); } setSt({ key: '', state: 'idle', left: 0 }); };
  const rate = r => { if (el.current) el.current.playbackRate = r; };
  return { ...st, play, pause, resume, stop, retry: go, rate };
}

// 발언 타이머: 일시정지하면 남은 시간을 그대로 들고 있다가 이어 간다.
function useTimer() {
  const [t, setT] = useState({ limit: 0, left: 0, running: false, on: false });
  const r = useRef({ endsAt: 0, left: 0, onDone: null, id: 0 });
  const clear = () => { clearInterval(r.current.id); r.current.id = 0; };
  const loop = () => {
    clear();
    r.current.id = setInterval(() => {
      const left = (r.current.endsAt - Date.now()) / 1000;
      if (left <= 0) { clear(); setT(s => ({ ...s, left: 0, running: false })); const f = r.current.onDone; r.current.onDone = null; f && f(); return; }
      setT(s => ({ ...s, left }));
    }, 200);
  };
  const start = (limit, onDone) => { r.current.endsAt = Date.now() + limit * 1000; r.current.onDone = onDone; setT({ limit, left: limit, running: true, on: true }); loop(); };
  const pause = () => { if (!r.current.id) return; clear(); r.current.left = (r.current.endsAt - Date.now()) / 1000; setT(s => ({ ...s, running: false, left: r.current.left })); };
  const resume = () => { if (r.current.id || !r.current.onDone) return; r.current.endsAt = Date.now() + r.current.left * 1000; setT(s => ({ ...s, running: true })); loop(); };
  const stop = () => { clear(); r.current.onDone = null; setT({ limit: 0, left: 0, running: false, on: false }); };
  useEffect(() => clear, []);
  return { ...t, start, pause, resume, stop };
}

// ── 사람 그림 ───────────────────────────────────────────────
const PEOPLE = {
  j1: { skin: '#f1c9a5', hair: '#2a211c', style: 'short', suit: '#2f3e52', tie: '#8a2b3a', glasses: true },
  j2: { skin: '#f3cfb0', hair: '#3a2a22', style: 'long', suit: '#4a3d52', tie: null, glasses: true },
  j3: { skin: '#e8b98f', hair: '#1f1a17', style: 'side', suit: '#2e4a44', tie: '#6b5a2a', glasses: false },
  1: { skin: '#f1c9a5', hair: '#1f1a17', style: 'short', suit: '#33445e', tie: '#9a4a3a', glasses: false },
  2: { skin: '#f3cfb0', hair: '#3b2a20', style: 'long', suit: '#2f5a55', tie: null, glasses: false },
  3: { skin: '#d9a77c', hair: '#2a1f18', style: 'side', suit: '#3d3d56', tie: '#5c6b8a', glasses: false },
  4: { skin: '#f0c4a0', hair: '#4a3324', style: 'bob', suit: '#3a4256', tie: null, glasses: false },
  5: { skin: '#e9bb93', hair: '#2b2622', style: 'short', suit: '#4a4436', tie: '#8a2b3a', glasses: true },
};
function Person({ x, y, p, speaking }) {
  const h = p.hair;
  return (
    <g className={speaking ? 'speaking' : ''}>
      <rect x={x - 40} y={y - 12} width={80} height={96} rx={16} className="cr-chair" />
      {p.style === 'long' && <path d={`M${x - 26} ${y - 4} Q${x - 28} ${y - 33} ${x} ${y - 32} Q${x + 28} ${y - 33} ${x + 26} ${y - 4} L${x + 27} ${y + 34} Q${x + 18} ${y + 40} ${x + 13} ${y + 30} L${x - 13} ${y + 30} Q${x - 18} ${y + 40} ${x - 27} ${y + 34} Z`} fill={h} />}
      {p.style === 'bob' && <path d={`M${x - 26} ${y - 4} Q${x - 28} ${y - 33} ${x} ${y - 32} Q${x + 28} ${y - 33} ${x + 26} ${y - 4} L${x + 26} ${y + 18} Q${x + 20} ${y + 22} ${x + 16} ${y + 16} L${x - 16} ${y + 16} Q${x - 20} ${y + 22} ${x - 26} ${y + 18} Z`} fill={h} />}
      <path d={`M${x - 42} ${y + 84} Q${x - 42} ${y + 40} ${x - 15} ${y + 33} L${x + 15} ${y + 33} Q${x + 42} ${y + 40} ${x + 42} ${y + 84} Z`} fill={p.suit} />
      <rect x={x - 8} y={y + 18} width={16} height={17} fill={p.skin} />
      <path d={`M${x - 13} ${y + 33} L${x} ${y + 58} L${x + 13} ${y + 33} Z`} fill="#f3f1ec" />
      {p.tie && <path d={`M${x - 4} ${y + 37} L${x + 4} ${y + 37} L${x + 6} ${y + 60} L${x} ${y + 67} L${x - 6} ${y + 60} Z`} fill={p.tie} />}
      <ellipse cx={x} cy={y} rx={22} ry={25} fill={p.skin} />
      {p.style === 'short' && <path d={`M${x - 23} ${y - 2} Q${x - 25} ${y - 31} ${x} ${y - 30} Q${x + 25} ${y - 31} ${x + 23} ${y - 2} Q${x + 17} ${y - 17} ${x} ${y - 17} Q${x - 15} ${y - 18} ${x - 23} ${y - 2} Z`} fill={h} />}
      {p.style === 'side' && <path d={`M${x - 23} ${y} Q${x - 25} ${y - 32} ${x + 2} ${y - 30} Q${x + 26} ${y - 29} ${x + 23} ${y - 2} Q${x + 10} ${y - 20} ${x - 8} ${y - 14} Q${x - 16} ${y - 12} ${x - 23} ${y} Z`} fill={h} />}
      {(p.style === 'long' || p.style === 'bob') && <path d={`M${x - 23} ${y - 2} Q${x - 24} ${y - 30} ${x} ${y - 29} Q${x + 24} ${y - 30} ${x + 23} ${y - 2} Q${x + 12} ${y - 16} ${x - 4} ${y - 15} Q${x - 16} ${y - 14} ${x - 23} ${y - 2} Z`} fill={h} />}
      <circle cx={x - 8} cy={y + 2} r={2.3} fill="#2b2420" /><circle cx={x + 8} cy={y + 2} r={2.3} fill="#2b2420" />
      {p.glasses && <g fill="none" stroke="#2b2420" strokeWidth="1.6"><circle cx={x - 8} cy={y + 2} r={6.5} /><circle cx={x + 8} cy={y + 2} r={6.5} /><path d={`M${x - 1.5} ${y + 2} L${x + 1.5} ${y + 2}`} /></g>}
      <path d={`M${x - 6} ${y + 12} Q${x} ${speaking ? 18 : 16} ${x + 6} ${y + 12}`.replace(`Q${x} ${speaking ? 18 : 16}`, `Q${x} ${y + (speaking ? 18 : 16)}`)} stroke="#7a3b2e" strokeWidth="1.8" fill={speaking ? '#7a3b2e' : 'none'} strokeLinecap="round" />
      <circle cx={x - 14} cy={y + 9} r={4} fill="#e88b7a" opacity=".25" /><circle cx={x + 14} cy={y + 9} r={4} fill="#e88b7a" opacity=".25" />
      {speaking && <g className="cr-wave" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"><path d={`M${x + 32} ${y - 8} q6 8 0 16`} /><path d={`M${x + 39} ${y - 14} q10 14 0 28`} /></g>}
    </g>
  );
}

function Room({ active, mySeat, onSeat, busy }) {
  const judges = [['j1', 330, '위원 1', '진행'], ['j2', 500, '위원 2', '꼬리질문'], ['j3', 670, '위원 3', '인성질문']];
  const seats = [1, 2, 3, 4, 5].map((n, i) => [n, 140 + i * 180]);
  const hit = (key, x, y, w, h, label) => (
    <rect x={x} y={y} width={w} height={h} rx={14} className={'cr-hit' + (active === key ? ' on' : '') + (key === mySeat ? ' mine' : '') + (busy ? ' busy' : '')}
      role="button" tabIndex={0} aria-label={label} onClick={() => onSeat(key)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onSeat(key)} />
  );
  return (
    <svg className="cr-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
      <g className="cr-band"><line x1="380" y1="34" x2="440" y2="34" /><text x="500" y="39">면접위원석</text><line x1="560" y1="34" x2="620" y2="34" /></g>
      {judges.map(([k, x, n, r]) => (
        <g key={k}>
          {active === k && <rect x={x - 62} y={58} width={124} height={140} rx={16} className="cr-glow" />}
          <Person x={x} y={102} p={PEOPLE[k]} speaking={active === k} />
          {hit(k, x - 62, 58, 124, 196, `${n} ${r}`)}
        </g>
      ))}
      <rect x="230" y="184" width="540" height="18" rx="6" className="cr-desk-top" />
      <rect x="236" y="200" width="528" height="44" rx="6" className="cr-desk" />
      {judges.map(([k, x, n, r]) => (
        <g key={k + 'p'} className="cr-plate" pointerEvents="none">
          <rect x={x - 46} y={208} width={92} height={30} rx={4} />
          <text x={x} y={222} className="n">{n}</text><text x={x} y={234} className="r">{r}</text>
        </g>
      ))}
      <g className="cr-band"><line x1="360" y1="292" x2="440" y2="292" /><text x="500" y="297">대면 면접</text><line x1="560" y1="292" x2="640" y2="292" /></g>
      <g className="cr-band"><line x1="390" y1="330" x2="440" y2="330" /><text x="500" y="335">지원자석</text><line x1="560" y1="330" x2="610" y2="330" /></g>
      {seats.map(([n, x]) => (
        <g key={n}>
          {n === mySeat && <rect x={x - 72} y={356} width={144} height={222} rx={16} className="cr-mine" />}
          {active === n && <rect x={x - 72} y={356} width={144} height={222} rx={16} className="cr-glow" />}
          <Person x={x} y={410} p={PEOPLE[n]} speaking={active === n} />
          <text x={x} y={530} className="cr-name">지원자 {n}</text>
          <text x={x} y={552} className={'cr-role' + (n === mySeat ? ' me' : '')}>{n === mySeat ? '내 자리' : '답변 듣기'}</text>
          {hit(n, x - 72, 356, 144, 222, n === mySeat ? '내 자리, 배정 문제로 2분 답변 연습' : `지원자 ${n} 1차 모범답변 듣기`)}
        </g>
      ))}
    </svg>
  );
}

// ── 화면 ───────────────────────────────────────────────────
export default function CnuRoom({ onBack }) {
  const [store, setStore] = useState(loadStore);
  const [theme, setTheme] = useState(() => read(THEME, '1'));
  const [speed, setSpeedS] = useState(() => read(SPEED, 1));
  const speedRef = useRef(speed); speedRef.current = speed;
  const audio = useAudio(speedRef), timer = useTimer();
  const [view, setView] = useState({ mode: 'wait', pos: 0 });
  const sess = useRef({ mode: 'wait', steps: [], pos: 0, token: 0, paused: false, drawn: null });
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState(false), [hist, setHist] = useState(false), [notice, setNotice] = useState('');
  const [drawn, setDrawn] = useState(null);
  const capRef = useRef(null), preRef = useRef(null);

  const setIdx = store.cur, assign = store.assign[setIdx];
  const qAt = p => BY_ID[assign[p - 1]];
  const round = store.opened.indexOf(setIdx) + 1;
  const save = n => { setStore(n); write(STORE, n); };
  useEffect(() => { write(THEME, theme); }, [theme]);
  const setSpeed = v => { setSpeedS(v); write(SPEED, v); audio.rate(v); };
  useEffect(() => { const t = setTimeout(() => setNotice(''), 4200); return () => clearTimeout(t); }, [notice]);

  const step = sess.current.steps[view.pos];
  const tok = sess.current.token; // the step this render shows; stale clicks carry an old number and are ignored
  const mode = view.mode;

  // 진행: 각 단계에는 번호표(token)가 있어, 늦게 도착한 종료 신호가 차례를 두 번 넘기지 않는다.
  const exec = pos => {
    const s = sess.current, st = s.steps[pos];
    const token = ++s.token; s.pos = pos;
    timer.stop(); setView({ mode: s.mode, pos });
    if (!st) { stopAll('wait'); return; }
    // Fetch the next clip while this one plays, so turns follow each other without a gap.
    const nx = s.steps.slice(pos + 1).find(x => x.t === 'say');
    if (nx && typeof Audio !== 'undefined') { const pre = new Audio(); pre.preload = 'auto'; pre.src = BASE + nx.key + '.mp3'; preRef.current = pre; }
    if (st.t === 'say') audio.play(st.key, () => { if (sess.current.token === token && !sess.current.paused) exec(pos + 1); });
    else if (st.t === 'user') {
      audio.stop();
      if (st.auto) timer.start(st.limit, () => finish(token));
    } else if (st.t === 'end') {
      audio.stop();
      if (s.mode === 'full' && !store.done.includes(setIdx)) save({ ...store, done: [...store.done, setIdx] });
    }
  };
  const finish = token => { const s = sess.current; if (token !== s.token) return; exec(s.pos + 1); };
  const startUser = () => { const s = sess.current, st = s.steps[s.pos]; if (!st || st.t !== 'user' || timer.on) return; audio.stop(); const token = s.token; timer.start(st.limit, () => finish(token)); };
  const nextTurn = tok => {
    const s = sess.current; if (s.mode === 'wait' || (tok != null && tok !== s.token)) return;
    s.paused = false; setPaused(false);
    const i = s.steps.findIndex((x, j) => j > s.pos && x.turn);
    exec(i < 0 ? s.steps.length - 1 : i);
  };
  const stopAll = (m = 'wait') => {
    const s = sess.current; s.token++; s.mode = m; s.steps = []; s.pos = 0; s.paused = false; s.drawn = null;
    audio.stop(); timer.stop(); setPaused(false); setDrawn(null); setView({ mode: m, pos: 0 });
  };
  const run = (m, steps) => { stopAll(m); const s = sess.current; s.mode = m; s.steps = steps; exec(0); };
  const startFull = () => run('full', buildSteps(setIdx, assign));
  const pause = () => { const s = sess.current; if (s.mode === 'wait' || s.paused) return; s.paused = true; setPaused(true); audio.pause(); timer.pause(); };
  const resume = () => {
    const s = sess.current; if (!s.paused) return; s.paused = false; setPaused(false);
    const st = s.steps[s.pos];
    if (st && st.t === 'say' && audio.state === 'ended') exec(s.pos + 1); else { audio.resume(); timer.resume(); }
  };

  // 대기실 좌석 연습. 전체면접 중에는 좌석을 눌러도 아무것도 바뀌지 않는다.
  const onSeat = k => {
    if (mode === 'full') { setNotice('전체면접 중에는 좌석 연습을 할 수 없어요. ‘대기실로 돌아가기’ 후 이용하세요.'); return; }
    if (k === 'j1') return run('solo', [{ t: 'say', who: 'j1', key: 'sc-intro', text: SCRIPTS.intro, ph: 'solo', sp: 'j1', turn: true }, { t: 'end', ph: 'solo' }]);
    if (k === 'j2') { const q2 = qAt(2); return run('solo', [{ t: 'say', who: 'j2', key: q2.id + '-f', text: q2.f, ph: 'solo', sp: 'j2', qno: 2, turn: true, tag: '꼬리질문' }, { t: 'user', ph: 'solo', sp: 2, qno: 2, limit: 60, auto: true, prompt: q2.f, tag: '꼬리질문' }, { t: 'end', ph: 'solo' }]); }
    if (k === 'j3') { const i = Math.floor(Math.random() * PRACTICE.length); return run('solo', [{ t: 'say', who: 'j3', key: `pp-${i}`, text: PRACTICE[i], ph: 'solo', sp: 'j3', turn: true, tag: '인성질문' }, { t: 'user', ph: 'solo', sp: 2, limit: 60, auto: true, prompt: PRACTICE[i], tag: '인성질문' }, { t: 'end', ph: 'solo' }]); }
    if (k === 2) { const q2 = qAt(2); return run('solo', [{ t: 'say', who: 'j1', key: q2.id + '-q', text: q2.q, ph: 'solo', sp: 'j1', qno: 2, turn: true }, { t: 'user', ph: 'solo', sp: 2, qno: 2, limit: 120, auto: true }, { t: 'end', ph: 'solo' }]); }
    const q = qAt(k);
    run('solo', [{ t: 'say', who: k, key: q.id + '-m1', text: q.m1, ph: 'solo', sp: k, qno: k, turn: true, tag: '1차 모범답변' }, { t: 'end', ph: 'solo' }]);
  };

  const drawTarget = () => { const s = sess.current; if (s.drawn) return; const t = pick([1, 3, 4, 5]); s.drawn = t; setDrawn(t); };
  const replay = (key) => audio.play(key, () => {});

  const newRound = () => {
    const left = SETS.map((_, i) => i).filter(i => !store.opened.includes(i));
    if (!left.length) { setNotice('준비된 새 문제를 모두 열었습니다. 지금 회차나 이전 회차를 다시 연습할 수 있어요.'); return; }
    stopAll();
    const i = pick(left);
    save({ ...store, opened: [...store.opened, i], cur: i, assign: { ...store.assign, [i]: makeAssign(SETS[i]) } });
    setNotice(`새 회차(ROUND ${String(store.opened.length + 1).padStart(2, '0')})를 열었어요.`);
  };
  const reopen = i => { stopAll(); save({ ...store, cur: i }); setHist(false); };

  useEffect(() => { if (capRef.current) capRef.current.scrollTop = 0; }, [view.pos, view.mode]);
  useEffect(() => () => { sess.current.token++; }, []);
  useEffect(() => { const k = e => { if (e.key === 'Escape') { setSheet(false); setHist(false); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, []);

  // ── 진행 영역에 보여 줄 내용 ──
  const ph = mode === 'wait' ? 'wait' : step ? step.ph : 'wait';
  const active = mode !== 'wait' && step ? (step.t === 'user' ? 2 : step.who) : null;
  const isUser = step && step.t === 'user';
  const target = isUser && step.draw ? drawn : step && step.target;
  const qno = step && (step.qno || (isUser && step.draw && drawn) || null);
  let headline = '문제를 보고 준비하세요', sub = '문제지로 답변을 준비한 뒤 전체면접을 시작하세요. 좌석을 눌러 개별 연습도 할 수 있습니다.';
  if (mode !== 'wait' && step) {
    if (step.t === 'end') { headline = mode === 'full' ? '면접이 끝났습니다' : '개별 연습이 끝났습니다'; sub = mode === 'full' ? '대기실로 돌아가 다시 연습하거나 새 회차를 열 수 있어요.' : '다른 좌석을 눌러 계속 연습할 수 있어요.'; }
    else if (isUser) {
      headline = timer.on ? '지금 답변하세요' : step.draw && !drawn ? '반박할 답변을 뽑으세요' : `${step.limit === 60 ? '1분' : '2분'} 답변을 준비하세요`;
      if (step.ph === 'r1') sub = `${step.qno}번 문제 · 2분 동안 소리 내어 답변하세요.`;
      else if (step.draw) sub = drawn ? `${drawn}번 문제 · 지원자 ${drawn}의 1차 의견에 응답 — 먼저 상대 의견을 공정하게 요약하고, 이어서 추가·보완·반대 중 필요한 방식으로 본인의 견해를 제시하세요.` : '지원자 1·3·4·5 중 한 명의 1차 답변이 무작위로 배정됩니다.';
      else if (step.tag) sub = `${step.tag} · 1분 동안 답변하세요.`;
      else if (step.ph === 'solo') sub = `${step.qno}번 문제 · 배정 문제로 2분 답변을 연습합니다.`;
      else sub = step.qno ? `${step.qno}번 문제 · 1분 동안 답변하세요.` : '1분 동안 답변하세요.';
    } else {
      headline = `${whoName(step.who)} ${step.who === 'j1' || step.who === 'j2' || step.who === 'j3' ? '발언 중' : '답변 중'}`;
      if (target) sub = `${target}번 문제 · 지원자 ${target}의 1차 의견에 응답`;
      else if (step.qno && typeof step.who === 'number') sub = `${step.qno}번 문제${step.tag ? ' · ' + step.tag : ''}`;
      else if (step.qno && step.sp === 2) sub = `지원자 2 · ${step.qno}번 문제`;
      else if (typeof step.sp === 'number' && step.who === 'j1') sub = `다음 차례 · 지원자 ${step.sp}${step.qno ? ` · ${step.qno}번 문제` : ''}`;
      else sub = step.tag || PHASE[step.ph] || '';
    }
  }
  const caption = mode !== 'wait' && step ? (step.t === 'say' ? step.text : isUser ? (step.prompt || (step.qno && step.ph !== 'r2' ? qAt(step.qno).q : step.draw && drawn ? qAt(drawn).m1 : '')) : '') : '';
  const capLabel = step && step.t === 'say' ? `${whoName(step.who)} · 자막` : isUser && step.draw && drawn ? `지원자 ${drawn}의 1차 답변 · 자막` : isUser ? '질문' : '답변 자막';
  const clock = isUser ? (timer.on ? timer.left : step.limit) : step && step.t === 'say' ? audio.left : 120;
  const limit = isUser ? step.limit : step && step.t === 'say' ? (AUDIO[step.key]?.d || 0) / speed : 120;
  const frac = limit ? Math.max(0, Math.min(1, clock / limit)) : 1;
  const ftype = FINAL_TYPES[setIdx % 3][1];

  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);
  return createPortal(
    <div className="cr" data-theme={theme}>
      <header className="cr-top">
        <div className="cr-title">
          <button className="cr-back" onClick={() => { stopAll(); onBack(); }} aria-label="학교 목록으로">←<em> 학교 목록</em></button>
          <span className="cr-kicker">GROUP INTERVIEW · 충남대학교 법학전문대학원</span>
          <h1>충남대 로스쿨 <span>면접 </span>시뮬레이션</h1>
          <p>다섯 명이 차례로 지정된 문제에 답합니다. <b>지원자 2는 내 자리입니다.</b></p>
        </div>
        <div className="cr-topbtns">
          <Themes theme={theme} setTheme={setTheme} className="cr-themes top" />
          <button className="cr-btn ghost" onClick={() => setHist(true)}>이전<span className="cr-wide"> 회차</span></button>
          <button className="cr-btn ghost" onClick={newRound}>↻ 새 회차</button>
        </div>
      </header>

      <main className="cr-main">
        <section className="cr-room">
          <div className="cr-room-head"><span><i className="cr-dot" />면접실 01</span><span>ROUND {String(round).padStart(2, '0')}</span></div>
          <div className="cr-room-body"><Room active={active} mySeat={2} onSeat={onSeat} busy={mode === 'full'} /></div>
          <div className="cr-room-foot">{mode === 'full' ? '면접이 진행 중입니다. 일시정지와 다음 차례는 오른쪽 진행 영역에서 할 수 있어요.' : '다른 지원자를 누르면 1차 모범답변을, 위원을 누르면 안내·꼬리질문·인성질문을 바로 연습할 수 있습니다.'}</div>
        </section>

        <section className="cr-panel" aria-live="polite">
          <div className="cr-panel-top">
            <div className="cr-phases">
              {['wait', 'r1', 'r2', 'fin', 'end'].map(k => <span key={k} className={ph === k || (k === 'wait' && ph === 'solo') ? 'on' : ''}>{k === 'wait' && ph === 'solo' ? '개별 연습' : PHASE[k].replace('면접 대기실', '대기실')}</span>)}
            </div>
            <div className={'cr-clock' + (isUser && timer.on && timer.left <= 10 ? ' warn' : '')}>{mmss(clock)}</div>
          </div>
          <div className="cr-bar"><i style={{ width: (frac * 100).toFixed(1) + '%' }} /></div>
          <h2 className={isUser && timer.on ? 'now' : ''}>{paused ? '일시정지됨' : headline}</h2>
          <p className="cr-sub">{sub}</p>

          {isUser && step.draw && !drawn && <button className="cr-btn primary" onClick={drawTarget}>반박할 답변 뽑기</button>}
          {isUser && !timer.on && !step.auto && (!step.draw || drawn) && (
            <div className="cr-row">
              <button className="cr-btn primary" onClick={startUser} disabled={paused}>{step.limit === 60 ? '1분' : '2분'} 답변 시작</button>
              {step.draw && drawn && <button className="cr-btn" onClick={() => replay(qAt(drawn).id + '-m1')}>{audio.key === qAt(drawn).id + '-m1' && audio.state === 'playing' ? '듣는 중…' : `지원자 ${drawn} 1차 답변 다시 듣기`}</button>}
              {step.replay && <button className="cr-btn" onClick={() => replay(step.replay[0])}>질문 다시 듣기</button>}
            </div>
          )}
          {isUser && timer.on && <button className="cr-btn primary" onClick={() => finish(tok)}>답변 마치기</button>}
          {(audio.state === 'blocked') && <button className="cr-btn primary" onClick={audio.retry}>▶ 음성 재생</button>}
          {audio.state === 'error' && step && step.t === 'say' && (
            <div className="cr-err">음성을 불러오지 못했어요. 자막을 읽고 계속 진행하세요.
              <div className="cr-row"><button className="cr-btn" onClick={() => tok === sess.current.token && exec(sess.current.pos)}>다시 듣기</button><button className="cr-btn" onClick={() => tok === sess.current.token && exec(sess.current.pos + 1)}>다음 차례</button></div>
            </div>
          )}

          {caption && (
            <div className="cr-cap">
              <span>{capLabel}</span>
              <div ref={capRef}>{caption}</div>
            </div>
          )}

          <div className="cr-controls">
            {mode === 'wait' && <button className="cr-btn primary" onClick={startFull}>전체면접시작</button>}
            {mode !== 'wait' && step && step.t !== 'end' && (paused
              ? <button className="cr-btn primary" onClick={resume}>다시 시작</button>
              : <button className="cr-btn" onClick={pause}>일시정지</button>)}
            {mode !== 'wait' && step && step.t !== 'end' && <button className="cr-btn" onClick={() => nextTurn(tok)}>다음 차례</button>}
            <button className="cr-btn" onClick={() => setSheet(true)}>문제지 보기</button>
            {mode !== 'wait' && <button className="cr-btn ghost" onClick={() => stopAll()}>대기실로 돌아가기</button>}
            {mode === 'full' && step && step.t === 'end' && <button className="cr-btn primary" onClick={newRound}>새 회차</button>}
          </div>
          <label className="cr-speed">음성 속도
            <select value={speed} onChange={e => setSpeed(+e.target.value)}>
              <option value={0.9}>0.9배</option><option value={1}>기본</option><option value={1.1}>1.1배</option>
            </select>
            <small>마지막 1분 · {ftype}</small>
          </label>
          <Themes theme={theme} setTheme={setTheme} className="cr-themes bottom" />
          {notice && <div className="cr-notice">{notice}</div>}
        </section>
      </main>

      <footer className="cr-foot">
        <button className="cr-sheetbar" onClick={() => setSheet(true)}><b>▸ 면접 문제 보기</b><span>이번 회차 · 5문제 · 1~5번은 지원자 1~5에게 지정</span></button>
        <div className="cr-steps">
          <div><b>01</b><div><strong>대기실 준비</strong><span>찬반형·견해 제시형·해결방안 제시형 문제를 함께 준비합니다.</span></div></div>
          <div><b>02</b><div><strong>1차 발언 · 2분</strong><span>지정된 문제에 답합니다.</span></div></div>
          <div><b>03</b><div><strong>2차 발언 · 2분</strong><span>다른 지원자의 1차 답변을 뽑아 응답하고, 마지막 1분 질문에 답합니다.</span></div></div>
        </div>
      </footer>

      {sheet && <Sheet title={`ROUND ${String(round).padStart(2, '0')} 문제지`} assign={assign} onClose={() => setSheet(false)} />}
      {hist && (
        <div className="cr-modal" onClick={e => e.target === e.currentTarget && setHist(false)}>
          <div className="cr-modal-in">
            <div className="cr-modal-head"><h3>이전 회차</h3><button onClick={() => setHist(false)} aria-label="닫기">×</button></div>
            <p className="cr-sub">이 브라우저에서 연 회차 {store.opened.length}개 / 준비된 회차 {SETS.length}개 · 문항 {SETS.flat().length}개</p>
            <HistList store={store} cur={setIdx} onOpen={reopen} />
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function Themes({ theme, setTheme, className }) {
  return (
    <div className={className} role="group" aria-label="색감 선택">
      {['1', '2', '3'].map(t => <button key={t} className={theme === t ? 'on' : ''} onClick={() => setTheme(t)} aria-label={`색감 ${t}안`}><i data-t={t} />{t}안</button>)}
    </div>
  );
}

function Sheet({ title, assign, onClose }) {
  return (
    <div className="cr-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="cr-modal-in wide">
        <div className="cr-modal-head"><h3>{title}</h3><button onClick={onClose} aria-label="닫기">×</button></div>
        <ol className="cr-sheet">
          {assign.map((id, i) => {
            const q = BY_ID[id];
            return (
              <li key={id}>
                <div className="cr-sheet-no">{i + 1}</div>
                <div>
                  <div className="cr-sheet-meta">{`지원자 ${i + 1}${i === 1 ? ' · 내 문제' : ''}`} · {TYPE_LABEL[q.type]} · {q.field}{q.gichul ? ' · 기출' : ''}</div>
                  <p>{q.q}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function HistList({ store, cur, onOpen }) {
  const [peek, setPeek] = useState(null);
  return (
    <>
      <ul className="cr-hist">
        {store.opened.map((i, n) => (
          <li key={i} className={i === cur ? 'on' : ''}>
            <b>ROUND {String(n + 1).padStart(2, '0')}</b>
            <span>{store.done.includes(i) ? '✓ 연습함' : '연습 전'}{i === cur ? ' · 지금 회차' : ''}</span>
            <button className="cr-btn ghost sm" onClick={() => setPeek(i)}>문제지</button>
            <button className="cr-btn sm" onClick={() => onOpen(i)}>{i === cur ? '처음부터' : '다시 연습'}</button>
          </li>
        ))}
      </ul>
      {peek != null && <Sheet title={`ROUND ${String(store.opened.indexOf(peek) + 1).padStart(2, '0')} 문제지`} assign={store.assign[peek]} onClose={() => setPeek(null)} />}
    </>
  );
}
