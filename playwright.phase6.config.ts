import { defineConfig, devices } from '@playwright/test';

const root = '/Users/olivero/Documents/projects/Prometheus-phase-6';
const apiEnvironmentWithoutBrevo = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith('BREVO_')),
);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      cwd: root,
      url: 'http://127.0.0.1:3002/api/health',
      env: {
        ...apiEnvironmentWithoutBrevo,
        PORT: '3002',
        INVITATION_DELIVERY_MODE: 'disabled',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm dev:web -- --port 5175',
      cwd: root,
      url: 'http://127.0.0.1:5175/foundation',
      env: {
        ...process.env,
        VITE_API_BASE_URL: 'http://127.0.0.1:3002/api',
      },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
