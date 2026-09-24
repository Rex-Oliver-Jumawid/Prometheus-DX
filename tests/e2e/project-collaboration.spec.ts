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
  await page.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(page.getByText('Persistent reply')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Persistent reply')).toBeVisible();
  await expect(page.getByText(/Reply to/)).toBeVisible();
  const reply = page.getByRole('listitem').filter({ hasText: 'Persistent reply' });
  await reply.getByRole('button', { name: 'Message options' }).click();
  await reply.getByRole('button', { name: 'Edit message' }).click();
  await reply.getByRole('textbox', { name: 'Edit message' }).fill('Persistent edited reply');
  await reply.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Persistent edited reply')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Persistent edited reply')).toBeVisible();
  // The Figma bubble places the timestamp below the message, never over its author.
  const bubble = page.locator('.pw-chat-message').filter({
    hasText: 'Persistent edited reply',
  }).first();
  const [authorBounds, bodyBounds, timeBounds, bubbleBounds] = await Promise.all([
    bubble.locator('.pw-chat-message-meta strong').boundingBox(),
    bubble.locator('.pw-chat-message-text').boundingBox(),
    bubble.locator(':scope > time.pw-chat-message-time').boundingBox(),
    bubble.boundingBox(),
  ]);
  expect(authorBounds).not.toBeNull();
  expect(bodyBounds).not.toBeNull();
  expect(timeBounds).not.toBeNull();
  expect(bubbleBounds).not.toBeNull();
  expect(timeBounds!.y).toBeGreaterThanOrEqual(bodyBounds!.y + bodyBounds!.height - 1);
  expect(timeBounds!.y).toBeGreaterThan(authorBounds!.y + authorBounds!.height);
  expect(timeBounds!.y + timeBounds!.height).toBeLessThanOrEqual(
    bubbleBounds!.y + bubbleBounds!.height + 1,
  );
  const stored = await prisma.projectMessage.findFirstOrThrow({
    where: { projectId, body: 'Persistent edited reply' },
  });
  expect(stored.parentMessageId).toBe(rootMessageId);
  expect(stored.editedAt).not.toBeNull();
});

test('Project Lead can announce, pin, and surface the change in Activity', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  await page.goto('/projects/' + projectId + '?tab=chat');
  await page.getByRole('button', { name: 'Announce' }).click();
  await page.getByRole('textbox', { name: 'Announcement title' }).fill('Release guidance');
  await page.getByRole('textbox', { name: 'Announcement details' }).fill(
    'Keep output notes specific so review can move faster.',
  );
  await page.getByRole('button', { name: 'Post' }).click();
  await expect(page.getByText('Release guidance')).toBeVisible();
  await page.getByRole('button', { name: 'Pin announcement' }).click();
  await expect(page.getByRole('button', { name: 'Unpin announcement' })).toBeVisible();

  await page.goto('/projects/' + projectId + '?tab=activity');
  await expect(page.getByText('Posted announcement')).toBeVisible();
  await expect(page.getByText('Pinned announcement')).toBeVisible();
  await expect(page.getByText('Release guidance').first()).toBeVisible();
});

test('Activity links to Outcomes but never returns private submission content', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  await page.goto('/projects/' + projectId + '?tab=activity');
  await expect(page.getByRole('heading', { name: 'Project Activity' })).toBeVisible();
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

test('Chat opens on recent messages and keeps the viewport when older history loads', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await prisma.projectMessage.createMany({
    data: Array.from({ length: 35 }, (_, index) => ({
      projectId,
      memberId,
      body: 'Conversation record ' + String(index).padStart(4, '0'),
    })),
  });
  await signIn(page);
  await page.goto('/projects/' + projectId + '?tab=chat');
  const thread = page.getByRole('list', { name: 'Project messages' });
  await expect(thread.locator('li')).toHaveCount(30);
  await expect.poll(
    () => thread.evaluate((element) =>
      element.scrollHeight - element.clientHeight - element.scrollTop),
  ).toBeLessThan(4);

  const visiblePageAnchor = thread.locator('li').first();
  const anchorText = await visiblePageAnchor.locator('.pw-chat-message-text').innerText();
  const before = await visiblePageAnchor.evaluate((element) =>
    element.getBoundingClientRect().top,
  );
  await page.getByRole('button', { name: 'Load earlier messages' }).click();
  await expect(thread.locator('li')).toHaveCount(37);
  const anchor = thread.locator('li').filter({
    has: page.getByText(anchorText, { exact: true }),
  });
  const after = await anchor.evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(after - before)).toBeLessThan(5);
});

test('Search results focus the actual older chat message without scrolling the workspace', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/' + projectId + '?tab=chat');
  await expect(page.getByRole('list', { name: 'Project messages' }).locator('li')).toHaveCount(30);
  await page.getByRole('button', { name: 'Search project conversation' }).click();
  await page.getByRole('textbox', { name: 'Search project messages' }).fill('Initial project update');
  const result = page.locator('.pw-chat-search-result').filter({ hasText: 'Initial project update' });
  await expect(result).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  await result.click();
  const selected = page.locator('[data-message-id="' + rootMessageId + '"]');
  await expect(selected).toHaveClass(/pw-chat-message--targeted/);
  await expect.poll(async () => {
    return page.getByRole('list', { name: 'Project messages' }).evaluate((thread, id) => {
      const target = thread.querySelector('[data-message-id="' + id + '"]');
      if (!target) return false;
      const area = thread.getBoundingClientRect();
      const row = target.getBoundingClientRect();
      return row.top >= area.top - 1 && row.bottom <= area.bottom + 1;
    }, rootMessageId);
  }).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);

  await page.getByRole('button', { name: 'Search project conversation' }).click();
  await page.getByRole('button', { name: 'Clear' }).click();
  await expect(page.locator('.pw-chat-message--targeted')).toHaveCount(0);

  await page.getByRole('textbox', { name: 'Search project messages' }).fill('Initial project update');
  await page.locator('.pw-chat-search-result').filter({ hasText: 'Initial project update' }).click();
  await expect(page.locator('.pw-chat-message--targeted')).toHaveCount(1);

  const sentBody = 'Search return to latest ' + Date.now();
  await page.getByRole('textbox', { name: 'Message' }).fill(sentBody);
  await page.getByRole('textbox', { name: 'Message' }).press('Enter');
  await expect(page.getByText(sentBody, { exact: true })).toBeVisible();
  await expect(page.locator('.pw-chat-message--targeted')).toHaveCount(0);
  await expect.poll(
    () => page.getByRole('list', { name: 'Project messages' }).evaluate((thread) =>
      thread.scrollHeight - thread.clientHeight - thread.scrollTop),
  ).toBeLessThan(4);
});

test('The announcements and members rail fits its contents without stretching to chat height', async ({ page }) => {
  test.skip(!hasCredentials, 'Requires E2E credentials.');
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/' + projectId + '?tab=chat');
  const chat = page.locator('.pw-chat-panel');
  const rail = page.locator('.pw-chat-side-stack');
  await expect(page.locator('.pw-announcement-card--pinned')).toBeVisible();
  await expect.poll(async () => {
    const [chatBox, railBox] = await Promise.all([chat.boundingBox(), rail.boundingBox()]);
    return Boolean(chatBox && railBox && railBox.height < chatBox.height);
  }).toBe(true);
  const [listBox, cardBox] = await Promise.all([
    page.locator('.pw-announcement-list').boundingBox(),
    page.locator('.pw-announcement-card--pinned').boundingBox(),
  ]);
  expect(listBox && cardBox && cardBox.y + cardBox.height <= listBox.y + listBox.height + 1).toBe(true);
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
