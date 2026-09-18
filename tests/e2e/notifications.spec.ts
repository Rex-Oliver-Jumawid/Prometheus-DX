import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const runId = `phase7-notifications-${Date.now()}`;
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
let recipientId = '';
let actorId = '';
let projectId = '';
let outcomeId = '';
let notificationId = '';
let existingUnreadCount = 0;

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const recipient = await prisma.member.findFirstOrThrow({
    where: {
      email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' },
    },
  });
  recipientId = recipient.id;
  existingUnreadCount = await prisma.notification.count({
    where: { recipientMemberId: recipientId, readAt: null },
  });
  const actor = await prisma.member.create({
    data: {
      fullName: 'Phase 7 Notification Actor',
      email: `${runId}@prometheus.test`,
      departmentId: recipient.departmentId,
      status: 'ACTIVE',
    },
  });
  actorId = actor.id;
  const project = await prisma.project.create({
    data: {
      name: `${runId} Project With A Deliberately Long Responsive Name`,
      description: 'Focused notification navigation fixture.',
      createdByMemberId: actorId,
      leadMemberId: recipientId,
      departments: { create: { departmentId: recipient.departmentId } },
      stages: {
        create: {
          name: 'Delivery',
          position: 0,
          outcomes: {
            create: {
              title: 'Notification-linked Outcome',
              position: 0,
              createdByMemberId: actorId,
              departments: { create: { departmentId: recipient.departmentId } },
              acceptanceCriteria: {
                create: {
                  description: 'Notification opens this Outcome.',
                  position: 0,
                },
              },
            },
          },
        },
      },
    },
    include: { stages: { include: { outcomes: true } } },
  });
  projectId = project.id;
  outcomeId = project.stages[0]!.outcomes[0]!.id;
  const notification = await prisma.notification.create({
    data: {
      recipientMemberId: recipientId,
      actorMemberId: actorId,
      projectId,
      outcomeId,
      type: 'SUBMISSION_CREATED',
      eventKey: `${runId}:submission`,
    },
  });
  notificationId = notification.id;
});

test.afterAll(async () => {
  if (notificationId)
    await prisma.notification.deleteMany({ where: { id: notificationId } });
  if (projectId) await prisma.project.delete({ where: { id: projectId } });
  if (actorId) await prisma.member.delete({ where: { id: actorId } });
  await prisma.$disconnect();
});

test('notification bell opens the inbox, navigation marks read, and refresh preserves state', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const failedNotificationRequests: string[] = [];
  const pendingNotificationRequests = new Set<string>();
  let readMutationCount = 0;
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (
      response.url().includes('/api/notifications') &&
      response.status() >= 400
    )
      failedNotificationRequests.push(
        `${response.request().method()} ${response.status()} ${response.url()}`,
      );
    if (
      response.url().endsWith(`/api/notifications/${notificationId}/read`) &&
      response.request().method() === 'PUT'
    )
      readMutationCount += 1;
  });
  page.on('request', (request) => {
    if (request.url().includes('/api/notifications'))
      pendingNotificationRequests.add(request.url());
  });
  const finishNotificationRequest = (request: { url(): string }) => {
    if (request.url().includes('/api/notifications'))
      pendingNotificationRequests.delete(request.url());
  };
  page.on('requestfinished', finishNotificationRequest);
  page.on('requestfailed', finishNotificationRequest);

  await signIn(page);
  const expectedInitial = existingUnreadCount + 1;
  const bell = page.getByRole('link', {
    name: `Open notifications, ${expectedInitial} unread notification${expectedInitial === 1 ? '' : 's'}`,
  });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL(/\/notifications$/);
  const notificationRow = page.getByRole('button', {
    name: /Unread: Output ready for review.*Phase 7 Notification Actor.*Notification-linked Outcome/,
  });
  await expect(notificationRow).toBeVisible();

  const readResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/notifications/${notificationId}/read`) &&
      response.request().method() === 'PUT',
  );
  await notificationRow.click();
  expect((await readResponse).status()).toBe(200);
  await expect(page).toHaveURL(`/projects/${projectId}/outcomes/${outcomeId}`);
  await expect(
    page.getByRole('heading', { name: 'Notification-linked Outcome' }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/notifications$/);
  await page.goForward();
  await expect(page).toHaveURL(`/projects/${projectId}/outcomes/${outcomeId}`);

  const expectedAfterRead = existingUnreadCount;
  const refreshedBell = page.getByRole('link', {
    name: expectedAfterRead
      ? `Open notifications, ${expectedAfterRead} unread notification${expectedAfterRead === 1 ? '' : 's'}`
      : 'Open notifications',
  });
  await expect(refreshedBell).toBeVisible();
  await page.reload();
  await expect(refreshedBell).toBeVisible();
  await refreshedBell.click();
  await expect(page).toHaveURL(/\/notifications$/);
  await expect(
    page.getByRole('button', {
      name: /Output ready for review.*Phase 7 Notification Actor.*Notification-linked Outcome/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Unread: Output ready for review.*Notification-linked Outcome/,
    }),
  ).toHaveCount(0);

  for (const viewport of [
    { width: 820, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole('heading', { name: 'Notifications' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  }

  expect(readMutationCount).toBe(1);
  expect(failedNotificationRequests).toEqual([]);
  expect([...pendingNotificationRequests]).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
