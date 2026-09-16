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
  if (projectId) {
    await prisma.project.delete({ where: { id: projectId } });
  }
  if (alternateLeadId) {
    await prisma.member.delete({ where: { id: alternateLeadId } });
  }
  if (departmentId) {
    await prisma.department.delete({ where: { id: departmentId } });
  }
  await prisma.$disconnect();
});

test('F4-28 F4-29 F4-30 F4-31: Lead grants and revokes persisted Project Member access', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto(`/projects/${projectId}`);
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
  await page.reload();
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
  expect(
    await prisma.projectMemberAccessHistory.count({
      where: { projectId, memberId: alternateLeadId },
    }),
  ).toBe(2);

  const currentMember = await prisma.member.findUniqueOrThrow({
    where: { id: currentMemberId },
  });
  const currentAccess = page.getByLabel(
    `Project access for ${currentMember.fullName}`,
  );
  const selfGrantResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${projectId}/members/${currentMemberId}/access`,
        ) && response.request().method() === 'PATCH',
  );
  await currentAccess.selectOption('CAN_EDIT');
  expect((await selfGrantResponse).status()).toBe(200);
  await expect(currentAccess).toHaveValue('CAN_EDIT');
});

test('F4-32 F4-33 F4-35 F4-36: CAN_EDIT changes status but cannot exercise Lead-only authority', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
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
});

test('F4-34: CAN_VIEW Project Member cannot change Project status', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await prisma.projectMember.update({
    where: {
      projectId_memberId: { projectId, memberId: currentMemberId },
    },
    data: { accessLevel: 'CAN_VIEW' },
  });
  await prisma.member.update({
    where: { id: currentMemberId },
    data: { workspaceRole: originalWorkspaceRole },
  });
  await signIn(page);
  await page.goto(`/projects/${projectId}`);
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
