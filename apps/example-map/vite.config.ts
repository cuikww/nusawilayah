import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Map demo: region data in public/data, boundaries in public/geo (both copied by `pnpm data`).
// Not deployed: the boundary data must not be distributed before PRD gate 3 (boundary data origin) is cleared.
export default defineConfig({ plugins: [react()] });
