import { expect, test } from '@playwright/test';

test('login exposes the forgot password flow', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();

  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(
    page.getByRole('heading', { name: 'Reset your password', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Company email')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Send reset link', exact: true }),
  ).toBeVisible();
});

test('forgot password validates the email before contacting auth', async ({
  page,
}) => {
  await page.goto('/forgot-password');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('Enter your company email.')).toBeVisible();

  await page.getByLabel('Company email').fill('not-an-email');
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
});

test('reset password route fails closed without a recovery session', async ({
  page,
}) => {
  await page.goto('/reset-password');
  await expect(
    page.getByRole('heading', {
      name: /Reset link unavailable|Password recovery unavailable/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Request a new reset link' }),
  ).toBeVisible();
});
