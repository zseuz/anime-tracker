import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests. They start their own API (against the separate `anime_tracker_test` database)
 * and the Angular dev server, and mock AniList, so they are deterministic and never touch real data.
 *
 * Needs MySQL running and `npm run db:setup` done (it creates the test database).
 * Stop `npm start` first: these tests use the same ports (3000 and 4200) on purpose.
 *
 * By default the installed Microsoft Edge is used (no browser download). Override with
 * E2E_CHANNEL=chrome, or E2E_CHANNEL= to use Playwright's bundled Chromium (`npx playwright install chromium`).
 */
const channel = process.env['E2E_CHANNEL'] ?? 'msedge';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:4200',
    channel: channel || undefined,
    locale: 'es-ES',
    colorScheme: 'dark', // the app follows the system theme until the user picks one
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node src/index.js',
      cwd: 'server',
      env: { DB_NAME: 'anime_tracker_test', PORT: '3000', CORS_ORIGIN: 'http://localhost:4200', AUTH_RATE_LIMIT_MAX: '10000' },
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: 'node node_modules/@angular/cli/bin/ng.js serve --port 4200',
      env: { NG_CLI_ANALYTICS: 'false', CI: '1' },
      url: 'http://localhost:4200',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
