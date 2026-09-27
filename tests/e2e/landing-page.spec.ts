import { expect, test } from '@playwright/test';

test('the site root renders the public React landing page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('.hero-art')).toBeVisible();
  await expect(page.locator('.site-header')).toBeVisible();

  await page.getByRole('link', { name: /Open Prometheus/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('the former standalone landing URL redirects to the public root', async ({ page }) => {
  await page.goto('/landing-page.html');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the floating navbar stays visible while scrolling to a lower section', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'How it works' }).click();
  await expect(page).toHaveURL(/#approach$/);

  const header = page.locator('.site-header');
  await expect(header).toHaveClass(/is-scrolled/);
  await expect(header).toBeInViewport();
  await expect.poll(() => header.evaluate((element) => element.getBoundingClientRect().top))
    .toBeGreaterThanOrEqual(-1);
  await expect.poll(() => header.evaluate((element) => element.getBoundingClientRect().top))
    .toBeLessThanOrEqual(1);
});

test('mobile navigation opens and closes on section selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'What it does' })).toBeVisible();
  await nav.getByRole('link', { name: 'What it does' }).click();
  await expect(page).toHaveURL(/#features$/);
  await expect(page.locator('.site-header')).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});

test('the signed-in workspace route still requires authentication', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
