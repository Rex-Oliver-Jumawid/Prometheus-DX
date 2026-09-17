import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const runId = `phase4-slice2-${Date.now()}`;
let currentMemberId = '';
let originalWorkspaceRole: 'ADMINISTRATOR' | 'MEMBER' = 'MEMBER';
let alternateLeadId = '';
let firstDepartmentId = '';
let secondDepartmentId = '';
let leadProjectId = '';
let nonLeadProjectId = '';
let firstStageId = '';
let firstOutcomeId = '';
let dependentOutcomeId = '';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

async function authenticatedApi(
  page: Page,
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown,
) {
  return page.evaluate(
    async ({ requestPath, requestMethod, requestBody }) => {
      const storageKey = Object.keys(localStorage).find(
        (key) => key.startsWith('sb-') && key.endsWith('-auth-token'),
      );
      const session = storageKey
        ? (JSON.parse(localStorage.getItem(storageKey) ?? '{}') as {
            access_token?: string;
          })
        : {};
      const response = await fetch(`/api${requestPath}`, {
        method: requestMethod,
        headers: {
          'Content-Type': 'application/json',
          ...(session.access_token
            ? { Authorization: `Bearer ${session.access_token}` }
            : {}),
        },
        body: JSON.stringify(requestBody),
      });
      return { status: response.status, body: await response.json() };
    },
    { requestPath: path, requestMethod: method, requestBody: body },
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const currentMember = await prisma.member.findFirstOrThrow({
    where: {
      email: {
        equals: process.env.E2E_MEMBER_EMAIL!,
        mode: 'insensitive',
      },
    },
  });
  currentMemberId = currentMember.id;
  originalWorkspaceRole = currentMember.workspaceRole;
  const firstDepartment = await prisma.department.create({
    data: { name: `${runId} Research`, shortLabel: 'P4RES' },
  });
  const secondDepartment = await prisma.department.create({
    data: { name: `${runId} Design`, shortLabel: 'P4DES' },
  });
  firstDepartmentId = firstDepartment.id;
  secondDepartmentId = secondDepartment.id;
  const alternateLead = await prisma.member.create({
    data: {
      email: `${runId}@example.com`,
      fullName: 'Phase Four Alternate Lead',
      departmentId: firstDepartment.id,
      status: 'ACTIVE',
      workspaceRole: 'MEMBER',
    },
  });
  alternateLeadId = alternateLead.id;
  const leadProject = await prisma.project.create({
    data: {
      name: `Workflow Project ${runId}`,
      description: 'Focused Phase 4 Stage and Outcome browser acceptance.',
      createdByMemberId: alternateLead.id,
      leadMemberId: currentMember.id,
      departments: {
        create: [
          { departmentId: firstDepartment.id },
          { departmentId: secondDepartment.id },
        ],
      },
    },
  });
  leadProjectId = leadProject.id;
  const nonLeadProject = await prisma.project.create({
    data: {
      name: `Non Lead Workflow ${runId}`,
      description: 'Creator and Administrator authority regression fixture.',
      createdByMemberId: currentMember.id,
      leadMemberId: alternateLead.id,
      departments: { create: { departmentId: firstDepartment.id } },
    },
  });
  nonLeadProjectId = nonLeadProject.id;
});

test.afterAll(async () => {
  if (currentMemberId) {
    await prisma.member.update({
      where: { id: currentMemberId },
      data: { workspaceRole: originalWorkspaceRole },
    });
  }
  if (leadProjectId || nonLeadProjectId) {
    await prisma.outcomeDependency.deleteMany({
      where: {
        OR: [
          {
            outcome: {
              stage: {
                projectId: {
                  in: [leadProjectId, nonLeadProjectId].filter(Boolean),
                },
              },
            },
          },
          {
            prerequisiteOutcome: {
              stage: {
                projectId: {
                  in: [leadProjectId, nonLeadProjectId].filter(Boolean),
                },
              },
            },
          },
        ],
      },
    });
    await prisma.project.deleteMany({
      where: { id: { in: [leadProjectId, nonLeadProjectId].filter(Boolean) } },
    });
  }
  if (alternateLeadId) {
    await prisma.member.delete({ where: { id: alternateLeadId } });
  }
  if (firstDepartmentId || secondDepartmentId) {
    await prisma.department.deleteMany({
      where: {
        id: { in: [firstDepartmentId, secondDepartmentId].filter(Boolean) },
      },
    });
  }
  await prisma.$disconnect();
});

test('F4-01 F4-02 F4-03 F4-06: Lead creates and edits a persistent Stage with guarded submission', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await signIn(page);
  await page.goto(`/projects/${leadProjectId}`);
  await expect(
    page.getByRole('heading', {
      name: `Workflow Project ${runId}`,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Stages and Outcomes' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '+ Add Stage' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Add project stage' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Create stage' }).click();
  await expect(page.getByText('Enter a stage name.')).toBeVisible();
  await page.getByLabel('Stage name').fill('Discovery');
  const stageResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${leadProjectId}/stages`) &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Create stage' }).dblclick();
  expect((await stageResponse).status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Discovery' })).toBeVisible();
  expect(
    await prisma.stage.count({
      where: { projectId: leadProjectId, name: 'Discovery' },
    }),
  ).toBe(1);
  const stage = await prisma.stage.findFirstOrThrow({
    where: { projectId: leadProjectId, name: 'Discovery' },
  });
  firstStageId = stage.id;
  await page.getByRole('button', { name: 'Edit Stage Discovery' }).click();
  await page.getByLabel('Stage name').fill('Market Learning');
  await page.getByRole('button', { name: 'Save stage' }).click();
  await expect(
    page.getByRole('heading', { name: 'Market Learning' }),
  ).toBeVisible();
  expect(consoleErrors).toEqual([]);
});

test('F4-03 refresh persistence: edited Stage reloads from PostgreSQL', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto(`/projects/${leadProjectId}`);
  await expect(
    page.getByRole('heading', { name: 'Market Learning' }),
  ).toBeVisible();
});

test('F4-07 through F4-10: Lead creates, links, and edits persistent Outcomes', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto(`/projects/${leadProjectId}`);
  const stage = page.locator('.workflow-stage').filter({
    has: page.getByRole('heading', { name: 'Market Learning' }),
  });
  await stage.getByRole('button', { name: '+ Add Outcome' }).click();
  const createDialog = page.getByRole('dialog', {
    name: 'Add project outcome',
  });
  await expect(createDialog).toBeVisible();
  await createDialog.getByRole('button', { name: 'Create outcome' }).click();
  await expect(
    createDialog.getByText('Choose at least one responsible department.'),
  ).toBeVisible();
  await createDialog
    .getByLabel('Outcome title')
    .fill('Customer evidence collected');
  await createDialog
    .getByLabel('Outcome description Optional')
    .fill('Interview evidence confirms the opportunity.');
  await createDialog.locator(`input[value="${firstDepartmentId}"]`).check();
  await createDialog
    .getByRole('textbox', { name: 'Acceptance criterion 1', exact: true })
    .fill('Five interviews are documented.');
  await createDialog.getByRole('button', { name: '+ Add criterion' }).click();
  await createDialog
    .getByRole('textbox', { name: 'Acceptance criterion 2', exact: true })
    .fill('The customer problem is summarized.');
  await createDialog.getByRole('button', { name: 'Create outcome' }).click();
  await expect(
    page.getByRole('heading', { name: 'Customer evidence collected' }),
  ).toBeVisible();
  const firstOutcome = await prisma.outcome.findFirstOrThrow({
    where: { stageId: firstStageId, title: 'Customer evidence collected' },
    include: { departments: true, acceptanceCriteria: true },
  });
  firstOutcomeId = firstOutcome.id;
  expect(
    firstOutcome.departments.map(({ departmentId }) => departmentId),
  ).toEqual([firstDepartmentId]);
  expect(
    firstOutcome.acceptanceCriteria.map(({ description }) => description),
  ).toEqual([
    'Five interviews are documented.',
    'The customer problem is summarized.',
  ]);

  await stage.getByRole('button', { name: '+ Add Outcome' }).click();
  const dependentDialog = page.getByRole('dialog', {
    name: 'Add project outcome',
  });
  await dependentDialog
    .getByLabel('Outcome title')
    .fill('Opportunity decision');
  await dependentDialog
    .getByLabel('Outcome description Optional')
    .fill('Decide whether to proceed with the opportunity.');
  await dependentDialog.locator(`input[value="${secondDepartmentId}"]`).check();
  await dependentDialog
    .getByRole('textbox', { name: 'Acceptance criterion 1', exact: true })
    .fill('A decision is recorded.');
  await dependentDialog
    .getByRole('checkbox', { name: 'Customer evidence collected' })
    .check();
  await dependentDialog.getByRole('button', { name: 'Create outcome' }).click();
  await expect(
    page.getByRole('heading', { name: 'Opportunity decision' }),
  ).toBeVisible();
  const dependent = await prisma.outcome.findFirstOrThrow({
    where: { stageId: firstStageId, title: 'Opportunity decision' },
    include: { prerequisites: true },
  });
  dependentOutcomeId = dependent.id;
  expect(dependent.prerequisites).toHaveLength(1);
  expect(dependent.prerequisites[0].prerequisiteOutcomeId).toBe(firstOutcomeId);

  await page
    .getByRole('button', { name: 'Edit Outcome Opportunity decision' })
    .click();
  const editDialog = page.getByRole('dialog', { name: 'Edit project outcome' });
  await editDialog
    .getByLabel('Outcome title')
    .fill('Opportunity decision approved');
  const editResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${leadProjectId}/outcomes/${dependentOutcomeId}`,
        ) && response.request().method() === 'PATCH',
  );
  await editDialog.getByRole('button', { name: 'Save outcome' }).click();
  expect((await editResponse).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Opportunity decision approved' }),
  ).toBeVisible();
});

test('F4-13: direct Outcome route persists across reload and browser history', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  const initialWorkflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${leadProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/projects/${leadProjectId}/outcomes/${dependentOutcomeId}`);
  expect((await initialWorkflowResponse).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Opportunity decision approved' }),
  ).toBeVisible();
  await expect(
    page.getByText('Customer evidence collected - Waiting'),
  ).toBeVisible();
  const reloadWorkflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${leadProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.reload();
  expect((await reloadWorkflowResponse).status()).toBe(200);
  await expect(page).toHaveURL(
    `/projects/${leadProjectId}/outcomes/${dependentOutcomeId}`,
  );
  await expect(
    page.getByRole('heading', { name: 'Opportunity decision approved' }),
  ).toBeVisible();
  await page.goBack();
  const forwardWorkflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${leadProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.goForward();
  expect((await forwardWorkflowResponse).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Opportunity decision approved' }),
  ).toBeVisible();
});

test('F4-04 F4-05 F4-11 F4-12: viewer, creator, and Admin non-Lead cannot mutate workflow', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await prisma.member.update({
    where: { id: currentMemberId },
    data: { workspaceRole: 'MEMBER' },
  });
  await signIn(page);
  await page.goto(`/projects/${nonLeadProjectId}`);
  await expect(page.getByRole('button', { name: '+ Add Stage' })).toHaveCount(
    0,
  );
  const deniedStage = await authenticatedApi(
    page,
    `/projects/${nonLeadProjectId}/stages`,
    'POST',
    { name: 'Forbidden Stage' },
  );
  expect(deniedStage.status).toBe(403);

  const fixtureStage = await prisma.stage.create({
    data: { projectId: nonLeadProjectId, name: 'Lead Stage', position: 0 },
  });
  const deniedOutcome = await authenticatedApi(
    page,
    `/projects/${nonLeadProjectId}/stages/${fixtureStage.id}/outcomes`,
    'POST',
    {
      title: 'Forbidden Outcome',
      departmentIds: [firstDepartmentId],
      acceptanceCriteria: ['Should never persist.'],
      prerequisiteOutcomeIds: [],
    },
  );
  expect(deniedOutcome.status).toBe(403);

  await prisma.member.update({
    where: { id: currentMemberId },
    data: { workspaceRole: 'ADMINISTRATOR' },
  });
  const deniedAdminStage = await authenticatedApi(
    page,
    `/projects/${nonLeadProjectId}/stages`,
    'POST',
    { name: 'Admin Forbidden Stage' },
  );
  expect(deniedAdminStage.status).toBe(403);
  const deniedAdminOutcome = await authenticatedApi(
    page,
    `/projects/${nonLeadProjectId}/stages/${fixtureStage.id}/outcomes`,
    'POST',
    {
      title: 'Admin Forbidden Outcome',
      departmentIds: [firstDepartmentId],
      acceptanceCriteria: ['Should never persist.'],
      prerequisiteOutcomeIds: [],
    },
  );
  expect(deniedAdminOutcome.status).toBe(403);
  expect(
    await prisma.outcome.count({
      where: { stage: { projectId: nonLeadProjectId } },
    }),
  ).toBe(0);
});

test('Project Workspace remains usable without horizontal overflow at a narrow viewport', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await prisma.member.update({
    where: { id: currentMemberId },
    data: { workspaceRole: originalWorkspaceRole },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  const workflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${leadProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/projects/${leadProjectId}`);
  expect((await workflowResponse).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Stages and Outcomes' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
