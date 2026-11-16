// Prints every clip the CNU simulator plays as JSON: [[key, voiceSeat, text], ...].
import { readdirSync } from 'fs';
import { clips } from '../src/data/cnu/meta.js';
const dir = new URL('../src/data/cnu/', import.meta.url);
const by = {};
for (const f of readdirSync(dir).filter(f => /^r\d+\.js$/.test(f)).sort()) (await import(new URL(f, dir))).default.forEach(q => { by[q.id] = q; });
const sets = (await import(new URL('rounds.js', dir))).default.map(ids => ids.map(id => by[id]));
process.stdout.write(JSON.stringify(clips(sets)));
