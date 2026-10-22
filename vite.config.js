import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths and ASCII-only output so the build also publishes as a claude.ai artifact.
export default defineConfig({ base: './', plugins: [react()], esbuild: { charset: 'ascii' } });
