import { expect, test } from '@playwright/test';

test('signed-out direct protected navigation returns to login', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('login validates required credentials without submitting twice', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter your company email.')).toBeVisible();
  await expect(page.getByText('Enter your password.')).toBeVisible();
});

test('unknown account is rejected without leaking account details', async ({
  page,
}) => {
  await page.goto('/login');
  await page
    .getByLabel('Company email')
    .fill(`phase1-unknown-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('not-a-real-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Sign-in failed. Check your email and password and try again.',
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('known account with a wrong password is rejected generically', async ({
  page,
}) => {
  const email = process.env.E2E_MEMBER_EMAIL;
  test.skip(!email, 'Requires E2E_MEMBER_EMAIL in .env.');

  await page.goto('/login');
  await page.getByLabel('Company email').fill(email!);
  await page
    .getByLabel('Password', { exact: true })
    .fill('definitely-not-the-real-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Sign-in failed. Check your email and password and try again.',
  );
  await expect(page).toHaveURL(/\/login$/);
});

test('authorized member exercises the shell, refreshes, and signs out', async ({
  page,
}) => {
  const email = process.env.E2E_MEMBER_EMAIL;
  const password = process.env.E2E_MEMBER_PASSWORD;
  test.skip(
    !email || !password,
    'Requires E2E_MEMBER_EMAIL and E2E_MEMBER_PASSWORD in .env.',
  );

  await page.goto('/projects');
  await page.getByLabel('Company email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Collapse sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand sidebar' }).click();
  await expect(page.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible();

  await page.getByRole('button', { name: 'Notifications' }).click();
  await expect(page.getByText('You’re all caught up.')).toBeVisible();
  await page.getByRole('button', { name: 'Notifications' }).click();

  await page.getByRole('link', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/team$/);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();

  await page
    .getByRole('button', { name: 'Open profile and account' })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: 'Profile' })).toContainText(
    email!,
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
