import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MemberStatus, WorkspaceRole, type Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ProjectWorkflowService } from './project-workflow.service';

const projectId = '11111111-1111-4111-8111-111111111111';
const otherProjectId = '22222222-2222-4222-8222-222222222222';
const stageId = '33333333-3333-4333-8333-333333333333';
const outcomeId = '44444444-4444-4444-8444-444444444444';
const prerequisiteId = '55555555-5555-4555-8555-555555555555';
const departmentId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-09-16T00:00:00.000Z');

const lead = {
  id: '77777777-7777-4777-8777-777777777777',
  email: 'lead@example.com',
  fullName: 'Project Lead',
  workspaceRole: WorkspaceRole.MEMBER,
  status: MemberStatus.ACTIVE,
} as Member;

const member = {
  ...lead,
  id: '88888888-8888-4888-8888-888888888888',
  email: 'member@example.com',
  fullName: 'Ordinary Member',
} as Member;

const department = {
  id: departmentId,
  name: 'Research and Development',
  shortLabel: 'R&D',
};

function outcomeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: outcomeId,
    stageId,
    title: 'Validated opportunity',
    description: 'Confirm demand.',
    lifecycleStatus: 'OPEN' as const,
    position: 0,
    createdAt: now,
    updatedAt: now,
    departments: [{ department }],
    acceptanceCriteria: [
      {
        id: '99999999-9999-4999-8999-999999999999',
        description: 'Interview evidence exists.',
        position: 0,
      },
    ],
    prerequisites: [],
    _count: { submissions: 0 },
    members: [],
    ...overrides,
  };
}

function stageRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: stageId,
    projectId,
    name: 'Discovery',
    description: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    outcomes: [],
    ...overrides,
  };
}

function createDatabase(
  options: {
    leadMemberId?: string;
    projectExists?: boolean;
    stageProjectId?: string | null;
    outcomeProjectId?: string | null;
    prerequisiteProjectId?: string;
    departmentsFound?: boolean;
    outcomeLifecycleStatus?: 'OPEN' | 'NEEDS_REVISION' | 'ACCEPTED';
    membershipProjectId?: string | null;
    projectAccessLevel?: 'CAN_VIEW' | 'CAN_EDIT';
    projectMemberExists?: boolean;
  } = {},
) {
  const projectExists = options.projectExists ?? true;
  let projectAccessLevel = options.projectAccessLevel ?? 'CAN_VIEW';
  const database = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    project: {
      findUnique: vi
        .fn()
        .mockImplementation((query: { select?: { stages?: unknown } }) =>
          Promise.resolve(
            projectExists
              ? query.select?.stages
                ? {
                    id: projectId,
                    leadMemberId: options.leadMemberId ?? lead.id,
                    stages: [stageRecord()],
                  }
                : { leadMemberId: options.leadMemberId ?? lead.id }
              : null,
          ),
        ),
    },
    stage: {
      findUnique: vi
        .fn()
        .mockResolvedValue(
          options.stageProjectId === null
            ? null
            : { projectId: options.stageProjectId ?? projectId },
        ),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(stageRecord()),
      update: vi.fn().mockResolvedValue(stageRecord({ name: 'Research' })),
    },
    department: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          options.departmentsFound === false ? [] : [{ id: departmentId }],
        ),
    },
    outcome: {
      findMany: vi
        .fn()
        .mockImplementation((query: { where: { id: { in: string[] } } }) =>
          Promise.resolve(
            query.where.id.in.map((id) => ({
              id,
              stage: { projectId: options.prerequisiteProjectId ?? projectId },
            })),
          ),
        ),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(
        options.outcomeProjectId === null
          ? null
          : {
              ...outcomeRecord(),
              lifecycleStatus: options.outcomeLifecycleStatus ?? 'OPEN',
              stage: { projectId: options.outcomeProjectId ?? projectId },
            },
      ),
      findUniqueOrThrow: vi.fn().mockResolvedValue(
        outcomeRecord({
          lifecycleStatus: options.outcomeLifecycleStatus ?? 'OPEN',
          members: [
            {
              memberId: member.id,
              joinedAt: now,
              member: {
                id: member.id,
                fullName: member.fullName,
                email: member.email,
              },
            },
          ],
        }),
      ),
      create: vi.fn().mockResolvedValue(outcomeRecord()),
      update: vi
        .fn()
        .mockResolvedValue(outcomeRecord({ title: 'Updated outcome' })),
    },
    outcomeDependency: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    acceptanceCriterion: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    outcomeDepartment: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    outcomeMember: {
      upsert: vi.fn().mockResolvedValue({ outcomeId, memberId: member.id }),
      findUnique: vi.fn().mockResolvedValue(
        options.membershipProjectId === null
          ? null
          : {
              outcome: {
                stage: {
                  projectId: options.membershipProjectId ?? projectId,
                },
              },
            },
      ),
    },
    projectMember: {
      upsert: vi.fn().mockResolvedValue({
        projectId,
        memberId: member.id,
        accessLevel: 'CAN_VIEW',
      }),
      findMany: vi.fn().mockImplementation(() =>
        Promise.resolve(
          options.projectMemberExists === false
            ? []
            : [
                {
                  memberId: member.id,
                  accessLevel: projectAccessLevel,
                  createdAt: now,
                  member: {
                    id: member.id,
                    fullName: member.fullName,
                    email: member.email,
                    outcomeMemberships: [
                      {
                        outcome: {
                          id: outcomeId,
                          title: 'Validated opportunity',
                        },
                      },
                    ],
                  },
                },
              ],
        ),
      ),
      findUnique: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            options.projectMemberExists === false
              ? null
              : { accessLevel: projectAccessLevel },
          ),
        ),
      update: vi
        .fn()
        .mockImplementation(
          ({ data }: { data: { accessLevel: 'CAN_VIEW' | 'CAN_EDIT' } }) => {
            projectAccessLevel = data.accessLevel;
            return Promise.resolve({
              projectId,
              memberId: member.id,
              accessLevel: projectAccessLevel,
            });
          },
        ),
    },
    projectMemberAccessHistory: {
      create: vi
        .fn()
        .mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
    },
  };
  const transaction = vi.fn(
    async (operation: (client: typeof database) => unknown) =>
      operation(database),
  );
  return { ...database, $transaction: transaction } as unknown as PrismaService;
}

const outcomeInput = {
  title: 'Validated opportunity',
  description: 'Confirm demand.',
  departmentIds: [departmentId],
  acceptanceCriteria: ['Interview evidence exists.'],
  prerequisiteOutcomeIds: [prerequisiteId],
};

describe('ProjectWorkflowService', () => {
  it('lists deterministic workflow structure for any active viewer', async () => {
    const service = new ProjectWorkflowService(createDatabase());

    await expect(service.getWorkflow(member, projectId)).resolves.toMatchObject(
      {
        projectId,
        canManageStructure: false,
        stages: [{ id: stageId, name: 'Discovery' }],
      },
    );
  });

  it('returns a controlled error for an absent Project workflow', async () => {
    const service = new ProjectWorkflowService(
      createDatabase({ projectExists: false }),
    );

    await expect(service.getWorkflow(member, projectId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('allows only the assigned Lead to create and edit an ordered Stage', async () => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.createStage(lead, projectId, { name: 'Discovery' }),
    ).resolves.toMatchObject({ name: 'Discovery', position: 0 });
    expect(database.stage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId,
          name: 'Discovery',
          position: 0,
        }),
      }),
    );
    await expect(
      service.updateStage(lead, projectId, stageId, { name: 'Research' }),
    ).resolves.toMatchObject({ name: 'Research' });
  });

  it.each([
    ['unrelated Member', member],
    [
      'Administrator who is not Lead',
      { ...member, workspaceRole: WorkspaceRole.ADMINISTRATOR } as Member,
    ],
    [
      'creator who is not Lead',
      { ...member, fullName: 'Project Creator' } as Member,
    ],
  ])('denies Stage mutation to an %s', async (_label, actor) => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.createStage(actor, projectId, { name: 'Forbidden Stage' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.stage.create).not.toHaveBeenCalled();
  });

  it('rejects a Stage from a different Project', async () => {
    const database = createDatabase({ stageProjectId: otherProjectId });
    const service = new ProjectWorkflowService(database);

    await expect(
      service.updateStage(lead, projectId, stageId, { name: 'Research' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(database.stage.update).not.toHaveBeenCalled();
  });

  it('creates an Outcome with Departments, criteria, and same-Project prerequisites', async () => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.createOutcome(lead, projectId, stageId, outcomeInput),
    ).resolves.toMatchObject({
      id: outcomeId,
      title: outcomeInput.title,
      departments: [department],
      acceptanceCriteria: [{ description: outcomeInput.acceptanceCriteria[0] }],
    });
    expect(database.outcome.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stageId,
          createdByMemberId: lead.id,
          departments: { create: [{ departmentId }] },
          acceptanceCriteria: {
            create: [
              { description: 'Interview evidence exists.', position: 0 },
            ],
          },
          prerequisites: {
            create: [{ prerequisiteOutcomeId: prerequisiteId }],
          },
        }),
      }),
    );
  });

  it('updates Outcome metadata through replacement of canonical child sets', async () => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.updateOutcome(lead, projectId, outcomeId, {
        ...outcomeInput,
        title: 'Updated outcome',
      }),
    ).resolves.toMatchObject({ title: 'Updated outcome' });
    expect(database.outcome.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Updated outcome',
          departments: expect.objectContaining({ create: [{ departmentId }] }),
          acceptanceCriteria: expect.objectContaining({
            create: [
              { description: 'Interview evidence exists.', position: 0 },
            ],
          }),
          prerequisites: expect.objectContaining({
            connectOrCreate: [
              {
                where: {
                  outcomeId_prerequisiteOutcomeId: {
                    outcomeId,
                    prerequisiteOutcomeId: prerequisiteId,
                  },
                },
                create: { prerequisiteOutcomeId: prerequisiteId },
              },
            ],
          }),
        }),
      }),
    );
    expect(database.outcomeDependency.deleteMany).toHaveBeenCalledWith({
      where: { outcomeId, prerequisiteOutcomeId: { notIn: [prerequisiteId] } },
    });
    expect(database.acceptanceCriterion.deleteMany).toHaveBeenCalledWith({
      where: { outcomeId },
    });
    expect(database.outcomeDepartment.deleteMany).toHaveBeenCalledWith({
      where: { outcomeId },
    });
  });

  it('reads Outcome details only through the expected Project', async () => {
    const service = new ProjectWorkflowService(createDatabase());
    await expect(
      service.getOutcome(member, projectId, outcomeId),
    ).resolves.toMatchObject({
      id: outcomeId,
      isJoined: false,
    });

    const wrongProject = new ProjectWorkflowService(
      createDatabase({ outcomeProjectId: otherProjectId }),
    );
    await expect(
      wrongProject.getOutcome(member, projectId, outcomeId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects missing Departments and cross-Project prerequisites', async () => {
    const missingDepartment = new ProjectWorkflowService(
      createDatabase({ departmentsFound: false }),
    );
    await expect(
      missingDepartment.createOutcome(lead, projectId, stageId, outcomeInput),
    ).rejects.toBeInstanceOf(BadRequestException);

    const crossProject = new ProjectWorkflowService(
      createDatabase({ prerequisiteProjectId: otherProjectId }),
    );
    await expect(
      crossProject.createOutcome(lead, projectId, stageId, outcomeInput),
    ).rejects.toThrow('Prerequisite Outcomes must belong to the same Project.');
  });

  it('rejects a self prerequisite while editing', async () => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.updateOutcome(lead, projectId, outcomeId, {
        ...outcomeInput,
        prerequisiteOutcomeIds: [outcomeId],
      }),
    ).rejects.toThrow('An Outcome cannot depend on itself.');
    expect(database.outcome.update).not.toHaveBeenCalled();
  });

  it.each([
    ['unrelated Member', member],
    [
      'Administrator who is not Lead',
      { ...member, workspaceRole: WorkspaceRole.ADMINISTRATOR } as Member,
    ],
  ])('denies Outcome mutation to an %s', async (_label, actor) => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.createOutcome(actor, projectId, stageId, outcomeInput),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.outcome.create).not.toHaveBeenCalled();
  });

  it.each([
    ['open', 'OPEN' as const],
    [
      'locked or under review because only acceptance closes joining',
      'OPEN' as const,
    ],
    ['needs revision', 'NEEDS_REVISION' as const],
  ])(
    'joins an %s Outcome and derives default Project Membership',
    async (_label, lifecycleStatus) => {
      const database = createDatabase({
        outcomeLifecycleStatus: lifecycleStatus,
      });
      const service = new ProjectWorkflowService(database);

      await expect(
        service.joinOutcome(member, projectId, outcomeId),
      ).resolves.toMatchObject({ id: outcomeId, isJoined: true });
      expect(database.outcomeMember.upsert).toHaveBeenCalledWith({
        where: { outcomeId_memberId: { outcomeId, memberId: member.id } },
        update: {},
        create: { outcomeId, memberId: member.id },
      });
      expect(database.projectMember.upsert).toHaveBeenCalledWith({
        where: { projectId_memberId: { projectId, memberId: member.id } },
        update: {},
        create: {
          projectId,
          memberId: member.id,
          accessLevel: 'CAN_VIEW',
        },
      });
    },
  );

  it('uses idempotent upserts so repeated joins cannot duplicate memberships', async () => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await service.joinOutcome(member, projectId, outcomeId);
    await service.joinOutcome(member, projectId, outcomeId);

    expect(database.outcomeMember.upsert).toHaveBeenCalledTimes(2);
    expect(database.projectMember.upsert).toHaveBeenCalledTimes(2);
  });

  it('denies joining an accepted Outcome before writing membership', async () => {
    const database = createDatabase({ outcomeLifecycleStatus: 'ACCEPTED' });
    const service = new ProjectWorkflowService(database);

    await expect(
      service.joinOutcome(member, projectId, outcomeId),
    ).rejects.toThrow('Accepted Outcomes are closed to new Members.');
    expect(database.outcomeMember.upsert).not.toHaveBeenCalled();
    expect(database.projectMember.upsert).not.toHaveBeenCalled();
  });

  it('rejects removal of permanent Outcome Membership', async () => {
    const service = new ProjectWorkflowService(createDatabase());

    await expect(
      service.rejectOutcomeMemberRemoval(projectId, outcomeId, member.id),
    ).rejects.toThrow('Outcome Membership is permanent.');
  });

  it('lists derived Project Members and exposes access management only to the Lead', async () => {
    const service = new ProjectWorkflowService(createDatabase());

    await expect(service.getProjectMembers(lead, projectId)).resolves.toEqual({
      projectId,
      canManageAccess: true,
      members: [
        {
          member: {
            id: member.id,
            fullName: member.fullName,
            email: member.email,
          },
          accessLevel: 'CAN_VIEW',
          outcomes: [{ id: outcomeId, title: 'Validated opportunity' }],
        },
      ],
    });
    await expect(
      service.getProjectMembers(member, projectId),
    ).resolves.toMatchObject({
      canManageAccess: false,
    });
  });

  it('lets only the Lead grant and revoke CAN_EDIT with access history', async () => {
    const database = createDatabase();
    const service = new ProjectWorkflowService(database);

    await expect(
      service.updateProjectMemberAccess(lead, projectId, member.id, {
        accessLevel: 'CAN_EDIT',
      }),
    ).resolves.toMatchObject({ accessLevel: 'CAN_EDIT' });
    expect(database.projectMemberAccessHistory.create).toHaveBeenCalledWith({
      data: {
        projectId,
        memberId: member.id,
        previousAccess: 'CAN_VIEW',
        newAccess: 'CAN_EDIT',
        changedByMemberId: lead.id,
      },
    });

    await expect(
      service.updateProjectMemberAccess(lead, projectId, member.id, {
        accessLevel: 'CAN_VIEW',
      }),
    ).resolves.toMatchObject({ accessLevel: 'CAN_VIEW' });
    expect(database.projectMemberAccessHistory.create).toHaveBeenLastCalledWith(
      {
        data: {
          projectId,
          memberId: member.id,
          previousAccess: 'CAN_EDIT',
          newAccess: 'CAN_VIEW',
          changedByMemberId: lead.id,
        },
      },
    );
  });

  it.each([
    ['ordinary Member', member],
    [
      'Administrator who is not Lead',
      { ...member, workspaceRole: WorkspaceRole.ADMINISTRATOR } as Member,
    ],
  ])(
    'denies Project Member access management to an %s',
    async (_label, actor) => {
      const database = createDatabase({ projectAccessLevel: 'CAN_EDIT' });
      const service = new ProjectWorkflowService(database);

      await expect(
        service.updateProjectMemberAccess(actor, projectId, member.id, {
          accessLevel: 'CAN_VIEW',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(database.projectMember.update).not.toHaveBeenCalled();
      expect(database.projectMemberAccessHistory.create).not.toHaveBeenCalled();
    },
  );

  it('returns a controlled not-found error for a nonmember access target', async () => {
    const database = createDatabase({ projectMemberExists: false });
    const service = new ProjectWorkflowService(database);

    await expect(
      service.updateProjectMemberAccess(lead, projectId, member.id, {
        accessLevel: 'CAN_EDIT',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
