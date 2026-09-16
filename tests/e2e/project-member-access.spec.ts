import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const runId = `phase4-slice4-${Date.now()}`;
let currentMemberId = '';
let originalWorkspaceRole: 'ADMINISTRATOR' | 'MEMBER' = 'MEMBER';
let alternateLeadId = '';
let departmentId = '';
let projectId = '';
let stageId = '';
let mainFlowProjectId = '';

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
  const department = await prisma.department.create({
    data: { name: `${runId} Access`, shortLabel: 'P4ACC' },
  });
  departmentId = department.id;
  const alternateLead = await prisma.member.create({
    data: {
      email: `${runId}@example.com`,
      fullName: 'Phase Four Access Member',
      departmentId,
      status: 'ACTIVE',
      workspaceRole: 'MEMBER',
    },
  });
  alternateLeadId = alternateLead.id;
  const project = await prisma.project.create({
    data: {
      name: `Access Project ${runId}`,
      description: 'Focused Phase 4 Project Member access acceptance.',
      createdByMemberId: alternateLead.id,
      leadMemberId: currentMember.id,
      departments: { create: { departmentId } },
      stages: {
        create: {
          name: 'Access Stage',
          position: 0,
          outcomes: {
            create: {
              title: 'Access Outcome',
              position: 0,
              createdByMemberId: currentMember.id,
              departments: { create: { departmentId } },
              acceptanceCriteria: {
                create: { description: 'Access is verified.', position: 0 },
              },
              members: {
                create: [
                  { memberId: currentMember.id },
                  { memberId: alternateLead.id },
                ],
              },
            },
          },
        },
      },
      members: {
        create: [
          { memberId: currentMember.id, accessLevel: 'CAN_VIEW' },
          { memberId: alternateLead.id, accessLevel: 'CAN_VIEW' },
        ],
      },
    },
    include: { stages: true },
  });
  projectId = project.id;
  stageId = project.stages[0].id;
});

test.afterAll(async () => {
  if (currentMemberId) {
    await prisma.member.update({
      where: { id: currentMemberId },
      data: { workspaceRole: originalWorkspaceRole },
    });
  }
  const projectIds = [projectId, mainFlowProjectId].filter(Boolean);
  if (projectIds.length) {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (alternateLeadId) {
    await prisma.member.delete({ where: { id: alternateLeadId } });
  }
  if (departmentId) {
    await prisma.department.delete({ where: { id: departmentId } });
  }
  await prisma.$disconnect();
});

test('F4-28 F4-29: Lead grants and revokes persisted Project Member access', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  test.slow();
  await signIn(page);
  const workflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  const membersResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/members`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/projects/${projectId}`);
  expect((await workflowResponse).status()).toBe(200);
  expect((await membersResponse).status()).toBe(200);
  await expect(
    page.getByRole('heading', { name: 'Project Members' }),
  ).toBeVisible();
  const alternateAccess = page.getByLabel(
    'Project access for Phase Four Access Member',
  );
  await expect(alternateAccess).toHaveValue('CAN_VIEW');
  const grantResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${projectId}/members/${alternateLeadId}/access`,
        ) && response.request().method() === 'PATCH',
  );
  await alternateAccess.selectOption('CAN_EDIT');
  expect((await grantResponse).status()).toBe(200);
  await expect(alternateAccess).toHaveValue('CAN_EDIT');
  const persistedWorkflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  const persistedMembersResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/members`) &&
      response.request().method() === 'GET',
  );
  await page.reload();
  expect((await persistedWorkflowResponse).status()).toBe(200);
  expect((await persistedMembersResponse).status()).toBe(200);
  await expect(
    page.getByLabel('Project access for Phase Four Access Member'),
  ).toHaveValue('CAN_EDIT');

  const revokeResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${projectId}/members/${alternateLeadId}/access`,
        ) && response.request().method() === 'PATCH',
  );
  await page
    .getByLabel('Project access for Phase Four Access Member')
    .selectOption('CAN_VIEW');
  expect((await revokeResponse).status()).toBe(200);
  await expect(
    page.getByLabel('Project access for Phase Four Access Member'),
  ).toHaveValue('CAN_VIEW');
  await expect(
    prisma.projectMemberAccessHistory.findMany({
      where: { projectId, memberId: alternateLeadId },
      orderBy: { createdAt: 'asc' },
    }),
  ).resolves.toEqual([
    expect.objectContaining({
      previousAccess: 'CAN_VIEW',
      newAccess: 'CAN_EDIT',
      changedByMemberId: currentMemberId,
    }),
    expect.objectContaining({
      previousAccess: 'CAN_EDIT',
      newAccess: 'CAN_VIEW',
      changedByMemberId: currentMemberId,
    }),
  ]);
});

test('F4-30 F4-32 F4-33 F4-34 F4-35 F4-36: CAN_EDIT changes status but cannot exercise Lead-only authority', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await prisma.projectMember.update({
    where: {
      projectId_memberId: { projectId, memberId: currentMemberId },
    },
    data: { accessLevel: 'CAN_EDIT' },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { leadMemberId: alternateLeadId },
  });
  await signIn(page);
  await page.goto(`/projects/${projectId}`);
  await expect(page.getByLabel('Project status')).toBeVisible();
  const statusResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/status`) &&
      response.request().method() === 'PATCH',
  );
  await page.getByLabel('Project status').selectOption('IN_PROGRESS');
  expect((await statusResponse).status()).toBe(200);
  await expect(page.getByLabel('Project status')).toHaveValue('IN_PROGRESS');
  expect(
    await prisma.projectStatusHistory.count({
      where: {
        projectId,
        changedByMemberId: currentMemberId,
        toStatus: 'IN_PROGRESS',
      },
    }),
  ).toBe(1);

  await expect(page.getByRole('button', { name: '+ Add Stage' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Edit Stage Access Stage' }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: '+ Add Outcome' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Edit Outcome Access Outcome' }),
  ).toHaveCount(0);
  await expect(page.locator('.project-member-access select')).toHaveCount(0);

  expect(
    (
      await authenticatedApi(page, `/projects/${projectId}/stages`, 'POST', {
        name: 'Forbidden Stage',
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${projectId}/stages/${stageId}/outcomes`,
        'POST',
        {
          title: 'Forbidden Outcome',
          description: null,
          departmentIds: [departmentId],
          acceptanceCriteria: ['Must not be created.'],
          prerequisiteOutcomeIds: [],
        },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${projectId}/members/${currentMemberId}/access`,
        'PATCH',
        { accessLevel: 'CAN_VIEW' },
      )
    ).status,
  ).toBe(403);

  await prisma.member.update({
    where: { id: currentMemberId },
    data: { workspaceRole: 'ADMINISTRATOR' },
  });
  await prisma.projectMember.update({
    where: {
      projectId_memberId: { projectId, memberId: currentMemberId },
    },
    data: { accessLevel: 'CAN_VIEW' },
  });
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${projectId}/members/${currentMemberId}/access`,
        'PATCH',
        { accessLevel: 'CAN_EDIT' },
      )
    ).status,
  ).toBe(403);
  await expect(
    prisma.projectMember.findUnique({
      where: {
        projectId_memberId: { projectId, memberId: currentMemberId },
      },
    }),
  ).resolves.toMatchObject({ accessLevel: 'CAN_VIEW' });
});

test('F4-31: CAN_VIEW Project Member cannot change Project status', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await prisma.projectMember.update({
    where: {
      projectId_memberId: { projectId, memberId: currentMemberId },
    },
    data: { accessLevel: 'CAN_VIEW' },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { leadMemberId: alternateLeadId, status: 'IN_PROGRESS' },
  });
  await prisma.member.update({
    where: { id: currentMemberId },
    data: { workspaceRole: originalWorkspaceRole },
  });
  await signIn(page);
  const workflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  const membersResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${projectId}/members`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/projects/${projectId}`);
  expect((await workflowResponse).status()).toBe(200);
  expect((await membersResponse).status()).toBe(200);
  await expect(page.getByLabel('Project status')).toHaveCount(0);
  expect(
    (
      await authenticatedApi(page, `/projects/${projectId}/status`, 'PATCH', {
        status: 'DONE',
      })
    ).status,
  ).toBe(403);
  await expect(
    page.getByText('CAN_VIEW', { exact: true }).first(),
  ).toBeVisible();
  expect(
    await prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
  ).toMatchObject({ status: 'IN_PROGRESS' });
});

test('Phase 4 main E2E flow: Lead builds workflow, Member joins, Lead grants CAN_EDIT, and Lead-only authority stays isolated', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  test.slow();
  const currentMember = await prisma.member.findUniqueOrThrow({
    where: { id: currentMemberId },
  });
  const project = await prisma.project.create({
    data: {
      name: `Main Flow Project ${runId}`,
      description: 'Canonical Phase 4 end-to-end acceptance flow.',
      createdByMemberId: alternateLeadId,
      leadMemberId: currentMemberId,
      departments: { create: { departmentId } },
    },
  });
  mainFlowProjectId = project.id;

  await signIn(page);
  const initialWorkflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${mainFlowProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.goto(`/projects/${mainFlowProjectId}`);
  expect((await initialWorkflowResponse).status()).toBe(200);
  await page.getByRole('button', { name: '+ Add Stage' }).click();
  await page.getByLabel('Stage name').fill('Main Flow Stage');
  await page.getByRole('button', { name: 'Create stage' }).click();
  await expect(
    page.getByRole('heading', { name: 'Main Flow Stage' }),
  ).toBeVisible();
  const mainStage = await prisma.stage.findFirstOrThrow({
    where: { projectId: mainFlowProjectId, name: 'Main Flow Stage' },
  });

  const stage = page.locator('.workflow-stage').filter({
    has: page.getByRole('heading', { name: 'Main Flow Stage' }),
  });
  await stage.getByRole('button', { name: '+ Add Outcome' }).click();
  const outcomeDialog = page.getByRole('dialog', {
    name: 'Add project outcome',
  });
  await outcomeDialog.getByLabel('Outcome title').fill('Main Flow Outcome');
  await outcomeDialog.locator(`input[value="${departmentId}"]`).check();
  await outcomeDialog
    .getByRole('textbox', { name: 'Acceptance criterion 1', exact: true })
    .fill('The complete Phase 4 authority flow is verified.');
  await outcomeDialog.getByRole('button', { name: 'Create outcome' }).click();
  await expect(
    page.getByRole('heading', { name: 'Main Flow Outcome' }),
  ).toBeVisible();
  const mainOutcome = await prisma.outcome.findFirstOrThrow({
    where: { stageId: mainStage.id, title: 'Main Flow Outcome' },
  });

  await prisma.project.update({
    where: { id: mainFlowProjectId },
    data: { leadMemberId: alternateLeadId },
  });
  await page.goto(`/projects/${mainFlowProjectId}/outcomes/${mainOutcome.id}`);
  const joinResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${mainFlowProjectId}/outcomes/${mainOutcome.id}/join`,
        ) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '+ Join Outcome' }).click();
  expect((await joinResponse).status()).toBe(201);
  await expect(
    prisma.projectMember.findUnique({
      where: {
        projectId_memberId: {
          projectId: mainFlowProjectId,
          memberId: currentMemberId,
        },
      },
    }),
  ).resolves.toMatchObject({ accessLevel: 'CAN_VIEW' });

  await page.goto(`/projects/${mainFlowProjectId}`);
  await expect(page.getByLabel('Project status')).toHaveCount(0);
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${mainFlowProjectId}/status`,
        'PATCH',
        { status: 'IN_PROGRESS' },
      )
    ).status,
  ).toBe(403);

  await prisma.project.update({
    where: { id: mainFlowProjectId },
    data: { leadMemberId: currentMemberId },
  });
  const leadWorkflowResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${mainFlowProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  const leadMembersResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${mainFlowProjectId}/members`) &&
      response.request().method() === 'GET',
  );
  await page.reload();
  expect((await leadWorkflowResponse).status()).toBe(200);
  expect((await leadMembersResponse).status()).toBe(200);
  const accessControl = page.getByLabel(
    `Project access for ${currentMember.fullName}`,
  );
  await expect(accessControl).toHaveValue('CAN_VIEW');
  const accessResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${mainFlowProjectId}/members/${currentMemberId}/access`,
        ) && response.request().method() === 'PATCH',
  );
  await accessControl.selectOption('CAN_EDIT');
  expect((await accessResponse).status()).toBe(200);
  await expect(
    prisma.projectMemberAccessHistory.findFirst({
      where: {
        projectId: mainFlowProjectId,
        memberId: currentMemberId,
        previousAccess: 'CAN_VIEW',
        newAccess: 'CAN_EDIT',
        changedByMemberId: currentMemberId,
      },
    }),
  ).resolves.not.toBeNull();

  await prisma.project.update({
    where: { id: mainFlowProjectId },
    data: { leadMemberId: alternateLeadId },
  });
  await page.reload();
  const statusResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/projects/${mainFlowProjectId}/status`) &&
      response.request().method() === 'PATCH',
  );
  await page.getByLabel('Project status').selectOption('IN_PROGRESS');
  expect((await statusResponse).status()).toBe(200);
  await expect(page.getByLabel('Project status')).toHaveValue('IN_PROGRESS');
  await expect(page.getByRole('button', { name: '+ Add Stage' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('button', { name: '+ Add Outcome' })).toHaveCount(
    0,
  );
  await expect(page.locator('.project-member-access select')).toHaveCount(0);
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${mainFlowProjectId}/stages`,
        'POST',
        { name: 'Forbidden Main Flow Stage' },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${mainFlowProjectId}/stages/${mainStage.id}/outcomes`,
        'POST',
        {
          title: 'Forbidden Main Flow Outcome',
          description: null,
          departmentIds: [departmentId],
          acceptanceCriteria: ['This mutation must remain forbidden.'],
          prerequisiteOutcomeIds: [],
        },
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await authenticatedApi(
        page,
        `/projects/${mainFlowProjectId}/members/${currentMemberId}/access`,
        'PATCH',
        { accessLevel: 'CAN_VIEW' },
      )
    ).status,
  ).toBe(403);
});
