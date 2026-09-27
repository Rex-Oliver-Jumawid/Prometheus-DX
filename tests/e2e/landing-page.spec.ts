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

test('the former standalone URL leads to the explicit public landing route', async ({ page }) => {
  await page.goto('/landing-page.html');
  await expect(page).toHaveURL(/\/landing$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the login brand returns visitors to the landing page', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Prometheus Virtual Office, view landing page' }).click();
  await expect(page).toHaveURL(/\/landing$/);
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

  const glass = await header.locator('.nav').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      background: style.backgroundColor,
      borderRadius: style.borderTopLeftRadius,
      backdrop: style.backdropFilter,
      shadow: style.boxShadow,
    };
  });
  expect(glass.background).toMatch(/^rgba\(255,\s*255,\s*255,\s*0\./);
  expect(glass.borderRadius).toBe('999px');
  expect(glass.backdrop).toContain('blur(26px)');
  expect(glass.backdrop).toContain('saturate(');
  expect(glass.shadow).toContain('inset');
});

test('landing brand returns to top with matching rounded logos and square red CTAs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/landing');

  const navbarBrand = page.locator('.site-header .brand-icon');
  const footerBrand = page.locator('.footer .brand-icon');
  const navbarRadius = await navbarBrand.evaluate((element) =>
    getComputedStyle(element).borderTopLeftRadius,
  );
  const footerRadius = await footerBrand.evaluate((element) =>
    getComputedStyle(element).borderTopLeftRadius,
  );
  expect(navbarRadius).toBe('14px');
  expect(footerRadius).toBe(navbarRadius);

  const primaryButtons = page.locator('.hero-actions .action-primary, .closing-actions .action-primary');
  await expect(primaryButtons).toHaveCount(2);
  for (const button of await primaryButtons.all()) {
    const radius = await button.evaluate((element) =>
      getComputedStyle(element).borderTopLeftRadius,
    );
    expect(radius).toBe('0px');
  }

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'How it works' }).click();
  await expect(page).toHaveURL(/#approach$/);
  await nav.getByRole('link', { name: 'Prometheus, back to top' }).click();
  await expect(page).toHaveURL(/#top$/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);

  // Footer branding should navigate to the same real document-top anchor.
  await page.locator('.footer .brand').click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
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
  await expect(page.locator('.site-header .nav')).toHaveCSS('border-top-left-radius', '999px');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});

test('the signed-in workspace route still requires authentication', async ({ page }) => {
  await page.goto('/workspace');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

const hasAuthFixture = Boolean(
  process.env.E2E_MEMBER_EMAIL &&
  process.env.E2E_MEMBER_PASSWORD &&
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY,
);

test('returning members open the workspace and can explicitly view the landing page', async ({ page }) => {
  test.skip(!hasAuthFixture, 'Requires a configured Supabase E2E member.');

  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/workspace$/, { timeout: 15_000 });

  await page.goto('/');
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.locator('#landing-root')).toHaveCount(0);

  await page.goto('/schedule');
  await expect(page).toHaveURL(/\/schedule$/);
  await page.getByRole('link', { name: 'Prometheus Virtual Office, go to Home' }).click();
  await expect(page).toHaveURL(/\/workspace$/);

  // Signed-in members can still open the public landing page explicitly.
  await page.goto('/landing');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('link', { name: /Open Prometheus/i }).first().click();
  await expect(page).toHaveURL(/\/workspace$/);

  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('link', { name: 'Prometheus Virtual Office, view landing page' }).click();
  await expect(page).toHaveURL(/\/landing$/);
});
