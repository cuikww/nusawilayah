import { defineConfig } from '@playwright/test';

// Production build, so the test sees real server rendering.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:5181', channel: 'chrome' },
  webServer: {
    command: 'pnpm build && pnpm start -p 5181',
    url: 'http://localhost:5181',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: { NEXT_TELEMETRY_DISABLED: '1' },
  },
});
