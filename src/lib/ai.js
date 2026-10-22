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

// Returns the response text, or null when no key is set or the call fails,
// so callers fall back to their built-in templates.
export async function ask(prompt) {
  const sample = await getSample();
  if (sample) {
    try { return (await sample(prompt, { modelTier: 'default' })).text.trim() || null; }
    catch (err) { console.warn('[Thought Library] Claude request failed:', err); if (!getApiKey()) return null; }
  }
  const c = getClient();
  if (!c) return null;
  try {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: prompt }],
    });
    if (res.stop_reason === 'refusal') return null;
    return res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim() || null;
  } catch (err) {
    console.warn('[Thought Library] AI request failed:', err);
    return null;
  }
}
