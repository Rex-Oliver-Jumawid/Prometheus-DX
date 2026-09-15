import { expect, test } from '@playwright/test';

test('signed-out direct protected navigation returns to login', async ({ page }) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('login validates required credentials without submitting twice', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter your company email.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
});

test('authorized member enters the shell, refreshes, and signs out', async ({ page }) => {
  const email = process.env.E2E_MEMBER_EMAIL;
  const password = process.env.E2E_MEMBER_PASSWORD;
  test.skip(!email || !password, 'Requires configured Supabase Phase 1 member credentials.');

  await page.goto('/projects');
  await page.getByLabel('Company email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await page.getByRole('button', { name: 'Open profile and account' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Profile' })).toContainText(email!);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
