import Anthropic from '@anthropic-ai/sdk';

// The key lives only in this browser's localStorage and is sent straight to the Anthropic API.
const KEY_STORAGE = 'thoughtlib_anthropic_key';
const MODEL = 'claude-opus-5-5';

export function getApiKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage blocked */ }
  client = null;
}

// Inside a claude.ai artifact the page can ask Claude on the viewer's own account.
let samplePromise = null;
function getSample() {
  if (!samplePromise) samplePromise = window.claude?.use ? window.claude.use('sample').catch(() => null) : Promise.resolve(null);
  return samplePromise;
}
let sampleReady = false;
getSample().then(fn => { sampleReady = !!fn; });

export const hasApiKey = () => sampleReady || !!getApiKey();
export const inArtifact = () => !!window.claude?.use;

let client = null;
function getClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  if (!client) client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  return client;
}

// Why the last call fell back to templates, in words the viewer can act on.
const ISSUE_TEXT = {
  not_granted: 'Claude 사용이 허용되지 않았어요. 페이지 오른쪽 위 메뉴의 권한(Permissions)에서 Claude 사용을 허용한 뒤 새로고침해 주세요.',
  sampling_disabled: '이 계정에서는 Claude를 쓸 수 없어요.',
  rate_limited: 'Claude 사용 한도에 걸렸어요. 잠시 뒤 다시 눌러 주세요.',
  session_expired: 'claude.ai 로그인이 만료됐어요. 다시 로그인한 뒤 새로고침해 주세요.',
  refused: 'Claude가 이 요청에 답하지 않았어요. 주제나 표현을 바꿔 다시 시도해 주세요.',
  empty_completion: 'Claude 답변이 비어 있었어요. 다시 눌러 주세요.',
  unreadable: 'Claude 답변 형식을 읽지 못했어요. 다시 눌러 주세요.',
  no_ai: 'AI가 연결되어 있지 않아요. claude.ai 링크로 열거나 맨 아래 ‘AI 설정’에서 키를 넣어 주세요.',
  failed: '일시적인 연결 오류예요. 다시 눌러 주세요.',
};
let issue = '';
export const lastAiIssue = () => ISSUE_TEXT[issue] || '';
// Callers report a reply they could not parse, so the message names the real cause.
export const markUnreadable = () => { if (!issue) issue = 'unreadable'; };

// Returns the response text, or null when no key is set or the call fails,
// so callers fall back to their built-in templates.
export async function ask(prompt) {
  issue = '';
  const sample = await getSample();
  if (sample) {
    try {
      const text = (await sample(prompt, { modelTier: 'default' })).text.trim();
      if (!text) issue = 'empty_completion';
      return text || null;
    } catch (err) {
      console.warn('[Thought Library] Claude request failed:', err);
      issue = ISSUE_TEXT[err?.code] ? err.code : 'failed';
      if (!getApiKey()) return null;
    }
  }
  const c = getClient();
  if (!c) { if (!issue) issue = 'no_ai'; return null; }
  try {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal') { issue = 'refused'; return null; }
    issue = '';
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim() || null;
  } catch (err) {
    console.warn('[Thought Library] AI request failed:', err);
    issue = err?.status === 429 ? 'rate_limited' : 'failed';
    return null;
  }
}
