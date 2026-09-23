import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD);
const runId = 'collaboration-' + Date.now();
let projectId = '';
let otherProjectId = '';
let departmentId = '';
let memberId = '';
let rootMessageId = '';
let outcomeId = '';
const privateSubmissionText = 'PRIVATE-SUBMISSION-CONTENT-' + runId;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page.getByLabel('Password', { exact: true }).fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.skip(!hasCredentials, 'Requires E2E member credentials and the Chat/Activity migrations.');
  const member = await prisma.member.findFirstOrThrow({
    where: { email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' } },
  });
  memberId = member.id;
  const department = await prisma.department.create({
    data: { name: runId, shortLabel: 'COLLAB' },
  });
  departmentId = department.id;
  const projects = await Promise.all(['main', 'foreign'].map((suffix) =>
    prisma.project.create({
      data: {
        name: runId + '-' + suffix,
        description: 'Focused collaboration browser acceptance.',
        createdByMemberId: memberId,
        leadMemberId: memberId,
        departments: { create: { departmentId } },
      },
    }),
  ));
  projectId = projects[0].id;
  otherProjectId = projects[1].id;
  const stage = await prisma.stage.create({
    data: { projectId, name: 'Discovery', position: 0 },
  });
  const outcome = await prisma.outcome.create({
    data: {
      stageId: stage.id,
      title: 'Collaboration outcome',
      position: 0,
      createdByMemberId: memberId,
      departments: { create: { departmentId } },
      acceptanceCriteria: { create: { description: 'Approved', position: 0 } },
    },
  });
  outcomeId = outcome.id;
  const root = await prisma.projectMessage.create({
    data: { projectId, memberId, body: 'Initial project update' },
  });
  rootMessageId = root.id;
  await prisma.activityLog.createMany({
    data: [
      {
        projectId, actorMemberId: memberId,
        entityType: 'Outcome', entityId: outcomeId, outcomeId,
        action: 'OUTCOME_CREATED', metadata: { title: 'Collaboration outcome' },
      },
      {
        projectId, actorMemberId: memberId,
        entityType: 'OutcomeSubmission', entityId: randomUUID(), outcomeId,
        action: 'SUBMISSION_CREATED', metadata: { content: privateSubmissionText },
      },
    ],
  });
}, 30_000);

test.afterAll(async () => {
  if (projectId || otherProjectId) {
    const ids = [projectId, otherProjectId].filter(Boolean);
    await prisma.projectMessage.deleteMany({
      where: { projectId: { in: ids }, parentMessageId: { not: null } },
    });
    await prisma.projectMessage.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.project.deleteMany({ where: { id: { in: ids } } });
  }
  if (departmentId) await prisma.department.delete({ where: { id: departmentId } });
  await prisma.$disconnect();
}, 30_000);

test('Chat persists a reply and author edit across reload', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  await page.goto('/projects/' + projectId + '?tab=chat');
  await expect(page.getByRole('heading', { name: 'Project chat' })).toBeVisible();
  await expect(page.getByText('Initial project update')).toBeVisible();
  await page.getByRole('button', { name: 'Reply', exact: true }).click();
  await expect(page.getByText(/Replying to/)).toBeVisible();
  await page.getByRole('textbox', { name: 'Message' }).fill('Persistent reply');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Persistent reply')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Persistent reply')).toBeVisible();
  await expect(page.getByText(/Reply to/)).toBeVisible();
  const reply = page.getByRole('listitem').filter({ hasText: 'Persistent reply' });
  await reply.getByRole('button', { name: 'Edit' }).click();
  await reply.getByRole('textbox', { name: 'Edit message' }).fill('Persistent edited reply');
  await reply.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Persistent edited reply')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Persistent edited reply')).toBeVisible();
  const stored = await prisma.projectMessage.findFirstOrThrow({
    where: { projectId, body: 'Persistent edited reply' },
  });
  expect(stored.parentMessageId).toBe(rootMessageId);
  expect(stored.editedAt).not.toBeNull();
});

test('Activity links to Outcomes but never returns private submission content', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  await page.goto('/projects/' + projectId + '?tab=activity');
  await expect(page.getByRole('heading', { name: 'Project activity' })).toBeVisible();
  await expect(page.getByText(/created an outcome/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'View outcome' }).first()).toHaveAttribute(
    'href', '/projects/' + projectId + '/outcomes/' + outcomeId,
  );
  expect(await page.getByText(privateSubmissionText).count()).toBe(0);
  const apiResponse = await page.evaluate(async (id) => {
    const key = Object.keys(localStorage).find(
      (name) => name.startsWith('sb-') && name.endsWith('-auth-token'),
    );
    const session = key ? JSON.parse(localStorage.getItem(key) ?? '{}') as {
      access_token?: string;
    } : {};
    const response = await fetch('/api/projects/' + id + '/activity', {
      headers: { Authorization: 'Bearer ' + (session.access_token ?? '') },
    });
    return { status: response.status, json: await response.json() };
  }, projectId);
  expect(apiResponse.status).toBe(200);
  expect(JSON.stringify(apiResponse.json)).not.toContain(privateSubmissionText);
});

test('Collaboration panels fit narrow and desktop viewports', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    for (const tab of ['chat', 'activity']) {
      await page.goto('/projects/' + projectId + '?tab=' + tab);
      const panel = page.locator('.pw-collaboration-panel');
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    }
  }
});
