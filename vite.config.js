import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths and ASCII-only output so the build also publishes as a claude.ai artifact.
// The prewritten question bank loads as a few chunks: the expected-question files go 30 to a chunk so no file passes the artifact's 16MB limit.
// The personal build (the owner's claude.ai page) is the one made with the private Notion notes present;
// the public homepage build leaves out everything that came from those notes.
const PERSONAL = fs.existsSync(new URL('./src/data/notion-notes.json', import.meta.url));
export default defineConfig({
  base: './', plugins: [react()], esbuild: { charset: 'ascii' },
  define: { __PERSONAL__: JSON.stringify(PERSONAL) },
  build: { rollupOptions: { output: { manualChunks: id => { if (!id.includes('/src/data/bank/')) return undefined; const e = id.match(/bank\/e-(\d+)/); return e ? 'bank-e' + Math.floor((+e[1] - 1) / 30) : 'bank-' + (id.match(/bank\/(\w)/) || [0, 'x'])[1]; } } } },
});
