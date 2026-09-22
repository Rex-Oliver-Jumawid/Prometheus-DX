import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

// Override these per worktree so parallel Playwright runs use isolated servers.
const apiPort = Number(process.env.E2E_API_PORT ?? '3001');
const webPort = Number(process.env.E2E_WEB_PORT ?? '5173');
const webOrigin = `http://127.0.0.1:${webPort}`;

const usesSharedMemberCredential = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const apiEnvironmentWithoutBrevo = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('BREVO_')),
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  workers: usesSharedMemberCredential ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      env: {
        ...apiEnvironmentWithoutBrevo,
        PORT: String(apiPort),
        CLIENT_ORIGINS: [
          apiEnvironmentWithoutBrevo.CLIENT_ORIGINS ??
            'http://localhost:5173,http://localhost:4173',
          `http://localhost:${webPort}`,
          webOrigin,
        ].join(','),
        INVITATION_DELIVERY_MODE: 'disabled',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev:web',
      url: `${webOrigin}/foundation`,
      env: {
        E2E_API_PORT: String(apiPort),
        E2E_WEB_PORT: String(webPort),
        VITE_API_BASE_URL: '/api',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
