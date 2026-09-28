import { expect, test } from '@playwright/test';

test('login keeps its split layout when DevTools narrow the browser', async ({
  page,
}) => {
  await page.setViewportSize({ width: 895, height: 780 });
  await page.goto('/login');

  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();

  const panel = await page.locator('.auth-panel').boundingBox();
  const artwork = await page.locator('.auth-art').boundingBox();

  expect(panel).not.toBeNull();
  expect(artwork).not.toBeNull();
  expect(artwork!.x).toBeGreaterThanOrEqual(panel!.x + panel!.width - 1);

  await expect(page.locator('.auth-brand')).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeInViewport();

  const hasHorizontalOverflow = await page
    .locator('.login-page')
    .evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(hasHorizontalOverflow).toBe(false);
});

test('short desktop viewport can scroll from the brand to the last login control', async ({
  page,
}) => {
  await page.setViewportSize({ width: 895, height: 520 });
  await page.goto('/login');

  await page.locator('.auth-panel').evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(page.locator('.auth-brand')).toBeInViewport();

  const googleButton = page.getByRole('button', {
    name: 'Continue with Google',
  });
  await googleButton.scrollIntoViewIfNeeded();
  await expect(googleButton).toBeInViewport();
});

test('stacked layout keeps the entire form reachable at tablet and phone sizes', async ({
  page,
}) => {
  for (const viewport of [
    { width: 716, height: 782 },
    { width: 390, height: 667 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');

    const login = page.locator('.login-page');
    await login.evaluate((element) => {
      element.scrollTop = 0;
    });

    const artwork = await page.locator('.auth-art').boundingBox();
    const brand = await page.locator('.auth-brand').boundingBox();

    expect(artwork).not.toBeNull();
    expect(brand).not.toBeNull();
    expect(brand!.y).toBeGreaterThanOrEqual(
      artwork!.y + artwork!.height - 1,
    );
    await expect(page.locator('.auth-brand')).toBeInViewport();

    const googleButton = page.getByRole('button', {
      name: 'Continue with Google',
    });
    await googleButton.scrollIntoViewIfNeeded();
    await expect(googleButton).toBeInViewport();

    const hasHorizontalOverflow = await login.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
  }
});
