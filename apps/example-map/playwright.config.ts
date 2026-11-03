import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5182', channel: 'chrome' },
  webServer: { command: 'pnpm data && pnpm exec vite --port 5182 --strictPort', url: 'http://localhost:5182', reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
