import TOPICS from '../data/topics.json';
import { loadJSON, saveJSON } from './util.js';

export const ENTRIES_KEY = 'thoughtlib_entries_v2';
export const ATTEMPTS_KEY = 'thoughtlib_attempts_v1';
export const ANALYSIS_KEY = 'thoughtlib_analysis_v1';
export const MYQ_KEY = 'thoughtlib_myquestions_v1';
export const VIEWED_KEY = 'thoughtlib_viewed_v1';
const DATA_VERSION_KEY = 'thoughtlib_data_version';
// Bump when src/data/topics.json gains topics; existing libraries pick up new titles once.
const DATA_VERSION = 1;

const seed = () => TOPICS.map(t => ({ ...t, myView: '' }));

export function loadEntries() {
  const saved = loadJSON(ENTRIES_KEY, null);
  if (!Array.isArray(saved) || !saved.length) {
    const fresh = seed();
    saveJSON(ENTRIES_KEY, fresh);
    saveJSON(DATA_VERSION_KEY, DATA_VERSION);
    return fresh;
  }
  if (loadJSON(DATA_VERSION_KEY, 0) >= DATA_VERSION) return saved;
  const titles = new Set(saved.map(e => e.title));
  const merged = [...saved, ...seed().filter(t => !titles.has(t.title))];
  saveJSON(ENTRIES_KEY, merged);
  saveJSON(DATA_VERSION_KEY, DATA_VERSION);
  return merged;
}
