import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const runId = `phase3-slice3-${Date.now()}`;
let fixtureDepartmentIds: string[] = [];
let fixtureLeadId: string | undefined;
let createdProjectId: string | undefined;
let unrelatedProjectId: string | undefined;
let leadProjectId: string | undefined;
let currentMemberId: string | undefined;

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
  currentMemberId = currentMember.id;
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
  const unrelatedProject = await prisma.project.create({
    data: {
      name: `Browser Project ${runId} Unrelated`,
      description: 'A real Project visible to an active Member without authority.',
      createdByMemberId: lead.id,
      leadMemberId: lead.id,
      departments: { create: { departmentId: firstDepartment.id } },
    },
  });
  unrelatedProjectId = unrelatedProject.id;
  const leadProject = await prisma.project.create({
    data: {
      name: `Browser Project ${runId} Lead Status`,
      description: 'A real Project for exercising Project Lead status controls.',
      createdByMemberId: lead.id,
      leadMemberId: currentMember.id,
      departments: { create: { departmentId: secondDepartment.id } },
    },
  });
  leadProjectId = leadProject.id;
});

test.afterAll(async () => {
  const projectIds = [createdProjectId, unrelatedProjectId, leadProjectId].filter(
    (id): id is string => Boolean(id),
  );
  if (projectIds.length) await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: `Browser Project ${runId}` } } });
  if (fixtureLeadId) await prisma.member.delete({ where: { id: fixtureLeadId } });
  if (fixtureDepartmentIds.length) await prisma.department.deleteMany({ where: { id: { in: fixtureDepartmentIds } } });
  await prisma.$disconnect();
});

async function apiStatusUpdate(page: Page, projectId: string, status: string) {
  return page.evaluate(async ({ id, nextStatus }) => {
    const storageKey = Object.keys(localStorage).find(
      (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
    );
    const session = storageKey
      ? (JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { access_token?: string })
      : {};
    const response = await fetch(`/api/projects/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(session.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ status: nextStatus }),
    });
    return response.status;
  }, { id: projectId, nextStatus: status });
}

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
  await page.getByRole('button', { name: 'Create Project', exact: true }).click();
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
  const project = await prisma.project.findFirstOrThrow({ where: { name }, include: { departments: true } });
  createdProjectId = project.id;
  expect(await prisma.project.count({ where: { name } })).toBe(1);
  expect(project.createdByMemberId).toBe(creator.id);
  expect(project.leadMemberId).toBe(fixtureLeadId);
  expect(project.departments.map((item) => item.departmentId).sort()).toEqual([...fixtureDepartmentIds].sort());
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  expect(errors).toEqual([]);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('an unrelated active Member can open a Project but cannot change its status', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto(`/projects/${unrelatedProjectId}`);
  await expect(page.getByRole('heading', { name: `Browser Project ${runId} Unrelated`, exact: true })).toBeVisible();
  const ownershipCard = page
    .locator('.project-overview-card')
    .filter({ has: page.getByRole('heading', { name: 'Project ownership' }) });
  await expect(
    ownershipCard.locator('dt + dd').first(),
  ).toContainText('Phase Three Alternate Lead');
  await expect(page.getByLabel('Project status')).toHaveCount(0);
  expect(await apiStatusUpdate(page, unrelatedProjectId!, 'IN_PROGRESS')).toBe(403);
});

test('a creator and Administrator without the Lead relationship receive no status authority', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const member = await prisma.member.findUniqueOrThrow({ where: { id: currentMemberId! } });
  try {
    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: 'ADMINISTRATOR' },
    });
    await signIn(page);
    await page.goto(`/projects/${createdProjectId}`);
    await expect(page.getByRole('heading', { name: `Browser Project ${runId}`, exact: true })).toBeVisible();
    await expect(page.getByLabel('Project status')).toHaveCount(0);
    expect(await apiStatusUpdate(page, createdProjectId!, 'DONE')).toBe(403);
  } finally {
    await prisma.member.update({
      where: { id: member.id },
      data: { workspaceRole: member.workspaceRole },
    });
  }
});

test('the Project Lead changes status through the direct Project route and it persists', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto(`/projects/${leadProjectId}`);
  await expect(page.getByRole('heading', { name: `Browser Project ${runId} Lead Status`, exact: true })).toBeVisible();
  const statusControl = page.getByLabel('Project status');
  await expect(statusControl).toHaveValue('PLANNING');
  await expect(statusControl.locator('option[value="ARCHIVED"]')).toHaveCount(0);
  await statusControl.selectOption('IN_PROGRESS');
  await expect(statusControl).toHaveValue('IN_PROGRESS');
  await statusControl.selectOption('DONE');
  await expect(statusControl).toHaveValue('DONE');
  await page.reload();
  await expect(page.getByLabel('Project status')).toHaveValue('DONE');
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: leadProjectId! },
    include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
  });
  expect(project.status).toBe('DONE');
  expect(project.doneAt).not.toBeNull();
  expect(project.statusHistory.map((item) => ({ from: item.fromStatus, to: item.toStatus, source: item.changeSource, by: item.changedByMemberId }))).toEqual([
    { from: 'PLANNING', to: 'IN_PROGRESS', source: 'USER', by: currentMemberId },
    { from: 'IN_PROGRESS', to: 'DONE', source: 'USER', by: currentMemberId },
  ]);
});

test('a nonexistent or invalid Project route shows a controlled not-found state', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto('/projects/11111111-1111-4111-8111-111111111111');
  await expect(page.getByText('Project not found', { exact: true })).toBeVisible();
  await page.goto('/projects/not-a-project-id');
  await expect(page.getByText('Project not found', { exact: true })).toBeVisible();
});
