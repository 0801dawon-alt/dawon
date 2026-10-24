// Checks the prewritten bank: every model answer must sit under the question it was written for.
// Usage: node scripts/bank-check.mjs            -> summary, writes the ids still missing answers
//        node scripts/bank-check.mjs list A B   -> prints topics A..B (seed order) with their questions
//        node scripts/bank-check.mjs missing N  -> prints the first N topics that still lack answers
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'src/data');
const T = JSON.parse(fs.readFileSync(path.join(DATA, 'topics.json'), 'utf8'));
const mods = ['topics-notion-a.js', 'topics-notion-b.js', 'topics-notion-c.js', ...fs.readdirSync(DATA).filter(f => f.startsWith('topics-add-')).sort()];
const all = [...T];
for (const m of mods) all.push(...(await import(path.join(DATA, m))).default);
const BY = new Map(all.map(t => [t.id, t]));
const flat = s => (s || '').replace(/\s+/g, '');

const covered = new Set(); let ok = 0, bad = 0;
globalThis.__M = (id, list) => {
  list.forEach(([h], n) => {
    const q = ((BY.get(id) || {}).questions || [])[n];
    if (q && flat(q).startsWith(flat(h))) { ok++; covered.add(id + '#' + n); } else { bad++; console.log('MISMATCH', id, n, h); }
  });
  return [];
};
const BANK = path.join(DATA, 'bank');
let passages = 0;
for (const f of fs.readdirSync(BANK).sort()) {
  const src = fs.readFileSync(path.join(BANK, f), 'utf8');
  if (f.startsWith('q-')) await import('data:text/javascript,' + encodeURIComponent(src.replace(/^import .*$/m, 'const M=globalThis.__M;')));
  else passages += (await import(path.join(BANK, f))).default.filter(x => x.k === 'p').length;
}
const missing = all.filter(e => (e.questions || []).some((q, n) => !covered.has(e.id + '#' + n)));
const show = list => list.forEach(e => { console.log(`## ${e.id} [${e.category}] ${e.title} — ${e.summary}`); (e.questions || []).forEach((q, i) => console.log(`${i}. ${q}`)); });
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'list') show(all.slice(+a, +b));
else if (cmd === 'missing') show(missing.slice(0, +a || 20));
else {
  let total = 0; all.forEach(e => (total += (e.questions || []).length));
  const cats = {}; all.forEach(e => (cats[e.category] = (cats[e.category] || 0) + 1));
  const maxK = Math.max(0, ...all.filter(e => /^k\d+$/.test(e.id)).map(e => +e.id.slice(1)));
  console.log({ topics: all.length, questions: total, answered: ok, mismatched: bad, topicsMissingAnswers: missing.length, passageSets: passages, nextTopicId: 'k' + (maxK + 1), categories: cats });
  if (bad) process.exitCode = 1;
}
