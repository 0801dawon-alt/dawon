// Prints every clip the CNU simulator plays as JSON: [[key, voiceSeat, text], ...].
import { readdirSync } from 'fs';
import { clips } from '../src/data/cnu/meta.js';
const dir = new URL('../src/data/cnu/', import.meta.url);
const sets = [];
for (const f of readdirSync(dir).filter(f => /^r\d+\.js$/.test(f)).sort()) sets.push((await import(new URL(f, dir))).default);
process.stdout.write(JSON.stringify(clips(sets)));
