import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { HomeService } from './home.service';

const MEMBER_ID = '11111111-1111-4111-8111-111111111111';
const LEAD_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
const PARTICIPATING_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const OUTCOME_ID = '44444444-4444-4444-8444-444444444444';
const REVISION_OUTCOME_ID = '55555555-5555-4555-8555-555555555555';
const DEPARTMENT_ID = '66666666-6666-4666-8666-666666666666';

function project(
  overrides: Partial<{
    id: string;
    name: string;
    status: 'PLANNING' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED';
    leadId: string;
    isParticipating: boolean;
    accessLevel: 'CAN_VIEW' | 'CAN_EDIT' | null;
    progress: number;
  }> = {},
) {
  const leadId =
    overrides.leadId ?? '77777777-7777-4777-8777-777777777777';
  return {
    id: overrides.id ?? LEAD_PROJECT_ID,
    name: overrides.name ?? 'Project',
    description: 'Project description',
    status: overrides.status ?? 'IN_PROGRESS',
    lead: { id: leadId, fullName: 'Lead', email: 'lead@example.com' },
    creator: { id: leadId, fullName: 'Lead', email: 'lead@example.com' },
    departments: [],
    isParticipating: overrides.isParticipating ?? false,
    currentMemberAccess: overrides.accessLevel ?? null,
    canChangeStatus: leadId === MEMBER_ID,
    doneAt: null,
    archivedAt: null,
    createdAt: '2026-09-20T00:00:00.000Z',
    updatedAt: '2026-09-20T00:00:00.000Z',
    metrics: {
      totalOutcomes: 4,
      openOutcomes: 2,
      acceptedOutcomes: 2,
      activeStagesCount: 1,
      activeStages: [],
      progressPercentage: overrides.progress ?? 50,
    },
  };
}

function fixture() {
  const prisma = {
    memberSchedule: {
      findUnique: vi.fn().mockResolvedValue({ targetWeeklyMinutes: 1_020 }),
    },
    workSession: {
      findMany: vi.fn().mockResolvedValue([
        {
          timeIn: new Date('2026-09-22T01:00:00.000Z'),
          member: {
            id: MEMBER_ID,
            fullName: 'Rex Jumawid',
            department: {
              id: DEPARTMENT_ID,
              name: 'X Team',
              shortLabel: 'X Team',
            },
          },
        },
      ]),
    },
    outcome: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce([
          {
            id: OUTCOME_ID,
            title: 'Approved application UI/UX',
            updatedAt: new Date('2026-09-22T03:00:00.000Z'),
            stage: {
              name: 'Experience Design',
              project: { id: LEAD_PROJECT_ID, name: 'Client System' },
            },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: REVISION_OUTCOME_ID,
            title: 'Delivery polish',
            stage: {
              name: 'Launch',
              project: {
                id: PARTICIPATING_PROJECT_ID,
                name: 'Onboarding',
              },
            },
            revisionRequests: [
              {
                id: '88888888-8888-4888-8888-888888888888',
                message: 'Tighten the empty state.',
                createdAt: new Date('2026-09-22T04:00:00.000Z'),
              },
            ],
          },
        ]),
    },
  };

  const projectsService = {
    listProjects: vi.fn().mockResolvedValue([
      project({
        id: LEAD_PROJECT_ID,
        name: 'Leading project',
        leadId: MEMBER_ID,
        progress: 65,
      }),
      project({
        id: PARTICIPATING_PROJECT_ID,
        name: 'Participating project',
        isParticipating: true,
        accessLevel: 'CAN_EDIT',
        progress: 25,
      }),
      project({
        id: '99999999-9999-4999-8999-999999999999',
        name: 'Company-visible only',
      }),
    ]),
  };

  const workSessionsService = {
    refreshStaleSessions: vi.fn().mockResolvedValue(undefined),
    getHistory: vi.fn().mockResolvedValue({
      totalDurationSeconds: 66_960,
    }),
  };

  return {
    prisma,
    projectsService,
    workSessionsService,
    service: new HomeService(
      prisma as never,
      projectsService as never,
      workSessionsService as never,
    ),
  };
}

describe('HomeService', () => {
  it('separates led and participating projects and calculates real summary values', async () => {
    const { service } = fixture();
    const result = await service.getDashboard({ id: MEMBER_ID } as Member);

    expect(result.projects.leading).toEqual([
      expect.objectContaining({
        id: LEAD_PROJECT_ID,
        relationship: 'LEAD',
        progressPercentage: 65,
      }),
    ]);
    expect(result.projects.participating).toEqual([
      expect.objectContaining({
        id: PARTICIPATING_PROJECT_ID,
        relationship: 'PARTICIPANT',
        accessLevel: 'CAN_EDIT',
      }),
    ]);
    expect(result.summary).toMatchObject({
      workingNow: 1,
      activeProjects: 3,
      totalProjects: 3,
      awaitingReview: 1,
      revisionRequests: 1,
      actualWorkedSeconds: 66_960,
      plannedMinutes: 1_020,
    });
  });

  it('queries only review work led by the current member and revisions assigned to their outcomes', async () => {
    const { service, prisma } = fixture();
    const result = await service.getDashboard({ id: MEMBER_ID } as Member);

    expect(prisma.outcome.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          stage: { project: { leadMemberId: MEMBER_ID } },
          submissions: { some: { reviewStatus: 'FOR_REVIEW' } },
        }),
      }),
    );
    expect(prisma.outcome.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          lifecycleStatus: 'NEEDS_REVISION',
          members: { some: { memberId: MEMBER_ID } },
          revisionRequests: { some: { resolvedAt: null } },
        }),
      }),
    );
    expect(result.needsAttention.map((item) => item.kind)).toEqual([
      'REVISION',
      'REVIEW',
    ]);
  });
});
