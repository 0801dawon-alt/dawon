import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths and ASCII-only output so the build also publishes as a claude.ai artifact.
// The prewritten question bank loads as one chunk, however many data files it grows to.
export default defineConfig({
  base: './', plugins: [react()], esbuild: { charset: 'ascii' },
  build: { rollupOptions: { output: { manualChunks: id => (id.includes('/src/data/bank/') ? 'bank' : undefined) } } },
});
