import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { OutcomeDeliverySchema } from '../../shared/contracts/outcome-delivery';

const prisma = new PrismaClient();
const runId = `phase5-delivery-${Date.now()}`;
let memberId = '',
  otherId = '',
  projectId = '',
  outcomeId = '';
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
async function openDelivery(page: Page, reload = false) {
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/outcomes/${outcomeId}/delivery`) &&
      response.request().method() === 'GET',
  );
  if (reload) await page.reload();
  else await page.goto(`/projects/${projectId}/outcomes/${outcomeId}`);
  expect((await response).status()).toBe(200);
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
      path: `/api/projects/${projectId}/outcomes/${outcomeId}/delivery${suffix}`,
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
  const other = await prisma.member.create({
    data: {
      fullName: 'Other Outcome Member',
      email: `${runId}@example.com`,
      departmentId: member.departmentId,
      status: 'ACTIVE',
    },
  });
  otherId = other.id;
  const project = await prisma.project.create({
    data: {
      name: runId,
      description: 'Shared submission workflow fixture.',
      createdByMemberId: memberId,
      leadMemberId: otherId,
      departments: { create: { departmentId: member.departmentId } },
      stages: {
        create: {
          name: 'Delivery',
          position: 0,
          outcomes: {
            create: {
              title: 'Shared Delivery',
              position: 0,
              createdByMemberId: otherId,
              departments: { create: { departmentId: member.departmentId } },
              acceptanceCriteria: {
                create: {
                  description: 'Combined output satisfies the objective.',
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
  outcomeId = project.stages[0].outcomes[0].id;
});
test.afterAll(async () => {
  if (projectId) await prisma.project.delete({ where: { id: projectId } });
  if (otherId) await prisma.member.delete({ where: { id: otherId } });
  await prisma.$disconnect();
});

test('F5-10 F5-11: viewer cannot submit or save drafts; invalid content is denied', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await expect(
    page.getByText('No submissions yet.', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await request(page, '/submissions', 'POST', {
        content: 'Not joined',
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(403);
  expect(
    (await request(page, '/draft', 'PUT', { content: 'Not joined' })).status,
  ).toBe(403);
  expect(
    (
      await request(page, '/submissions', 'POST', {
        content: ' ',
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(400);
  await prisma.outcomeMember.createMany({
    data: [
      { outcomeId, memberId },
      { outcomeId, memberId: otherId },
    ],
  });
  await prisma.projectMember.createMany({
    data: [
      { projectId, memberId },
      { projectId, memberId: otherId },
    ],
  });
});

test('Saved output draft survives refresh and is private to its member', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await page
    .getByLabel('Output content', { exact: true })
    .fill('https://example.com/delivery');
  await page
    .getByLabel('Submission notes', { exact: true })
    .fill('Initial evidence');
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/draft') &&
      response.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await openDelivery(page, true);
  await expect(page.getByLabel('Output content', { exact: true })).toHaveValue(
    'https://example.com/delivery',
  );
  expect(
    await prisma.outcomeOutputDraft.count({
      where: { outcomeId, memberId: otherId },
    }),
  ).toBe(0);
});

test('Stale draft writes cannot overwrite a saved output', async ({ page }) => {
  await signIn(page);
  expect(
    (
      await request(page, '/draft', 'PUT', {
        content: 'Stale overwrite',
        note: '',
        updatedAt: null,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await request(page, '/submissions', 'POST', {
        content: 'Stale submission',
        requestId: crypto.randomUUID(),
        draftUpdatedAt: null,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await prisma.outcomeOutputDraft.findUniqueOrThrow({
        where: { outcomeId_memberId: { outcomeId, memberId } },
      })
    ).content,
  ).toBe('https://example.com/delivery');
});

test('F5-09 F5-12 F5-13: submission appends attributed history and clears the saved draft', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  const submitted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/submissions') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Submit for review', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  expect((await submitted).status()).toBe(201);
  expect(await prisma.outcomeSubmission.count({ where: { outcomeId } })).toBe(
    1,
  );
  await expect(
    page.getByRole('button', { name: /v1.*https:\/\/example.com\/delivery/ }),
  ).toBeVisible();
  await openDelivery(page, true);
  await expect(
    page.locator('.outcome-submission-card.latest'),
  ).toHaveCount(1);
  await page
    .getByRole('button', { name: /v1.*https:\/\/example.com\/delivery/ })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Submission record' });
  await expect(dialog.getByText('Member submission', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Outcome-level review', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Submission status', { exact: true })).toBeVisible();
  await expect(
    dialog.getByRole('link', { name: 'https://example.com/delivery' }),
  ).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(
    dialog.getByText('Initial evidence', { exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  const records = await prisma.outcomeSubmission.findMany({
    where: { outcomeId },
  });
  expect(records).toHaveLength(1);
  expect(records[0].submittedByMemberId).toBe(memberId);
  expect(
    await prisma.outcomeOutputDraft.count({ where: { outcomeId, memberId } }),
  ).toBe(0);
});

test('F5-14 F5-15 F5-16: parallel pending entries coexist and duplicate retries append once', async ({
  page,
}) => {
  await signIn(page);
  const input = {
    content: 'Second contribution',
    requestId: crypto.randomUUID(),
  };
  const responses = await Promise.all([
    request(page, '/submissions', 'POST', input),
    request(page, '/submissions', 'POST', input),
  ]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  expect(
    await prisma.outcomeSubmission.count({
      where: { outcomeId, reviewStatus: 'FOR_REVIEW' },
    }),
  ).toBe(2);
  expect(
    (
      await request(page, '/submissions', 'POST', {
        ...input,
        content: 'Changed retry',
      })
    ).status,
  ).toBe(409);
  const history = OutcomeDeliverySchema.parse(
    (await request(page, '', 'GET')).body,
  );
  expect(history.submissions.map((item) => item.content)).toEqual([
    'Second contribution',
    'https://example.com/delivery',
  ]);
  expect(history.hasForReview).toBe(true);
});

test('F5-18 F5-19 F5-40: non-Lead and CAN_EDIT cannot review, accept, reopen or override dependencies', async ({
  page,
}) => {
  await signIn(page);
  const data = OutcomeDeliverySchema.parse(
    (await request(page, '', 'GET')).body,
  );
  const decision = {
    criterionIds: data.criteria.map((item) => item.id),
    note: 'Forged review',
    outcomeUpdatedAt: data.outcomeUpdatedAt,
    submissionIds: data.submissions.map((item) => item.id),
  };
  expect(
    (await request(page, '/request-revision', 'POST', decision)).status,
  ).toBe(403);
  expect((await request(page, '/accept', 'POST', decision)).status).toBe(403);
  expect(
    (
      await request(page, '/reopen', 'POST', {
        outcomeUpdatedAt: data.outcomeUpdatedAt,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(
        page,
        `/dependencies/${crypto.randomUUID()}/override`,
        'POST',
        { reason: 'No authority' },
      )
    ).status,
  ).toBe(403);
  await prisma.projectMember.update({
    where: { projectId_memberId: { projectId, memberId } },
    data: { accessLevel: 'CAN_EDIT' },
  });
  expect((await request(page, '/accept', 'POST', decision)).status).toBe(403);
  await prisma.project.update({
    where: { id: projectId },
    data: { leadMemberId: memberId },
  });
});

test('Individual submission review preserves other pending submissions', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await page.getByRole('button', { name: /v2.*Second contribution/ }).click();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/reviews') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('dialog', { name: 'Submission record' })
    .getByRole('button', { name: 'Mark submission reviewed' })
    .click();
  expect((await response).status()).toBe(201);
  expect(
    await prisma.outcomeSubmission.count({
      where: { outcomeId, reviewStatus: 'REVIEWED' },
    }),
  ).toBe(1);
  expect(
    await prisma.outcomeSubmission.count({
      where: { outcomeId, reviewStatus: 'FOR_REVIEW' },
    }),
  ).toBe(1);
});

test('F5-17 F5-20: Lead reviews combined history and requests revision with required feedback', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await page
    .getByRole('button', { name: 'Review Outcome', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review Outcome' });
  await expect(
    dialog.getByText('Project Lead verification', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('1. Outcome to satisfy', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('2. Team submissions', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('Second contribution', { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole('button', { name: 'Request revision', exact: true })
    .click();
  await expect(
    dialog.getByText('Explain what the team must revise.'),
  ).toBeVisible();
  await dialog
    .getByLabel('Outcome review feedback')
    .fill('Add the missing evidence.');
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/request-revision') &&
      response.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Request revision', exact: true })
    .click();
  expect((await response).status()).toBe(201);
  await expect(dialog).toHaveCount(0);
  expect(
    (await prisma.outcome.findUniqueOrThrow({ where: { id: outcomeId } }))
      .lifecycleStatus,
  ).toBe('NEEDS_REVISION');
});

test('F5-21 F5-22: feedback is visible and resubmission preserves NEEDS_REVISION', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await expect(
    page.getByText('Add the missing evidence.', { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel('Output content', { exact: true })
    .fill('Revised evidence');
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/submissions') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('button', { name: 'Submit for review', exact: true })
    .click();
  expect((await response).status()).toBe(201);
  expect(
    (await prisma.outcome.findUniqueOrThrow({ where: { id: outcomeId } }))
      .lifecycleStatus,
  ).toBe('NEEDS_REVISION');
  expect(await prisma.outcomeSubmission.count({ where: { outcomeId } })).toBe(
    3,
  );
});

test('F5-24 F5-25: verify criteria and accept entire Outcome with all current member credit', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await page
    .getByRole('button', { name: 'Review Outcome', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Review Outcome' });
  await dialog
    .getByRole('button', { name: 'Accept Outcome', exact: true })
    .click();
  await expect(
    dialog.getByText(
      'Verify every acceptance criterion against the combined submissions before accepting.',
    ),
  ).toBeVisible();
  const draft = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/review-draft') &&
      response.request().method() === 'PUT',
  );
  await dialog
    .getByRole('checkbox', { name: 'Combined output satisfies the objective.' })
    .check();
  expect((await draft).status()).toBe(200);
  const accepted = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/accept') &&
      response.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Accept Outcome', exact: true })
    .click();
  expect((await accepted).status()).toBe(201);
  const history = await prisma.outcomeAcceptance.findMany({
    where: { outcomeId },
    include: { members: true },
  });
  expect(history).toHaveLength(1);
  expect(history[0].members.map((item) => item.memberId).sort()).toEqual(
    [memberId, otherId].sort(),
  );
});

test('F5-26 F5-27: accepted state survives refresh and denies submission, work and joining', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await expect(
    page.getByRole('region', { name: 'Review history' }),
  ).toBeVisible();
  await expect(page.getByText('Accepted Outcome', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/This outcome is final\./),
  ).toBeVisible();
  await expect(
    page.locator('.outcome-submission-card.latest.accepted-evidence'),
  ).toHaveCount(1);
  await expect(
    page.locator('.outcome-submission-card.latest .outcome-sub-latest-badge'),
  ).toHaveText('Latest');
  await expect(
    page.locator('.outcome-submission-card.latest .outcome-sub-status-badge'),
  ).toHaveText('Accepted');
  await expect(
    page.getByRole('button', { name: 'Submit for review' }),
  ).toHaveCount(0);
  expect(
    (
      await request(page, '/submissions', 'POST', {
        content: 'After acceptance',
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(409);
  const outcome = await prisma.outcome.findUniqueOrThrow({
    where: { id: outcomeId },
  });
  expect(outcome.lifecycleStatus).toBe('ACCEPTED');
  const data = OutcomeDeliverySchema.parse(
    (await request(page, '', 'GET')).body,
  );
  expect(
    (
      await request(page, '/accept', 'POST', {
        criterionIds: data.criteria.map((item) => item.id),
        note: '',
        outcomeUpdatedAt: data.outcomeUpdatedAt,
        submissionIds: data.submissions.map((item) => item.id),
      })
    ).status,
  ).toBe(409);
  expect(await prisma.outcomeAcceptance.count({ where: { outcomeId } })).toBe(
    1,
  );
});

test('F5-28 F5-29 F5-30 F5-31: reopening preserves membership, submissions and acceptance history', async ({
  page,
}) => {
  await signIn(page);
  await openDelivery(page);
  await page
    .getByRole('button', { name: 'Reopen Outcome', exact: true })
    .click();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/reopen') &&
      response.request().method() === 'POST',
  );
  await page
    .getByRole('dialog', { name: 'Reopen accepted Outcome' })
    .getByRole('button', { name: 'Confirm reopen' })
    .click();
  expect((await response).status()).toBe(201);
  expect(await prisma.outcomeMember.count({ where: { outcomeId } })).toBe(2);
  expect(await prisma.outcomeSubmission.count({ where: { outcomeId } })).toBe(
    3,
  );
  expect(
    (await prisma.outcomeAcceptance.findFirstOrThrow({ where: { outcomeId } }))
      .reopenedAt,
  ).not.toBeNull();
  expect(
    (await prisma.outcome.findUniqueOrThrow({ where: { id: outcomeId } }))
      .acceptedAt,
  ).toBeNull();
});

test('F5-33 F5-34: reopened Outcome receives new work and a second independent acceptance event', async ({
  page,
}) => {
  await signIn(page);
  expect(
    (
      await request(page, '/submissions', 'POST', {
        content: 'After reopening',
        requestId: crypto.randomUUID(),
      })
    ).status,
  ).toBe(201);
  const data = OutcomeDeliverySchema.parse(
    (await request(page, '', 'GET')).body,
  );
  expect(
    (
      await request(page, '/accept', 'POST', {
        criterionIds: data.criteria.map((item) => item.id),
        note: 'Second acceptance',
        outcomeUpdatedAt: data.outcomeUpdatedAt,
        submissionIds: data.submissions.map((item) => item.id),
      })
    ).status,
  ).toBe(201);
  const history = await prisma.outcomeAcceptance.findMany({
    where: { outcomeId },
    include: { members: true },
    orderBy: { acceptedAt: 'asc' },
  });
  expect(history).toHaveLength(2);
  expect(history[0].reopenedAt).not.toBeNull();
  expect(history[1].reopenedAt).toBeNull();
  expect(history.every((item) => item.members.length === 2)).toBe(true);
});
