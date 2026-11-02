import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The data is served from this site itself (self-host mode), so the playground always shows the repo's data.
// BASE is set by the Pages workflow to '/<repo>/'.
export default defineConfig({ plugins: [react()], publicDir: '../../packages/data/dist', base: process.env.BASE ?? '/' });
