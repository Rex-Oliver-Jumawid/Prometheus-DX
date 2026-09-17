import { PrismaClient } from '@prisma/client';
import { test, expect, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const runId = `phase5-work-${Date.now()}`;
let projectId = '';
let outcomeId = '';
let prerequisiteId = '';
let leadId = '';
let memberId = '';
let departmentId = '';
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

async function openWork(page: Page, reload = false) {
  const loaded = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/outcomes/${outcomeId}/work`) &&
      response.request().method() === 'GET',
  );
  if (reload) await page.reload();
  else await page.goto(`/projects/${projectId}/outcomes/${outcomeId}`);
  expect((await loaded).status()).toBe(200);
}

async function request(
  page: Page,
  suffix: string,
  method: string,
  body?: unknown,
) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const key = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
      )!;
      const token = JSON.parse(localStorage.getItem(key)!)
        .access_token as string;
      const response = await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        body: (await response.json()) as unknown,
      };
    },
    {
      path: `/api/projects/${projectId}/outcomes/${outcomeId}${suffix}`,
      method,
      body,
    },
  );
}

// This suite uses the hosted acceptance database and real Supabase sign-in.
// Its multi-request user journeys need headroom for a cold pooled connection.
test.describe.configure({ mode: 'serial', timeout: 60_000 });
test.beforeAll(async () => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const member = await prisma.member.findFirstOrThrow({
    where: {
      email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' },
    },
  });
  memberId = member.id;
  departmentId = member.departmentId;
  const lead = await prisma.member.create({
    data: {
      fullName: 'Work Slice Lead',
      email: `${runId}@example.com`,
      departmentId,
      status: 'ACTIVE',
    },
  });
  leadId = lead.id;
  const project = await prisma.project.create({
    data: {
      name: runId,
      description: 'Phase 5 work fixture',
      createdByMemberId: leadId,
      leadMemberId: leadId,
      stages: {
        create: {
          name: 'Work Stage',
          position: 0,
          outcomes: {
            create: [
              {
                title: 'Shared Work Outcome',
                position: 0,
                createdByMemberId: leadId,
              },
              {
                title: 'Work Prerequisite',
                position: 1,
                createdByMemberId: leadId,
              },
            ],
          },
        },
      },
    },
    include: { stages: { include: { outcomes: true } } },
  });
  projectId = project.id;
  outcomeId = project.stages[0].outcomes.find(
    (item) => item.position === 0,
  )!.id;
  prerequisiteId = project.stages[0].outcomes.find(
    (item) => item.position === 1,
  )!.id;
});

test.afterAll(async () => {
  if (projectId) {
    await prisma.outcomeDependency.deleteMany({
      where: { outcome: { stage: { projectId } } },
    });
    await prisma.project.delete({ where: { id: projectId } });
  }
  if (leadId) await prisma.member.delete({ where: { id: leadId } });
  await prisma.$disconnect();
});

test('F5-02: viewer cannot create Feature work', async ({
  page,
}) => {
  await signIn(page);
  await openWork(page);
  await expect(
    page.getByText('No features yet', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add Feature' })).toHaveCount(
    0,
  );
  expect(
    (await request(page, '/work/features', 'POST', { title: 'Forbidden' }))
      .status,
  ).toBe(403);
});

test('F5-02: CAN_EDIT without Outcome Membership cannot create Feature work', async ({
  page,
}) => {
  await prisma.projectMember.create({
    data: { projectId, memberId, accessLevel: 'CAN_EDIT' },
  });
  await signIn(page);
  await openWork(page);
  expect(
    (await request(page, '/work/features', 'POST', { title: 'Forbidden' }))
      .status,
  ).toBe(403);
});

test('F5-02: non-member Project Lead cannot create Feature work', async ({
  page,
}) => {
  await prisma.project.update({
    where: { id: projectId },
    data: { leadMemberId: memberId },
  });
  await signIn(page);
  await openWork(page);
  expect(
    (await request(page, '/work/features', 'POST', { title: 'Forbidden' }))
      .status,
  ).toBe(403);
  await prisma.project.update({
    where: { id: projectId },
    data: { leadMemberId: leadId },
  });
});

test('F5-01 F5-08: joined member creates a persisted Feature', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await prisma.$transaction([
    prisma.outcomeMember.upsert({
      where: { outcomeId_memberId: { outcomeId, memberId } },
      update: {},
      create: { outcomeId, memberId },
    }),
    prisma.projectMember.upsert({
      where: { projectId_memberId: { projectId, memberId } },
      update: {},
      create: { projectId, memberId, accessLevel: 'CAN_VIEW' },
    }),
  ]);
  await signIn(page);
  await openWork(page);
  await expect(page.getByText('✓ Joined Outcome')).toBeVisible();
  await page.getByRole('button', { name: '+ Add Feature' }).click();
  await page.getByRole('button', { name: 'Add feature', exact: true }).click();
  await expect(page.getByText('Enter a title.')).toBeVisible();
  await page
    .getByLabel('Feature title', { exact: true })
    .fill('Authentication');
  await page
    .getByLabel('Feature description', { exact: false })
    .fill('Implement the agreed authentication work.');
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/work/features') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add feature', exact: true }).click();
  expect((await created).status()).toBe(201);
  await expect(
    page.getByRole('heading', { name: 'Authentication', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('F5-03 F5-08: joined member creates a persisted Task', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await openWork(page);
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await expect(page.getByText('Enter a title.')).toBeVisible();
  await page.getByLabel('Task title', { exact: true }).fill('Implement login');
  const created = page.waitForResponse(
    (response) =>
      response.url().includes('/work/features/') &&
      response.url().endsWith('/tasks') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  expect((await created).status()).toBe(201);
  await expect(
    page.getByRole('checkbox', { name: 'Complete Implement login' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('F5-05: completing a Task persists and updates progress', async ({ page }) => {
  await signIn(page);
  await openWork(page);
  const completed = page.waitForResponse(
    (response) =>
      response.url().includes('/work/tasks/') &&
      response.url().endsWith('/state') &&
      response.request().method() === 'PATCH',
  );
  await page
    .getByRole('checkbox', { name: 'Complete Implement login' })
    .check();
  expect((await completed).status()).toBe(200);
  await expect(page.getByText('100% work progress')).toBeVisible();
  await expect
    .poll(async () =>
      prisma.task.findFirstOrThrow({
        where: { feature: { outcomeId }, title: 'Implement login' },
        select: { status: true },
      }),
    )
    .toEqual({ status: 'DONE' });
});

test('F5-06: reopening a completed Task persists and recalculates progress', async ({
  page,
}) => {
  await signIn(page);
  await openWork(page);
  await expect(
    page.getByRole('checkbox', { name: 'Complete Implement login' }),
  ).toBeChecked();
  const reopened = page.waitForResponse(
    (response) =>
      response.url().includes('/work/tasks/') &&
      response.url().endsWith('/state') &&
      response.request().method() === 'PATCH',
  );
  await page
    .getByRole('checkbox', { name: 'Complete Implement login' })
    .uncheck();
  expect((await reopened).status()).toBe(200);
  await expect(page.getByText('0% work progress')).toBeVisible();
  await expect
    .poll(async () =>
      prisma.task.findFirstOrThrow({
        where: { feature: { outcomeId }, title: 'Implement login' },
        select: { status: true },
      }),
    )
    .toEqual({ status: 'TODO' });
});

test('F5-04: edit Task persists', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await openWork(page);
  await page.getByRole('button', { name: 'Edit task Implement login' }).click();
  await page
    .getByLabel('Task title', { exact: true })
    .first()
    .fill('Implement secure login');
  const savedTask = page.waitForResponse(
    (response) =>
      response.url().includes('/work/tasks/') &&
      response.request().method() === 'PATCH',
  );
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  expect((await savedTask).status()).toBe(200);
  await expect(
    page.getByRole('checkbox', { name: 'Complete Implement secure login' }),
  ).toBeVisible();
  expect(
    (await request(page, '/work/features', 'POST', { title: ' ' })).status,
  ).toBe(400);
  expect(errors).toEqual([]);
});

test('Work area expands and remains responsive on mobile and desktop', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  await openWork(page);
  await page.getByRole('button', { name: 'Collapse Authentication' }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Complete Implement secure login' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand Authentication' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () =>
      page
        .getByRole('complementary')
        .evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page
    .getByRole('heading', { name: 'Features & Tasks' })
    .scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: 'test-results/phase5-work-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect
    .poll(async () => (await page.getByRole('complementary').boundingBox())?.x)
    .toBe(12);
  await page.screenshot({
    path: 'test-results/phase5-work-desktop.png',
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test('F5-07: concurrent work is retained and stale updates are rejected', async ({
  page,
}) => {
  await signIn(page);
  const results = await Promise.all(
    ['Parallel A', 'Parallel B'].map((title) =>
      request(page, '/work/features', 'POST', { title }),
    ),
  );
  expect(results.map((result) => result.status)).toEqual([201, 201]);
  const features = await prisma.feature.findMany({ where: { outcomeId } });
  expect(features.map((feature) => feature.position).sort()).toEqual([0, 1, 2]);
  const task = await prisma.task.findFirstOrThrow({
    where: { feature: { outcomeId } },
  });
  const original = {
    title: 'Updated once',
    updatedAt: task.updatedAt.toISOString(),
  };
  expect(
    (await request(page, `/work/tasks/${task.id}`, 'PATCH', original)).status,
  ).toBe(200);
  expect(
    (
      await request(page, `/work/tasks/${task.id}`, 'PATCH', {
        ...original,
        title: 'Stale overwrite',
      })
    ).status,
  ).toBe(409);
  expect(
    (await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).title,
  ).toBe('Updated once');
});

test('Feature editing and deletion persist with audit history', async ({
  page,
}) => {
  await signIn(page);
  await openWork(page);
  const feature = page.getByRole('article', {
    name: 'Feature Parallel A',
    exact: true,
  });
  await feature
    .getByRole('button', { name: 'Edit feature', exact: true })
    .click();
  await feature
    .getByLabel('Feature title', { exact: true })
    .fill('Renamed feature');
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes('/work/features/') &&
      response.request().method() === 'PATCH',
  );
  await feature
    .getByRole('button', { name: 'Save feature', exact: true })
    .click();
  expect((await saved).status()).toBe(200);
  const updated = page.getByRole('article', {
    name: 'Feature Renamed feature',
    exact: true,
  });
  await expect(updated).toBeVisible();
  page.on('dialog', (dialog) => void dialog.accept());
  const deleted = page.waitForResponse(
    (response) =>
      response.url().includes('/work/features/') &&
      response.request().method() === 'DELETE',
  );
  await updated
    .getByRole('button', { name: 'Delete feature Renamed feature' })
    .click();
  expect((await deleted).status()).toBe(200);
  await expect(updated).toHaveCount(0);
  expect(
    await prisma.activityLog.count({
      where: { outcomeId, action: 'FEATURE_DELETED' },
    }),
  ).toBe(1);
});

test('Task deletion preserves an audit event and permits new work', async ({
  page,
}) => {
  await signIn(page);
  await openWork(page);
  page.on('dialog', (dialog) => void dialog.accept());
  const task = page.getByRole('checkbox', { name: 'Complete Updated once' });
  const deleted = page.waitForResponse(
    (response) =>
      response.url().includes('/work/tasks/') &&
      response.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Delete task Updated once' }).click();
  expect((await deleted).status()).toBe(200);
  await expect(task).toHaveCount(0);
  expect(
    await prisma.activityLog.count({
      where: { outcomeId, action: { in: ['TASK_DELETED', 'FEATURE_DELETED'] } },
    }),
  ).toBe(2);
  // Preserve a task for the following lock/execution case.
  const remaining = await prisma.feature.findFirstOrThrow({
    where: { outcomeId, title: 'Authentication' },
  });
  expect(
    (
      await request(page, `/work/features/${remaining.id}/tasks`, 'POST', {
        title: 'Updated once',
      })
    ).status,
  ).toBe(201);
});

test('F5-35 F5-37: dependencies allow planning but block execution; accepted work is closed', async ({
  page,
}) => {
  await signIn(page);
  await prisma.outcomeDependency.create({
    data: { outcomeId, prerequisiteOutcomeId: prerequisiteId },
  });
  await openWork(page);
  await expect(
    page.getByText('Locked by prerequisite', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Complete Updated once' }),
  ).toBeDisabled();
  expect(
    (
      await request(page, '/work/features', 'POST', {
        title: 'Plan while locked',
      })
    ).status,
  ).toBe(201);
  const task = await prisma.task.findFirstOrThrow({
    where: { feature: { outcomeId } },
  });
  expect(
    (
      await request(page, `/work/tasks/${task.id}/state`, 'PATCH', {
        status: 'DONE',
        updatedAt: task.updatedAt.toISOString(),
      })
    ).status,
  ).toBe(409);
  await prisma.outcome.update({
    where: { id: outcomeId },
    data: { lifecycleStatus: 'ACCEPTED', acceptedAt: new Date() },
  });
  expect(
    (await request(page, '/work/features', 'POST', { title: 'Accepted work' }))
      .status,
  ).toBe(409);
  await openWork(page, true);
  await expect(page.getByRole('button', { name: '+ Add Feature' })).toHaveCount(
    0,
  );
  await expect(page.getByText('100% work progress')).toBeVisible();
});

test('Work area loading, error, and retry use the same protected direct route', async ({
  page,
}) => {
  await signIn(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const endpoint = `**/api/projects/${projectId}/outcomes/${outcomeId}/work`;
  const intercepted = page.waitForRequest(endpoint);
  await page.route(
    endpoint,
    async (route) => {
      await pending;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Temporarily unavailable' }),
      });
    },
  );
  await page.goto(`/projects/${projectId}/outcomes/${outcomeId}`);
  await intercepted;
  await expect(
    page.getByRole('region', { name: 'Loading Outcome work' }),
  ).toBeVisible();
  release();
  await expect(
    page.getByText('Outcome work could not be loaded.'),
  ).toBeVisible();
  await page.unroute(endpoint);
  await page.getByRole('button', { name: 'Retry work area' }).click();
  await expect(
    page.getByRole('heading', { name: 'Features & Tasks' }),
  ).toBeVisible();
});

test('Invalid and missing direct Outcome routes cannot expose another record', async ({
  page,
}) => {
  await signIn(page);
  expect(
    (
      await request(page, '/work/tasks/not-a-uuid', 'PATCH', {
        title: 'Missing',
        updatedAt: new Date().toISOString(),
      })
    ).status,
  ).toBe(400);
  const workflowLoaded = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/projects/${projectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/projects/${projectId}/outcomes/${crypto.randomUUID()}`);
  expect((await workflowLoaded).status()).toBe(200);
  await expect(
    page.getByText('Outcome not found', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to Project Workspace' }).click();
  await expect(
    page.getByRole('heading', { name: 'Stages and Outcomes' }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByText('Outcome not found', { exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole('heading', { name: 'Stages and Outcomes' }),
  ).toBeVisible();
});
