import { PrismaClient } from '@prisma/client';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createAuthFixture, deleteAuthFixture } from './auth-fixture';
import { RegistryMemberSchema } from '../../shared/contracts/registry';
import { ProjectSchema } from '../../shared/contracts/project';
import {
  OutcomeSchema,
  StageSchema,
} from '../../shared/contracts/project-workflow';
import { OutcomeDeliverySchema } from '../../shared/contracts/outcome-delivery';

const prisma = new PrismaClient();
const runId = `core-${Date.now()}`;
const authFixtures: Awaited<ReturnType<typeof createAuthFixture>>[] = [];
const memberIds: string[] = [];
const contexts: BrowserContext[] = [];
let admin: Page, lead: Page, worker: Page, newcomer: Page;
let departmentId = '',
  projectId = '',
  stageId = '',
  outcomeId = '';
let dependentId = '',
  directId = '',
  protectedDependentId = '';
const browserErrors: string[] = [];

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/me') && response.status() === 200,
  );
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await response;
  await expect(page).not.toHaveURL(/\/login$/);
}
async function api(page: Page, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const key = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
      )!;
      const token = JSON.parse(localStorage.getItem(key)!)
        .access_token as string;
      const response = await fetch(`/api${path}`, {
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
    { path, method, body },
  );
}
function base(id = outcomeId) {
  return `/projects/${projectId}/outcomes/${id}`;
}
async function open(page: Page, id = outcomeId) {
  const loaded = page.waitForResponse(
    (response) =>
      (response.url().endsWith(`${base(id)}/delivery`) ||
        (response.url().includes(`/api/projects/${projectId}`) &&
          response.status() >= 400)) &&
      response.request().method() === 'GET',
  );
  await page.goto(base(id));
  const response = await loaded;
  expect(response.status(), `Direct route request: ${response.url()}`).toBe(
    200,
  );
}
async function delivery(page: Page, id = outcomeId) {
  return OutcomeDeliverySchema.parse(
    (await api(page, `${base(id)}/delivery`)).body,
  );
}
async function submit(page: Page, content: string, id = outcomeId) {
  return api(page, `${base(id)}/delivery/submissions`, 'POST', {
    content,
    requestId: crypto.randomUUID(),
  });
}
async function accept(page: Page, id = outcomeId) {
  const data = await delivery(page, id);
  return api(page, `${base(id)}/delivery/accept`, 'POST', {
    criterionIds: data.criteria.map((item) => item.id),
    submissionIds: data.submissions.map((item) => item.id),
    note: '',
    outcomeUpdatedAt: data.outcomeUpdatedAt,
  });
}

test.describe.configure({ mode: 'serial' });
test.beforeAll(async ({ browser }) => {
  test.skip(
    !process.env.E2E_MEMBER_EMAIL || !process.env.E2E_MEMBER_PASSWORD,
    'Requires Administrator E2E credentials.',
  );
  const administrator = await prisma.member.findFirstOrThrow({
    where: {
      email: { equals: process.env.E2E_MEMBER_EMAIL!, mode: 'insensitive' },
    },
  });
  expect(administrator.workspaceRole).toBe('ADMINISTRATOR');
  departmentId = administrator.departmentId;
  for (let i = 0; i < 3; i++)
    authFixtures.push(await createAuthFixture(prisma, `${runId}-${i}`));
  for (let i = 0; i < 4; i++)
    contexts.push(
      await browser.newContext({
        baseURL: `http://127.0.0.1:${process.env.E2E_WEB_PORT ?? '5173'}`,
      }),
    );
  [admin, lead, worker, newcomer] = await Promise.all(
    contexts.map((context) => context.newPage()),
  );
  for (const page of [admin, lead, worker, newcomer])
    page.on('pageerror', (error) => browserErrors.push(error.message));
});
test.afterAll(async () => {
  // A stopped Playwright worker may have already closed its browser contexts.
  // Still clean up the database fixtures after a failed serial test.
  await Promise.allSettled(contexts.map((context) => context.close()));
  if (projectId) {
    await prisma.outcomeDependency.deleteMany({
      where: { outcome: { stage: { projectId } } },
    });
    await prisma.project.delete({ where: { id: projectId } });
  }
  if (memberIds.length)
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
  for (const fixture of authFixtures) await deleteAuthFixture(prisma, fixture);
  await prisma.$disconnect();
});

test('Core 01: Administrator authorizes three isolated members through Registry', async () => {
  await signIn(
    admin,
    process.env.E2E_MEMBER_EMAIL!,
    process.env.E2E_MEMBER_PASSWORD!,
  );
  for (const [index, fixture] of authFixtures.entries()) {
    const response = await api(admin, '/registry/members', 'POST', {
      fullName: `Core ${['Lead', 'Worker', 'Newcomer'][index]} ${runId}`,
      email: fixture.email,
      departmentId,
      position: 'E2E tester',
      workspaceRole: 'MEMBER',
      status: 'INVITED',
    });
    expect(response.status).toBe(201);
    memberIds.push(RegistryMemberSchema.parse(response.body).id);
  }
});

test('Core 02: members sign in through Supabase and workspace membership is linked', async () => {
  await Promise.all(
    [lead, worker, newcomer].map((page, index) =>
      signIn(page, authFixtures[index].email, authFixtures[index].password),
    ),
  );
  const members = await prisma.member.findMany({
    where: { id: { in: memberIds } },
  });
  expect(
    members.every((member) => member.status === 'ACTIVE' && member.authUserId),
  ).toBe(true);
  expect((await api(worker, '/registry/members')).status).toBe(403);
});

test('Core 03: Member creates a Project and assigns themselves Lead', async () => {
  await lead.goto('/projects');
  await lead
    .getByRole('button', { name: '+ Add Project', exact: true })
    .click();
  const dialog = lead.getByRole('dialog', { name: 'Add Project' });
  await dialog.getByLabel('Project name').fill(`Prometheus Core ${runId}`);
  await dialog
    .getByLabel('Description')
    .fill('Complete authenticated delivery workflow.');
  await dialog.getByLabel('Project Lead').selectOption(memberIds[0]);
  await dialog.locator(`input[value="${departmentId}"]`).check();
  const response = lead.waitForResponse(
    (response) =>
      response.url().endsWith('/api/projects') &&
      response.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Create Project', exact: true })
    .click();
  projectId = ProjectSchema.parse(await (await response).json()).id;
});

test('Core 04: Lead creates Stage and Outcome through the workflow UI', async () => {
  await lead.goto(`/projects/${projectId}`);
  await lead.getByRole('button', { name: '+ Add Stage', exact: true }).click();
  await lead.getByLabel('Stage name').fill('Core Delivery');
  const stageResponse = lead.waitForResponse(
    (response) =>
      response.url().endsWith(`/projects/${projectId}/stages`) &&
      response.request().method() === 'POST',
  );
  await lead.getByRole('button', { name: 'Create stage', exact: true }).click();
  stageId = StageSchema.parse(await (await stageResponse).json()).id;
  await lead
    .getByRole('button', { name: '+ Add Outcome', exact: true })
    .click();
  const dialog = lead.getByRole('dialog', { name: 'Add project outcome' });
  await dialog.getByLabel('Outcome title').fill('Core evidence delivered');
  await dialog.locator(`input[value="${departmentId}"]`).check();
  await dialog
    .getByLabel('Acceptance criterion 1', { exact: true })
    .fill('The revised evidence meets the objective.');
  const response = lead.waitForResponse(
    (response) =>
      response.url().endsWith(`/stages/${stageId}/outcomes`) &&
      response.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Create outcome', exact: true })
    .click();
  outcomeId = OutcomeSchema.parse(await (await response).json()).id;
});

test('Core 05: another Member joins Outcome and creates a Feature', async () => {
  await open(worker);
  const joining = worker.waitForResponse(
    (response) =>
      response.url().endsWith(`/outcomes/${outcomeId}/join`) &&
      response.request().method() === 'POST',
  );
  await worker.getByRole('button', { name: '+ Join outcome', exact: true }).click();
  expect((await joining).status()).toBe(201);
  await expect(
    worker.getByText('✓ Joined outcome', { exact: true }),
  ).toBeVisible();
  await expect(worker).toHaveURL(new RegExp(`/projects/${projectId}/outcomes/${outcomeId}$`));
  await worker
    .getByRole('button', { name: 'Add a feature to this outcome', exact: true })
    .click();
  await worker
    .getByLabel('Feature title', { exact: true })
    .fill('Evidence package');
  const response = worker.waitForResponse(
    (response) =>
      response.url().endsWith('/work/features') &&
      response.request().method() === 'POST',
  );
  await worker
    .getByRole('button', { name: 'Add feature', exact: true })
    .click();
  expect((await response).status()).toBe(201);
});

test('Core 06: Outcome Member creates and completes a Task', async () => {
  await worker
    .getByLabel('Add a task to Evidence package', { exact: true })
    .fill('Document evidence');
  const created = worker.waitForResponse(
    (response) =>
      response.url().endsWith('/tasks') &&
      response.url().includes('/work/features/') &&
      response.request().method() === 'POST',
  );
  await worker.getByRole('button', { name: 'Add task', exact: true }).click();
  expect((await created).status()).toBe(201);

  const checkbox = worker.getByRole('checkbox', {
    name: 'Complete Document evidence',
  });
  await expect(checkbox).toBeVisible();
  const updated = worker.waitForResponse(
    (response) =>
      response.url().endsWith('/state') &&
      response.request().method() === 'PATCH',
  );
  // Completion is persisted asynchronously; .check() expects the controlled
  // checkbox to remain checked immediately after the click.
  await checkbox.click();
  expect((await updated).status()).toBe(200);
  await expect(checkbox).toBeChecked();
  await expect(
    worker.getByRole('progressbar', { name: 'Work progress' }),
  ).toHaveAttribute('aria-valuenow', '100');
});

test('Core 07: Member submits Output and Lead requests revision', async () => {
  await worker
    .getByLabel('Output content', { exact: true })
    .fill('Initial core evidence');
  const submitted = worker.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/submissions') &&
      response.request().method() === 'POST',
  );
  await worker
    .getByRole('button', { name: 'Submit for review', exact: true })
    .click();
  expect((await submitted).status()).toBe(201);
  await open(lead);
  await lead
    .getByRole('button', { name: 'Review outcome', exact: true })
    .click();
  await lead
    .getByLabel('Outcome review feedback')
    .fill('Include independent validation.');
  const revision = lead.waitForResponse(
    (response) =>
      response.url().endsWith('/request-revision') &&
      response.request().method() === 'POST',
  );
  await lead
    .getByRole('button', { name: 'Request revision', exact: true })
    .click();
  expect((await revision).status()).toBe(201);
});

test('Core 08 F5-23: another Member joins during revision and contributes to shared pending review', async () => {
  expect((await api(newcomer, `${base()}/join`, 'POST')).status).toBe(201);
  expect((await submit(newcomer, 'Independent validation')).status).toBe(201);
  expect((await delivery(newcomer)).lifecycleStatus).toBe('NEEDS_REVISION');
});

test('Core 08b F5-07: two authenticated Outcome Members create concurrent tasks without lost work', async () => {
  const feature = await prisma.feature.findFirstOrThrow({
    where: { outcomeId },
  });
  const results = await Promise.all(
    [worker, newcomer].map((page, index) =>
      api(page, `${base()}/work/features/${feature.id}/tasks`, 'POST', {
        title: `Concurrent member work ${index}`,
      }),
    ),
  );
  expect(results.map((result) => result.status)).toEqual([201, 201]);
  expect(await prisma.task.count({ where: { featureId: feature.id } })).toBe(3);
});

test('Core 09 F5-14: original Member resubmits while another submission remains under review', async () => {
  await open(worker);
  await expect(
    worker.getByText('Include independent validation.', { exact: true }),
  ).toBeVisible();
  await worker
    .getByLabel('Output content', { exact: true })
    .fill('Revised core evidence');
  const response = worker.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/submissions') &&
      response.request().method() === 'POST',
  );
  await worker
    .getByRole('button', { name: 'Submit for review', exact: true })
    .click();
  expect((await response).status()).toBe(201);
  const pending = await prisma.outcomeSubmission.findMany({
    where: { outcomeId, reviewStatus: 'FOR_REVIEW' },
  });
  expect(pending.map((item) => item.submittedByMemberId).sort()).toEqual(
    [memberIds[1], memberIds[2]].sort(),
  );
});

test('Core 10a: Lead verifies combined work and saves review preparation', async () => {
  await open(lead);
  await lead
    .getByRole('button', { name: 'Review outcome', exact: true })
    .click();
  const dialog = lead.getByRole('dialog', { name: 'Review Outcome' });
  await expect(
    dialog.getByText('Revised core evidence', { exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByText('Independent validation', { exact: true }),
  ).toBeVisible();
  const draft = lead.waitForResponse(
    (response) =>
      response.url().endsWith('/review-draft') &&
      response.request().method() === 'PUT',
  );
  await dialog
    .getByRole('checkbox', {
      name: 'The revised evidence meets the objective.',
    })
    .check();
  expect((await draft).status()).toBe(200);
  await dialog.getByRole('button', { name: 'Close Review Outcome' }).click();
});

test('Core 10b: saved review preparation survives reload and Lead accepts Outcome', async () => {
  await open(lead);
  await lead
    .getByRole('button', { name: 'Review outcome', exact: true })
    .click();
  const dialog = lead.getByRole('dialog', { name: 'Review Outcome' });
  await expect(
    dialog.getByRole('checkbox', {
      name: 'The revised evidence meets the objective.',
    }),
  ).toBeChecked();
  await lead.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toBeVisible();
  expect(
    await lead.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await lead.screenshot({ path: 'test-results/phase5-review-mobile.png' });
  await lead.setViewportSize({ width: 1440, height: 1000 });
  await lead.screenshot({ path: 'test-results/phase5-review-desktop.png' });
  const accepted = lead.waitForResponse(
    (response) =>
      response.url().endsWith('/delivery/accept') &&
      response.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Accept Outcome', exact: true })
    .click();
  expect((await accepted).status()).toBe(201);
});

test('Core 11: accepted state survives direct navigation and grants every current Outcome Member credit', async () => {
  await open(worker);
  await expect(
    worker.getByRole('region', { name: 'Review history' }),
  ).toBeVisible();
  await expect(
    worker.getByRole('button', { name: 'Submit for review' }),
  ).toHaveCount(0);
  const acceptance = await prisma.outcomeAcceptance.findFirstOrThrow({
    where: { outcomeId },
    include: { members: true },
  });
  expect(acceptance.members.map((item) => item.memberId).sort()).toEqual(
    [memberIds[1], memberIds[2]].sort(),
  );
  expect((await api(lead, `${base()}/join`, 'POST')).status).toBe(409);
  expect((await submit(worker, 'Closed')).status).toBe(409);
  expect(browserErrors).toEqual([]);
});

test('Core 12 F5-35 F5-36: Lead configures a dependent Outcome and a Member joins while locked', async () => {
  const source = await api(
    lead,
    `/projects/${projectId}/stages/${stageId}/outcomes`,
    'POST',
    {
      title: 'Direct acceptance source',
      description: '',
      departmentIds: [departmentId],
      acceptanceCriteria: ['Ready to proceed'],
      prerequisiteOutcomeIds: [],
    },
  );
  expect(source.status).toBe(201);
  directId = OutcomeSchema.parse(source.body).id;
  const dependent = await api(
    lead,
    `/projects/${projectId}/stages/${stageId}/outcomes`,
    'POST',
    {
      title: 'Dependent work',
      description: '',
      departmentIds: [departmentId],
      acceptanceCriteria: ['Dependent work complete'],
      prerequisiteOutcomeIds: [directId],
    },
  );
  expect(dependent.status).toBe(201);
  dependentId = OutcomeSchema.parse(dependent.body).id;
  expect((await api(worker, `${base(dependentId)}/join`, 'POST')).status).toBe(
    201,
  );
  const state = await delivery(worker, dependentId);
  expect(state.canSubmit).toBe(false);
  expect((await submit(worker, 'Blocked output', dependentId)).status).toBe(
    409,
  );
});

test('Core 13 F5-38: direct acceptance without revision unlocks the dependent Outcome', async () => {
  expect((await api(worker, `${base(directId)}/join`, 'POST')).status).toBe(
    201,
  );
  expect((await submit(worker, 'Direct evidence', directId)).status).toBe(201);
  expect((await accept(lead, directId)).status).toBe(201);
  expect((await delivery(worker, dependentId)).canSubmit).toBe(true);
});

test('Core 14 F5-39: dependency unlock persists; reopening prerequisite relocks unfinished work', async () => {
  await open(worker, dependentId);
  await expect(
    worker.getByRole('button', { name: 'Submit for review' }),
  ).toBeEnabled();
  const state = await delivery(lead, directId);
  expect(
    (
      await api(lead, `${base(directId)}/delivery/reopen`, 'POST', {
        outcomeUpdatedAt: state.outcomeUpdatedAt,
      })
    ).status,
  ).toBe(201);
  expect((await submit(worker, 'Blocked again', dependentId)).status).toBe(409);
});

test('Core 15 F5-40: Lead overrides only the selected dependency; non-Lead cannot override', async () => {
  const state = await delivery(lead, dependentId);
  const path = `${base(dependentId)}/delivery/dependencies/${state.dependencies[0].id}/override`;
  expect(
    (await api(newcomer, path, 'POST', { reason: 'Not the Lead' })).status,
  ).toBe(403);
  await open(lead, dependentId);
  await lead
    .getByRole('button', { name: 'Skip dependency', exact: true })
    .click();
  const dialog = lead.getByRole('dialog', { name: 'Skip dependency' });
  await dialog
    .getByLabel('Reason for override', { exact: true })
    .fill('Independent evidence makes this prerequisite unnecessary.');
  const response = lead.waitForResponse(
    (response) =>
      response.url().endsWith('/override') &&
      response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Confirm skip dependency' }).click();
  expect((await response).status()).toBe(201);
  expect(
    (await prisma.outcome.findUniqueOrThrow({ where: { id: directId } }))
      .lifecycleStatus,
  ).toBe('OPEN');
});

test('Core 16: unchanged dependencies preserve overrides and dependency cycles are denied', async () => {
  const updated = await api(lead, base(dependentId), 'PATCH', {
    title: 'Dependent work updated',
    description: '',
    departmentIds: [departmentId],
    acceptanceCriteria: ['Dependent work complete'],
    prerequisiteOutcomeIds: [directId],
  });
  expect(updated.status).toBe(200);
  expect(OutcomeSchema.parse(updated.body).isLocked).toBe(false);
  expect(
    (
      await api(lead, base(directId), 'PATCH', {
        title: 'Cycle',
        description: '',
        departmentIds: [departmentId],
        acceptanceCriteria: ['Ready'],
        prerequisiteOutcomeIds: [dependentId],
      })
    ).status,
  ).toBe(400);
});

test('Core 17 F5-32: Lead joins after reopening; later acceptance snapshots the expanded membership', async () => {
  const data = await delivery(lead);
  expect(
    (
      await api(lead, `${base()}/delivery/reopen`, 'POST', {
        outcomeUpdatedAt: data.outcomeUpdatedAt,
      })
    ).status,
  ).toBe(201);
  expect((await api(lead, `${base()}/join`, 'POST')).status).toBe(201);
  expect((await accept(lead)).status).toBe(201);
  const acceptances = await prisma.outcomeAcceptance.findMany({
    where: { outcomeId },
    include: { members: true },
    orderBy: { acceptedAt: 'asc' },
  });
  expect(acceptances.map((item) => item.members.length)).toEqual([2, 3]);
  expect(browserErrors).toEqual([]);
});

test('Core 18: stale combined review is rejected when another Member submits', async () => {
  expect(
    (await submit(worker, 'First dependent evidence', dependentId)).status,
  ).toBe(201);
  const state = await delivery(lead, dependentId);
  expect(
    (await submit(worker, 'Additional evidence', dependentId)).status,
  ).toBe(201);
  expect(
    (
      await api(lead, `${base(dependentId)}/delivery/accept`, 'POST', {
        criterionIds: state.criteria.map((item) => item.id),
        submissionIds: state.submissions.map((item) => item.id),
        outcomeUpdatedAt: state.outcomeUpdatedAt,
        note: '',
      })
    ).status,
  ).toBe(409);
  expect((await delivery(lead, dependentId)).lifecycleStatus).toBe('OPEN');
});

test('Core 18b: background history refresh preserves an unsaved output', async () => {
  await open(worker, dependentId);
  await worker
    .getByLabel('Output content', { exact: true })
    .fill('Unsaved local evidence');
  expect(
    (await submit(worker, 'Another window contribution', dependentId)).status,
  ).toBe(201);
  await worker
    .getByRole('button', { name: 'Add a feature to this outcome', exact: true })
    .click();
  await worker
    .getByLabel('Feature title', { exact: true })
    .fill('Refresh evidence');
  const refreshed = worker.waitForResponse(
    (response) =>
      response.url().endsWith(`${base(dependentId)}/delivery`) &&
      response.request().method() === 'GET',
  );
  await worker
    .getByRole('button', { name: 'Add feature', exact: true })
    .click();
  expect((await refreshed).status()).toBe(200);
  await expect(
    worker.getByLabel('Output content', { exact: true }),
  ).toHaveValue('Unsaved local evidence');
});

test('Core 19: only Lead explicitly resolves revision without accepting', async () => {
  const state = await delivery(lead, dependentId);
  expect(
    (
      await api(
        lead,
        `${base(dependentId)}/delivery/request-revision`,
        'POST',
        {
          criterionIds: [],
          submissionIds: state.submissions.map((item) => item.id),
          outcomeUpdatedAt: state.outcomeUpdatedAt,
          note: 'Clarify the evidence.',
        },
      )
    ).status,
  ).toBe(201);
  const revision = await delivery(lead, dependentId);
  const body = { outcomeUpdatedAt: revision.outcomeUpdatedAt };
  expect(
    (
      await api(
        worker,
        `${base(dependentId)}/delivery/resolve-revision`,
        'POST',
        body,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await api(
        lead,
        `${base(dependentId)}/delivery/resolve-revision`,
        'POST',
        body,
      )
    ).status,
  ).toBe(201);
  const resolved = await delivery(worker, dependentId);
  expect(resolved.lifecycleStatus).toBe('OPEN');
  expect(resolved.revisions[0].resolvedAt).not.toBeNull();
  expect(resolved.acceptances).toHaveLength(0);
});

test('Core 20: acceptance and a simultaneous new join produce consistent credit', async () => {
  const [decision, join] = await Promise.all([
    accept(lead, dependentId),
    api(newcomer, `${base(dependentId)}/join`, 'POST'),
  ]);
  expect(decision.status).toBe(201);
  expect([201, 409]).toContain(join.status);
  const state = await delivery(lead, dependentId);
  const members = await prisma.outcomeMember.findMany({
    where: { outcomeId: dependentId },
  });
  expect(state.acceptances[0].members.map((item) => item.id).sort()).toEqual(
    members.map((item) => item.memberId).sort(),
  );
  expect(
    state.acceptances[0].members.some((item) => item.id === memberIds[2]),
  ).toBe(join.status === 201);
});

test('Core 21: create a non-overridden dependent after direct prerequisite acceptance', async () => {
  expect((await accept(lead, directId)).status).toBe(201);
  const result = await api(
    lead,
    `/projects/${projectId}/stages/${stageId}/outcomes`,
    'POST',
    {
      title: 'Previously accepted dependent',
      departmentIds: [departmentId],
      acceptanceCriteria: ['Delivered'],
      prerequisiteOutcomeIds: [directId],
    },
  );
  expect(result.status).toBe(201);
  protectedDependentId = OutcomeSchema.parse(result.body).id;
  expect(
    (await api(worker, `${base(protectedDependentId)}/join`, 'POST')).status,
  ).toBe(201);
});

test('Core 22: accept the dependent while its prerequisite is resolved', async () => {
  expect(
    (await submit(worker, 'Completed dependent work', protectedDependentId))
      .status,
  ).toBe(201);
  expect((await accept(lead, protectedDependentId)).status).toBe(201);
});

test('Core 23: reopening a prerequisite preserves an accepted dependent until that dependent is reopened', async () => {
  const source = await delivery(lead, directId);
  expect(
    (
      await api(lead, `${base(directId)}/delivery/reopen`, 'POST', {
        outcomeUpdatedAt: source.outcomeUpdatedAt,
      })
    ).status,
  ).toBe(201);
  const accepted = OutcomeSchema.parse(
    (await api(worker, base(protectedDependentId))).body,
  );
  expect(accepted.lifecycleStatus).toBe('ACCEPTED');
  expect(accepted.isLocked).toBe(false);
  expect(
    (
      await api(lead, `${base(protectedDependentId)}/delivery/reopen`, 'POST', {
        outcomeUpdatedAt: accepted.updatedAt,
      })
    ).status,
  ).toBe(201);
  expect(
    OutcomeSchema.parse((await api(worker, base(protectedDependentId))).body)
      .isLocked,
  ).toBe(true);
  expect(
    (await delivery(worker, protectedDependentId)).acceptances,
  ).toHaveLength(1);
  expect(browserErrors).toEqual([]);
});

test('Core 24: submission loading failure is visible and retry restores shared history', async () => {
  await worker.route(
    `**/api${base()}/delivery`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Temporary delivery failure' }),
      }),
    { times: 1 },
  );
  await worker.goto(base());
  await expect(
    worker.getByText('Submissions could not be loaded.'),
  ).toBeVisible();
  await worker.getByRole('button', { name: 'Retry submissions' }).click();
  await expect(
    worker.getByRole('heading', { name: 'Accepted Outcome', exact: true }),
  ).toBeVisible();
  await expect(
    worker.getByRole('button', { name: /v3.*Revised core evidence/ }),
  ).toBeVisible();
});

test('Core 25: Project and Stage progress derive from current acceptance and decrease on reopening', async () => {
  await worker.goto(`/projects/${projectId}`);
  const progress = worker.getByRole('progressbar', {
    name: 'Project acceptance progress',
    exact: true,
  });
  await expect(progress).toHaveAttribute('value', '2');
  await expect(progress).toHaveAttribute('max', '4');
  const current = await delivery(lead);
  expect(
    (
      await api(lead, `${base()}/delivery/reopen`, 'POST', {
        outcomeUpdatedAt: current.outcomeUpdatedAt,
      })
    ).status,
  ).toBe(201);
  await worker.reload();
  await expect(progress).toHaveAttribute('value', '1');
  await expect(
    worker.getByRole('progressbar', {
      name: 'Core Delivery acceptance progress',
      exact: true,
    }),
  ).toHaveAttribute('value', '1');
  expect(
    (await prisma.project.findUniqueOrThrow({ where: { id: projectId } }))
      .status,
  ).toBe('PLANNING');
  expect(browserErrors).toEqual([]);
});
