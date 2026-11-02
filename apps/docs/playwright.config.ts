import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5180', channel: 'chrome' },
  webServer: { command: 'pnpm exec vite --port 5180 --strictPort', url: 'http://localhost:5180', reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
