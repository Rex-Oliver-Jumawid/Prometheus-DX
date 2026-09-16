import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const runId = `phase3-slice2-${Date.now()}`;
let fixtureDepartmentIds: string[] = [];
let fixtureLeadId: string | undefined;
let createdProjectId: string | undefined;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const currentMember = await prisma.member.findFirst({
    where: { email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' } },
  });
  if (!currentMember) throw new Error('E2E member record was not found.');
  const [firstDepartment, secondDepartment] = await Promise.all([
    prisma.department.create({ data: { name: `${runId} Design`, shortLabel: 'P3DES' } }),
    prisma.department.create({ data: { name: `${runId} Delivery`, shortLabel: 'P3DEL' } }),
  ]);
  fixtureDepartmentIds = [firstDepartment.id, secondDepartment.id];
  const lead = await prisma.member.create({
    data: {
      email: `${runId}@example.com`,
      fullName: 'Phase Three Alternate Lead',
      departmentId: firstDepartment.id,
      status: 'ACTIVE',
      workspaceRole: 'MEMBER',
    },
  });
  fixtureLeadId = lead.id;
});

test.afterAll(async () => {
  if (createdProjectId) await prisma.project.delete({ where: { id: createdProjectId } });
  await prisma.project.deleteMany({ where: { name: { startsWith: `Browser Project ${runId}` } } });
  if (fixtureLeadId) await prisma.member.delete({ where: { id: fixtureLeadId } });
  if (fixtureDepartmentIds.length) await prisma.department.deleteMany({ where: { id: { in: fixtureDepartmentIds } } });
  await prisma.$disconnect();
});

test('an active Member creates a Project with another active Lead and multiple Departments', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  const creator = await prisma.member.findFirstOrThrow({ where: { email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' } } });
  const name = `Browser Project ${runId}`;

  await signIn(page);
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '+ Add Project', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Add Project' })).toBeVisible();
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
  await expect(page.getByText('Enter a project name.')).toBeVisible();
  await expect(page.getByText('Enter a project description.')).toBeVisible();
  await expect(page.getByText('Choose an active Project Lead.')).toBeVisible();
  await expect(page.getByText('Choose at least one department.')).toBeVisible();

  await page.getByLabel('Project name').fill(name);
  await page.getByLabel('Description').fill('Created through the focused Phase 3 browser acceptance path.');
  await page.getByLabel('Project Lead').selectOption(creator.id);
  await page.getByLabel('Project Lead').selectOption(fixtureLeadId!);
  for (const departmentId of fixtureDepartmentIds) await page.locator(`input[value="${departmentId}"]`).check();
  const requestPromise = page.waitForRequest((request) => request.url().endsWith('/api/projects') && request.method() === 'POST');
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/projects') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create Project', exact: true }).dblclick();
  const request = await requestPromise;
  expect((await responsePromise).status()).toBe(201);
  expect(request.postDataJSON()).toMatchObject({
    name,
    description: 'Created through the focused Phase 3 browser acceptance path.',
    leadMemberId: fixtureLeadId,
  });
  expect((request.postDataJSON() as { departmentIds: string[] }).departmentIds.sort()).toEqual(
    [...fixtureDepartmentIds].sort(),
  );
  await expect(page.getByRole('dialog', { name: 'Add Project' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const project = await prisma.project.findFirstOrThrow({ where: { name }, include: { departments: true } });
  createdProjectId = project.id;
  expect(await prisma.project.count({ where: { name } })).toBe(1);
  expect(project.createdByMemberId).toBe(creator.id);
  expect(project.leadMemberId).toBe(fixtureLeadId);
  expect(project.departments.map((item) => item.departmentId).sort()).toEqual([...fixtureDepartmentIds].sort());
  expect(errors).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
