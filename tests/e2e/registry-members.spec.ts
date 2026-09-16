import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasRegistryCredentials = Boolean(
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.E2E_MEMBER_EMAIL &&
  process.env.E2E_MEMBER_PASSWORD,
);

test.describe.configure({ mode: 'serial' });

const createdMemberEmails = new Set<string>();
const createdDepartmentIds = new Set<string>();

test.afterEach(async () => {
  if (!hasRegistryCredentials) return;
  if (createdMemberEmails.size > 0) {
    await prisma.member.deleteMany({
      where: { email: { in: [...createdMemberEmails] } },
    });
    createdMemberEmails.clear();
  }
  if (createdDepartmentIds.size > 0) {
    await prisma.department.deleteMany({
      where: { id: { in: [...createdDepartmentIds] } },
    });
    createdDepartmentIds.clear();
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function signIn(page: Page) {
  await page.goto('/login');
  await page
    .getByLabel('Company email')
    .fill(process.env.E2E_MEMBER_EMAIL ?? '');
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD ?? '');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/);
}

test('administrator adds and edits a member with duplicate-email protection', async ({
  page,
}) => {
  test.setTimeout(60_000);
  test.skip(
    !hasRegistryCredentials,
    'Requires Supabase browser auth config and E2E member credentials.',
  );

  const administrator = await prisma.member.findFirst({
    where: {
      email: {
        equals: process.env.E2E_MEMBER_EMAIL!,
        mode: 'insensitive',
      },
    },
  });
  if (!administrator) throw new Error('E2E member record was not found.');
  test.skip(
    administrator.workspaceRole !== 'ADMINISTRATOR',
    'Registry member acceptance requires an Administrator E2E member.',
  );

  const suffix = Date.now().toString(36);
  const department = await prisma.department.create({
    data: {
      name: `Member E2E ${suffix}`,
      shortLabel: `M${suffix.slice(-5)}`,
      description: 'Registry member acceptance fixture.',
    },
  });
  createdDepartmentIds.add(department.id);
  const reassignedDepartment = await prisma.department.create({
    data: {
      name: `Reassigned E2E ${suffix}`,
      shortLabel: `R${suffix.slice(-5)}`,
      description: 'Registry reassignment acceptance fixture.',
    },
  });
  createdDepartmentIds.add(reassignedDepartment.id);

  const email = `registry-${suffix}@example.com`;
  const updatedFullName =
    'Registry Member Updated With An Exceptionally Long Display Name';
  const updatedPosition =
    'Senior Product Specialist For Cross-Functional Organization Programs';
  createdMemberEmails.add(email);
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await signIn(page);
  await page.goto('/registry');
  const addMemberButton = page.getByRole('button', { name: /Add member/ });
  await addMemberButton.click();
  await expect(page.getByRole('dialog', { name: 'Add member' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Add member' })).toHaveCount(0);
  await expect(addMemberButton).toBeFocused();

  await addMemberButton.click();
  await page
    .locator('.registry-dialog-backdrop')
    .click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog', { name: 'Add member' })).toHaveCount(0);
  await expect(addMemberButton).toBeFocused();

  await addMemberButton.click();

  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();

  await page.getByLabel('Full name').fill('Registry Test Member');
  await page.getByLabel('Email address').fill(email);
  await page
    .getByRole('dialog', { name: 'Add member' })
    .locator('select[name="departmentId"]')
    .selectOption(department.id);
  await page.getByLabel('Position').fill('Product Specialist');
  await page.getByLabel('Workspace role').selectOption('MEMBER');
  await expect(page.getByLabel('Member status')).toBeDisabled();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();

  await expect(
    page.getByRole('button', { name: 'Edit Registry Test Member' }),
  ).toBeVisible();
  await expect(page.getByText('Setup pending').first()).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Send invitation|Resend invitation/ }),
  ).toBeVisible();
  await expect(
    page.locator('.registry-department-card').filter({
      hasText: department.name,
    }),
  ).toContainText('1 member');

  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Edit Registry Test Member' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Add member/ }).click();
  await page.getByLabel('Full name').fill('Duplicate Member');
  await page.getByLabel('Email address').fill(email.toUpperCase());
  await page
    .getByRole('dialog', { name: 'Add member' })
    .locator('select[name="departmentId"]')
    .selectOption(department.id);
  await page.getByLabel('Position').fill('Duplicate');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(
    page.getByText('That email already belongs to a Prometheus member.'),
  ).toBeVisible();
  browserErrors.length = 0;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await page.getByRole('button', { name: 'Edit Registry Test Member' }).click();
  await page.getByLabel('Full name').fill(updatedFullName);
  await page.getByLabel('Position').fill(updatedPosition);
  await page
    .getByRole('dialog', { name: 'Edit member' })
    .locator('select[name="departmentId"]')
    .selectOption(reassignedDepartment.id);
  await page.getByLabel('Workspace role').selectOption('ADMINISTRATOR');
  await page.getByLabel('Member status').selectOption('DEACTIVATED');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Edit member' }),
  ).not.toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: `Edit ${updatedFullName}` }),
  ).toBeVisible();
  await expect(page.getByText(updatedPosition)).toBeVisible();
  await expect(page.getByText('Administrator').last()).toBeVisible();
  await expect(
    page.locator('.registry-department-card').filter({
      hasText: department.name,
    }),
  ).toContainText('0 members');
  await expect(
    page.locator('.registry-department-card').filter({
      hasText: reassignedDepartment.name,
    }),
  ).toContainText('1 member');

  const persisted = await prisma.member.findFirst({
    where: { email },
  });
  expect(persisted).toMatchObject({
    fullName: updatedFullName,
    departmentId: reassignedDepartment.id,
    position: updatedPosition,
    workspaceRole: 'ADMINISTRATOR',
    status: 'DEACTIVATED',
    authUserId: null,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Registry', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
  expect(browserErrors).toEqual([]);
});
