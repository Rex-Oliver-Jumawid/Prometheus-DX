import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasRegistryCredentials = Boolean(
  process.env.VITE_SUPABASE_URL &&
  process.env.VITE_SUPABASE_ANON_KEY &&
  process.env.E2E_MEMBER_EMAIL &&
  process.env.E2E_MEMBER_PASSWORD,
);

const createdNames = new Set<string>();

test.describe.configure({ mode: 'serial' });

test.afterEach(async () => {
  if (!hasRegistryCredentials || createdNames.size === 0) return;
  await prisma.department.deleteMany({
    where: { name: { in: [...createdNames] } },
  });
  createdNames.clear();
});

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
  await expect(page).not.toHaveURL(/\/login$/);
}

test('administrator creates and edits a department with persistence', async ({
  page,
}) => {
  test.skip(
    !hasRegistryCredentials,
    'Requires Supabase browser auth config and E2E member credentials.',
  );

  const email = process.env.E2E_MEMBER_EMAIL!;
  const member = await prisma.member.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!member) throw new Error('E2E member record was not found.');
  test.skip(
    member.workspaceRole !== 'ADMINISTRATOR',
    'Registry department acceptance requires an Administrator E2E member.',
  );

  const suffix = Date.now().toString(36);
  const originalName = `E2E Registry ${suffix}`;
  const updatedName = `E2E Platform ${suffix}`;
  const originalDescription = 'Created through the Registry browser flow.';
  const updatedDescription = 'Edited through the Registry browser flow.';
  const originalShortLabel = `E${suffix.slice(-5)}`.slice(0, 12);
  const updatedShortLabel = `P${suffix.slice(-5)}`.slice(0, 12);
  createdNames.add(originalName);
  createdNames.add(updatedName);

  await signIn(page);
  await page.goto('/registry');
  await expect(
    page.getByRole('heading', { name: 'Registry', exact: true }),
  ).toBeVisible();

  const addDepartmentButton = page
    .getByRole('button', { name: /Add department/ })
    .first();
  await addDepartmentButton.click();
  await expect(
    page.getByRole('dialog', { name: 'Add department' }),
  ).toBeVisible();
  await expect(page.getByLabel('Department name')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Add department' }),
  ).toHaveCount(0);
  await expect(addDepartmentButton).toBeFocused();

  await addDepartmentButton.click();
  await page
    .locator('.registry-dialog-backdrop')
    .click({ position: { x: 4, y: 4 } });
  await expect(
    page.getByRole('dialog', { name: 'Add department' }),
  ).toHaveCount(0);
  await expect(addDepartmentButton).toBeFocused();

  await addDepartmentButton.click();

  await page
    .getByRole('button', { name: 'Create department', exact: true })
    .click();
  await expect(page.getByText('Enter a department name.')).toBeVisible();

  await page.getByLabel('Department name').fill(originalName);
  await page.getByLabel('Short label').fill(originalShortLabel);
  await page.getByLabel('Description').fill(originalDescription);
  await page
    .getByRole('button', { name: 'Create department', exact: true })
    .click();

  await expect(
    page.getByRole('button', { name: `Edit ${originalName}` }),
  ).toBeVisible();
  await expect(page.getByText(originalDescription)).toBeVisible();
  await expect(page.getByText(originalShortLabel)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: `Edit ${originalName}` }),
  ).toBeVisible();

  await page.getByRole('button', { name: `Edit ${originalName}` }).click();
  await expect(
    page.getByRole('dialog', { name: 'Edit department' }),
  ).toBeVisible();
  await page.getByLabel('Department name').fill(updatedName);
  await page.getByLabel('Short label').fill(updatedShortLabel);
  await page.getByLabel('Description').fill(updatedDescription);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(
    page.getByRole('button', { name: `Edit ${updatedName}` }),
  ).toBeVisible();
  await expect(page.getByText(updatedDescription)).toBeVisible();
  await expect(page.getByText(updatedShortLabel)).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole('button', { name: `Edit ${updatedName}` }),
  ).toBeVisible();
  await expect(page.getByText(updatedDescription)).toBeVisible();
});
