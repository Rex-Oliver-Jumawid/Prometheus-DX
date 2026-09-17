import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';

const prisma = new PrismaClient();
const hasCredentials = Boolean(
  process.env.E2E_MEMBER_EMAIL && process.env.E2E_MEMBER_PASSWORD,
);
const runId = `phase4-slice3-${Date.now()}`;
let currentMemberId = '';
let alternateLeadId = '';
let departmentId = '';
let participatingProjectId = '';
let creatorOnlyProjectId = '';
let leadingProjectId = '';
let openOutcomeId = '';
let secondOutcomeId = '';
let lockedOutcomeId = '';
let needsRevisionOutcomeId = '';
let acceptedOutcomeId = '';
let leadingOutcomeId = '';

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Company email').fill(process.env.E2E_MEMBER_EMAIL!);
  await page
    .getByLabel('Password', { exact: true })
    .fill(process.env.E2E_MEMBER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login$/, { timeout: 15_000 });
}

async function apiRequest(page: Page, path: string, method: 'POST' | 'DELETE') {
  return page.evaluate(
    async ({ requestPath, requestMethod }) => {
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
        headers: session.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    },
    { requestPath: path, requestMethod: method },
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
  const department = await prisma.department.create({
    data: { name: `${runId} Membership`, shortLabel: 'P4MEM' },
  });
  departmentId = department.id;
  const alternateLead = await prisma.member.create({
    data: {
      email: `${runId}@example.com`,
      fullName: 'Phase Four Membership Lead',
      departmentId,
      status: 'ACTIVE',
      workspaceRole: 'MEMBER',
    },
  });
  alternateLeadId = alternateLead.id;

  const participatingProject = await prisma.project.create({
    data: {
      name: `Participating Project ${runId}`,
      description: 'Outcome Membership participation fixture.',
      createdByMemberId: alternateLead.id,
      leadMemberId: alternateLead.id,
      departments: { create: { departmentId } },
      stages: {
        create: {
          name: 'Membership Stage',
          position: 0,
          outcomes: {
            create: [
              {
                title: 'Open Outcome',
                position: 0,
                createdByMemberId: alternateLead.id,
                departments: { create: { departmentId } },
                acceptanceCriteria: {
                  create: { description: 'Open result exists.', position: 0 },
                },
              },
              {
                title: 'Second Outcome',
                position: 1,
                createdByMemberId: alternateLead.id,
                departments: { create: { departmentId } },
                acceptanceCriteria: {
                  create: { description: 'Second result exists.', position: 0 },
                },
              },
              {
                title: 'Locked Outcome',
                position: 2,
                createdByMemberId: alternateLead.id,
                departments: { create: { departmentId } },
                acceptanceCriteria: {
                  create: { description: 'Locked result exists.', position: 0 },
                },
              },
              {
                title: 'Needs Revision Outcome',
                lifecycleStatus: 'NEEDS_REVISION',
                position: 3,
                createdByMemberId: alternateLead.id,
                departments: { create: { departmentId } },
                acceptanceCriteria: {
                  create: {
                    description: 'Revision result exists.',
                    position: 0,
                  },
                },
              },
              {
                title: 'Accepted Outcome',
                lifecycleStatus: 'ACCEPTED',
                acceptedAt: new Date(),
                position: 4,
                createdByMemberId: alternateLead.id,
                departments: { create: { departmentId } },
                acceptanceCriteria: {
                  create: {
                    description: 'Accepted result exists.',
                    position: 0,
                  },
                },
              },
            ],
          },
        },
      },
    },
    include: { stages: { include: { outcomes: true } } },
  });
  participatingProjectId = participatingProject.id;
  const outcomes = participatingProject.stages[0].outcomes;
  openOutcomeId = outcomes.find(({ title }) => title === 'Open Outcome')!.id;
  secondOutcomeId = outcomes.find(
    ({ title }) => title === 'Second Outcome',
  )!.id;
  lockedOutcomeId = outcomes.find(
    ({ title }) => title === 'Locked Outcome',
  )!.id;
  needsRevisionOutcomeId = outcomes.find(
    ({ title }) => title === 'Needs Revision Outcome',
  )!.id;
  acceptedOutcomeId = outcomes.find(
    ({ title }) => title === 'Accepted Outcome',
  )!.id;
  await prisma.outcomeDependency.create({
    data: {
      outcomeId: lockedOutcomeId,
      prerequisiteOutcomeId: acceptedOutcomeId,
    },
  });
  await prisma.outcome.update({
    where: { id: acceptedOutcomeId },
    data: { lifecycleStatus: 'OPEN', acceptedAt: null },
  });

  const creatorOnlyProject = await prisma.project.create({
    data: {
      name: `Creator Only Project ${runId}`,
      description: 'Creation alone is not participation.',
      createdByMemberId: currentMember.id,
      leadMemberId: alternateLead.id,
      departments: { create: { departmentId } },
    },
  });
  creatorOnlyProjectId = creatorOnlyProject.id;

  const leadingProject = await prisma.project.create({
    data: {
      name: `Leading Membership Project ${runId}`,
      description: 'A Lead may join without duplicate Participating grouping.',
      createdByMemberId: currentMember.id,
      leadMemberId: currentMember.id,
      departments: { create: { departmentId } },
      stages: {
        create: {
          name: 'Lead Stage',
          position: 0,
          outcomes: {
            create: {
              title: 'Lead Joined Outcome',
              position: 0,
              createdByMemberId: currentMember.id,
              departments: { create: { departmentId } },
              acceptanceCriteria: {
                create: { description: 'Lead result exists.', position: 0 },
              },
            },
          },
        },
      },
    },
    include: { stages: { include: { outcomes: true } } },
  });
  leadingProjectId = leadingProject.id;
  leadingOutcomeId = leadingProject.stages[0].outcomes[0].id;
});

test.afterAll(async () => {
  const projectIds = [
    participatingProjectId,
    creatorOnlyProjectId,
    leadingProjectId,
  ].filter(Boolean);
  if (projectIds.length) {
    await prisma.outcomeDependency.deleteMany({
      where: {
        OR: [
          { outcome: { stage: { projectId: { in: projectIds } } } },
          {
            prerequisiteOutcome: {
              stage: { projectId: { in: projectIds } },
            },
          },
        ],
      },
    });
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

test('F4-14 F4-15 F4-23 F4-24: joining an open Outcome persists and derives CAN_VIEW Project Membership', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  const workflowResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/projects/${participatingProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.goto(
    `/projects/${participatingProjectId}/outcomes/${openOutcomeId}`,
  );
  expect((await workflowResponse).status()).toBe(200);
  await expect(
    page.getByRole('button', { name: '+ Join Outcome' }),
  ).toBeVisible();
  const joinResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(
          `/api/projects/${participatingProjectId}/outcomes/${openOutcomeId}/join`,
        ) && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '+ Join Outcome' }).click();
  expect((await joinResponse).status()).toBe(201);
  await expect(page.getByText('✓ Joined Outcome')).toBeVisible();
  await expect(page.getByRole('button', { name: /leave/i })).toHaveCount(0);
  expect(
    await prisma.outcomeMember.count({
      where: { outcomeId: openOutcomeId, memberId: currentMemberId },
    }),
  ).toBe(1);
  await expect(
    prisma.projectMember.findUnique({
      where: {
        projectId_memberId: {
          projectId: participatingProjectId,
          memberId: currentMemberId,
        },
      },
    }),
  ).resolves.toMatchObject({ accessLevel: 'CAN_VIEW' });
  const reloadResponse = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/projects/${participatingProjectId}/workflow`) &&
      response.request().method() === 'GET',
  );
  await page.reload();
  expect((await reloadResponse).status()).toBe(200);
  await expect(page.getByText('✓ Joined Outcome')).toBeVisible();
});

test('F4-16 F4-17 F4-18 F4-19 F4-27: repeated and eligible-state joins remain idempotent', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  expect(
    (
      await apiRequest(
        page,
        `/projects/${participatingProjectId}/outcomes/${openOutcomeId}/join`,
        'POST',
      )
    ).status,
  ).toBe(201);
  expect(
    (
      await apiRequest(
        page,
        `/projects/${participatingProjectId}/outcomes/${lockedOutcomeId}/join`,
        'POST',
      )
    ).status,
  ).toBe(201);
  expect(
    (
      await apiRequest(
        page,
        `/projects/${participatingProjectId}/outcomes/${needsRevisionOutcomeId}/join`,
        'POST',
      )
    ).status,
  ).toBe(201);
  expect(
    (
      await apiRequest(
        page,
        `/projects/${participatingProjectId}/outcomes/${secondOutcomeId}/join`,
        'POST',
      )
    ).status,
  ).toBe(201);
  expect(
    await prisma.outcomeMember.count({
      where: { outcomeId: openOutcomeId, memberId: currentMemberId },
    }),
  ).toBe(1);
  expect(
    await prisma.projectMember.count({
      where: { projectId: participatingProjectId, memberId: currentMemberId },
    }),
  ).toBe(1);
});

test('F4-20 F4-21 F4-22: accepted joining and all Outcome Membership removal are denied', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await prisma.outcome.update({
    where: { id: acceptedOutcomeId },
    data: { lifecycleStatus: 'ACCEPTED', acceptedAt: new Date() },
  });
  await signIn(page);
  const deniedJoin = await apiRequest(
    page,
    `/projects/${participatingProjectId}/outcomes/${acceptedOutcomeId}/join`,
    'POST',
  );
  expect(deniedJoin.status).toBe(409);
  expect(
    await prisma.outcomeMember.count({
      where: { outcomeId: acceptedOutcomeId, memberId: currentMemberId },
    }),
  ).toBe(0);

  await prisma.project.update({
    where: { id: participatingProjectId },
    data: { leadMemberId: currentMemberId },
  });
  const deniedRemoval = await apiRequest(
    page,
    `/projects/${participatingProjectId}/outcomes/${openOutcomeId}/members/${currentMemberId}`,
    'DELETE',
  );
  expect(deniedRemoval.status).toBe(403);
  expect(
    await prisma.outcomeMember.count({
      where: { outcomeId: openOutcomeId, memberId: currentMemberId },
    }),
  ).toBe(1);
  await prisma.project.update({
    where: { id: participatingProjectId },
    data: { leadMemberId: alternateLeadId },
  });
});

test('F4-25: Participating derives from membership and excludes creator-only Projects', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  await page.goto('/projects');
  await page.getByRole('tab', { name: 'My Projects' }).click();
  await expect(
    page.getByRole('heading', { name: `Participating Project ${runId}` }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: `Creator Only Project ${runId}` }),
  ).toHaveCount(0);
});

test('F4-26: a Lead who joins remains identified as Lead in My Projects', async ({
  page,
}) => {
  test.skip(!hasCredentials, 'Requires E2E member credentials.');
  await signIn(page);
  expect(
    (
      await apiRequest(
        page,
        `/projects/${leadingProjectId}/outcomes/${leadingOutcomeId}/join`,
        'POST',
      )
    ).status,
  ).toBe(201);
  await page.goto('/projects');
  await page.getByRole('tab', { name: 'My Projects' }).click();
  const projectCard = page.locator('.vw-overview-project').filter({
    has: page.getByRole('heading', {
      name: `Leading Membership Project ${runId}`,
    }),
  });
  await expect(projectCard).toBeVisible();
  await expect(projectCard.getByText('Lead', { exact: true })).toBeVisible();
  await expect(projectCard.getByText('Member', { exact: true })).toHaveCount(0);
});
