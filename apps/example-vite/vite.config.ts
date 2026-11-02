import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Self-host mode: serve @nusawilayah/data/dist as static files, so the demo works offline.
export default defineConfig({ plugins: [react()], publicDir: '../../packages/data/dist' });
