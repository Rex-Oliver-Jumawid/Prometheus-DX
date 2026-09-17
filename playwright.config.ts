import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

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
    baseURL: 'http://127.0.0.1:5173',
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
      url: 'http://127.0.0.1:3001/api/health',
      env: {
        ...apiEnvironmentWithoutBrevo,
        INVITATION_DELIVERY_MODE: 'disabled',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://127.0.0.1:5173/foundation',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
