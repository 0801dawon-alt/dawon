import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FORMATS, PERSONAL } from '../data/schools/formats.js';
import { loadBank } from '../lib/bank.js';
import { ask, hasApiKey, inArtifact, lastAiIssue } from '../lib/ai.js';
import { PEOPLE, Person } from './RoomPeople.jsx';
import './cnu-room.css';
import './indiv-room.css';

// 개별면접 시뮬레이션: 준비 단계(제시문 열람·메모 또는 서면 답안) → 면접위원 3명과 구술면접.
// 면접위원 대사는 브라우저 음성으로 읽고, 지원자는 말하거나 적어서 답한다. 꼬리질문은 Claude가 연결되어 있으면
// 답변을 듣고 만들고, 없으면 문제은행에 미리 써 둔 꼬리질문을 쓴다.
const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage off */ } };
const pick = a => a[Math.floor(Math.random() * a.length)];
const mmss = s => { const a = Math.max(0, Math.ceil(s)); return String(Math.floor(a / 60)).padStart(2, '0') + ':' + String(a % 60).padStart(2, '0'); };
const JUDGE = ['j1', 'j2', 'j3'];
const GENERIC_FU = [
  '방금 답변의 핵심 근거가 무엇인지 한 문장으로 다시 정리해 주시겠습니까?',
  '지원자의 입장에 가장 강하게 반대할 사람은 누구이고, 그 사람에게 어떻게 답하겠습니까?',
  '제시한 해결책이 실제로 시행될 때 생길 수 있는 부작용은 무엇입니까?',
  '두 가치가 충돌할 때 지원자는 어떤 기준으로 우선순위를 정했습니까?',
  '방금 답변에서 제시문의 어느 부분을 근거로 삼았는지 짚어 주시겠습니까?',
  '지원자의 주장이 틀렸다고 판명될 수 있는 상황이 있다면 어떤 경우입니까?',
  '그 주장을 실제 정책으로 옮긴다면 가장 먼저 무엇을 바꾸겠습니까?',
  '방금 든 예시와 반대되는 사례가 있다면 지원자의 결론은 달라집니까?',
  '지원자의 입장으로 가장 손해를 보는 사람은 누구이고, 그 손해는 정당화됩니까?',
  '같은 질문을 10년 뒤에 받는다면 답이 달라질 수 있다고 봅니까?',
];

// ── 면접위원 음성: 브라우저 음성 합성. 한국어 음성이 없으면 자막만 보여 준다. ──
function useVoice() {
  const [speaking, setSpeaking] = useState(false);
  const [rate, setRate] = useState(() => read('tl-indiv-rate', 1));
  const tok = useRef(0);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const voices = () => (synth ? synth.getVoices().filter(v => /^ko/i.test(v.lang)) : []);
  useEffect(() => { if (synth) synth.getVoices(); return () => synth && synth.cancel(); }, []);
  useEffect(() => write('tl-indiv-rate', rate), [rate]);
  const stop = () => { tok.current++; synth && synth.cancel(); setSpeaking(false); };
  const speak = (text, who) => new Promise(resolve => {
    const my = ++tok.current;
    const ko = voices();
    if (!synth || !ko.length) { resolve(false); return; }
    synth.cancel();
    const voice = ko[JUDGE.indexOf(who) % ko.length] || ko[0];
    const pitch = { j1: 0.9, j2: 1.1, j3: 1 }[who] || 1;
    // 긴 문장을 한 번에 읽으면 크롬이 중간에 끊기므로 문장 단위로 나눈다.
    const parts = text.match(/[^.?!。]+[.?!。]?/g) || [text];
    let i = 0;
    setSpeaking(true);
    const next = () => {
      if (my !== tok.current) return resolve(false);
      if (i >= parts.length) { setSpeaking(false); return resolve(true); }
      const u = new SpeechSynthesisUtterance(parts[i++].trim());
      u.lang = 'ko-KR'; u.voice = voice; u.rate = rate; u.pitch = pitch;
      u.onend = next; u.onerror = next;
      synth.speak(u);
    };
    next();
  });
  return { speaking, speak, stop, rate, setRate, ok: () => !!synth && voices().length > 0 };
}

// ── 지원자 음성 입력: claude.ai 화면에서는 받아쓰기 기능, 그 밖에서는 브라우저 음성 인식. ──
function useListen() {
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [err, setErr] = useState('');
  const r = useRef({ active: false, dict: null });
  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const [dictReady, setDictReady] = useState(false);
  useEffect(() => {
    if (!inArtifact()) return;
    window.claude.use('dictation').then(d => {
      if (!d) return;
      r.current.dict = d; setDictReady(true);
      d.onPartial(({ text: t }) => setInterim(t));
      d.onFinal(({ text: t }) => { setInterim(''); setText(x => (x ? x + ' ' : '') + t.trim()); });
      d.onState(({ state }) => setListening(state === 'listening'));
    }).catch(() => {});
  }, []);
  const supported = dictReady || (!inArtifact() && !!SR);
  const start = () => {
    setErr('');
    const d = r.current.dict;
    if (d) {
      d.start().catch(e => setErr(e?.code === 'not_granted' ? '받아쓰기가 허용되지 않았어요. 답변 칸에 직접 적어 주세요.' : '받아쓰기를 시작하지 못했어요. 다시 눌러 주세요.'));
      return;
    }
    if (!SR) return;
    const sr = r.current.sr = new SR(); sr.lang = 'ko-KR'; sr.continuous = true; sr.interimResults = true;
    sr.onresult = ev => {
      let it = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) setText(x => (x ? x + ' ' : '') + t.trim()); else it += t;
      }
      setInterim(it);
    };
    // 크롬은 잠깐 말이 끊기면 인식을 멈추므로 답변하는 동안 다시 켠다.
    sr.onend = () => { if (r.current.active) { try { sr.start(); } catch { /* running */ } } else setListening(false); };
    sr.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { r.current.active = false; setErr('마이크 권한이 없어요. 답변 칸에 직접 적어 주세요.'); } };
    r.current.active = true; setListening(true);
    try { sr.start(); } catch { /* running */ }
  };
  const stop = () => {
    const d = r.current.dict;
    if (d) { d.stop().catch(() => {}); return; }
    r.current.active = false; setListening(false); setInterim('');
    try { r.current.sr && r.current.sr.stop(); } catch { /* not running */ }
  };
  useEffect(() => () => { r.current.active = false; try { r.current.sr && r.current.sr.stop(); } catch { /* */ } }, []);
  const reset = () => { setText(''); setInterim(''); };
  // 받아쓰기 결과는 멈춘 뒤에도 조금 늦게 들어오므로, 답변을 마칠 때는 가장 최근 값을 읽는다.
  const live = useRef({}); live.current = { text, interim };
  const snap = () => (live.current.text + ' ' + live.current.interim).trim();
  return { supported, listening, text, setText, interim, err, start, stop, reset, snap };
}

function useCountdown() {
  const [left, setLeft] = useState(0);
  const r = useRef({ end: 0, id: 0, done: null, paused: 0 });
  const clear = () => { clearInterval(r.current.id); r.current.id = 0; };
  const tick = () => {
    clear();
    r.current.id = setInterval(() => {
      const l = (r.current.end - Date.now()) / 1000;
      if (l <= 0) { clear(); setLeft(0); const f = r.current.done; r.current.done = null; f && f(); return; }
      setLeft(l);
    }, 250);
  };
  const start = (sec, done) => { r.current.end = Date.now() + sec * 1000; r.current.done = done; setLeft(sec); tick(); };
  const stop = () => { clear(); r.current.done = null; };
  useEffect(() => clear, []);
  return { left, start, stop };
}

// ── 면접실 그림: 면접위원(2~3명)과 지원자 1명. ──
function Room({ active, roles, onJudge, me }) {
  const xs = roles.length === 2 ? [400, 600] : [330, 500, 670];
  const JUDGE = ['j1', 'j2', 'j3'].slice(0, roles.length);
  return (
    <svg className="cr-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid meet">
      <g className="cr-band"><line x1="380" y1="34" x2="440" y2="34" /><text x="500" y="39">면접위원석</text><line x1="560" y1="34" x2="620" y2="34" /></g>
      {JUDGE.map((k, i) => (
        <g key={k}>
          {active === k && <rect x={xs[i] - 62} y={58} width={124} height={140} rx={16} className="cr-glow" />}
          <Person x={xs[i]} y={102} p={PEOPLE[k]} speaking={active === k} />
        </g>
      ))}
      <rect x="230" y="184" width="540" height="18" rx="6" className="cr-desk-top" />
      <rect x="236" y="200" width="528" height="44" rx="6" className="cr-desk" />
      {JUDGE.map((k, i) => (
        <g key={k + 'p'} className="cr-plate" pointerEvents="none">
          <rect x={xs[i] - 50} y={208} width={100} height={30} rx={4} />
          <text x={xs[i]} y={222} className="n">위원 {i + 1}</text><text x={xs[i]} y={234} className="r">{roles[i][0]}</text>
        </g>
      ))}
      {JUDGE.map((k, i) => (
        <rect key={k + 'h'} x={xs[i] - 62} y={58} width={124} height={196} rx={14} className={'cr-hit' + (active === k ? ' on' : '')}
          role="button" tabIndex={0} aria-label={`위원 ${i + 1} ${roles[i][0]} — 눌러서 추가질문 받기`}
          onClick={() => onJudge(k)} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onJudge(k)} />
      ))}
      <g className="cr-band"><line x1="390" y1="300" x2="440" y2="300" /><text x="500" y="305">개별 면접</text><line x1="560" y1="300" x2="610" y2="300" /></g>
      
      <g>
        <rect x={428} y={326} width={144} height={222} rx={16} className="cr-mine" />
        {active === 'me' && <rect x={428} y={326} width={144} height={222} rx={16} className="cr-glow" />}
        <Person x={500} y={380} p={PEOPLE[me]} speaking={active === 'me'} />
        <rect x="410" y="462" width="180" height="14" rx="6" className="cr-desk-top" />
        <text x={500} y={505} className="cr-name">지원자</text>
        <text x={500} y={527} className="cr-role me">내 자리</text>
      </g>
    </svg>
  );
}

function Passage({ set, show, lead }) {
  return (
    <div className="ir-doc">
      {lead && <p className="ir-lead">{lead}</p>}
      <h3>{set.title}</h3>
      {(set.ps || []).map(p => (
        <div key={p.label} className="ir-ps"><b>{p.label.length > 2 ? p.label : `(${p.label})`}</b>{p.source && <small>{p.source}</small>}<p>{p.text}</p></div>
      ))}
      <ol className="ir-qs">{set.qs.map((q, i) => show.includes(i) && <li key={i} value={i + 1}>{q}</li>)}</ol>
    </div>
  );
}

const followupPrompt = (set, q, answer, prev, kind, written = '') => `너는 로스쿨 개별 구술면접의 면접위원이다. 법률 지식(조문·판례·법률 용어)은 묻지 않고, 논리와 가치 판단, 제시문 이해를 묻는다.
${kind === 'probe' ? '제시문을 제대로 읽었는지 확인하거나, 지원자가 놓친 제시문의 내용을 짚어 묻는 질문 1개를 던져라.' : kind === 'counter' ? '지원자 답변과 반대되는 입장의 가장 강한 논거를 들어 재반박을 요구하는 질문 1개를 던져라.' : '지원자의 답변을 듣고 꼬리질문 1개를 던져라. 답변의 전제나 기준을 흔들거나, 약한 근거를 파고들거나, 제시한 대안의 부작용과 실현 가능성을 따지는 것 가운데 가장 효과적인 것을 고른다.'}
답변에 실제로 나온 표현을 짚어서 구체적으로 묻고, 2문장을 넘기지 않는다. '~입니까?'로 끝낸다. 이전 질문과 겹치지 않게 한다. 질문 문장만 출력.
[제시문 제목] ${set.title}
${set.ps.length ? '[제시문] ' + set.ps.map(p => `(${p.label}) ${p.text}`).join('\n').slice(0, 3500) : ''}
${set.ps.length && set.qs.length > 1 ? '[서면 문제]\n' + set.qs.map((x, i) => `${i + 1}. ${x}`).join('\n') + '\n' : ''}${written ? '[지원자의 서면 답안]\n' + written.slice(0, 3000) + '\n서면 답안과 방금 답변을 함께 근거로 삼아, 답안에 쓴 표현을 짚어 묻는다.\n' : ''}[이번 질문] ${q}
[지원자 답변] ${(answer || '(답변 없음)').slice(0, 2500)}
${prev.length ? '[이미 한 질문] ' + prev.join(' / ') : ''}`;

// 노크 소리: 짧은 저음 두 번(Web Audio). 소리를 낼 수 없으면 조용히 넘어간다.
function knock() {
  try {
    const C = window.AudioContext || window.webkitAudioContext; const c = new C();
    [0, 0.22].forEach(t => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = 130; o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0.0001, c.currentTime + t); g.gain.exponentialRampToValueAtTime(0.6, c.currentTime + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.15);
      o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.16);
    });
    setTimeout(() => c.close && c.close(), 800);
  } catch { /* no audio */ }
}

export default function IndivRoom({ school, onBack }) {
  const cfg = FORMATS[school];
  const stage = cfg.stages[0] || null;
  const LASTJ = JUDGE[cfg.judges.length - 1];
  const voice = useVoice();
  const mic = useListen();
  const prepClock = useCountdown();
  const oralClock = useCountdown();
  const [mode, setMode] = useState('wait'); // wait · prep · oral · end
  const [set, setSet] = useState(null);
  const [notes, setNotes] = useState({});
  const [log, setLog] = useState([]); // {who, text, kind}
  const [turn, setTurn] = useState(null); // {who, text, kind, q}
  const [phase, setPhase] = useState('idle'); // speaking · answer · thinking · idle
  const [timeUp, setTimeUp] = useState(false);
  const [sheet, setSheet] = useState('');
  const [notice, setNotice] = useState('');
  const [me] = useState(() => pick([1, 2, 3, 4, 5]));
  const s = useRef({ token: 0, main: [], mi: 0, fuUsed: [], pqUsed: [], asked: [], count: 0, timeUp: false });
  const seenKey = `tl-indiv-${school}-seen`;
  const flash = t => { setNotice(t); clearTimeout(flash.id); flash.id = setTimeout(() => setNotice(''), 3200); };

  // 문제: 문제은행 제시문 세트에서 이 학교에서 아직 안 푼 것을 고른다.
  const drawSet = async () => {
    const b = await loadBank();
    const seen = read(seenKey, []);
    // 제시문 없이 면접실에서 질문을 받는 학교: 모범답안이 있는 단독 질문 두 개(서로 다른 주제).
    // 강원대: 기출 형식으로 새로 쓴 세트.
    if (cfg.source === 'kangwon') {
      const K = (await import('../data/schools/kangwon-sets.js')).default;
      const fresh = K.filter(p => !seen.includes(p.id));
      const p = pick(fresh.length ? fresh : K);
      write(seenKey, [...seen.filter(x => x !== p.id), p.id].slice(-400));
      return { ...p, qi: 0 };
    }
    if (cfg.source === 'q') {
      const pool = b.qs.filter(x => x.m && x.q && x.q.length <= 220);
      const fresh = pool.filter(x => !seen.includes(x.q));
      const a = pick(fresh.length ? fresh : pool);
      const rest = (fresh.length > 1 ? fresh : pool).filter(x => x !== a && x.t !== a.t);
      const c = pick(rest);
      write(seenKey, [...seen, a.q, c.q].slice(-800));
      return { id: 'q-' + Date.now(), title: '면접 질문', lt: '질문형', ps: [], qs: [a.q, c.q], ms: [a.m, c.m], fu: [], qi: 0 };
    }
    const pool = b.ps.filter(p => (p.qs || []).length >= (cfg.main === 'next' ? 3 : 1) && (p.ps || []).length);
    const fresh = pool.filter(p => !seen.includes(p.id));
    const p = pick(fresh.length ? fresh : pool);
    write(seenKey, [...seen.filter(x => x !== p.id), p.id].slice(-400));
    const qi = cfg.main === 'one' ? Math.floor(Math.random() * p.qs.length) : 0;
    return { ...p, qi };
  };
  useEffect(() => { drawSet().then(setSet); }, [school]);
  useEffect(() => { const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = o; }; }, []);
  useEffect(() => () => { s.current.token++; voice.stop(); }, []);

  // 준비 단계에서 보는 문제와, 구술에서 묻는 문제.
  const prepShow = !set ? [] : cfg.main === 'one' ? [set.qi] : cfg.main === 'next' ? [0, 1] : set.qs.map((_, i) => i);
  const notesRef = useRef(notes); notesRef.current = notes;
  const writtenText = () => Object.entries(notesRef.current).filter(([, v]) => v && v.trim()).map(([k, v]) => (k < 0 ? '[메모] ' : `[${+k + 1}번 답안] `) + v.trim()).join('\n');
  const mainIdx = !set ? [] : cfg.main === 'one' ? [set.qi] : cfg.main === 'next' ? [2] : set.qs.map((_, i) => i);

  // 강원대: 면접 종료 1분 전에 밖에서 진행요원이 노크한다.
  useEffect(() => {
    if (mode !== 'oral' || !cfg.knock || s.current.knocked || oralClock.left <= 0 || oralClock.left > 60) return;
    s.current.knocked = true; knock();
    flash('똑똑 — 면접 종료 1분 전입니다. 답변을 마무리하세요.');
  }, [oralClock.left, mode]);

  const stopAll = () => { s.current.token++; voice.stop(); mic.stop(); prepClock.stop(); oralClock.stop(); setPhase('idle'); setTurn(null); };

  const startPrep = () => {
    stopAll(); setNotes({}); setLog([]); setTimeUp(false); s.current.timeUp = false;
    setMode('prep');
    prepClock.start(stage.sec, () => { flash(`${stage.label} 시간이 끝났어요. 면접실로 이동합니다.`); enterOral(); });
  };

  // 면접위원 한 명이 말하고, 끝나면 지원자 답변 차례로 넘어간다.
  const say = async (who, text, kind, extra = {}) => {
    const my = s.current.token;
    mic.stop();
    const t = { who, text, kind, ...extra };
    setTurn(t); setPhase('speaking');
    setLog(l => [...l, { who, text, kind }]);
    if (kind === 'q' || kind === 'fu' || kind === 'pq') s.current.asked.push(text);
    await voice.speak(text, who);
    if (my !== s.current.token) return;
    if (kind === 'close') { setPhase('idle'); finishOral(); return; }
    if (kind === 'intro') return;
    setPhase('answer'); mic.reset();
  };

  const enterOral = async () => {
    prepClock.stop();
    const my = ++s.current.token;
    setMode('oral'); setLog([]); setTimeUp(false);
    Object.assign(s.current, { main: mainIdx, mi: 0, fuUsed: [], pqUsed: [], asked: [], count: 0, timeUp: false });
    s.current.knocked = false;
    oralClock.start(cfg.oral, () => { s.current.timeUp = true; setTimeUp(true); });
    const intro = cfg.main === 'written'
      ? '자리에 앉으세요. 지금부터 대면 면접을 시작하겠습니다. 작성한 서면 답안의 복사본을 드렸으니 보면서 답해도 됩니다. 서면 답안을 바탕으로 질문하겠습니다.'
      : cfg.source === 'q'
      ? '자리에 앉으세요. 지금부터 면접을 시작하겠습니다. 질문을 드리면 잠시 생각한 뒤 답변해 주세요.'
      : cfg.main === 'next'
      ? '자리에 앉으세요. 지금부터 구술면접을 시작하겠습니다. 서면으로 답한 문제와 같은 제시문에 딸린 다른 문제를 드리겠습니다. 잠시 생각한 뒤 답변해 주세요.'
      : cfg.main === 'all'
        ? '자리에 앉으세요. 지금부터 구술면접을 시작하겠습니다. 작성한 서면 답안을 바탕으로 질문하겠습니다. 답안을 보면서 답해도 됩니다.'
        : '자리에 앉으세요. 지금부터 면접을 시작하겠습니다. 준비실에서 작성한 메모를 보면서 답변해도 됩니다.';
    await say('j1', intro, 'intro');
    if (my !== s.current.token) return;
    askMain();
  };

  const askMain = () => {
    const st = s.current;
    if (st.mi >= st.main.length) return afterMains();
    const qi = st.main[st.mi++];
    if (cfg.main === 'written') {
      const has = (notesRef.current[qi] || '').trim();
      return say('j1', has ? `${qi + 1}번 문제에 대해 서면 답안에 쓴 내용을 간단히 설명해 주세요.` : `${qi + 1}번 문제는 서면 답안에 쓰지 않았는데, 지금 말로 답해 보시겠습니까?`, 'q', { qi });
    }
    const n = st.main.length > 1 ? `${qi + 1}번 문제입니다. ` : '';
    say('j1', n + set.qs[qi], 'q', { qi });
  };

  const fallbackFu = () => {
    const st = s.current;
    const list = [...(set.fu || []), ...GENERIC_FU.filter(x => set.ps.length || !x.includes('제시문'))].filter(x => !st.fuUsed.includes(x) && !st.asked.includes(x));
    const q = list[0] || pick(GENERIC_FU);
    st.fuUsed.push(q);
    return q;
  };
  const makeFu = async (kind, lastQ, lastA) => {
    if (!hasApiKey()) return { q: fallbackFu(), ai: false };
    const q = ((await ask(followupPrompt(set, lastQ, lastA, s.current.asked, kind, writtenText()))) || '').trim().replace(/^["'“]|["'”]$/g, '');
    if (q) return { q, ai: true };
    const why = lastAiIssue();
    if (why) flash(why + ' 미리 준비된 질문으로 이어 갑니다.');
    return { q: fallbackFu(), ai: false };
  };
  const personalQ = () => {
    const st = s.current;
    const list = PERSONAL.map(x => x.replace('{s}', cfg.name)).filter(x => !st.pqUsed.includes(x));
    const q = pick(list.length ? list : PERSONAL.map(x => x.replace('{s}', cfg.name)));
    st.pqUsed.push(q);
    return q;
  };

  // 지정 질문이 끝난 뒤: 인성 질문을 하는 학교는 인성 질문, 그 뒤로는 시간이 다 될 때까지 위원들이 추가질문.
  const afterMains = () => {
    const st = s.current;
    if (cfg.personal && st.pqUsed.length < 2) return say('j3', personalQ(), 'pq');
    return follow(st.count % 2 ? LASTJ : 'j2');
  };

  // 위원 who가 지원자의 마지막 답변을 듣고 질문한다.
  const follow = async (who, kind) => {
    const my = s.current.token;
    const lastA = [...logRef.current].reverse().find(x => x.who === 'me');
    const lastQ = [...logRef.current].reverse().find(x => x.who !== 'me' && x.kind !== 'intro');
    if (who === 'j3' && cfg.personal && kind !== 'fu') return say('j3', personalQ(), 'pq');
    setTurn({ who, text: '', kind: 'fu' }); setPhase('thinking');
    const k = kind || (who === 'j1' ? 'probe' : who === 'j3' ? 'counter' : 'fu');
    const { q } = await makeFu(k, lastQ ? lastQ.text : set.qs[mainIdx[0]], lastA ? lastA.text : '');
    if (my !== s.current.token) return;
    say(who, q, 'fu');
  };
  const logRef = useRef(log); logRef.current = log;

  const finishAnswer = () => {
    mic.stop();
    const last = turn && turn.kind;
    setTimeout(() => {
      const text = mic.snap();
      setLog(l => { const n = [...l, { who: 'me', text: text || '(답변하지 않음)', kind: 'a' }]; logRef.current = n; return n; });
      mic.reset();
      const st = s.current;
      st.count++;
      if (st.timeUp) return say('j1', '시간이 다 되었습니다. 이것으로 면접을 마치겠습니다. 수고하셨습니다.', 'close');
      // 지정 문제마다 꼬리질문을 하나씩 받고 다음 문제로 넘어간다.
      if (last === 'q') return follow('j2', 'fu');
      if (st.mi < st.main.length) return askMain();
      afterMains();
    }, 350);
  };

  const finishOral = () => { oralClock.stop(); mic.stop(); setMode('end'); setPhase('idle'); setTurn(null); };
  const endNow = () => { s.current.token++; voice.stop(); say('j1', '이것으로 면접을 마치겠습니다. 수고하셨습니다.', 'close'); };

  const onJudge = k => {
    if (mode !== 'oral') { flash(mode === 'end' ? '면접이 끝났어요. 다시 하기를 눌러 주세요.' : '면접실에 들어가면 면접위원을 눌러 추가질문을 받을 수 있어요.'); return; }
    if (phase === 'speaking' || phase === 'thinking') { flash('면접위원이 말하는 중이에요. 끝난 뒤 눌러 주세요.'); return; }
    if (phase === 'answer' && (mic.text || mic.interim).trim()) { flash('지금 답변을 먼저 마친 뒤 눌러 주세요.'); return; }
    s.current.token++;
    if (k === 'j3' && cfg.personal) say('j3', personalQ(), 'pq');
    else follow(k);
  };

  const again = async (same) => {
    stopAll(); setMode('wait'); setLog([]); setNotes({});
    if (!same) setSet(await drawSet());
  };

  // ── 화면 ──
  const active = phase === 'speaking' || phase === 'thinking' ? turn && turn.who : phase === 'answer' ? 'me' : null;
  const whoLabel = w => w === 'me' ? '지원자(나)' : `위원 ${JUDGE.indexOf(w) + 1} · ${cfg.judges[JUDGE.indexOf(w)][0]}`;
  const PH = [['wait', '대기실'], ...(stage ? [['prep', stage.label]] : []), ['oral', cfg.oralLabel || '구술면접'], ['end', '면접 종료']];
  let headline = '대기실', sub = cfg.summary;
  if (mode === 'wait') { headline = '면접을 시작하세요'; sub = stage ? `${stage.label} ${mmss(stage.sec).replace(/^0/, '')} → 구술면접 ${Math.round(cfg.oral / 60)}분. ${stage.how}` : `구술면접 약 ${Math.round(cfg.oral / 60)}분. ${cfg.how}`; }
  if (mode === 'prep') { headline = `${stage.label} 중`; sub = stage.how; }
  if (mode === 'oral') {
    if (phase === 'thinking') { headline = `${whoLabel(turn.who)} 질문 준비 중…`; sub = hasApiKey() ? 'Claude가 방금 답변을 듣고 질문을 만들고 있어요.' : ''; }
    else if (phase === 'speaking') { headline = `${whoLabel(turn.who)} 발언 중`; sub = turn.kind === 'pq' ? '인성 질문' : turn.kind === 'fu' ? '추가질문' : turn.kind === 'q' ? '면접 문제' : ''; }
    else if (phase === 'answer') { headline = '지금 답변하세요'; sub = timeUp ? '면접 시간이 끝났어요. 이 답변을 마치면 면접이 끝납니다.' : mic.supported ? '‘말하기’를 누르고 소리 내어 답하세요. 말한 내용이 아래에 적혀요.' : '소리 내어 답하고, 핵심을 아래 칸에 적어 두면 꼬리질문이 그 답변에 맞춰 나와요.'; }
    else { headline = '면접 진행 중'; sub = '면접위원을 누르면 추가질문을 받을 수 있어요.'; }
  }
  if (mode === 'end') { headline = '면접이 끝났습니다'; sub = '질문과 내 답변, 모범답안을 확인해 보세요.'; }
  const clock = mode === 'prep' ? prepClock.left : mode === 'oral' ? oralClock.left : mode === 'wait' ? (stage ? stage.sec : cfg.oral) : 0;
  const limit = mode === 'prep' ? stage.sec : cfg.oral;
  const frac = mode === 'wait' ? 1 : Math.max(0, Math.min(1, clock / limit));
  const caption = mode === 'oral' && turn && turn.text ? turn.text : '';
  const noteLabel = stage && stage.k === 'write' ? '서면 답안' : '메모';

  return createPortal(
    <div className={'cr ir' + (mode === 'prep' ? ' prep' : '')}>
      <header className="cr-top">
        <div className="cr-title">
          <button className="cr-back" onClick={() => { stopAll(); onBack(); }} aria-label="로스쿨 목록으로">←<em> 로스쿨 목록</em></button>
          <span className="cr-kicker">{cfg.kicker}</span>
          <span className="cr-ls">법학전문대학원 입학 면접</span>
          <h1>{cfg.name} 로스쿨 <span>면접 </span>시뮬레이션</h1>
          <p>{cfg.summary}</p>
        </div>
        <div className="cr-topbtns">
          <button className="cr-btn ghost" onClick={() => setSheet('info')}>면접 방식<span className="cr-wide"> 안내</span></button>
          <button className="cr-btn ghost" onClick={() => again(false)}>↻ 새 문제</button>
        </div>
      </header>

      <main className="cr-main">
        <section className="cr-room">
          <div className="cr-room-head"><span><i className="cr-dot" />{mode === 'prep' ? stage.label : '로스쿨 면접고사장'}</span><span>{set ? set.lt || '제시문' : '문제 불러오는 중'}</span></div>
          <div className="cr-room-body">
            {mode === 'prep' && set ? <Passage set={set} show={prepShow} lead={cfg.lead} /> : <Room active={active} roles={cfg.judges} onJudge={onJudge} me={me} />}
          </div>
          <div className="cr-room-foot">{mode === 'prep' ? '제시문과 문제를 읽고 오른쪽에 적으세요.' : `면접위원 ${cfg.judges.length}명 · 지원자 1명${cfg.judgesSure ? '' : ` (위원 수는 공지에 없어 ${cfg.judges.length}명으로 배치)`} · 면접위원을 누르면 추가질문을 받을 수 있어요.`}</div>
        </section>

        <section className="cr-panel" aria-live="polite">
          <div className="cr-panel-top">
            <div className="cr-phases">{PH.map(([k, l]) => <span key={k} className={mode === k ? 'on' : ''}>{l}</span>)}</div>
            <div className={'cr-clock' + ((mode === 'prep' || mode === 'oral') && clock <= 30 ? ' warn' : '')}>{mmss(clock)}</div>
          </div>
          <div className="cr-bar"><i style={{ width: (frac * 100).toFixed(1) + '%' }} /></div>
          <h2 className={phase === 'answer' ? 'now' : ''}>{headline}</h2>
          <p className="cr-sub">{sub}</p>

          {mode === 'prep' && set && (
            <div className="ir-notes">
              {(stage.k === 'read' ? [-1] : prepShow).map(i => (
                <label key={i}>{i < 0 ? '답변 메모' : `${i + 1}번 답안`}
                  <textarea value={notes[i] || ''} onChange={e => setNotes(n => ({ ...n, [i]: e.target.value }))} placeholder={i < 0 ? '핵심 논지, 근거, 예상 반론을 적어 두세요.' : '답안을 적으세요.'} />
                </label>
              ))}
            </div>
          )}

          {caption && (<div className="cr-cap"><span>{whoLabel(turn.who)} · 자막</span><div>{caption}</div></div>)}
          {phase === 'thinking' && <div className="cr-cap"><span>잠시만요</span><div>면접위원이 답변을 듣고 질문을 고르고 있어요…</div></div>}

          {mode === 'oral' && phase === 'answer' && (
            <div className="ir-ans">
              <textarea value={mic.text + (mic.interim ? (mic.text ? ' ' : '') + mic.interim : '')} onChange={e => mic.setText(e.target.value)} placeholder={mic.supported ? '말하기를 누르면 답변이 여기에 적혀요. 직접 고쳐 써도 돼요.' : '답변을 적거나, 소리 내어 말한 뒤 핵심만 적어도 돼요.'} />
              {mic.err && <small className="cr-err">{mic.err}</small>}
              <div className="cr-row">
                {mic.supported && (mic.listening
                  ? <button className="cr-btn" onClick={mic.stop}>■ 말하기 멈추기</button>
                  : <button className="cr-btn" onClick={mic.start}>🎙 말하기</button>)}
                <button className="cr-btn primary" onClick={finishAnswer}>답변 마치기</button>
                {turn && <button className="cr-btn ghost" onClick={() => voice.speak(turn.text, turn.who)}>질문 다시 듣기</button>}
              </div>
            </div>
          )}

          {mode === 'end' && (
            <div className="cr-cap ir-review"><span>면접 기록</span>
              <div>{log.filter(x => x.kind !== 'intro' && x.kind !== 'close').map((x, i) => <p key={i} className={x.who === 'me' ? 'me' : ''}><b>{whoLabel(x.who)}</b>{x.text}</p>)}</div>
            </div>
          )}

          <div className="cr-controls">
            {mode === 'wait' && stage && <button className="cr-btn primary" onClick={startPrep} disabled={!set}>면접 시작 · {stage.label}</button>}
            {mode === 'wait' && <button className={'cr-btn' + (stage ? '' : ' primary')} onClick={enterOral} disabled={!set}>{stage ? '바로 구술면접' : '면접 시작'}</button>}
            {mode === 'prep' && <button className="cr-btn primary" onClick={enterOral}>준비 끝 · 면접실 입장</button>}
            {(mode === 'oral' || mode === 'end') && Object.values(notes).some(Boolean) && <button className="cr-btn" onClick={() => setSheet('notes')}>내 {noteLabel}</button>}
            {mode !== 'prep' && set && set.ps.length > 0 && <button className="cr-btn" onClick={() => setSheet('doc')}>제시문 보기</button>}
            {mode === 'oral' && <button className="cr-btn ghost" onClick={endNow}>면접 끝내기</button>}
            {mode === 'end' && <button className="cr-btn" onClick={() => setSheet('model')}>모범답안</button>}
            {mode === 'end' && <button className="cr-btn" onClick={() => again(true)}>같은 문제 다시</button>}
            {mode === 'end' && <button className="cr-btn primary" onClick={() => again(false)}>새 문제로</button>}
          </div>
          <label className="cr-speed">음성 속도
            <select value={voice.rate} onChange={e => voice.setRate(+e.target.value)}>
              <option value={0.9}>0.9배</option><option value={1}>기본</option><option value={1.15}>1.15배</option>
            </select>
            <small>{hasApiKey() ? '꼬리질문: Claude가 답변을 듣고 만듦' : '꼬리질문: 미리 준비된 질문'}</small>
          </label>
          {notice && <div className="cr-notice">{notice}</div>}
        </section>
      </main>

      <footer className="cr-foot">
        <div className="cr-steps">
          {cfg.steps.map(([t, d], i) => <div key={i}><b>{String(i + 1).padStart(2, '0')}</b><div><strong>{t}</strong><span>{d}</span></div></div>)}
        </div>
      </footer>

      {sheet && (
        <div className="cr-modal" onClick={e => e.target === e.currentTarget && setSheet('')}>
          <div className={'cr-modal-in' + (sheet === 'doc' || sheet === 'model' ? ' wide' : '')}>
            <div className="cr-modal-head"><h3>{{ info: `${cfg.name} 면접 방식`, doc: '제시문', notes: `내 ${noteLabel}`, model: '모범답안' }[sheet]}</h3><button onClick={() => setSheet('')} aria-label="닫기">×</button></div>
            {sheet === 'info' && <>
              <ol className="cr-sheet">{cfg.flow.map((f, i) => <li key={i}><span className="cr-sheet-no">{i + 1}</span><p>{f}</p></li>)}</ol>
              <p className="cr-sub">{cfg.note}</p>
              <p className="cr-sub">꼬리질문은 {inArtifact() ? 'claude.ai에 로그인한 내 계정의 Claude가' : hasApiKey() ? '입력한 API 키로 Claude가' : 'Claude가 연결되어 있지 않아 문제은행에 미리 써 둔 질문으로'} 만듭니다.{cfg.personal ? ' 인성 질문은 위원 3이 합니다.' : ''}</p>
            </>}
            {sheet === 'doc' && set && <Passage set={set} show={mode === 'wait' ? prepShow : [...new Set([...prepShow, ...mainIdx])]} />}
            {sheet === 'notes' && <div className="ir-doc">{Object.entries(notes).filter(([, v]) => v).map(([k, v]) => <div key={k} className="ir-ps"><b>{k < 0 ? '메모' : `${+k + 1}번 답안`}</b><p>{v}</p></div>)}</div>}
            {sheet === 'model' && set && <div className="ir-doc">{set.qs.map((q, i) => (prepShow.includes(i) || mainIdx.includes(i)) && <div key={i} className="ir-ps"><b>{i + 1}번</b><small>{q}</small><p>{(set.ms || [])[i] || '모범답안이 없어요.'}</p></div>)}</div>}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
