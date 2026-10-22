import { forwardRef, useEffect, useRef, useState } from 'react';
import { ACCENT, LAW_GUIDE } from '../lib/constants.js';
import { ask, inArtifact } from '../lib/ai.js';
import { countFillers, parseJSON } from '../lib/util.js';
import { Rail } from './Chrome.jsx';
import { ConfirmLink } from './Detail.jsx';

const FALLBACK_FOLLOWUPS = [
  '방금 제시한 기준을 그대로 적용하면 반대 사례도 허용해야 하는데, 그 결론도 받아들일 수 있습니까?',
  '답변의 핵심 근거가 사실과 다르다는 반론이 나온다면, 어떤 자료로 다시 입증하겠습니까?',
  '반대 입장에서 가장 강한 논거 하나를 들고, 그에 대해 재반박해보시오.',
  '이 문제에서 충돌하는 기본권은 무엇이며, 어떤 기준으로 형량하겠습니까?',
  '현행 법이나 판례와 비교했을 때 지원자의 입장은 어떤 점에서 달라집니까?',
];
const COUNTER = /(반면|하지만|반대로|물론)/;

async function evaluate(at, text, entry) {
  const fl = countFillers(text), cpm = at.dur ? Math.round(text.replace(/\s/g, '').length / (at.dur / 60)) : 0;
  let fb = parseJSON(await ask(`너는 한국 로스쿨 구술면접 평가위원이다.\n${LAW_GUIDE}\n 아래는 지원자의 실제 답변을 음성 인식으로 전사한 것이다(인식 오류 가능성 감안). 엄격하고 구체적으로 평가하라.
[질문] ${at.q}
[답변 시간] ${at.dur}초, 분당 ${cpm}자
[답변 전사]
${text}
${entry ? '[참고 쟁점] ' + (entry.issues || []).join(' / ') : ''}
평가 기준: 논리성(주장-근거 연결), 근거(구체적 사례·수치·제도), 구조(결론 선제시·두괄식·마무리), 전달력(문장 간결성, 군말, 시간 활용), 쟁점이해(대립 지점 파악, 반론 고려). 각 0~20점.
잘한 점·고칠 점은 답변의 실제 표현을 짚어 구체적으로 쓰고, 누적 비교용 짧은 라벨(예: '결론 먼저 제시', '근거에 수치 부족', '반론 미고려', '군말 과다')을 strengthTags/weakTags에 넣어라.
JSON만 출력: {"total":0,"scores":{"논리성":0,"근거":0,"구조":0,"전달력":0,"쟁점이해":0},"summary":"2문장 총평","strengths":["..."],"weaknesses":["..."],"better":"보완한 답변의 뼈대(3~4문장)","strengthTags":["..."],"weakTags":["..."]}`));
  if (!fb || !fb.scores) {
    // Rule-based scoring when AI is unavailable.
    const words = text.split(/\s+/).length, fn = Object.values(fl).reduce((a, b) => a + b, 0);
    const s5 = { 논리성: 12, 근거: /\d/.test(text) ? 14 : 9, 구조: /(결론|첫째|둘째|따라서|그래서)/.test(text) ? 14 : 10, 전달력: Math.max(6, 18 - fn), 쟁점이해: COUNTER.test(text) ? 14 : 9 };
    fb = {
      scores: s5, total: Object.values(s5).reduce((a, b) => a + b, 0),
      summary: 'AI 평가를 사용할 수 없어 간단한 규칙 기반으로 평가했습니다.',
      strengths: words > 80 ? ['충분한 분량으로 답변했습니다'] : [],
      weaknesses: [...(fn > 3 ? ['군말이 ' + fn + '회 사용되었습니다'] : []), ...(!/\d/.test(text) ? ['구체적 수치·사례가 없습니다'] : []), ...(!COUNTER.test(text) ? ['반대 입장을 고려하지 않았습니다'] : [])],
      better: '', strengthTags: [],
      weakTags: [...(fn > 3 ? ['군말 과다'] : []), ...(!/\d/.test(text) ? ['근거에 수치 부족'] : []), ...(!COUNTER.test(text) ? ['반론 미고려'] : [])],
    };
  }
  if (typeof fb.total !== 'number') fb.total = Object.values(fb.scores).reduce((a, b) => a + (+b || 0), 0);
  return { ...fb, fillers: fl, cpm };
}

async function nextFollowup(at, prev) {
  const fb = at.fb || {};
  let q = await ask(`너는 한국 로스쿨 구술면접 면접위원이다.\n${LAW_GUIDE}\n지원자의 답변을 듣고 실제 면접처럼 꼬리질문 1개를 던져라. 답변의 전제나 기준을 흔들거나, 약한 근거를 파고들거나, 반대 입장의 논거로 재반박을 요구하거나, 기본권 충돌 시 형량 기준·현행 법·판례와의 정합성을 묻는 방식 중 가장 효과적인 것을 고른다. 3번에 1번 정도는 답변과 관련된 상식(관련 법·제도의 정확한 명칭과 내용, 핵심 개념의 정의, 주요 통계·연도, 해외 사례)을 정확히 알고 있는지 확인하는 질문으로 만든다. 답변에 실제로 나온 표현을 짚어서 구체적으로 묻고, 필요하면 2문장까지 쓴다. '~입니까?' 또는 '~답변해보시오.'로 끝낸다. 이전 꼬리질문과 겹치지 않게 한다. 질문 문장만 출력.\n[원 질문] ${at.q}\n[답변] ${(at.text || '').slice(0, 2500)}\n${fb.weaknesses ? '[평가상 약점] ' + fb.weaknesses.join(' / ') : ''}\n${prev.length ? '[이전 꼬리질문] ' + prev.join(' / ') : ''}`);
  q = (q || '').trim().replace(/^["'“]|["'”]$/g, '');
  return q || FALLBACK_FOLLOWUPS.find(x => !prev.includes(x)) || FALLBACK_FOLLOWUPS[0];
}

// claude.ai pages cannot use the microphone; phones can still dictate through the keyboard.
const IN_ARTIFACT = inArtifact();
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
const DICTATION_TIP = TOUCH ? ' 키보드의 🎤 버튼을 누르고 말하면 받아 적혀요.'
  : MAC ? ' fn 키를 두 번 누르고 말하면 받아 적혀요(Mac 받아쓰기).'
  : ' Windows 키 + H를 누르고 말하면 받아 적혀요(Windows 음성 입력).';

// Step-by-step dictation guide, shown under the '말로 답하기' button.
const GUIDE = TOUCH ? [
  ['지금 키보드에서', '🎤 마이크 버튼을 누르고 말하세요. 말한 내용이 답변 칸에 바로 받아 적혀요. 다 말했으면 ‘피드백 받기’를 누르세요.'],
  ['아이폰인데 🎤가 없다면', '설정 → 일반 → 키보드 → ‘받아쓰기 활성화’를 켜세요. 키보드 오른쪽 아래에 🎤가 생겨요.'],
  ['삼성 휴대폰인데 🎤가 없다면', '키보드 위쪽 툴바(⋯)에서 🎤 음성 입력을 누르거나 쉼표(,) 키를 길게 누르세요. 툴바에 없으면 ⋯에서 음성 입력 버튼을 추가하세요.'],
  ['다른 안드로이드라면', 'Gboard 키보드 오른쪽 위의 🎤를 누르세요. 없으면 Gboard 설정 → 음성 입력을 켜세요.'],
  ['그래도 없다면', '네이버 스마트보드 같은 다른 키보드 앱일 수 있어요. 🌐 키로 휴대폰 기본 키보드로 바꾸면 🎤가 보여요.'],
] : MAC ? [
  ['지금', 'fn 키를 두 번 누르고 말하세요(🎤 키가 있는 키보드라면 🎤 키). 말한 내용이 답변 칸에 받아 적혀요. 다 말했으면 fn 키를 한 번 더 누르세요.'],
  ['받아쓰기가 안 켜진다면', '시스템 설정 → 키보드 → ‘받아쓰기’를 켜고, 언어에 한국어가 있는지 확인하세요.'],
] : [
  ['지금', 'Windows 키 + H를 누르면 음성 입력 창이 떠요. 말한 내용이 답변 칸에 받아 적혀요.'],
  ['한국어로 안 받아 적힌다면', '설정 → 시간 및 언어 → 언어 및 지역에서 한국어 음성 팩을 설치하세요.'],
];

const darkLabel = { fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted-3)' };

// 05 답변 녹음·피드백. Recording starts when the timer enters the answer phase and
// stops (and saves an attempt) when it leaves it.
export const Record = forwardRef(function Record({ timer, question, entries, attempts, saveAttempts, onFinish, onPractice, flash }, ref) {
  const [recOn, setRecOn] = useState(!IN_ARTIFACT);
  const [recording, setRecording] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [curAtt, setCurAtt] = useState(null);
  const [recErr, setRecErr] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const answerRef = useRef(null);
  const [fbLoading, setFbLoading] = useState(false);
  const [fuList, setFuList] = useState([]);
  const [fuLoading, setFuLoading] = useState(false);
  const rec = useRef({});
  const live = useRef({ liveText, attempts, question });
  live.current = { liveText, attempts, question };
  const prevPhase = useRef(timer.phase);

  const runFeedback = async (at, text) => {
    if (!text.trim()) { flash('전사된 답변이 없습니다'); return; }
    setFbLoading(true);
    const entry = entries.find(e => (e.questions || []).includes(at.q));
    const fb = await evaluate(at, text, entry);
    saveAttempts(list => list.map(a => (a.id === at.id ? { ...a, text, fb } : a)));
    setFbLoading(false);
  };

  const startRec = async () => {
    setRecording(true); setLiveText(''); setAudioUrl(''); setCurAtt(null); setRecErr(''); setFuList([]);
    const r = rec.current; r.t0 = Date.now(); r.finalText = '';
    let err = '';
    try {
      r.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      r.chunks = [];
      r.mr = new MediaRecorder(r.stream);
      r.mr.ondataavailable = e => e.data.size && r.chunks.push(e.data);
      r.mr.onstop = () => { setAudioUrl(URL.createObjectURL(new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' }))); r.stream.getTracks().forEach(t => t.stop()); };
      r.mr.start();
    } catch { err = IN_ARTIFACT ? 'claude.ai 화면에서는 마이크를 쓸 수 없어 녹음은 생략됩니다' : '마이크 권한이 없어 녹음은 생략됩니다'; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setRecErr((err ? err + ' · ' : '') + '이 브라우저는 실시간 전사를 지원하지 않아요(크롬 권장). 답변 후 직접 입력할 수 있어요'); return; }
    if (err) setRecErr(err);
    const sr = r.sr = new SR(); sr.lang = 'ko-KR'; sr.continuous = true; sr.interimResults = true;
    sr.onresult = ev => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) r.finalText += t.trim() + ' '; else interim += t;
      }
      setLiveText(r.finalText + interim);
    };
    // Chrome ends recognition after silence; restart while still recording.
    sr.onend = () => { if (r.active) { try { sr.start(); } catch { /* already started */ } } };
    sr.onerror = e => { if (e.error === 'not-allowed') setRecErr('음성 인식 권한이 거부되었습니다'); };
    r.active = true;
    try { sr.start(); } catch { /* already started */ }
  };

  const stopRec = save => {
    const r = rec.current; r.active = false; setRecording(false);
    const dur = Math.round((Date.now() - (r.t0 || Date.now())) / 1000);
    try { r.sr && r.sr.stop(); } catch { /* not running */ }
    try { r.mr && r.mr.state !== 'inactive' && r.mr.stop(); } catch { /* not running */ }
    if (!save) return;
    // Give the recognizer a moment to flush its final result.
    setTimeout(() => {
      const { liveText: t, question: q } = live.current;
      const text = (t || '').trim();
      const at = { id: 'a' + Date.now(), date: new Date().toISOString(), q: q || '(질문 없음)', text, dur, fb: null };
      saveAttempts(list => [at, ...list]); setCurAtt(at.id);
      if (text) runFeedback(at, text);
    }, 700);
  };

  useEffect(() => {
    const prev = prevPhase.current, phase = timer.phase; prevPhase.current = phase;
    if (prev !== 'answer' && phase === 'answer' && recOn && !recording) startRec();
    if (prev === 'answer' && phase !== 'answer' && recording) stopRec(phase === 'done');
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = attempts.find(a => a.id === curAtt), fb = cur && cur.fb;
  const fillers = fb && fb.fillers ? Object.entries(fb.fillers).sort((a, b) => b[1] - a[1]) : [];

  const onFeedback = () => {
    if (fbLoading) return;
    if (cur && (cur.text === liveText || recOn)) { runFeedback(cur, liveText || cur.text || ''); return; }
    if (!liveText.trim()) { flash('먼저 답변을 녹음하거나 입력하세요'); return; }
    const used = timer.phase === 'answer' || timer.phase === 'done' ? Math.max(0, timer.ans - timer.remain) : 0;
    const at = { id: 'a' + Date.now(), date: new Date().toISOString(), q: question || '(질문 없음)', text: liveText, dur: used, fb: null, manual: !recOn };
    saveAttempts(list => [at, ...list]); setCurAtt(at.id); setFuList([]);
    runFeedback(at, liveText);
  };

  const getFollowup = async () => {
    if (!cur || fuLoading) return;
    setFuLoading(true);
    const q = await nextFollowup(cur, fuList);
    setFuList([...fuList, q]); setFuLoading(false);
  };

  const setMode = v => { if (!v && recording) stopRec(false); setRecOn(v); };
  const recStatus = recording
    ? '녹음·전사 중… 답변이 끝나면 ‘답변 종료’를 누르거나 시간이 다 되길 기다리세요'
    : (recErr || (recOn ? '타이머의 답변 시간이 시작되면 자동으로 녹음됩니다' : (IN_ARTIFACT ? '말로 답하려면 답변 칸을 누른 뒤' + DICTATION_TIP : '직접 작성 모드 · 녹음 없이 타이머를 보며 답변을 적어보세요')));

  return (
    <section ref={ref} className="section" style={{ background: 'var(--cream)', paddingBlock: 'clamp(48px,7vw,96px)', borderTop: '1px solid var(--line)' }}>
      <Rail no="05" label="RECORD" numColor="#c9c6bf" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div className="title-block" style={{ flex: 1, minWidth: 220 }}>
            <h2 className="h2">답변 녹음 · 피드백</h2>
            <div className="accent-bar" />
            <p className="lede" style={{ color: 'var(--body)', maxWidth: 520 }}>{IN_ARTIFACT ? '말하거나 적어서 답변하면 Claude가 평가하고, ' : '자동 녹음으로 말하거나 직접 적어서 답변하면 AI가 평가하고, '}<br />꼬리질문까지 이어 받을 수 있습니다. 모든 답변은 아래 ‘내 기록’에 쌓입니다.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* claude.ai pages cannot record, so only the homepage offers the mode switch. */}
            {!IN_ARTIFACT && <span className="label" style={{ color: 'var(--muted)', marginRight: 4 }}>답변 방식</span>}
            {!IN_ARTIFACT && [[true, '● 자동 녹음'], [false, '✎ 직접 작성']].map(([v, l]) => (
              <button key={l} className={'box' + (v === recOn ? ' on' : '')} style={{ flex: 'none', width: 100, maxWidth: 'none', fontSize: 12.5 }} onClick={() => setMode(v)}>{l}</button>
            ))}
            {recording && <button onClick={onFinish} style={{ fontSize: 13, padding: '8px 14px', border: '1px solid var(--danger)', background: 'var(--danger)', color: '#fff' }}>답변 종료</button>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--body)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: recording ? '#c0392b' : (recOn ? '#8a8780' : '#c9c6bf') }} /><span>{recStatus}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', gap: 20, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {!recOn && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn-accent" style={{ alignSelf: 'flex-start' }} onClick={() => {
                  // Focusing inside the click opens the phone keyboard, where the 🎤 key lives.
                  setGuideOpen(true); const el = answerRef.current;
                  if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                }}>🎤 말로 답하기</button>
                {guideOpen && (
                  <div style={{ background: '#efede6', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.65 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontWeight: 600 }}>{TOUCH ? '키보드의 🎤 버튼으로 말하세요' : '노트북 음성 입력으로 말하세요'}</span>
                      <span className="link" style={{ fontSize: 12.5, color: 'var(--muted)' }} onClick={() => setGuideOpen(false)}>닫기</span>
                    </div>
                    {GUIDE.map(([h, t]) => <div key={h}><span style={{ color: 'var(--muted)' }}>{h} · </span>{t}</div>)}
                  </div>
                )}
              </div>
            )}
            <div className="label" style={{ color: 'var(--muted)' }}>전사 {question ? '· ' + (question.length > 40 ? question.slice(0, 40) + '…' : question) : ''}</div>
            <textarea ref={answerRef} className="transcript" rows={9} value={liveText} onChange={ev => setLiveText(ev.target.value)}
              placeholder={recOn ? '답변 시간이 시작되면 여기에 실시간으로 받아 적힙니다. 끝난 뒤 직접 고칠 수 있어요.' : (IN_ARTIFACT ? '답변을 말하거나 적은 뒤 ‘피드백 받기’를 누르세요.' : '답변을 여기에 적고 ‘피드백 받기’를 누르세요.') + DICTATION_TIP} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{cur ? `${cur.dur}초 · ${liveText.replace(/\s/g, '').length}자` + (fb && fb.cpm ? ` · 분당 ${fb.cpm}자` : '') : ''}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {audioUrl && <audio src={audioUrl} controls style={{ height: 34 }} />}
                <button onClick={onFeedback} style={{ fontSize: 13, padding: '8px 14px', border: 'none', background: 'var(--ink)', color: 'var(--cream)' }}>{fbLoading ? '평가 중…' : (fb ? '다시 평가' : '피드백 받기')}</button>
              </div>
            </div>
          </div>
          <div className="fb-panel">
            {!fb && <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--muted-3)' }}>답변이 끝나면 논리성·근거·구조·전달력·쟁점 이해를 점수로 평가하고, 잘한 점과 고칠 점을 정리합니다.</div>}
            {fb && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 200, fontSize: 64, lineHeight: 1, letterSpacing: '-0.04em' }}>{fb.total}</span>
                  <span style={{ ...darkLabel, fontSize: 12 }}>/ 100</span>
                </div>
                <div style={{ fontSize: 14.5, lineHeight: 1.75 }}>{fb.summary}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
                  {Object.entries(fb.scores || {}).map(([k, v]) => (
                    <div key={k} className="fb-score">
                      <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>{k}</span>
                      <span style={{ fontSize: 20, fontWeight: 300 }}>{v}</span>
                      <div style={{ height: 2, background: 'var(--charcoal-line)' }}><div style={{ height: 2, width: Math.round(v / 20 * 100) + '%', background: ACCENT }} /></div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={darkLabel}>잘한 점</div>{(fb.strengths || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>+ {x}</div>)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={darkLabel}>고칠 점</div>{(fb.weaknesses || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>− {x}</div>)}</div>
                {fb.better && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--charcoal-line)', paddingTop: 14 }}>
                    <div style={darkLabel}>이렇게 보완하면</div>
                    <div style={{ fontSize: 14, lineHeight: 1.8, color: '#e9e6dd' }}>{fb.better}</div>
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--muted-3)' }}>{fillers.length ? '말버릇: ' + fillers.map(([k, n]) => `‘${k}’ ${n}회`).join(' · ') : '말버릇 없음'}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, borderTop: '1px solid var(--charcoal-line)', paddingTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={darkLabel}>꼬리질문</div>
                    <button onClick={getFollowup} style={{ fontSize: 13, padding: '9px 16px', border: 'none', background: ACCENT, color: 'var(--cream)', fontWeight: 600 }}>{fuLoading ? '생성 중…' : (fuList.length ? '추가 꼬리질문 받기' : '꼬리질문 받기')} →</button>
                  </div>
                  {fuList.map((q, i) => (
                    <div key={i} className="fu-item">
                      <span style={{ fontSize: 12, color: 'var(--muted-3)', paddingTop: 3, whiteSpace: 'nowrap' }}>추가질문 {i + 1}</span>
                      <span style={{ fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.7, wordBreak: 'keep-all' }}>{q}</span>
                      <button className="btn-answer" onClick={() => { setLiveText(''); setCurAtt(null); onPractice(q); }}>답변하기 →</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

function tagCount(attempts, key) {
  const c = {};
  attempts.forEach(a => ((a.fb && a.fb[key]) || []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
  return Object.entries(c).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
}

// 06 내 기록: running stats, repeated tags, AI trend analysis and the attempt log.
export const MyPage = forwardRef(function MyPage({ attempts, saveAttempts, analysis, setAnalysis, savedToClaude, onPractice, flash }, ref) {
  const [openId, setOpenId] = useState(null);
  const [loading, setLoading] = useState(false);
  const F = attempts.filter(a => a.fb);
  const allFl = {}; F.forEach(a => Object.entries(a.fb.fillers || {}).forEach(([k, n]) => { allFl[k] = (allFl[k] || 0) + n; }));
  const topFl = Object.entries(allFl).sort((a, b) => b[1] - a[1])[0];
  const avg = list => String(Math.round(list.reduce((s, a) => s + a.fb.total, 0) / list.length));
  const stats = [
    { k: '연습한 답변', v: String(attempts.length) },
    { k: '평균 점수', v: F.length ? avg(F) : '—' },
    { k: '최근 5회 평균', v: F.length ? avg(F.slice(0, 5)) : '—' },
    { k: '고쳐야 할 습관', v: topFl ? `‘${topFl[0]}’` : '—' },
  ];
  const few = F.length < 3;
  const weak = few ? [] : tagCount(attempts, 'weakTags').filter(x => x.n >= 2).slice(0, 6);
  const strong = few ? [] : tagCount(attempts, 'strengthTags').filter(x => x.n >= 2).slice(0, 6);

  const analyze = async () => {
    if (loading) return;
    const list = F.slice(0, 15);
    if (list.length < 2) { flash('피드백 받은 답변이 2개 이상 필요합니다'); return; }
    setLoading(true);
    const dump = list.map((a, i) => `#${i + 1} [${a.date.slice(0, 10)}] Q: ${a.q}\n점수 ${a.fb.total} | 약점: ${(a.fb.weakTags || []).join(', ')} | 강점: ${(a.fb.strengthTags || []).join(', ')}\n답변: ${(a.text || '').slice(0, 600)}`).join('\n\n');
    let r = parseJSON(await ask(`너는 면접 코치다. 한 지원자의 최근 답변 기록이다(최신순). 개별 답변이 아니라 여러 답변에 걸쳐 반복되는 습관과 성장 추세를 분석하라. 근거로 답변 번호를 인용하라.
${dump}
JSON만 출력: {"summary":"전체 경향 2~3문장(점수 추세 포함)","patterns":["반복되는 실수 3~5개, 각각 몇 번째 답변에서 나타났는지"],"strengths":["꾸준한 강점 2~3개"],"next":["다음 연습에서 집중할 구체적 과제 3개"]}`));
    if (!r || !r.summary) {
      r = {
        summary: '최근 ' + list.length + '개 답변 평균 ' + avg(list) + '점입니다.',
        patterns: tagCount(attempts, 'weakTags').slice(0, 4).map(x => x.k + ' (' + x.n + '회)'),
        strengths: tagCount(attempts, 'strengthTags').slice(0, 3).map(x => x.k),
        next: ['결론을 첫 문장에 제시하기', '근거마다 수치나 사례 하나씩 붙이기', '반대 입장을 한 번 언급하고 반박하기'],
      };
    }
    setAnalysis({ ...r, n: list.length, date: new Date().toLocaleDateString('ko-KR') }); setLoading(false);
  };

  const label = { fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted)' };
  const fmt = d => new Date(d).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) + ' ' + new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <section ref={ref} className="section" style={{ background: 'var(--paper)', paddingBlock: 'clamp(48px,7vw,96px)', borderTop: '1px solid var(--line)' }}>
      <Rail no="06" label="MY PAGE" numColor="#c9c6bf" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 30, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div className="title-block">
            <h2 className="h2">내 기록</h2>
            <div className="accent-bar" />
            <p className="lede" style={{ color: 'var(--muted)', fontSize: 13 }}>{savedToClaude ? '내 Claude 계정 공간에 저장돼요. 다른 기기에서 이 페이지를 열어도 그대로 보이고, 다른 사람에게는 보이지 않아요.' : '이 브라우저에만 저장돼요.'}</p>
          </div>
          <button onClick={analyze} style={{ fontSize: 13, padding: '12px 20px', border: 'none', background: 'var(--ink)', color: 'var(--cream)' }}>{loading ? '분석 중…' : '누적 분석하기'}</button>
        </div>
        <div className="stats">
          {stats.map(st => <div key={st.k} className="stat"><span style={label}>{st.k}</span><span className="stat-v">{st.v}</span></div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={label}>반복되는 실수</div>
            {few && <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>답변이 3개 이상 쌓이면 자주 지적된 항목이 표시됩니다.</div>}
            {weak.map(x => <div key={x.k} className="tally"><span>{x.k}</span><span className="mono" style={{ color: 'var(--danger)' }}>{x.n}회</span></div>)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={label}>꾸준히 잘하는 점</div>
            {few && <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>—</div>}
            {strong.map(x => <div key={x.k} className="tally"><span>{x.k}</span><span className="mono" style={{ color: ACCENT }}>{x.n}회</span></div>)}
          </div>
        </div>
        {analysis && (
          <div style={{ background: 'var(--charcoal-deep)', color: 'var(--cream)', padding: 'clamp(22px,3vw,36px)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span style={darkLabel}>누적 분석 · 최근 {analysis.n}개 답변</span><span style={{ fontSize: 11, color: 'var(--muted-3)' }}>{analysis.date}</span>
            </div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 18, lineHeight: 1.7 }}>{analysis.summary}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,240px),1fr))', gap: 18 }}>
              {[['반복 패턴', analysis.patterns, '−'], ['강점', analysis.strengths, '+'], ['다음 연습 과제', analysis.next, '→']].map(([t, list, mark]) => (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={darkLabel}>{t}</div>
                  {(list || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>{mark} {x}</div>)}
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...label, marginBottom: 6 }}>답변 기록</div>
          {!attempts.length && <div style={{ fontSize: 13.5, color: 'var(--muted)', padding: '16px 0' }}>아직 기록이 없습니다. 타이머에서 답변을 시작해보세요.</div>}
          {attempts.slice(0, 50).map(a => (
            <div key={a.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <div className="attempt-row" onClick={() => setOpenId(openId === a.id ? null : a.id)}>
                <span className="mono" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{fmt(a.date)}</span>
                <span style={{ fontSize: 14.5, lineHeight: 1.6, wordBreak: 'keep-all' }}>{a.q}</span>
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 300, fontSize: 20, textAlign: 'right' }}>{a.fb ? String(a.fb.total) : '—'}</span>
              </div>
              {openId === a.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 20px' }}>
                  <div style={{ fontSize: 14, lineHeight: 1.85, background: '#efede6', padding: 16, whiteSpace: 'pre-wrap' }}>{a.text || '(전사 없음)'}</div>
                  <div style={{ fontSize: 13.5, lineHeight: 1.7, color: '#2e2d2b' }}>{a.fb ? a.fb.summary : '피드백 전'}</div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
                    <span className="link" onClick={() => onPractice(a.q)}>같은 질문 다시 연습</span>
                    <ConfirmLink label="삭제" armedLabel="한 번 더 누르면 삭제" style={{ color: 'var(--danger)' }} onConfirm={() => saveAttempts(list => list.filter(x => x.id !== a.id))} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
