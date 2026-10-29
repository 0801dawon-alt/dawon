import TOPICS from '../data/topics.json';
import NOTION_A from '../data/topics-notion-a.js';
import NOTION_B from '../data/topics-notion-b.js';
import NOTION_C from '../data/topics-notion-c.js';
import { loadJSON, saveJSON } from './util.js';
import EXTRA_Q from '../data/questions-extra.js';

export const ENTRIES_KEY = 'thoughtlib_entries_v2';
export const ATTEMPTS_KEY = 'thoughtlib_attempts_v1';
export const ANALYSIS_KEY = 'thoughtlib_analysis_v1';
export const MYQ_KEY = 'thoughtlib_myquestions_v1';
export const VIEWED_KEY = 'thoughtlib_viewed_v1';
const SEEN_KEY = 'thoughtlib_seed_seen_v1';
const REISSUE_KEY = 'thoughtlib_reissue_20261028';
// The 2026-10-28 daily subtopics moved from k91–k135 to k144–k182 when their ids clashed.
const REISSUED = id => /^k(\d+)$/.test(id) && +id.slice(1) >= 144 && +id.slice(1) <= 182;
// Ids of duplicate subtopics taken out of the library; an old copy is dropped unless the viewer edited it.
const RETIRED = new Set(['k57', 'k75', 'k85', 'k102', 'k106']);

// Subtopics added over time, one file per batch (topics-add-YYYYMMDD.js); each carries its own motion and reasons.
const ADDED = Object.values(import.meta.glob('../data/topics-add-*.js', { eager: true })).flatMap(m => m.default || []);

// Subtopics built from the owner's Notion notes appear only in the personal build.
const NOTION = __PERSONAL__ ? [...NOTION_A, ...NOTION_B, ...NOTION_C] : [];
// Partisan or person-centred current affairs stay in the personal build only; the shared version keeps
// issues with a clear, lasting point of dispute.
const PARTISAN = new Set(['v21', 'v22', 'v23', 'v24', 'v26', 'v27', 'v28', 'v29', 'v41', 'v42', 'v45', 'v46', 'v48', 'v50', 'v51', 'v53', 'v54', 'v55', 'v56', 'v58', 'v59', 'w2', 'w3', 'x3', 'u21', 'u22', 'u23', 'k56', 'k59']);
// Extra questions are appended, so model answers keyed by question order stay with their questions.
export const SEED_TOPICS = [...TOPICS, ...NOTION, ...ADDED]
  .filter(t => __PERSONAL__ || !PARTISAN.has(t.id))
  .map(t => (EXTRA_Q[t.id] ? { ...t, questions: [...(t.questions || []), ...EXTRA_Q[t.id]] } : t));
export const SEED_IDS = new Set(SEED_TOPICS.map(t => t.id));
const seed = () => SEED_TOPICS.map(t => ({ ...t, myView: '' }));

// Fields that come from the library data; the viewer's own notes, scraps and model answers stay theirs.
export const SEED_FIELDS = ['title', 'category', 'summary', 'keywords', 'tags', 'background', 'issues', 'pro', 'con', 'motion', 'questions'];

// A saved library picks up new subtopics once (a deleted one stays deleted) and the latest text of
// every library subtopic the viewer has not edited.
export function loadEntries() {
  const fresh = seed();
  const saved = loadJSON(ENTRIES_KEY, null);
  if (!Array.isArray(saved) || !saved.length) {
    saveJSON(ENTRIES_KEY, fresh);
    saveJSON(SEEN_KEY, fresh.map(t => t.id));
    return fresh;
  }
  const seen = new Set(loadJSON(SEEN_KEY, null) || saved.map(e => e.id));
  const byId = new Map(fresh.map(t => [t.id, t]));
  const refreshed = saved.filter(e => !RETIRED.has(e.id) || e.edited).map(e => {
    const f = byId.get(e.id);
    if (!f || e.edited) return e;
    const next = { ...e };
    SEED_FIELDS.forEach(k => { if (f[k] !== undefined) next[k] = f[k]; });
    return next;
  });
  const titles = new Set(refreshed.map(e => e.title)), ids = new Set(refreshed.map(e => e.id));
  // Subtopics given new ids once: a library that skipped them under the old id picks them up now.
  const reissue = !loadJSON(REISSUE_KEY, false);
  const merged = [
    ...refreshed,
    ...fresh.filter(t => (!seen.has(t.id) || (reissue && REISSUED(t.id))) && !ids.has(t.id) && !titles.has(t.title)),
  ];
  if (reissue) saveJSON(REISSUE_KEY, true);
  saveJSON(ENTRIES_KEY, merged);
  saveJSON(SEEN_KEY, fresh.map(t => t.id));
  return merged;
}

// The viewer's own part of a card, kept in their Claude space so every device shows the same library:
// a whole card they added or edited, or just the model answers saved on a library card. Notes and
// scraps travel separately. Null for an untouched library card.
export function libOverlay(e) {
  const { myView, scraps, ...rest } = e;
  if (!SEED_IDS.has(e.id) || e.edited) return { entry: rest };
  return e.models && Object.keys(e.models).length ? { entry: { id: e.id, models: e.models } } : null;
}

// Apply overlays from the viewer's Claude space to this device's library.
export function applyOverlays(list, lib) {
  const have = new Set(list.map(e => e.id));
  const next = list.filter(e => !(lib[e.id] && lib[e.id].deleted)).map(e => {
    const x = lib[e.id] && lib[e.id].entry;
    if (!x) return e;
    if (!SEED_IDS.has(e.id) || x.edited) return { ...e, ...x };
    return { ...e, models: { ...(e.models || {}), ...(x.models || {}) } };
  });
  const added = Object.entries(lib).filter(([id, d]) => d && d.entry && !d.deleted && !have.has(id) && (!SEED_IDS.has(id) || d.entry.edited)).map(([id, d]) => ({ myView: '', ...d.entry, id }));
  return [...added, ...next];
}
