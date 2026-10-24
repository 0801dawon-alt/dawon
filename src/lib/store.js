import TOPICS from '../data/topics.json';
import NOTION_A from '../data/topics-notion-a.js';
import NOTION_B from '../data/topics-notion-b.js';
import NOTION_C from '../data/topics-notion-c.js';
import { loadJSON, saveJSON } from './util.js';

export const ENTRIES_KEY = 'thoughtlib_entries_v2';
export const ATTEMPTS_KEY = 'thoughtlib_attempts_v1';
export const ANALYSIS_KEY = 'thoughtlib_analysis_v1';
export const MYQ_KEY = 'thoughtlib_myquestions_v1';
export const VIEWED_KEY = 'thoughtlib_viewed_v1';
const SEEN_KEY = 'thoughtlib_seed_seen_v1';

// Subtopics added over time, one file per batch (topics-add-YYYYMMDD.js); each carries its own motion and reasons.
const ADDED = Object.values(import.meta.glob('../data/topics-add-*.js', { eager: true })).flatMap(m => m.default || []);

const seed = () => [...TOPICS, ...NOTION_A, ...NOTION_B, ...NOTION_C, ...ADDED].map(t => ({ ...t, myView: '' }));

// Fields that come from the library data; the viewer's own notes, scraps and model answers stay theirs.
const SEED_FIELDS = ['title', 'category', 'summary', 'keywords', 'tags', 'background', 'issues', 'pro', 'con', 'motion', 'questions'];

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
  const titles = new Set(saved.map(e => e.title));
  const merged = [
    ...saved.map(e => {
      const f = byId.get(e.id);
      if (!f || e.edited) return e;
      const next = { ...e };
      SEED_FIELDS.forEach(k => { if (f[k] !== undefined) next[k] = f[k]; });
      return next;
    }),
    ...fresh.filter(t => !seen.has(t.id) && !titles.has(t.title)),
  ];
  saveJSON(ENTRIES_KEY, merged);
  saveJSON(SEEN_KEY, fresh.map(t => t.id));
  return merged;
}
