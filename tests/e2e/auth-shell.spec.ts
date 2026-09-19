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
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
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

test('password visibility control matches the icon design and toggles the input type', async ({
  page,
}) => {
  await page.goto('/login');

  const password = page.getByLabel('Password', { exact: true });
  const showPassword = page.getByRole('button', { name: 'Show password' });

  await expect(showPassword.locator('svg')).toBeVisible();
  await expect(showPassword).toHaveText('');
  await expect(password).toHaveAttribute('type', 'password');

  await showPassword.click();

  await expect(password).toHaveAttribute('type', 'text');
  const hidePassword = page.getByRole('button', { name: 'Hide password' });
  await expect(hidePassword.locator('svg')).toBeVisible();
  await expect(hidePassword).toHaveText('');
});

test('non-Gmail invited member account setup preserves the invited email and requires a password', async ({
  page,
}) => {
  await page.goto('/account-setup?email=Invited%40Example.com');
  await expect(
    page.getByRole('heading', { name: 'Set up account', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Invited email')).toHaveValue(
    'invited@example.com',
  );
  await expect(page.getByLabel('Invited email')).toHaveAttribute('readonly');
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toHaveCount(0);
  await page.getByLabel('Create password').fill('password-one');
  await page.getByLabel('Confirm password').fill('password-two');
  await page.getByRole('button', { name: 'Create password account' }).click();
  await expect(page.getByText('Passwords must match.')).toBeVisible();
});

test('Gmail invited member account setup offers Google without password setup', async ({
  page,
}) => {
  await page.goto('/account-setup?email=Invited.User%40Gmail.com');
  await expect(
    page.getByRole('heading', { name: 'Set up account', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Invited email')).toHaveValue(
    'invited.user@gmail.com',
  );
  await expect(page.getByLabel('Invited email')).toHaveAttribute('readonly');
  await expect(page.getByLabel('Create password')).toHaveCount(0);
  await expect(page.getByLabel('Confirm password')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Create password account' }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Continue with Google' }),
  ).toBeVisible();
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

  const profile = page.getByRole('dialog', { name: 'Profile settings' });
  await expect(profile).toBeVisible();
  await expect(profile).toContainText(email!);
  await expect(profile.getByLabel('Full name')).toHaveValue(/.+/);
  await expect(profile.getByLabel(/Email address/)).toHaveAttribute('readonly');
  await expect(profile.getByLabel(/Department/)).toHaveAttribute('readonly');
  await expect(profile.getByLabel(/Access role/)).toHaveAttribute('readonly');
  await expect(profile.getByLabel('Phone number')).toHaveAttribute('readonly');
  await expect(profile.getByLabel('About')).toHaveAttribute('readonly');
  await expect(profile.getByLabel('Time zone')).toBeDisabled();
  await expect(
    profile.getByRole('button', { name: 'Save changes' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('restored Administrator session stays on neutral loading before Registry', async ({
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
  test.skip(
    member.workspaceRole !== 'ADMINISTRATOR',
    'Restored Registry acceptance requires an Administrator.',
  );

  await signIn(page);
  await expect(
    page.getByRole('navigation', { name: 'Primary navigation' }),
  ).toBeVisible();

  await page.addInitScript(() => {
    const observed = {
      loginForm: false,
      administratorInterstitial: false,
    };
    Object.assign(window, { __prometheusAuthFrames: observed });
    new MutationObserver(() => {
      observed.loginForm ||= Boolean(document.querySelector('.login-form'));
      observed.administratorInterstitial ||=
        document.body?.textContent?.includes('Checking administrator access') ??
        false;
    }).observe(document, { childList: true, subtree: true });
  });

  let markMemberRequestStarted: () => void = () => undefined;
  let releaseMemberRequest: () => void = () => undefined;
  const memberRequestStarted = new Promise<void>((resolve) => {
    markMemberRequestStarted = resolve;
  });
  const memberRequestReleased = new Promise<void>((resolve) => {
    releaseMemberRequest = resolve;
  });
  await page.route('**/api/me', async (route) => {
    markMemberRequestStarted();
    await memberRequestReleased;
    await route.continue();
  });

  const navigation = page.goto('/registry', { waitUntil: 'domcontentloaded' });
  await memberRequestStarted;
  await expect(page.getByText('Opening Prometheus…')).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sign in', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText('Checking administrator access...')).toHaveCount(
    0,
  );
  releaseMemberRequest();
  await navigation;
  await page.unroute('**/api/me');

  await expect(
    page.getByRole('heading', { name: 'Registry', exact: true }),
  ).toBeVisible();
  const observedFrames = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __prometheusAuthFrames?: {
            loginForm: boolean;
            administratorInterstitial: boolean;
          };
        }
      ).__prometheusAuthFrames,
  );
  expect(observedFrames).toEqual({
    loginForm: false,
    administratorInterstitial: false,
  });
});

test('non-admin Project Lead cannot see or open Registry', async ({ page }) => {
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

  let projectId: string | undefined;
  try {
    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: 'MEMBER', status: 'ACTIVE', deactivatedAt: null },
    });
    const project = await prisma.project.create({
      data: {
        name: `F2-21 Registry isolation ${Date.now()}`,
        description: 'Playwright fixture for Project Lead Registry isolation.',
        createdByMemberId: member.id,
        leadMemberId: member.id,
        departments: { create: { departmentId: member.departmentId } },
      },
    });
    projectId = project.id;

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

    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: 'ADMINISTRATOR' },
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Registry', exact: true }),
    ).toBeVisible();
  } finally {
    if (projectId) {
      await prisma.project.delete({ where: { id: projectId } });
    }
    await prisma.member.update({
      where: { id: member.id },
      data: {
        workspaceRole: member.workspaceRole,
        status: member.status,
        deactivatedAt: member.deactivatedAt,
      },
    });
  }
});

test('confirmed first sign-in links the existing invited Member without duplication', async ({
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
  if (!member?.authUserId) {
    throw new Error('E2E member must begin linked to a Supabase identity.');
  }

  try {
    await prisma.member.update({
      where: { id: member.id },
      data: {
        authUserId: null,
        status: 'INVITED',
        workspaceRole: 'MEMBER',
        deactivatedAt: null,
      },
    });

    await page.goto(`/account-setup?email=${encodeURIComponent(email!)}`);
    await page.getByRole('link', { name: 'Sign in' }).click();
    await page.getByLabel('Company email').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect(
      page.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeVisible();

    const linked = await prisma.member.findUnique({
      where: { id: member.id },
    });
    expect(linked).toMatchObject({
      id: member.id,
      authUserId: member.authUserId,
      status: 'ACTIVE',
      workspaceRole: 'MEMBER',
    });
    expect(
      await prisma.member.count({
        where: { email: { equals: email!, mode: 'insensitive' } },
      }),
    ).toBe(1);

    await page.reload();
    await expect(
      page.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Registry' })).toHaveCount(0);
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
      data: {
        authUserId: member.authUserId,
        status: member.status,
        workspaceRole: member.workspaceRole,
        deactivatedAt: member.deactivatedAt,
      },
    });
  }
});

test('administrator role downgrade takes effect after refresh and at the API', async ({
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
  test.skip(
    member.workspaceRole !== 'ADMINISTRATOR',
    'Role downgrade acceptance starts with an Administrator.',
  );

  try {
    await signIn(page);
    await page.goto('/registry');
    await expect(
      page.getByRole('heading', { name: 'Registry', exact: true }),
    ).toBeVisible();

    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: 'MEMBER' },
    });
    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: 'Registry is for administrators',
        exact: true,
      }),
    ).toBeVisible();

    const status = await page.evaluate(async () => {
      const storageKey = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
      );
      const session = storageKey
        ? (JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
            access_token?: string;
          })
        : {};
      return fetch('/api/registry/members', {
        headers: session.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      }).then((response) => response.status);
    });
    expect(status).toBe(403);
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
    await signIn(page);
    await expect(page).not.toHaveURL(/\/login$/);
    await prisma.member.update({
      where: { id: member.id },
      data: { status: 'DEACTIVATED', deactivatedAt: new Date() },
    });
    await page.reload();
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(
      page.getByRole('heading', {
        name: 'This account can’t enter Prometheus',
        exact: true,
      }),
    ).toBeVisible();

    await prisma.member.update({
      where: { id: member.id },
      data: { status: 'ACTIVE', deactivatedAt: null },
    });
    await page.reload();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeVisible();
  } finally {
    await prisma.member.update({
      where: { id: member.id },
      data: { status: member.status, deactivatedAt: member.deactivatedAt },
    });
  }
});
