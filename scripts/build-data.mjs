// Rebuilds src/data/topics.json from the Claude Design handoff in project/.
// Replays the prototype's one-time localStorage migrations in the same order,
// so a fresh install starts with exactly the library the design ended with.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const design = join(root, 'project');
const mod = async f => (await import(pathToFileURL(join(design, f)).href)).default;

const html = readFileSync(join(design, 'Thought Library 2안.dc.html'), 'utf8');
const seed = name => {
  const m = html.match(new RegExp(`const ${name}\\s*=\\s*(\\[[\\s\\S]*?\\n\\]);`));
  if (!m) throw new Error(`${name} not found in design file`);
  return Function(`return ${m[1]}`)();
};

const byTitle = list => new Set(list.map(e => e.title));
const append = (list, more) => { const t = byTitle(list); return [...list, ...more.filter(e => !t.has(e.title))]; };

let E = [...seed('SEED'), ...seed('SEED2')];
E = append(E, await mod('topics.js'));
const Q = await mod('questions.js'), I = await mod('issues.js');
E = E.map(e => ({ ...e, ...(Q[e.title] ? { questions: Q[e.title] } : {}), ...(I[e.title] ? { issues: I[e.title] } : {}) }));
const F = await mod('fixes.js');
E = E.map(e => { const f = F[e.title]; if (!f) return e; const kw = f[1].split('|'); return { ...e, summary: f[0] || e.summary, keywords: kw, tags: [...new Set([...kw, ...(e.tags || [])])] }; });
const CM = { 기술: '과학', 윤리: '사회', '정치·법': '법', 교육: '사회', '문화·미디어': '문화', '보건·의료': '사회' };
E = E.map(e => (CM[e.category] ? { ...e, category: CM[e.category] } : e));
E = append(E, [...(await mod('topics3a.js')), ...(await mod('topics3b.js'))]);
E = append(E, await mod('topics3c.js'));
E = append(E, await mod('topics2.js'));

E = E.map(({ myView, ...e }) => e);
writeFileSync(join(root, 'src/data/topics.json'), JSON.stringify(E, null, 0).replace(/\},\{/g, '},\n{') + '\n');

const counts = {};
E.forEach(e => { counts[e.category] = (counts[e.category] || 0) + 1; });
console.log(E.length, 'topics', counts);
