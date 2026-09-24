import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const usesSharedMemberCredential = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const apiPort = Number(process.env.E2E_API_PORT || 3001);
const webPort = Number(process.env.E2E_WEB_PORT || 5173);
const isolatedPorts = Boolean(process.env.E2E_API_PORT || process.env.E2E_WEB_PORT);
const webBaseUrl = `http://127.0.0.1:${webPort}`;
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
    baseURL: webBaseUrl,
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
        INVITATION_DELIVERY_MODE: 'disabled',
      },
      reuseExistingServer: !process.env.CI && !isolatedPorts,
      timeout: 120_000,
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `${webBaseUrl}/foundation`,
      env: {
        ...process.env,
        E2E_API_PORT: String(apiPort),
      },
      reuseExistingServer: !process.env.CI && !isolatedPorts,
      timeout: 120_000,
    },
  ],
});
