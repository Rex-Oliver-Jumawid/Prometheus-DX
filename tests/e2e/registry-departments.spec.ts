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
  await prisma.ventureAuditEvent.deleteMany({ where: { venture: { name: { in: [...createdNames] } } } });
  await prisma.venture.deleteMany({
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

test('administrator creates and edits a venture with persistence', async ({
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
    'Registry venture acceptance requires an Administrator E2E member.',
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

  const addVentureButton = page
    .getByRole('button', { name: /Add venture/ })
    .first();
  await addVentureButton.click();
  await expect(
    page.getByRole('dialog', { name: 'Add venture' }),
  ).toBeVisible();
  await expect(page.getByLabel('Venture name')).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Add venture' }),
  ).toHaveCount(0);
  await expect(addVentureButton).toBeFocused();

  await addVentureButton.click();
  await page
    .locator('.registry-dialog-backdrop')
    .click({ position: { x: 4, y: 4 } });
  await expect(
    page.getByRole('dialog', { name: 'Add venture' }),
  ).toHaveCount(0);
  await expect(addVentureButton).toBeFocused();

  await addVentureButton.click();

  await page
    .getByRole('button', { name: 'Create venture', exact: true })
    .click();
  await expect(page.getByText('Enter a venture name.')).toBeVisible();

  await page.getByLabel('Venture name').fill(originalName);
  await page.getByLabel('Short label').fill(originalShortLabel);
  await page.getByLabel('Description').fill(originalDescription);
  await page
    .getByRole('button', { name: 'Create venture', exact: true })
    .click();

  const createdVenture = page.getByRole('button', {
    name: `View ${originalName} members`,
  });
  await expect(createdVenture).toBeVisible();
  await expect(
    createdVenture.getByText('0 members', { exact: true }),
  ).toBeVisible();
  await expect(
    createdVenture.getByText('0 projects', { exact: true }),
  ).toBeVisible();
  await expect(
    createdVenture.getByText('0 outcomes', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(originalShortLabel, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(originalName, { exact: true })).toHaveCount(0);
  await expect(
    page.getByText(originalDescription, { exact: true }),
  ).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole('button', { name: `View ${originalName} members` }),
  ).toBeVisible();

  await page
    .getByRole('button', { name: `View ${originalName} members` })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Edit venture' }),
  ).toBeVisible();
  await page.getByLabel('Venture name').fill(updatedName);
  await page.getByLabel('Short label').fill(updatedShortLabel);
  await page.getByLabel('Description').fill(updatedDescription);
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();

  await expect(
    page.getByRole('button', { name: `View ${updatedName} members` }),
  ).toBeVisible();
  await expect(
    page.getByText(updatedShortLabel, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(updatedName, { exact: true })).toHaveCount(0);
  await expect(page.getByText(updatedDescription, { exact: true })).toHaveCount(
    0,
  );

  await page.reload();
  await expect(
    page.getByRole('button', { name: `View ${updatedName} members` }),
  ).toBeVisible();
  await expect(
    page.getByText(updatedShortLabel, { exact: true }),
  ).toBeVisible();

  await page.getByRole('button', { name: `Remove ${updatedName}` }).click();
  const removeDialog = page.getByRole('dialog', { name: 'Archive venture' });
  await expect(removeDialog).toBeVisible();
  await expect(
    removeDialog.locator('.registry-reference-summary > span').nth(0),
  ).toHaveText(/^0\s*members$/);
  await expect(
    removeDialog.locator('.registry-reference-summary > span').nth(1),
  ).toHaveText(/^0\s*projects$/);
  await expect(
    removeDialog.locator('.registry-reference-summary > span').nth(2),
  ).toHaveText(/^0\s*outcomes$/);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('button', { name: `View ${updatedName} members` }),
  ).toBeVisible();

  await page.getByRole('button', { name: `Remove ${updatedName}` }).click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/registry/ventures/') &&
      response.request().method() === 'DELETE',
  );
  await page
    .getByRole('button', { name: 'Archive venture', exact: true })
    .click();
  expect((await deleteResponse).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: `View ${updatedName} members` }),
  ).toHaveCount(0);
  await expect(
    prisma.venture.count({ where: { name: updatedName, status: 'ARCHIVED' } }),
  ).resolves.toBe(1);
});
