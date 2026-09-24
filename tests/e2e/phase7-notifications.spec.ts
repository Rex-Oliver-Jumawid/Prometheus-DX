import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createAuthFixture, deleteAuthFixture } from './auth-fixture';

const prisma = new PrismaClient();

async function signIn(
  page: Page,
  account: Awaited<ReturnType<typeof createAuthFixture>>,
) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/me') && response.status() === 200,
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await signedIn;
  await expect(page).not.toHaveURL(/\/login$/);
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test('submission notification opens Outcome and persists read state', async ({
  browser,
}) => {
  const runId = `phase7-notifications-${crypto.randomUUID()}`;
  const outcomeTitle = `Review output ${runId}`;
  const accounts: Awaited<ReturnType<typeof createAuthFixture>>[] = [];
  const memberIds: string[] = [];
  let departmentId: string | undefined;
  let projectId: string | undefined;
  const contexts: BrowserContext[] = [];

  try {
    accounts.push(await createAuthFixture(prisma, `${runId}-lead`));
    accounts.push(await createAuthFixture(prisma, `${runId}-worker`));

    const department = await prisma.department.create({
      data: {
        name: `Notifications ${runId}`,
        shortLabel: 'P7N',
      },
    });
    departmentId = department.id;

    const lead = await prisma.member.create({
      data: {
        authUserId: accounts[0].id,
        email: accounts[0].email,
        fullName: `Lead ${runId}`,
        departmentId,
        status: 'ACTIVE',
      },
    });
    memberIds.push(lead.id);
    const worker = await prisma.member.create({
      data: {
        authUserId: accounts[1].id,
        email: accounts[1].email,
        fullName: `Worker ${runId}`,
        departmentId,
        status: 'ACTIVE',
      },
    });
    memberIds.push(worker.id);

    const project = await prisma.project.create({
      data: {
        name: `Notification journey ${runId}`,
        description: 'Isolated Project for the notification browser journey.',
        createdByMemberId: lead.id,
        leadMemberId: lead.id,
        departments: { create: { departmentId } },
        stages: {
          create: {
            name: 'Delivery',
            position: 0,
            outcomes: {
              create: {
                title: outcomeTitle,
                position: 0,
                createdByMemberId: lead.id,
                departments: { create: { departmentId } },
                members: { create: { memberId: worker.id } },
                acceptanceCriteria: {
                  create: {
                    description: 'The Project Lead can review the submitted output.',
                    position: 0,
                  },
                },
              },
            },
          },
        },
        members: { create: { memberId: worker.id } },
      },
      include: { stages: { include: { outcomes: true } } },
    });
    projectId = project.id;
    const outcomeId = project.stages[0].outcomes[0].id;

    const workerContext = await browser.newContext();
    contexts.push(workerContext);
    const workerPage = await workerContext.newPage();
    await signIn(workerPage, accounts[1]);
    await workerPage.goto(`/projects/${projectId}/outcomes/${outcomeId}`);
    await workerPage
      .getByLabel('Output content', { exact: true })
      .fill('https://example.com/phase-7-notification-evidence');
    const submitted = workerPage.waitForResponse(
      (response) =>
        response.url().endsWith('/delivery/submissions') &&
        response.request().method() === 'POST',
    );
    await workerPage
      .getByRole('button', { name: 'Submit for review', exact: true })
      .click();
    expect((await submitted).status()).toBe(201);

    const leadContext = await browser.newContext();
    contexts.push(leadContext);
    const leadPage = await leadContext.newPage();
    await signIn(leadPage, accounts[0]);
    const utilityLink = leadPage.getByRole('link', {
      name: 'Notifications, 1 unread',
    });
    await expect(utilityLink).toBeVisible();
    await utilityLink.click();
    await expect(leadPage).toHaveURL(/\/notifications$/);

    const notification = leadPage.getByRole('button', {
      name: /Output ready for your review/,
    });
    await expect(notification).toHaveAttribute('data-state', 'unread');
    await expect(notification).toContainText(worker.fullName);
    await expect(notification).toContainText(outcomeTitle);
    await notification.click();
    await expect(leadPage).toHaveURL(
      new RegExp(`/projects/${projectId}/outcomes/${outcomeId}$`),
    );
    await expect(leadPage.getByText(outcomeTitle).first()).toBeVisible();

    await leadPage.goBack();
    await expect(leadPage).toHaveURL(/\/notifications$/);
    await expect(notification).toHaveAttribute('data-state', 'read');
    await expect(leadPage.getByRole('link', { name: 'Notifications' })).toBeVisible();
    await expect(leadPage.locator('.sidebar-unread-badge')).toHaveCount(0);

    await leadPage.reload();
    await expect(notification).toHaveAttribute('data-state', 'read');
    await expect(leadPage.locator('.sidebar-unread-badge')).toHaveCount(0);
    await expect(
      prisma.notification.findFirstOrThrow({
        where: {
          recipientMemberId: lead.id,
          type: 'SUBMISSION_CREATED',
          outcomeId,
        },
      }),
    ).resolves.toMatchObject({ readAt: expect.any(Date) });
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
    if (projectId) {
      await prisma.notification.deleteMany({ where: { projectId } });
      await prisma.project.delete({ where: { id: projectId } });
    }
    if (memberIds.length > 0)
      await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    for (const account of accounts) await deleteAuthFixture(prisma, account);
    if (departmentId)
      await prisma.department.delete({ where: { id: departmentId } });
  }
});
