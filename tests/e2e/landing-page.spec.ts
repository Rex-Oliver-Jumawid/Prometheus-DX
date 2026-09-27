import { expect, test } from '@playwright/test';

test('visitors can explore the landing page and open local sign-in', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/landing-page\.html$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.hero-art')).toBeVisible();

  await page.getByRole('link', { name: /Open Prometheus/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('the standalone landing page remains accessible by direct URL', async ({ page }) => {
  await page.goto('/landing-page.html');

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.hero-art')).toBeVisible();
  await expect(page.locator('.site-header')).toBeVisible();
});
