import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5179', channel: 'chrome' },
  webServer: { command: 'pnpm exec vite --port 5179 --strictPort', url: 'http://localhost:5179', reuseExistingServer: !process.env.CI },
});
