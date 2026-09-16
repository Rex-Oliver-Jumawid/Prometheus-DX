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
  const existingSuggestionEmail = `existing-${suffix}@example.com`;
  const existingSuggestionName = `Existing Registry Member ${suffix}`;
  const updatedFullName =
    'Registry Member Updated With An Exceptionally Long Display Name';
  const updatedPosition =
    'Senior Product Specialist For Cross-Functional Organization Programs';
  createdMemberEmails.add(email);
  createdMemberEmails.add(existingSuggestionEmail);
  await prisma.member.create({
    data: {
      email: existingSuggestionEmail,
      fullName: existingSuggestionName,
      departmentId: department.id,
      position: 'Existing Member Fixture',
      workspaceRole: 'MEMBER',
      status: 'INVITED',
    },
  });
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await signIn(page);
  await page.goto('/registry');
  const addMemberButton = page.getByRole('button', { name: /Add member/ });
  await expect(
    page.getByRole('button', { name: `Edit ${existingSuggestionName}` }),
  ).toBeVisible();
  await addMemberButton.click();
  await expect(page.getByRole('dialog', { name: 'Add member' })).toBeVisible();
  const fullNameInput = page.getByLabel('Full name');
  await expect(fullNameInput).toBeFocused();
  const existingMembersList = page.getByRole('listbox', {
    name: 'Existing members',
  });
  await fullNameInput.focus();
  await expect(existingMembersList).toBeVisible();
  await fullNameInput.fill(existingSuggestionName);
  await expect(
    existingMembersList.getByRole('option').filter({
      hasText: existingSuggestionName,
    }),
  ).toHaveCount(1);
  await expect(
    existingMembersList.getByRole('option').filter({
      hasText: existingSuggestionName,
    }),
  ).toContainText('Already in Registry');
  await expect(existingMembersList).toContainText(existingSuggestionEmail);
  await fullNameInput.fill(existingSuggestionEmail);
  await expect(existingMembersList.getByRole('option')).toHaveCount(1);
  await expect(existingMembersList).toContainText(existingSuggestionName);

  await fullNameInput.fill('');
  const initiallyActiveSuggestion = await existingMembersList
    .locator('[role="option"][aria-selected="true"]')
    .textContent();
  await fullNameInput.press('ArrowDown');
  const nextActiveSuggestion = await existingMembersList
    .locator('[role="option"][aria-selected="true"]')
    .textContent();
  expect(nextActiveSuggestion).not.toBe(initiallyActiveSuggestion);
  await fullNameInput.press('ArrowUp');
  await expect(
    existingMembersList.locator('[role="option"][aria-selected="true"]'),
  ).toContainText(initiallyActiveSuggestion ?? '');
  await fullNameInput.press('Escape');
  await expect(existingMembersList).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Add member' })).toBeVisible();

  await fullNameInput.fill(existingSuggestionEmail);
  await fullNameInput.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Edit member' })).toBeVisible();
  await expect(page.getByLabel('Full name')).toHaveValue(
    existingSuggestionName,
  );
  await expect(
    prisma.member.count({ where: { email: existingSuggestionEmail } }),
  ).resolves.toBe(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();

  await addMemberButton.click();
  const desktopOverlay = await page.evaluate(() => {
    const backdrop = document.querySelector('.registry-dialog-backdrop');
    const dialog = document.querySelector('.registry-member-dialog');
    if (!(backdrop instanceof HTMLElement) || !(dialog instanceof HTMLElement))
      return null;
    const backdropRect = backdrop.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    return {
      backdropParent: backdrop.parentElement?.tagName,
      backdropPosition: getComputedStyle(backdrop).position,
      backdropRect: {
        top: backdropRect.top,
        right: backdropRect.right,
        bottom: backdropRect.bottom,
        left: backdropRect.left,
      },
      dialogRect: {
        top: dialogRect.top,
        right: dialogRect.right,
        bottom: dialogRect.bottom,
        left: dialogRect.left,
      },
      bodyOverflow: document.body.style.overflow,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  expect(desktopOverlay).not.toBeNull();
  expect(desktopOverlay).toMatchObject({
    backdropParent: 'BODY',
    backdropPosition: 'fixed',
    backdropRect: {
      top: 0,
      right: desktopOverlay?.viewport.width,
      bottom: desktopOverlay?.viewport.height,
      left: 0,
    },
    bodyOverflow: 'hidden',
  });
  expect(desktopOverlay!.dialogRect.left).toBeGreaterThan(0);
  expect(desktopOverlay!.dialogRect.top).toBeGreaterThan(0);
  expect(desktopOverlay!.dialogRect.right).toBeLessThan(
    desktopOverlay!.viewport.width,
  );
  expect(desktopOverlay!.dialogRect.bottom).toBeLessThan(
    desktopOverlay!.viewport.height,
  );

  await page.keyboard.press('Escape');
  await expect(existingMembersList).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Add member' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Add member' })).toHaveCount(0);
  await expect(addMemberButton).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');

  await addMemberButton.click();
  await page
    .locator('.registry-dialog-backdrop')
    .click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole('dialog', { name: 'Add member' })).toHaveCount(0);
  await expect(addMemberButton).toBeFocused();

  await addMemberButton.click();

  await page.getByLabel('Full name').fill('No Existing Registry Match');
  await expect(
    page.getByText(
      'No existing member found. Continue entering the new member.',
    ),
  ).toBeVisible();
  await page.getByLabel('Email address').fill('not-an-email');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();

  await page.getByLabel('Full name').fill('Registry Test Member');
  await page.getByLabel('Email address').fill(email);
  const departmentSearch = page
    .getByRole('dialog', { name: 'Add member' })
    .getByLabel('Department');
  await departmentSearch.fill('Not a persisted department');
  await page.getByLabel('Position').fill('Product Specialist');
  await page.getByLabel('Workspace role').selectOption('MEMBER');
  await expect(page.getByLabel('Member status')).toBeDisabled();
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByText('Choose a department.')).toBeVisible();
  await departmentSearch.fill(department.name.slice(0, 8));
  await expect(
    page.locator('#registry-department-options option').filter({
      hasText: department.shortLabel,
    }),
  ).toHaveCount(1);
  await departmentSearch.fill(department.name);
  const createMemberResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/registry/members') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  expect((await createMemberResponse).status()).toBe(201);

  await expect(
    page.getByRole('button', { name: 'Edit Registry Test Member' }),
  ).toBeVisible();
  await expect(page.getByText('Setup pending').first()).toBeVisible();
  await expect(
    page
      .locator('.registry-members-table tbody tr')
      .filter({ hasText: 'Registry Test Member' })
      .getByRole('button', { name: /Send invitation|Resend invitation/ }),
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
    .getByLabel('Department')
    .fill(department.name);
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
    .getByLabel('Department')
    .fill(reassignedDepartment.name);
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
  await page.getByRole('button', { name: /Add member/ }).click();
  const narrowDialog = await page
    .getByRole('dialog', { name: 'Add member' })
    .boundingBox();
  expect(narrowDialog).not.toBeNull();
  expect(narrowDialog!.x).toBeGreaterThanOrEqual(12);
  expect(narrowDialog!.x + narrowDialog!.width).toBeLessThanOrEqual(378);
  expect(narrowDialog!.y).toBeGreaterThanOrEqual(12);
  expect(narrowDialog!.y + narrowDialog!.height).toBeLessThanOrEqual(832);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  expect(browserErrors).toEqual([]);
});
