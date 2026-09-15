import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasSupabaseBrowserConfig = Boolean(
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY,
);

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signIn(page: Page) {
  const email = process.env.E2E_MEMBER_EMAIL;
  const password = process.env.E2E_MEMBER_PASSWORD;
  if (!email || !password)
    throw new Error('E2E credentials are not configured.');
  await page.goto('/login');
  await page.getByLabel('Company email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test('signed-out direct protected navigation returns to login', async ({
  page,
}) => {
  await page.goto('/projects');
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toBeVisible();
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
  test.skip(
    !hasSupabaseBrowserConfig,
    'Requires Supabase browser auth config.',
  );

  await page.goto('/login');
  await page
    .getByLabel('Company email')
    .fill(`phase1-unknown-${Date.now()}@example.com`);
  await page
    .getByLabel('Password', { exact: true })
    .fill('not-a-real-password');
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
  test.skip(
    !hasSupabaseBrowserConfig || !email,
    'Requires Supabase browser auth config and E2E_MEMBER_EMAIL.',
  );

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
    !hasSupabaseBrowserConfig || !email || !password,
    'Requires Supabase browser auth config and E2E member credentials.',
  );

  await page.goto('/projects');
  await page.getByLabel('Company email').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();

  await expect(
    page.getByRole('button', { name: /Collapse sidebar|Expand sidebar/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('navigation', { name: 'Workspace utilities' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Team' }).click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(
    page.getByRole('heading', { name: 'Team', exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/projects$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/team$/);

  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Team', exact: true }),
  ).toBeVisible();

  await page.goto('/schedule');
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(
    page.getByRole('heading', { name: 'Schedule', exact: true }),
  ).toBeVisible();

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

test('normal Member cannot see or open Registry', async ({ page }) => {
  const email = process.env.E2E_MEMBER_EMAIL;
  const password = process.env.E2E_MEMBER_PASSWORD;
  test.skip(
    !hasSupabaseBrowserConfig || !email || !password,
    'Requires Supabase browser auth config and E2E member credentials.',
  );

  const member = await prisma.member.findFirst({
    where: { email: { equals: email!, mode: 'insensitive' } },
  });
  if (!member) throw new Error('E2E member record was not found.');

  try {
    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: 'MEMBER' },
    });

    await signIn(page);
    await expect(page).not.toHaveURL(/\/login$/);
    await expect(page.getByRole('link', { name: 'Registry' })).toHaveCount(0);
    const registryApiStatus = await page.evaluate(async () => {
      const storageKey = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
      );
      const session = storageKey
        ? (JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
            access_token?: string;
          })
        : {};
      const response = await fetch('/api/registry/members', {
        headers: session.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      return response.status;
    });
    expect(registryApiStatus).toBe(403);
    await page.goto('/registry');
    await expect(
      page.getByRole('heading', {
        name: 'Registry is for administrators',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: member.workspaceRole },
    });
  }
});

test('deactivated Prometheus member is denied after authentication', async ({
  page,
}) => {
  const email = process.env.E2E_MEMBER_EMAIL;
  const password = process.env.E2E_MEMBER_PASSWORD;
  test.skip(
    !hasSupabaseBrowserConfig || !email || !password,
    'Requires Supabase browser auth config and E2E member credentials.',
  );

  const member = await prisma.member.findFirst({
    where: { email: { equals: email!, mode: 'insensitive' } },
  });
  if (!member) throw new Error('E2E member record was not found.');

  try {
    await prisma.member.update({
      where: { id: member.id },
      data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
    });

    await signIn(page);
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(
      page.getByRole('heading', {
        name: 'This account can’t enter Prometheus',
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await prisma.member.update({
      where: { id: member.id },
      data: { status: member.status, deactivatedAt: member.deactivatedAt },
    });
  }
});
