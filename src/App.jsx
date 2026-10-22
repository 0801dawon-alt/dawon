import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAT_ORDER } from './lib/constants.js';
import { ask, hasApiKey, lastAiIssue } from './lib/ai.js';
import { ANALYSIS_KEY, ATTEMPTS_KEY, ENTRIES_KEY, MYQ_KEY, VIEWED_KEY, loadEntries } from './lib/store.js';
import { connectRecords } from './lib/records.js';
import { ctx, loadJSON, parseJSON, saveJSON, scrollToEl, uid } from './lib/util.js';
import { Footer, Header, Intro, Toast } from './components/Chrome.jsx';
import Hero from './components/Hero.jsx';
import Library from './components/Library.jsx';
import { DetailPanel, EntryForm } from './components/Detail.jsx';
import Questions from './components/Questions.jsx';
import Passage from './components/Passage.jsx';
import Timer, { MiniTimer } from './components/Timer.jsx';
import { MyPage, Record } from './components/Record.jsx';
import Settings from './components/Settings.jsx';
import QuestionBook from './components/QuestionBook.jsx';

const EMPTY_FORM = { title: '', category: '', summary: '', keywords: '', body: '' };
const INTRO_MS = 3400;

function beep(acRef, n) {
  try {
    const ac = acRef.current || (acRef.current = new (window.AudioContext || window.webkitAudioContext)());
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime + i * 0.28;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.start(t); o.stop(t + 0.24);
    }
  } catch { /* audio unavailable */ }
}

// Sections fade up as they scroll into view; held back until the intro has closed.
function useReveal(t0, introRef) {
  useEffect(() => {
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = [...document.querySelectorAll('[data-reveal]')];
    els.forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(28px)'; });
    const io = new IntersectionObserver(ents => ents.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      const introLeft = introRef.current ? Math.max(0, 2900 - (performance.now() - t0)) : 0;
      const d = (+el.dataset.d || 0) + introLeft;
      el.style.transition = `opacity .9s cubic-bezier(.2,.7,.2,1) ${d}ms, transform .9s cubic-bezier(.2,.7,.2,1) ${d}ms`;
      requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'none'; });
      setTimeout(() => { el.style.transition = ''; el.style.transform = ''; }, d + 1000);
    }), { threshold: 0.12 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [t0, introRef]);
}

export default function App() {
  const [t0] = useState(() => performance.now());
  const [intro, setIntro] = useState(true);
  const introRef = useRef(true); introRef.current = intro;

  const [entries, setEntries] = useState(loadEntries);
  const [attempts, setAttempts] = useState(() => loadJSON(ATTEMPTS_KEY, []));
  const [analysis, setAnalysisState] = useState(() => loadJSON(ANALYSIS_KEY, null));

  const [cat, setCatState] = useState('전체');
  const [search, setSearchState] = useState('');
  const [page, setPageState] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [form, setForm] = useState(null);
  const [uploading, setUploading] = useState(0);
  const [restructuring, setRestructuring] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [aiOn, setAiOn] = useState(hasApiKey);
  useEffect(() => { const id = setTimeout(() => setAiOn(hasApiKey()), 1500); return () => clearTimeout(id); }, []);
  const [toast, setToast] = useState('');

  const [qTopic, setQTopic] = useState('');
  const [qList, setQList] = useState([]);
  // Questions the viewer typed in: [{id, q, date}], kept like answer history.
  const [myQuestions, setMyQuestions] = useState(() => loadJSON(MYQ_KEY, []));
  const myQRef = useRef(myQuestions); myQRef.current = myQuestions;
  const [pTopic, setPTopic] = useState('');

  const [tQuestion, setTQuestion] = useState('');
  // Passage text when practicing a passage question, so feedback can judge its use.
  const [tContext, setTContext] = useState('');
  // Topics the viewer has opened, shown quietly on library cards.
  const [viewed, setViewed] = useState(() => loadJSON(VIEWED_KEY, []));
  const viewedRef = useRef(viewed); viewedRef.current = viewed;
  // Clock-based timer: endsAt (ms) while running, leftMs while paused; remain is the whole seconds shown.
  const [timer, setTimer] = useState({ prep: 300, ans: 180, phase: 'idle', remain: 300, running: false, endsAt: 0, leftMs: 0, overtime: false, over: 0 });
  const timerRef = useRef(timer); timerRef.current = timer;

  const refs = { lib: useRef(null), q: useRef(null), p: useRef(null), t: useRef(null), r: useRef(null), m: useRef(null) };
  const acRef = useRef(null);
  const toastT = useRef(0);

  useReveal(t0, introRef);
  useEffect(() => { const id = setTimeout(() => setIntro(false), INTRO_MS); return () => clearTimeout(id); }, []);

  const flash = useCallback(t => { setToast(t); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(''), Math.max(2600, t.length * 70)); }, []);
  const scroll = key => scrollToEl(refs[key].current);
  const save = useCallback(next => setEntries(prev => { const v = typeof next === 'function' ? next(prev) : next; saveJSON(ENTRIES_KEY, v); return v; }), []);
  // History goes to the viewer's private space on claude.ai when available, else this browser.
  const attemptsRef = useRef(attempts); attemptsRef.current = attempts;
  const remote = useRef(null);
  const [recordsRemote, setRecordsRemote] = useState(false);
  // '나의 생각' from the private space (null = not connected, use the entry's local myView).
  const [notes, setNotes] = useState(null);
  const notesRef = useRef(notes); notesRef.current = notes;
  const noteTimers = useRef({});
  useEffect(() => {
    let live = true, conn = null;
    connectRecords({
      local: { attempts: attemptsRef.current, analysis: loadJSON(ANALYSIS_KEY, null), notes: Object.fromEntries(entries.filter(e => e.myView).map(e => [e.id, e.myView])), myQuestions: myQRef.current, viewed: viewedRef.current },
      onAttempts: list => { if (!live) return; attemptsRef.current = list; setAttempts(list); },
      onAnalysis: an => { if (live) setAnalysisState(an); },
      onMyQuestions: list => { if (live) setMyQuestions(list); },
      onViewed: ids => { if (live) setViewed(ids); },
      // Keep text still waiting to be written so a sync never rolls back what is being typed.
      onNotes: map => { if (live) setNotes(prev => { const next = { ...map }; Object.keys(noteTimers.current).forEach(id => { if (prev && id in prev) next[id] = prev[id]; }); return next; }); },
      onFail: () => {
        if (!live || !remote.current) return;
        remote.current = null; setRecordsRemote(false);
        saveJSON(ATTEMPTS_KEY, attemptsRef.current.slice(0, 200));
        saveJSON(MYQ_KEY, myQRef.current);
        saveJSON(VIEWED_KEY, viewedRef.current);
        const n = notesRef.current;
        if (n) save(list => list.map(e => (e.id in n ? { ...e, myView: n[e.id] } : e)));
        flash('Claude 계정에 저장할 수 없어 이 브라우저에 저장합니다');
      },
    }).then(r => { if (!live) { r && r.unsubscribe(); return; } conn = r; if (r) { remote.current = r; setRecordsRemote(true); } })
      .catch(() => {});
    return () => { live = false; conn && conn.unsubscribe(); remote.current = null; };
  }, [flash, save]);
  const saveAttempts = useCallback(fn => {
    const prev = attemptsRef.current, next = fn(prev).slice(0, 200);
    attemptsRef.current = next; setAttempts(next);
    const r = remote.current;
    if (!r) { saveJSON(ATTEMPTS_KEY, next); return; }
    const before = new Map(prev.map(a => [a.id, a]));
    next.forEach(a => { if (before.get(a.id) !== a) r.put(a); });
    const kept = new Set(next.map(a => a.id));
    prev.forEach(a => { if (!kept.has(a.id)) r.remove(a.id); });
  }, []);
  const openTopic = id => {
    setOpenId(id);
    if (viewedRef.current.includes(id)) return;
    const ids = [...viewedRef.current, id]; viewedRef.current = ids; setViewed(ids);
    if (remote.current) remote.current.putViewed(ids); else saveJSON(VIEWED_KEY, ids);
  };
  const saveMyQuestions = list => { setMyQuestions(list); myQRef.current = list; if (remote.current) remote.current.putMyQuestions(list); else saveJSON(MYQ_KEY, list); };
  const setAnalysis = an => { setAnalysisState(an); if (remote.current) remote.current.putAnalysis(an); else saveJSON(ANALYSIS_KEY, an); };
  const updateEntry = (id, patch) => save(list => list.map(e => (e.id === id ? { ...e, ...patch } : e)));
  // Say why a generator fell back to its template text.
  const onFallback = () => flash('기본 문장으로 대신했어요 · ' + (lastAiIssue() || 'Claude 답변을 받지 못했어요. 다시 눌러 주세요.'));

  // Timer tick: prep → answer (one beep) → overtime (three beeps) until the answer is ended.
  useEffect(() => {
    if (!timer.running) return;
    const commit = next => { timerRef.current = next; setTimer(next); };
    const id = setInterval(() => {
      const s = timerRef.current;
      if (!s.running) return;
      const left = s.endsAt - Date.now();
      // Past the answer time the clock keeps counting up (overtime) until the answer is ended.
      if (s.overtime) { const o = Math.floor(-left / 1000); if (o !== s.over) commit({ ...s, over: o }); return; }
      if (left > 0) { const r = Math.ceil(left / 1000); if (r !== s.remain) commit({ ...s, remain: r }); return; }
      if (s.phase === 'prep') { beep(acRef, 1); commit({ ...s, phase: 'answer', remain: s.ans, endsAt: s.endsAt + s.ans * 1000 }); }
      else { beep(acRef, 3); commit({ ...s, remain: 0, overtime: true, over: 0 }); }
    }, 100);
    return () => clearInterval(id);
  }, [timer.running]);

  const finishTimer = s => ({ ...s, phase: 'done', running: false, endsAt: 0, leftMs: 0, overtime: false, over: s.overtime ? Math.floor((Date.now() - s.endsAt) / 1000) : 0 });
  const idleTimer = s => ({ ...s, phase: 'idle', running: false, remain: s.prep || s.ans, endsAt: 0, leftMs: 0, overtime: false, over: 0 });
  const practice = (q, ctx) => {
    setTQuestion(q); setTContext(ctx || ''); setOpenId(null);
    setTimer(idleTimer);
    scroll('t');
  };

  const categories = useMemo(() => {
    const present = [...new Set(entries.map(e => e.category || '기타'))];
    return [...CAT_ORDER.filter(c => present.includes(c)), ...present.filter(c => !CAT_ORDER.includes(c))];
  }, [entries]);

  // One question per calendar day, picked deterministically from the library.
  const today = useMemo(() => {
    const d = new Date(), seed = d.getFullYear() * 1000 + d.getMonth() * 40 + d.getDate();
    const pool = entries.filter(e => (e.questions || []).length);
    if (!pool.length) return null;
    const e = pool[seed % pool.length];
    return { q: e.questions[seed % e.questions.length], cat: e.category + ' · ' + e.title };
  }, [entries]);

  const validId = id => (id && entries.some(e => e.id === id) ? id : entries[0] && entries[0].id) || '';
  const odBase = entries.find(e => e.id === openId) || null;
  const od = odBase && notes && remote.current ? { ...odBase, myView: notes[odBase.id] ?? odBase.myView ?? '' } : odBase;
  const onMyView = (id, text) => {
    const r = remote.current;
    if (!r) { updateEntry(id, { myView: text }); return; }
    setNotes(n => ({ ...(n || {}), [id]: text }));
    // One write per pause in typing.
    clearTimeout(noteTimers.current[id]);
    noteTimers.current[id] = setTimeout(() => { delete noteTimers.current[id]; r.putNote(id, text); }, 800);
  };

  async function restructureEntry(id, current) {
    const e = current || entries.find(x => x.id === id); if (!e) return false;
    const r = parseJSON(await ask(`다음 자료를 한국 대학/취업 면접 대비용 지식 카드로 재구성해줘. 반드시 JSON 객체만 출력:\n{"title":"주제명(짧게)","category":"${CAT_ORDER.join('|')} 중 하나","summary":"한 문장 요약","keywords":["3개"],"background":"배경 2~3문장","issues":["핵심 쟁점 3개, '-인가/-한가'로 끝낼 것"],"pro":["찬성·긍정 관점 2~3개"],"con":["반대·우려 관점 2~3개"],"questions":["예상 면접 질문 3개, '까?' 또는 '-시오.'로 끝낼 것"]}\n\n자료:\n${ctx(e)}`));
    if (!r || !r.summary) return false;
    updateEntry(id, { title: r.title || e.title, category: r.category || e.category, summary: r.summary, keywords: r.keywords || [], background: r.background || '', issues: r.issues || [], pro: r.pro || [], con: r.con || [], questions: r.questions || [] });
    return true;
  }

  async function handleFiles(files) {
    const list = [...files]; if (!list.length) return;
    setUploading(list.length);
    const added = [];
    for (const f of list) {
      const text = await f.text(), base = f.name.replace(/\.[^.]+$/, '');
      if (/\.json$/i.test(f.name)) {
        const j = parseJSON(text); const arr = Array.isArray(j) ? j : (j ? [j] : []);
        arr.forEach(o => added.push({ id: uid(), category: o.category || '업로드', title: o.title || base, summary: o.summary || '', keywords: o.keywords || [], background: o.background || '', issues: o.issues || [], pro: o.pro || [], con: o.con || [], questions: o.questions || [], body: o.body || '', myView: o.myView || '', source: f.name, _raw: !o.summary }));
        continue;
      }
      // Markdown split on '# 제목' headings → one entry per section.
      const parts = text.split(/\n(?=#\s)/).map(s => s.trim()).filter(Boolean);
      const chunks = parts.length > 1 || /^#\s/.test(text.trim()) ? parts : [text.trim()];
      chunks.forEach(c => {
        let title = base, body = c;
        if (/^#\s/.test(c)) { const nl = c.indexOf('\n'); title = (nl < 0 ? c : c.slice(0, nl)).replace(/^#\s*/, '').trim(); body = nl < 0 ? '' : c.slice(nl + 1).trim(); }
        added.push({ id: uid(), category: '업로드', title, summary: body.replace(/\s+/g, ' ').slice(0, 120), keywords: [], body, myView: '', source: f.name, _raw: true });
      });
    }
    save(prev => [...added.map(({ _raw, ...a }) => a), ...prev]);
    setForm(null); setCatState('전체'); setPageState(0);
    const ai = hasApiKey();
    flash(`${added.length}개 항목을 추가했습니다${ai ? ' · AI 재구성 중…' : ''}`);
    scroll('lib');
    if (ai) {
      for (const a of added.filter(x => x._raw).slice(0, 10)) await restructureEntry(a.id, a);
      flash('재구성 완료');
    }
    setUploading(0);
  }

  const saveForm = () => {
    const f = form;
    if (!f.title.trim()) { flash('제목을 입력하세요'); return; }
    const kw = f.keywords.split(',').map(x => x.trim()).filter(Boolean);
    const patch = { title: f.title.trim(), category: f.category.trim() || '기타', summary: f.summary.trim() || f.body.replace(/\s+/g, ' ').slice(0, 120), keywords: kw, body: f.body };
    if (f.id) updateEntry(f.id, patch); else save(prev => [{ id: uid(), myView: '', ...patch }, ...prev]);
    setForm(null); flash('저장했습니다');
  };

  const go = { lib: () => scroll('lib'), q: () => scroll('q'), p: () => scroll('p'), t: () => scroll('t'), m: () => scroll('m') };

  return (
    <div className="page">
      <Header go={go} />
      <Hero
        t0={t0} categories={categories} today={today} hasAttempts={attempts.length > 0}
        onToday={() => {
          const all = entries.flatMap(e => e.questions || []);
          if (today) practice(today.q); else if (all.length) practice(all[Math.floor(Math.random() * all.length)]);
        }}
        onContinue={() => scroll(attempts.length ? 'm' : 'lib')}
        onCategory={c => { setCatState(c); setPageState(0); scroll('lib'); }}
      />
      <Library
        ref={refs.lib} entries={entries} categories={categories}
        cat={cat} setCat={c => { setCatState(c); setPageState(0); }}
        search={search} setSearch={v => { setSearchState(v); setPageState(0); }}
        page={page} setPage={p => { setPageState(p); scroll('lib'); }}
        onOpen={openTopic} viewed={viewed} onNew={() => setForm(EMPTY_FORM)}
      />
      <Questions ref={refs.q} entries={entries} topicId={validId(qTopic)} setTopicId={setQTopic} qList={qList} setQList={setQList} myQuestions={myQuestions} saveMyQuestions={saveMyQuestions} onPractice={practice} onFallback={onFallback} />
      <Passage ref={refs.p} entries={entries} topicId={validId(pTopic)} setTopicId={setPTopic} onPractice={practice} onFallback={onFallback} flash={flash} />
      <Timer
        ref={refs.t} timer={timer} question={tQuestion} setQuestion={setTQuestion}
        onRandom={() => { const all = entries.flatMap(e => e.questions || []).concat(qList.map(x => x.q), myQuestions.map(x => x.q)); if (all.length) practice(all[Math.floor(Math.random() * all.length)]); }}
        onStart={() => setTimer(s => {
          if (s.overtime) return finishTimer(s);
          if (s.phase === 'idle' || s.phase === 'done') { const p = s.prep > 0 ? 'prep' : 'answer', total = p === 'prep' ? s.prep : s.ans; return { ...s, phase: p, remain: total, running: true, endsAt: Date.now() + total * 1000, leftMs: 0, overtime: false, over: 0 }; }
          return s.running ? { ...s, running: false, leftMs: Math.max(0, s.endsAt - Date.now()), endsAt: 0 } : { ...s, running: true, endsAt: Date.now() + s.leftMs };
        })}
        onSkip={() => setTimer(s => ({ ...s, phase: 'answer', remain: s.ans, running: true, endsAt: Date.now() + s.ans * 1000, leftMs: 0, overtime: false, over: 0 }))}
        onReset={() => setTimer(idleTimer)}
        setPrep={v => setTimer(s => ({ ...s, prep: v, remain: s.phase === 'idle' ? (v || s.ans) : s.remain }))}
        setAns={v => setTimer(s => ({ ...s, ans: v, remain: s.phase === 'idle' && !s.prep ? v : s.remain }))}
      />
      <Record
        ref={refs.r} timer={timer} question={tQuestion} setQuestion={setTQuestion} context={tContext} entries={entries} attempts={attempts} saveAttempts={saveAttempts}
        onFinish={() => setTimer(finishTimer)}
        onPractice={practice} flash={flash}
      />
      <MyPage ref={refs.m} attempts={attempts} saveAttempts={saveAttempts} analysis={analysis} setAnalysis={setAnalysis} savedToClaude={recordsRemote} onOpenBook={() => setBookOpen(true)}
        bookCount={new Set([...myQuestions.map(x => x.q.trim()), ...attempts.filter(a => a.q && a.q !== '(질문 없음)').map(a => a.q.trim())]).size} onPractice={practice} flash={flash} />
      <Footer aiOn={aiOn} onSettings={() => setSettingsOpen(true)} />
      <MiniTimer timer={timer} timerRef={refs.t} onClick={() => scroll('t')} />

      {od && (
        <DetailPanel
          entry={od} restructuring={restructuring}
          onClose={() => setOpenId(null)}
          onRestructure={async () => {
            if (restructuring) return;
            if (!hasApiKey()) { flash('AI 재구성은 맨 아래 ‘AI 설정’에서 키를 연결해야 쓸 수 있어요'); return; }
            setRestructuring(true); const ok = await restructureEntry(od.id); setRestructuring(false);
            flash(ok ? '재구성했습니다' : '재구성에 실패했습니다');
          }}
          onEdit={() => setForm({ id: od.id, title: od.title, category: od.category, summary: od.summary || '', keywords: (od.keywords || []).join(', '), body: od.body || '' })}
          onDelete={() => { save(prev => prev.filter(e => e.id !== od.id)); setOpenId(null); flash('삭제했습니다'); }}
          onPractice={practice}
          onMyView={v => onMyView(od.id, v)}
          onToQuestions={() => { setQTopic(od.id); setOpenId(null); scroll('q'); }}
          onToPassage={() => { setPTopic(od.id); setOpenId(null); scroll('p'); }}
        />
      )}
      {form && <EntryForm form={form} setForm={setForm} uploading={uploading} onClose={() => setForm(null)} onSave={saveForm} onFiles={handleFiles} />}
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} onSaved={msg => { setAiOn(hasApiKey()); setSettingsOpen(false); flash(msg); }} />}
      {bookOpen && <QuestionBook myQuestions={myQuestions} attempts={attempts} onClose={() => setBookOpen(false)} onPractice={(q, c) => { setBookOpen(false); practice(q, c); }} />}
      <Toast text={toast} />
      {intro && <Intro onSkip={() => setIntro(false)} />}
    </div>
  );
}
