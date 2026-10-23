import { forwardRef, useEffect, useRef, useState } from 'react';
import { ACCENT, CLAUDE_URL, HOMEPAGE_URL, LAW_GUIDE, QUESTION_CRAFT } from '../lib/constants.js';
import { ask, hasApiKey, inArtifact, lastAiIssue, markUnreadable } from '../lib/ai.js';
import { SYNC_RE, decodeSync, encodeSyncPlain } from '../lib/sync.js';
import { countFillers, parseJSON } from '../lib/util.js';
import { Rail } from './Chrome.jsx';
import { ConfirmLink } from './Detail.jsx';

const FALLBACK_FOLLOWUPS = [
  '방금 제시한 기준을 그대로 적용하면 반대 사례도 허용해야 하는데, 그 결론도 받아들일 수 있습니까?',
  '답변의 핵심 근거가 사실과 다르다는 반론이 나온다면, 어떤 자료로 다시 입증하겠습니까?',
  '반대 입장에서 가장 강한 논거 하나를 들고, 그에 대해 재반박해보시오.',
  '이 문제에서 충돌하는 두 가치는 무엇이며, 둘 중 무엇을 어떤 기준으로 우선하겠습니까?',
  '지원자가 제시한 대안이 실제로 시행된다면 가장 먼저 생길 부작용은 무엇이며, 어떻게 보완하겠습니까?',
];
const COUNTER = /(반면|하지만|반대로|물론)/;
const REASON = /(예를 들어|예컨대|사례|때문|왜냐하면|그 결과)/;
// Spoken Korean runs about 300 characters (spaces excluded) a minute.
const CHARS_PER_MIN = 300;

// Scoring rubric, written the way a law school oral-interview panel grades: six criteria with
// unequal weights, five anchored levels each, and the total computed here from the parts.
export const RUBRIC = [
  { k: '쟁점 파악', max: 20, what: '질문이 실제로 묻는 것에 답했는가, 대립하는 가치·이해관계를 정확히 짚었는가',
    levels: ['핵심 대립축을 스스로 명명하고 그 축 위에서 답을 전개', '핵심 쟁점은 잡았으나 대립 구도 설명이 얕음', '주제에는 답했으나 질문의 초점이 흐려지거나 일부만 답함', '질문을 넓게·다르게 해석해 초점에서 벗어남', '질문을 회피하거나 오해함'] },
  { k: '입장 명확성', max: 10, what: '처음부터 분명한 결론을 내리고 끝까지 일관되게 유지했는가',
    levels: ['첫 문장에 결론, 조건과 범위까지 분명하고 끝까지 일관', '결론은 분명하나 뒤늦게 나오거나 범위가 모호', '입장은 있으나 양쪽을 오가며 흐려짐', '"둘 다 중요하다" 식으로 판단을 미룸', '입장이 없거나 앞뒤가 모순'] },
  { k: '논증 타당성', max: 25, what: '근거에서 결론으로 가는 연결이 비약 없이 성립하는가, 판단 기준이 일관되는가',
    levels: ['근거마다 왜 결론을 지지하는지 설명되고 판단 기준이 하나로 일관', '대체로 타당하나 한 군데 연결이 약하거나 전제가 숨어 있음', '근거를 나열할 뿐 결론과의 연결 설명이 부족', '비약·순환논증·일반화 오류가 눈에 띔', '근거가 결론을 지지하지 못하거나 서로 충돌'] },
  { k: '근거 구체성', max: 15, what: '주장마다 현실에 맞는 구체적 이유·사례·제도를 들었는가',
    levels: ['현실과 맞는 구체적 사례·작동 방식으로 각 주장을 뒷받침', '구체적 근거가 있으나 일부 주장은 추상적', '상식적 이유는 있으나 대부분 일반론', '구호성 주장 위주로 근거가 거의 없음', '근거가 없거나 사실과 다름'] },
  { k: '반론·대안', max: 15, what: '가장 강한 반대 논거를 제시하고 재반박했는가, 부작용을 고려한 현실적 대안이나 조건을 냈는가',
    levels: ['가장 강한 반론을 정확히 세우고 재반박, 부작용까지 고려한 대안 제시', '반론과 재반박은 있으나 대안이나 부작용 검토가 얕음', '반론을 언급만 하고 넘어가거나 약한 반론만 다룸', '반대 입장을 왜곡하거나 무시함', '반론·대안 고려가 전혀 없음'] },
  { k: '구조·전달', max: 15, what: '두괄식 구조, 단계 표시(첫째·둘째), 간결한 문장, 군말, 주어진 시간 활용',
    levels: ['결론-근거-반론-마무리가 귀에 들리게 정리, 시간 활용 적절, 군말 거의 없음', '구조는 보이나 일부 장황하거나 마무리가 약함', '구조가 흐릿해 요점을 따라가기 어려운 구간이 있음', '두서없이 이어지고 반복·군말이 잦음', '구조가 없고 시간 활용이 크게 어긋남'] },
];
const LEVELS = ['상', '중상', '중', '중하', '하'];
// Share of a criterion's points each level may take: [low, high].
const BANDS = [[0.9, 1], [0.75, 0.85], [0.55, 0.7], [0.35, 0.5], [0, 0.3]];
export const GRADES = [[90, '최상위 합격권'], [80, '합격권'], [70, '무난하나 약점 뚜렷'], [60, '평균 이하'], [50, '부족'], [0, '미흡']];
export const gradeOf = t => (GRADES.find(([min]) => t >= min) || GRADES[GRADES.length - 1])[1];
const rubricText = RUBRIC.map((r, i) => `${i + 1}. ${r.k} (${r.max}점) — ${r.what}\n` + r.levels.map((d, j) => `   ${LEVELS[j]}(${Math.round(BANDS[j][0] * r.max)}~${Math.round(BANDS[j][1] * r.max)}점): ${d}`).join('\n')).join('\n');

async function evaluate(at, text, entry) {
  const fl = countFillers(text), cpm = at.dur ? Math.round(text.replace(/\s/g, '').length / (at.dur / 60)) : 0;
  const limit = at.limit || 120, target = Math.round(limit / 60 * CHARS_PER_MIN);
  const withPassage = !!at.context;
  const chars = text.replace(/\s/g, '').length, fillerN = Object.values(fl).reduce((a, b) => a + b, 0);
  const usedPct = at.dur ? Math.round(at.dur / limit * 100) : null, fillPct = Math.round(chars / target * 100);
  let fb = parseJSON(await ask(`너는 한국 로스쿨 구술면접에 여러 해 들어간 법학 교수이자 평가위원이다.\n${LAW_GUIDE}
아래는 지원자의 실제 답변을 음성 인식으로 전사한 것이다(띄어쓰기·맞춤법 같은 인식 오류는 감점하지 마라). 아래 평가 기준표를 그대로 적용해 채점하라.
[질문] ${at.q}
${withPassage ? '[제시문]\n' + at.context.slice(0, 4000) + '\n' : ''}[주어진 답변 시간] ${Math.round(limit / 60 * 10) / 10}분 (적정 분량 공백 제외 약 ${target}자)
[실제 답변] ${at.dur ? `${at.dur}초(주어진 시간의 ${usedPct}%), ` : ''}공백 제외 ${chars}자(적정 분량의 ${fillPct}%), 분당 ${cpm || '—'}자, 군말 ${fillerN}회
[답변 전사]
${text}
${entry ? '[참고 쟁점] ' + (entry.issues || []).join(' / ') : ''}

[평가 기준표 · 100점]
${rubricText}

[채점 절차]
1. 항목마다 먼저 답변에서 근거가 되는 표현을 그대로 인용하고(evidence), 그 표현이 어느 수준의 설명에 맞는지 고른 뒤(level), 그 수준의 점수 범위 안에서 점수를 정한다. 인용할 표현이 없으면 그 항목은 '중' 이상을 줄 수 없다.
2. 항목은 서로 독립적으로 채점한다. 전체 인상으로 모든 항목에 비슷한 비율을 주지 마라. 잘한 항목과 못한 항목의 차이가 점수에 드러나야 한다.
3. 분량·시간: 적정 분량의 50% 미만이면 '근거 구체성'과 '구조·전달'은 '중하' 이하, 70% 미만이면 '중' 이하로 한다. 주어진 시간을 20% 넘게 초과했으면 deductions에 2~5점 감점을 넣는다.
4. 감점 사항(deductions): 질문 회피, 명백한 사실 오류, 지원자 본인 신상을 드러내는 발언, 시간 초과만 해당한다. 없으면 빈 배열.
5. 점수 분포: 실제 면접 지원자 평균은 60점대다. 90점 이상은 거의 흠잡을 데 없는 답변에만, 80점대는 합격권 답변에만 준다. 무난하지만 평범한 답변은 60~70점대, 근거나 반론이 빠진 답변은 50점대 이하가 맞다. 관대하게 채점하지 마라.
${withPassage ? '6. 제시문이 주어진 문항이다. 제시문의 내용과 표현을 정확히 인용·활용했는지를 쟁점 파악과 근거 구체성에 반영하라.' : '6. 자료 없이 답하는 면접이다. 정확한 수치·통계·조문·연도는 요구하지 않는다. 상식 수준의 사례와 이유가 주장과 잘 연결되는지로 평가하고, 수치가 없다는 이유로 감점하거나 지적하지 마라.'}

잘한 점·고칠 점은 답변의 실제 표현을 짚어 구체적으로 쓴다. 고칠 점에는 "어떤 문장을 어떻게 바꾸면 되는지"를 담는다. 누적 비교용 짧은 라벨(예: '결론 먼저 제시', '근거와 주장 연결 약함', '반론 미고려', '군말 과다')을 strengthTags/weakTags에 넣는다.
마지막으로 모범답안을 실제로 말하는 문장으로 쓴다. 공백 제외 약 ${target}자, 결론 → 근거 2~3개 → 가장 강한 반론과 재반박 → 마무리 구조.${withPassage ? ' 제시문을 충분히 인용·활용하라.' : ' 지어낸 통계나 수치는 쓰지 마라.'}
JSON만 출력: {"criteria":[{"name":"쟁점 파악","level":"상|중상|중|중하|하","score":0,"evidence":"답변 인용","reason":"이 수준으로 본 이유 1~2문장"}, …6개 항목 모두 위 순서대로],"deductions":[{"reason":"…","points":0}],"summary":"교수의 총평 2~3문장","strengths":["…"],"weaknesses":["…"],"better":"보완한 답변의 뼈대(3~4문장)","model":"모범답안","strengthTags":["…"],"weakTags":["…"]}`));
  const max = Object.fromEntries(RUBRIC.map(r => [r.k, r.max]));
  if (fb && Array.isArray(fb.criteria) && fb.criteria.length) {
    // Keep each score inside its criterion's range and recompute the total here.
    const criteria = RUBRIC.map(r => {
      const c = fb.criteria.find(x => x && x.name === r.k) || {};
      const li = LEVELS.indexOf(c.level);
      // A score outside the chosen level's band is pulled back into it.
      const [lo, hi] = li < 0 ? [0, r.max] : [Math.round(BANDS[li][0] * r.max), Math.round(BANDS[li][1] * r.max)];
      return { name: r.k, max: r.max, level: li < 0 ? '' : c.level, score: Math.max(lo, Math.min(hi, Math.round(+c.score || 0))), evidence: c.evidence || '', reason: c.reason || '' };
    });
    const deductions = (fb.deductions || []).filter(d => d && +d.points > 0).map(d => ({ reason: d.reason || '', points: Math.min(10, Math.round(+d.points)) }));
    const sum = criteria.reduce((a, c) => a + c.score, 0) - deductions.reduce((a, d) => a + d.points, 0);
    fb = { ...fb, criteria, deductions, scores: Object.fromEntries(criteria.map(c => [c.name, c.score])), max, total: Math.max(0, Math.min(100, sum)) };
  } else {
    markUnreadable();
    // Rule-based scoring on the same rubric when Claude is unavailable.
    const short = fillPct < 50 ? 0.6 : fillPct < 70 ? 0.8 : 1;
    const pick = (k, ratio) => Math.round(max[k] * ratio);
    const s = {
      '쟁점 파악': pick('쟁점 파악', 0.6),
      '입장 명확성': pick('입장 명확성', /(찬성|반대|생각합니다|해야 합니다|결론)/.test(text.slice(0, 120)) ? 0.75 : 0.5),
      '논증 타당성': pick('논증 타당성', /(때문|왜냐하면|따라서|그러므로)/.test(text) ? 0.6 : 0.45),
      '근거 구체성': pick('근거 구체성', (REASON.test(text) ? 0.6 : 0.4) * short),
      '반론·대안': pick('반론·대안', COUNTER.test(text) ? 0.6 : 0.3),
      '구조·전달': pick('구조·전달', Math.max(0.3, (/(첫째|둘째|결론적으로|정리하면)/.test(text) ? 0.7 : 0.55) - fillerN * 0.03) * short),
    };
    fb = {
      scores: s, max, total: Object.values(s).reduce((a, b) => a + b, 0),
      summary: 'Claude 평가를 받지 못해 간단한 규칙 기반으로 평가했습니다. ' + lastAiIssue(),
      strengths: chars > target * 0.7 ? ['주어진 시간에 맞는 분량으로 답변했습니다'] : [],
      weaknesses: [...(fillerN > 3 ? ['군말이 ' + fillerN + '회 사용되었습니다'] : []), ...(!REASON.test(text) ? ['주장을 뒷받침하는 이유나 사례가 부족합니다'] : []), ...(!COUNTER.test(text) ? ['반대 입장을 고려하지 않았습니다'] : [])],
      better: '', strengthTags: [],
      weakTags: [...(fillerN > 3 ? ['군말 과다'] : []), ...(!REASON.test(text) ? ['근거와 주장 연결 약함'] : []), ...(!COUNTER.test(text) ? ['반론 미고려'] : [])],
    };
  }
  return { ...fb, grade: gradeOf(fb.total), fillers: fl, cpm };
}

async function nextFollowup(at, prev) {
  const fb = at.fb || {};
  let q = await ask(`너는 한국 로스쿨 구술면접 면접위원이다.\n${LAW_GUIDE}\n${QUESTION_CRAFT}\n지원자의 답변을 듣고 실제 면접처럼 꼬리질문 1개를 던져라. 답변의 전제나 기준을 흔들거나, 약한 근거를 파고들거나, 반대 입장의 논거로 재반박을 요구하거나, 두 가치가 충돌할 때의 판단 기준을 묻거나, 제시한 대안의 부작용과 실현 가능성을 따지는 방식 중 가장 효과적인 것을 고른다. 법률 지식(조문·판례·법리·법률 용어)을 묻지 않는다. 답변에 실제로 나온 표현을 짚어서 구체적으로 묻고, 필요하면 2문장까지 쓴다. '~입니까?' 또는 '~답변해보시오.'로 끝낸다. 이전 꼬리질문과 겹치지 않게 한다. 실제 제도·사건·통계를 언급할 때는 실제로 있는 것만 쓰고, 사례를 만들 때는 현실과 맞아떨어지게 쓴다. '가령'으로 시작하는 가정은 꼭 필요할 때만 쓰고, 마땅치 않으면 짧고 명료하게 묻는다. 질문 문장만 출력.\n[원 질문] ${at.q}\n[답변] ${(at.text || '').slice(0, 2500)}\n${fb.weaknesses ? '[평가상 약점] ' + fb.weaknesses.join(' / ') : ''}\n${prev.length ? '[이전 꼬리질문] ' + prev.join(' / ') : ''}`);
  q = (q || '').trim().replace(/^["'“]|["'”]$/g, '');
  return q || FALLBACK_FOLLOWUPS.find(x => !prev.includes(x)) || FALLBACK_FOLLOWUPS[0];
}

// claude.ai pages cannot use the microphone; phones can still dictate through the keyboard.
const IN_ARTIFACT = inArtifact();
const TOUCH = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent);
const DICTATION_TIP = TOUCH ? ' 키보드의 마이크 버튼을 누르고 말하면 받아 적혀요.'
  : MAC ? ' fn 키를 두 번 누르고 말하면 받아 적혀요(Mac 받아쓰기).'
  : ' Windows 노트북은 아래 ‘말로 답하기’ 안내를 따라 홈페이지에서 녹음한 뒤 붙여 넣으세요.';

// Step-by-step dictation guide, shown under the '말로 답하기' button.
const GUIDE = TOUCH ? [
  ['지금 키보드에서', '마이크 버튼을 누르고 말하세요. 말한 내용이 답변 칸에 바로 받아 적혀요. 다 말했으면 ‘피드백 받기’를 누르세요.'],
  ['아이폰인데 마이크가 없다면', '설정 → 일반 → 키보드 → ‘받아쓰기 활성화’를 켜세요. 키보드 오른쪽 아래에 마이크 버튼이 생겨요.'],
  ['삼성 휴대폰인데 마이크가 없다면', '키보드 위쪽 툴바(⋯)에서 음성 입력을 누르거나 쉼표(,) 키를 길게 누르세요. 툴바에 없으면 ⋯에서 음성 입력 버튼을 추가하세요.'],
  ['다른 안드로이드라면', 'Gboard 키보드 오른쪽 위의 마이크를 누르세요. 없으면 Gboard 설정 → 음성 입력을 켜세요.'],
  ['그래도 없다면', '네이버 스마트보드 같은 다른 키보드 앱일 수 있어요. 🌐 키로 휴대폰 기본 키보드로 바꾸면 마이크 버튼이 보여요.'],
] : MAC ? [
  ['지금', 'fn 키를 두 번 누르고 말하세요(마이크 키가 있는 키보드라면 그 키). 말한 내용이 답변 칸에 받아 적혀요. 다 말했으면 fn 키를 한 번 더 누르세요.'],
  ['받아쓰기가 안 켜진다면', '시스템 설정 → 키보드 → ‘받아쓰기’를 켜고, 언어에 한국어가 있는지 확인하세요.'],
] : [
  ['Windows 노트북이라면', 'Windows 기본 음성 입력은 한국어를 지원하지 않는 경우가 많아요. 크롬에서 아래 홈페이지를 열고 ‘자동 녹음’으로 답한 뒤 ‘복사하고 Claude 피드백 받기’를 누르세요. 이 화면이 열리면 답변 칸에 붙여 넣기(Ctrl+V)만 하면 질문과 답변이 함께 들어가요.'],
  ['Windows 11이라면', 'Windows 키 + H 음성 입력이 한국어를 지원할 수도 있어요. 입력 언어를 한국어로 바꾼 뒤 시도해 보세요.'],
];

// Format the homepage copies for the claude.ai page: [질문] ...\n[답변] ...\n[내 질문 목록]\n- ...
// The question list carries questions typed on the homepage back to the claude.ai page.
const HANDOFF = /^\s*\[질문\]\s*([^\n]*)\n\[답변\]\s*([\s\S]*?)(?:\n\[내 질문 목록\]\n([\s\S]*))?$/;
// The homepage link carries all records (answers, my questions) and the current question in its hash.
const carryLink = (token, myQuestions, q) => HOMEPAGE_URL + '#carry=' + (token || encodeURIComponent(JSON.stringify({ mq: myQuestions.map(x => x.q) }))) + (q ? '&q=' + encodeURIComponent(q) : '');
// Copied from the homepage: the answer to review plus every homepage record, for the claude.ai page.
export const copyRecordsText = (attempts, myQuestions, cur) => '[기록] ' + encodeSyncPlain({ attempts: attempts.slice(0, 200), mq: myQuestions.map(x => x.q), cur: cur || '' });

const darkLabel = { fontSize: 11, letterSpacing: '0.2em', color: 'var(--muted-3)' };

// 05 답변 녹음·피드백. Recording starts when the timer enters the answer phase and
// stops (and saves an attempt) when it leaves it.
export const Record = forwardRef(function Record({ timer, question, setQuestion, context, entries, attempts, saveAttempts, onFinish, onPractice, flash, myQuestions = [], onCarryQuestions, syncToken, onImport }, ref) {
  const [rubricOpen, setRubricOpen] = useState(false);
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
  const live = useRef({});
  live.current = { liveText, attempts, question, context, limit: timer.ans };
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
      const { liveText: t, question: q, context: c, limit } = live.current;
      const text = (t || '').trim();
      const at = { id: 'a' + Date.now(), date: new Date().toISOString(), q: q || '(질문 없음)', text, dur, limit, context: c || '', fb: null };
      saveAttempts(list => [at, ...list]); setCurAtt(at.id);
      // Without AI on the homepage the answer is kept for feedback on the claude.ai page instead.
      if (text && (IN_ARTIFACT || hasApiKey())) runFeedback(at, text);
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
    const used = timer.phase === 'answer' || timer.phase === 'done' ? Math.max(0, timer.ans - timer.remain) + (timer.over || 0) : 0;
    const at = { id: 'a' + Date.now(), date: new Date().toISOString(), q: question || '(질문 없음)', text: liveText, dur: used, limit: timer.ans, context: context || '', fb: null, manual: !recOn };
    saveAttempts(list => [at, ...list]); setCurAtt(at.id); setFuList([]);
    runFeedback(at, liveText);
  };

  // Homepage: save the answer as a record if needed, then copy it with every homepage record.
  const copyForClaude = () => {
    let id = cur && cur.text === liveText ? cur.id : '';
    const extra = [];
    if (!id) {
      const used = timer.phase === 'answer' || timer.phase === 'done' ? Math.max(0, timer.ans - timer.remain) + (timer.over || 0) : (cur ? cur.dur : 0);
      const at = cur ? { ...cur, text: liveText } : { id: 'a' + Date.now(), date: new Date().toISOString(), q: question || '(질문 없음)', text: liveText, dur: used, limit: timer.ans, context: context || '', fb: null, manual: !recOn };
      id = at.id; extra.push(at);
      saveAttempts(list => (cur ? list.map(a => (a.id === at.id ? at : a)) : [at, ...list])); setCurAtt(at.id);
    }
    const list = [...extra, ...attempts.filter(a => !extra.some(x => x.id === a.id))];
    navigator.clipboard?.writeText(copyRecordsText(list, myQuestions, id)).then(() => flash('복사했어요. 열린 Claude 화면의 답변 칸에 붙여 넣으세요'), () => flash('복사하지 못했어요. 다시 눌러 주세요'));
  };

  // claude.ai page: records pasted from the homepage join the lists, and the answer just given is reviewed.
  const pasteRecords = async v => {
    const payload = await decodeSync(v);
    if (!payload || !onImport) { flash('붙여 넣은 기록을 읽지 못했어요. 홈페이지에서 다시 복사해 주세요'); return; }
    const r = onImport(payload) || {};
    const at = (payload.attempts || []).find(a => a.id === payload.cur);
    const parts = [r.added ? `답변 ${r.added}개` : '', r.questions ? `질문 ${r.questions}개` : ''].filter(Boolean);
    flash(parts.length ? `홈페이지 기록을 옮겼어요 · ${parts.join(', ')}` : '홈페이지 기록이 이미 모두 옮겨져 있어요');
    if (!at) return;
    setQuestion(at.q === '(질문 없음)' ? '' : at.q); setLiveText(at.text || ''); setCurAtt(at.id); setFuList([]);
    const known = live.current.attempts.find(a => a.id === at.id);
    if (!at.fb && !(known && known.fb) && (at.text || '').trim()) runFeedback(at, at.text);
  };

  const getFollowup = async () => {
    if (!cur || fuLoading) return;
    setFuLoading(true);
    const q = await nextFollowup(cur, fuList);
    const next = [...fuList, q];
    setFuList(next); setFuLoading(false);
    saveAttempts(list => list.map(a => (a.id === cur.id ? { ...a, followups: next } : a)));
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
                  // Focusing inside the click opens the phone keyboard, where the mic key lives.
                  setGuideOpen(true); const el = answerRef.current;
                  if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
                }}>🎤 말로 답하기</button>
                {guideOpen && (
                  <div style={{ background: '#efede6', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.65 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontWeight: 600 }}>{TOUCH ? '키보드의 마이크 버튼으로 말하세요' : '노트북 음성 입력으로 말하세요'}</span>
                      <span className="link" style={{ fontSize: 12.5, color: 'var(--muted)' }} onClick={() => setGuideOpen(false)}>닫기</span>
                    </div>
                    {GUIDE.map(([h, t]) => <div key={h}><span style={{ color: 'var(--muted)' }}>{h} · </span>{t}</div>)}
                    {!TOUCH && !MAC && <a href={carryLink(syncToken, myQuestions, question)} target="_blank" rel="noopener noreferrer" style={{ alignSelf: 'flex-start', fontWeight: 600 }}>녹음되는 홈페이지 열기 ↗</a>}
                  </div>
                )}
              </div>
            )}
            <div className="label" style={{ color: 'var(--muted)' }}>전사 {question ? '· ' + (question.length > 40 ? question.slice(0, 40) + '…' : question) : ''}</div>
            <textarea ref={answerRef} className="transcript" rows={9} value={liveText} onChange={ev => {
                // Text copied from the homepage carries the question too: fill both fields.
                const v = ev.target.value;
                if (SYNC_RE.test(v)) { pasteRecords(v); return; }
                const m = v.match(HANDOFF);
                if (m) {
                  setQuestion(m[1].trim()); setLiveText(m[2].trim());
                  if (m[3] && onCarryQuestions) onCarryQuestions(m[3].split('\n').map(l => l.replace(/^-\s*/, '')));
                } else setLiveText(v);
              }}
              placeholder={recOn ? '답변 시간이 시작되면 여기에 실시간으로 받아 적힙니다. 끝난 뒤 직접 고칠 수 있어요.' : (IN_ARTIFACT ? '답변을 말하거나 적은 뒤 ‘피드백 받기’를 누르세요.' : '답변을 여기에 적고 ‘피드백 받기’를 누르세요.') + DICTATION_TIP} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{cur ? `${cur.dur}초 · ${liveText.replace(/\s/g, '').length}자` + (fb && fb.cpm ? ` · 분당 ${fb.cpm}자` : '') : ''}</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {audioUrl && <audio src={audioUrl} controls style={{ height: 34 }} />}
                {!IN_ARTIFACT && liveText.trim() && (
                  <a href={CLAUDE_URL} target="_blank" rel="noopener noreferrer" className="btn-line" style={{ fontSize: 13, padding: '8px 14px', textDecoration: 'none' }}
                    onClick={copyForClaude}>복사하고 Claude 피드백 받기 ↗</a>
                )}
                {(IN_ARTIFACT || hasApiKey()) && <button onClick={onFeedback} style={{ fontSize: 13, padding: '8px 14px', border: 'none', background: 'var(--ink)', color: 'var(--cream)' }}>{fbLoading ? '평가 중…' : (fb ? '다시 평가' : '피드백 받기')}</button>}
              </div>
            </div>
          </div>
          <div className="fb-panel">
            {!fb && !IN_ARTIFACT && !hasApiKey() && (
              <div style={{ fontSize: 14, lineHeight: 1.75, color: '#e9e6dd', borderBottom: '1px solid var(--charcoal-line)', paddingBottom: 14 }}>
                이 홈페이지는 AI가 연결되어 있지 않아 피드백은 Claude에서 받아요. 답변과 전사가 끝나면 왼쪽의 ‘복사하고 Claude 피드백 받기’를 누르고, 열린 Claude 화면의 답변 칸에 붙여 넣으세요. 피드백이 바로 나오고, 여기서 한 답변 기록도 모두 Claude로 옮겨져요.
              </div>
            )}
            {!fb && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--muted-3)' }}>답변이 끝나면 로스쿨 구술면접 평가 기준표(6개 항목 · 100점)로 채점하고, 항목마다 답변의 어느 표현을 근거로 몇 점을 줬는지 보여 줍니다.</div>
                <span className="link" style={{ fontSize: 12.5, color: 'var(--muted-3)', alignSelf: 'flex-start' }} onClick={() => setRubricOpen(!rubricOpen)}>{rubricOpen ? '평가 기준 닫기' : '평가 기준 보기'}</span>
                {rubricOpen && <RubricTable />}
              </div>
            )}
            {fb && (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--sans)', fontWeight: 200, fontSize: 64, lineHeight: 1, letterSpacing: '-0.04em' }}>{fb.total}</span>
                  <span style={{ ...darkLabel, fontSize: 12 }}>/ 100</span>
                  <span style={{ fontSize: 13, color: '#e9e6dd' }}>{fb.grade || gradeOf(fb.total)}</span>
                  <span className="link" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-3)' }} onClick={() => setRubricOpen(!rubricOpen)}>{rubricOpen ? '평가 기준 닫기' : '평가 기준 보기'}</span>
                </div>
                {rubricOpen && <RubricTable />}
                <div style={{ fontSize: 14.5, lineHeight: 1.75 }}>{fb.summary}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: 8 }}>
                  {Object.entries(fb.scores || {}).map(([k, v]) => (
                    <div key={k} className="fb-score">
                      <span style={{ fontSize: 11, color: 'var(--muted-3)' }}>{k}</span>
                      <span style={{ fontSize: 20, fontWeight: 300 }}>{v}<small style={{ fontSize: 11, color: 'var(--muted-3)' }}> / {(fb.max && fb.max[k]) || 20}</small></span>
                      <div style={{ height: 2, background: 'var(--charcoal-line)' }}><div style={{ height: 2, width: Math.round(v / ((fb.max && fb.max[k]) || 20) * 100) + '%', background: ACCENT }} /></div>
                    </div>
                  ))}
                </div>
                {(fb.criteria || []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={darkLabel}>항목별 채점 근거</div>
                    {fb.criteria.map(c => (
                      <div key={c.name} className="fb-crit">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{c.name}{c.level ? ` · ${c.level}` : ''}</span>
                          <span className="mono" style={{ color: 'var(--muted-3)' }}>{c.score}/{c.max}</span>
                        </div>
                        {c.evidence && <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--muted-3)' }}>“{c.evidence}”</div>}
                        {c.reason && <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>{c.reason}</div>}
                      </div>
                    ))}
                    {(fb.deductions || []).map((d, i) => <div key={i} style={{ fontSize: 13.5, color: '#e8a29a' }}>감점 −{d.points} · {d.reason}</div>)}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={darkLabel}>잘한 점</div>{(fb.strengths || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>+ {x}</div>)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><div style={darkLabel}>고칠 점</div>{(fb.weaknesses || []).map((x, i) => <div key={i} style={{ fontSize: 14, lineHeight: 1.7 }}>− {x}</div>)}</div>
                {fb.better && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--charcoal-line)', paddingTop: 14 }}>
                    <div style={darkLabel}>이렇게 보완하면</div>
                    <div style={{ fontSize: 14, lineHeight: 1.8, color: '#e9e6dd' }}>{fb.better}</div>
                  </div>
                )}
                {fb.model && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--charcoal-line)', paddingTop: 14 }}>
                    <div style={darkLabel}>모범답안 · {Math.round((cur.limit || 120) / 60 * 10) / 10}분 분량</div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.9, color: '#f3f1e8', whiteSpace: 'pre-wrap' }}>{fb.model}</div>
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
                      <button className="btn-answer" onClick={() => { setLiveText(''); setCurAtt(null); onPractice(q, cur && cur.context); }}>답변하기 →</button>
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

// The rubric as the candidate sees it: weight, what is judged, and what the top and middle levels look like.
function RubricTable() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: 'rgba(255,255,255,0.04)', padding: 14 }}>
      {RUBRIC.map(r => (
        <div key={r.k} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, lineHeight: 1.65 }}>
          <span style={{ fontWeight: 600 }}>{r.k} · {r.max}점</span>
          <span style={{ color: 'var(--muted-3)' }}>{r.what}</span>
          <span>상 · {r.levels[0]}</span>
          <span style={{ color: 'var(--muted-3)' }}>중 · {r.levels[2]}</span>
        </div>
      ))}
      <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--muted-3)' }}>{GRADES.map(([min, l]) => `${min ? min + '점 이상' : '그 아래'} ${l}`).join(' · ')}</div>
    </div>
  );
}

export function RecordBlock({ title, boxed, serif, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--muted)' }}>{title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.85, color: '#2e2d2b', whiteSpace: 'pre-wrap', wordBreak: 'keep-all', fontFamily: serif ? 'var(--serif)' : undefined, ...(boxed ? { background: '#efede6', padding: 16 } : {}) }}>{children}</div>
    </div>
  );
}

function tagCount(attempts, key) {
  const c = {};
  attempts.forEach(a => ((a.fb && a.fb[key]) || []).forEach(t => { c[t] = (c[t] || 0) + 1; }));
  return Object.entries(c).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
}

// 06 내 기록: running stats, repeated tags, AI trend analysis and the attempt log.
export const MyPage = forwardRef(function MyPage({ attempts, saveAttempts, analysis, setAnalysis, savedToClaude, bookCount, onOpenBook, onPractice, flash, myQuestions = [], onImport }, ref) {
  const [openId, setOpenId] = useState(null);
  const [grading, setGrading] = useState('');
  // Answers carried over from the homepage arrive without feedback; grade them here.
  const grade = async a => {
    if (grading) return;
    setGrading(a.id);
    const fb = await evaluate(a, a.text || '', null);
    saveAttempts(list => list.map(x => (x.id === a.id ? { ...x, fb } : x)));
    setGrading('');
  };
  const importText = async v => {
    if (!SYNC_RE.test(v)) return;
    const payload = await decodeSync(v);
    const r = payload && onImport ? onImport(payload) : null;
    if (!r) { flash('붙여 넣은 기록을 읽지 못했어요. 홈페이지에서 다시 복사해 주세요'); return; }
    const parts = [r.added ? `답변 ${r.added}개` : '', r.updated ? `피드백 ${r.updated}개` : '', r.questions ? `질문 ${r.questions}개` : ''].filter(Boolean);
    flash(parts.length ? `홈페이지 기록을 옮겼어요 · ${parts.join(', ')}` : '홈페이지 기록이 이미 모두 옮겨져 있어요');
  };
  const sendToClaude = () => {
    navigator.clipboard?.writeText(copyRecordsText(attempts, myQuestions, '')).then(() => flash('복사했어요. 열린 Claude 화면의 ‘내 기록’ 가져오기 칸에 붙여 넣으세요'), () => flash('복사하지 못했어요. 다시 눌러 주세요'));
  };
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
        next: ['결론을 첫 문장에 제시하기', '근거마다 이유나 사례 하나씩 붙이기', '반대 입장을 한 번 언급하고 반박하기'],
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
            <p className="lede" style={{ color: 'var(--muted)', fontSize: 13 }}>{savedToClaude ? '내 Claude 계정 공간에 저장돼요. 다른 기기에서 이 페이지를 열어도 그대로 보이고, 다른 사람에게는 보이지 않아요.' : IN_ARTIFACT ? '이 브라우저에만 저장돼요.' : '이 홈페이지 기록은 이 브라우저에만 있어요. ‘기록을 Claude로 옮기기’로 Claude에 합쳐 두면 어디서 열어도 같은 기록이 보여요.'}</p>
          </div>
          {!IN_ARTIFACT && <a href={CLAUDE_URL} target="_blank" rel="noopener noreferrer" className="btn-line" style={{ fontSize: 13, padding: '12px 18px', textDecoration: 'none' }} onClick={sendToClaude}>기록을 Claude로 옮기기 ↗</a>}
          <button onClick={analyze} style={{ fontSize: 13, padding: '12px 20px', border: 'none', background: 'var(--ink)', color: 'var(--cream)' }}>{loading ? '분석 중…' : '누적 분석하기'}</button>
        </div>
        {IN_ARTIFACT && (
          <div className="import-box">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>홈페이지 기록 가져오기 · 홈페이지 ‘내 기록’의 ‘기록을 Claude로 옮기기’를 누른 뒤 여기에 붙여 넣으세요. 홈페이지를 링크의 ‘녹음되는 홈페이지 열기’로 열면 여기 기록도 홈페이지에 함께 보여요.</span>
            <input className="manual-input" value="" onChange={ev => importText(ev.target.value)} onPaste={ev => { ev.preventDefault(); importText(ev.clipboardData.getData('text')); }} placeholder="여기에 붙여 넣기 (Ctrl+V)" />
          </div>
        )}
        <button className="qbook-open" onClick={onOpenBook}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 4, textAlign: 'left' }}>
            <span style={{ fontFamily: 'var(--serif)', fontWeight: 700, fontSize: 18 }}>질문 모음</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>직접 입력한 질문과 답변한 질문 {bookCount}개 · 질문별 피드백 요약</span>
          </span>
          <span style={{ fontSize: 14 }}>열기 →</span>
        </button>
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
                <span style={{ fontFamily: 'var(--sans)', fontWeight: 300, fontSize: a.fb ? 20 : 12.5, textAlign: 'right', color: a.fb ? undefined : 'var(--muted)' }}>{a.fb ? String(a.fb.total) : '피드백 전'}</span>
              </div>
              {openId === a.id && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 22px' }}>
                  <RecordBlock title="질문">{a.q}</RecordBlock>
                  <RecordBlock title={`내 답변 · ${a.dur || 0}초${a.limit ? ` / ${Math.round(a.limit / 60 * 10) / 10}분` : ''}`} boxed>{a.text || '(답변 없음)'}</RecordBlock>
                  {a.fb ? (
                    <>
                      <RecordBlock title={`피드백 · ${a.fb.total}점`}>
                        {a.fb.summary}
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 6 }}>{Object.entries(a.fb.scores || {}).map(([k, v]) => `${k} ${v}/${(a.fb.max && a.fb.max[k]) || 20}`).join(' · ')}</div>
                        {(a.fb.strengths || []).map((x, i) => <div key={'s' + i}>+ {x}</div>)}
                        {(a.fb.weaknesses || []).map((x, i) => <div key={'w' + i}>− {x}</div>)}
                      </RecordBlock>
                      {a.fb.model && <RecordBlock title="모범답안" boxed serif>{a.fb.model}</RecordBlock>}
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13.5, color: 'var(--muted)' }}>
                      피드백 전
                      {(IN_ARTIFACT || hasApiKey()) && (a.text || '').trim() && <button className="btn-line" style={{ fontSize: 12.5, padding: '6px 12px' }} onClick={() => grade(a)}>{grading === a.id ? '평가 중…' : '피드백 받기'}</button>}
                    </div>
                  )}
                  {(a.followups || []).length > 0 && (
                    <RecordBlock title="꼬리질문">{a.followups.map((q, i) => <div key={i}>{i + 1}. {q}</div>)}</RecordBlock>
                  )}
                  <div style={{ display: 'flex', gap: 16, fontSize: 12.5 }}>
                    <span className="link" onClick={() => onPractice(a.q, a.context)}>같은 질문 다시 연습</span>
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
