import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberStatus,
  Prisma,
  WorkspaceRole,
  type Member,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ProjectsService } from './projects.service';

const department = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Research and Development',
  shortLabel: 'R&D',
};
const secondDepartment = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Operations',
  shortLabel: 'OPS',
};
const creator = {
  id: '33333333-3333-4333-8333-333333333333',
  fullName: 'Creator Member',
  email: 'creator@example.com',
  workspaceRole: WorkspaceRole.MEMBER,
} as Member;
const lead = {
  id: '44444444-4444-4444-8444-444444444444',
  fullName: 'Lead Member',
  email: 'lead@example.com',
  status: MemberStatus.ACTIVE,
};

function projectRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    name: 'Phase 3 Project',
    description: 'A persisted Project.',
    status: 'PLANNING' as const,
    leadMemberId: lead.id,
    doneAt: null,
    archivedAt: null,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    updatedAt: new Date('2026-09-16T00:00:00.000Z'),
    createdByMember: creator,
    leadMember: lead,
    departments: [{ department }],
    members: [],
    ...overrides,
  };
}

function createDatabase(
  options: {
    listedProjects?: ReturnType<typeof projectRecord>[];
    foundProject?: ReturnType<typeof projectRecord> | null;
    foundLead?: { id: string; status: MemberStatus } | null;
    foundDepartments?: { id: string }[];
    createdProject?: ReturnType<typeof projectRecord>;
    updatedProject?: ReturnType<typeof projectRecord>;
    statusRows?: ReturnType<typeof projectRecord>[];
    createOptionLeads?: { id: string; fullName: string; email: string }[];
    createOptionDepartments?: {
      id: string;
      name: string;
      shortLabel: string;
    }[];
  } = {},
) {
  const database = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue(
        'statusRows' in options
          ? options.statusRows
          : [options.updatedProject ?? options.foundProject].filter(Boolean),
      ),
    member: {
      findUnique: vi
        .fn()
        .mockResolvedValue('foundLead' in options ? options.foundLead : lead),
      findMany: vi.fn().mockResolvedValue(options.createOptionLeads ?? []),
    },
    department: {
      findMany: vi
        .fn()
        .mockImplementation((query: { where?: unknown }) =>
          Promise.resolve(
            query.where
              ? (options.foundDepartments ?? [{ id: department.id }])
              : (options.createOptionDepartments ?? [department]),
          ),
        ),
    },
    project: {
      findMany: vi.fn().mockResolvedValue(options.listedProjects ?? []),
      findUnique: vi
        .fn()
        .mockResolvedValue(
          'foundProject' in options ? options.foundProject : null,
        ),
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(options.createdProject ?? projectRecord()),
        ),
      create: vi
        .fn()
        .mockResolvedValue(options.createdProject ?? projectRecord()),
      update: vi
        .fn()
        .mockResolvedValue(options.updatedProject ?? projectRecord()),
    },
  };
  const transaction = vi.fn(async (argument: unknown) => {
    if (Array.isArray(argument)) return Promise.all(argument);
    return (argument as (client: typeof database) => unknown)(database);
  });
  return { ...database, $transaction: transaction } as unknown as PrismaService;
}

const input = {
  name: 'Phase 3 Project',
  description: 'A persisted Project.',
  leadMemberId: lead.id,
  departmentIds: [department.id],
};

describe('ProjectsService', () => {
  it('returns active Members and persisted Departments as narrow create options', async () => {
    const activeLead = {
      id: lead.id,
      fullName: lead.fullName,
      email: lead.email,
    };
    const database = createDatabase({
      createOptionLeads: [activeLead],
      createOptionDepartments: [department],
    });
    const service = new ProjectsService(database);

    await expect(service.getCreateOptions()).resolves.toEqual({
      leads: [activeLead],
      departments: [department],
    });
    expect(database.member.findMany).toHaveBeenCalledWith({
      where: { status: MemberStatus.ACTIVE },
      select: { id: true, fullName: true, email: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
    expect(database.department.findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, shortLabel: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });
  it('lets an active authorized Member list all Projects', async () => {
    const database = createDatabase({ listedProjects: [projectRecord()] });
    const service = new ProjectsService(database);

    await expect(service.listProjects(creator)).resolves.toMatchObject([
      { id: '55555555-5555-4555-8555-555555555555', lead, creator },
    ]);
  });

  it('uses a lightweight list read model without loading unrelated Project Members or accepted Outcome rows', async () => {
    const database = createDatabase({
      listedProjects: [
        projectRecord({
          members: [{ memberId: creator.id, accessLevel: 'CAN_EDIT' }],
          stages: [
            {
              id: '77777777-7777-4777-8777-777777777777',
              name: 'Delivery',
              position: 0,
              _count: { outcomes: 3 },
              outcomes: [{ id: '88888888-8888-4888-8888-888888888888' }],
            },
          ],
        }),
      ],
    });
    const service = new ProjectsService(database);

    await expect(service.listProjects(creator)).resolves.toMatchObject([
      {
        isParticipating: true,
        currentMemberAccess: 'CAN_EDIT',
        canChangeStatus: true,
        metrics: {
          totalOutcomes: 3,
          acceptedOutcomes: 2,
          openOutcomes: 1,
          activeStagesCount: 1,
        },
      },
    ]);
    expect(database.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          members: expect.objectContaining({
            where: { memberId: creator.id },
          }),
          stages: expect.objectContaining({
            select: expect.objectContaining({
              _count: { select: { outcomes: true } },
              outcomes: expect.objectContaining({
                where: { lifecycleStatus: { not: 'ACCEPTED' } },
                select: { id: true },
              }),
            }),
          }),
        }),
      }),
    );
  });

  it('persists a regular Member as creator and another active Member as Lead', async () => {
    const database = createDatabase();
    const service = new ProjectsService(database);

    await expect(service.createProject(creator, input)).resolves.toMatchObject({
      creator: { id: creator.id },
      lead: { id: lead.id },
    });
    expect(database.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByMemberId: creator.id,
          leadMemberId: lead.id,
          statusHistory: {
            create: {
              toStatus: 'PLANNING',
              changedByMemberId: creator.id,
              changeSource: 'USER',
            },
          },
        }),
      }),
    );
  });

  it('does not grant an Administrator automatic Project Lead authority', async () => {
    const administrator = {
      ...creator,
      workspaceRole: WorkspaceRole.ADMINISTRATOR,
    } as Member;
    const database = createDatabase();
    const service = new ProjectsService(database);

    await service.createProject(administrator, input);

    expect(database.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdByMemberId: administrator.id,
          leadMemberId: lead.id,
        }),
      }),
    );
  });

  it('rejects an inactive Project Lead', async () => {
    const database = createDatabase({
      foundLead: { id: lead.id, status: MemberStatus.DEACTIVATED },
    });
    const service = new ProjectsService(database);

    await expect(service.createProject(creator, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(database.project.create).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent Project Lead', async () => {
    const database = createDatabase({ foundLead: null });
    const service = new ProjectsService(database);

    await expect(service.createProject(creator, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(database.project.create).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent Department without creating a partial Project', async () => {
    const database = createDatabase({ foundDepartments: [] });
    const service = new ProjectsService(database);

    await expect(service.createProject(creator, input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(database.project.create).not.toHaveBeenCalled();
  });

  it('persists multiple Department associations', async () => {
    const database = createDatabase({
      foundDepartments: [{ id: department.id }, { id: secondDepartment.id }],
      createdProject: projectRecord({
        departments: [{ department }, { department: secondDepartment }],
      }),
    });
    const service = new ProjectsService(database);

    await expect(
      service.createProject(creator, {
        ...input,
        departmentIds: [department.id, secondDepartment.id],
      }),
    ).resolves.toMatchObject({ departments: [department, secondDepartment] });
    expect(database.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          departments: {
            create: [
              { departmentId: department.id },
              { departmentId: secondDepartment.id },
            ],
          },
        }),
      }),
    );
  });

  it('returns a controlled not-found error for an absent Project', async () => {
    const service = new ProjectsService(createDatabase({ foundProject: null }));

    await expect(
      service.getProject(creator, '55555555-5555-4555-8555-555555555555'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns Project detail to an unrelated active Member', async () => {
    const unrelatedMember = {
      ...creator,
      id: '66666666-6666-4666-8666-666666666666',
    } as Member;
    const database = createDatabase({ foundProject: projectRecord() });
    const service = new ProjectsService(database);

    await expect(
      service.getProject(
        unrelatedMember,
        '55555555-5555-4555-8555-555555555555',
      ),
    ).resolves.toMatchObject({ lead, creator });
    expect(unrelatedMember.id).not.toBe(lead.id);
  });

  it('lets the assigned Project Lead change PLANNING to IN_PROGRESS with history', async () => {
    const database = createDatabase({
      foundProject: projectRecord(),
      updatedProject: projectRecord({ status: 'IN_PROGRESS' }),
    });
    const service = new ProjectsService(database);

    await expect(
      service.updateProjectStatus(
        lead as Member,
        '55555555-5555-4555-8555-555555555555',
        {
          status: 'IN_PROGRESS',
        },
      ),
    ).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(database.$queryRaw).toHaveBeenCalledOnce();
    const query = vi.mocked(database.$queryRaw).mock.calls[0][0] as Prisma.Sql;
    expect(query.values).toEqual(
      expect.arrayContaining([
        '55555555-5555-4555-8555-555555555555',
        lead.id,
        'IN_PROGRESS',
      ]),
    );
  });

  it('sets doneAt and preserves USER history when the Lead changes status to DONE', async () => {
    const database = createDatabase({
      foundProject: projectRecord({ status: 'IN_PROGRESS' }),
      updatedProject: projectRecord({
        status: 'DONE',
        doneAt: new Date('2026-09-16T12:00:00.000Z'),
      }),
    });
    const service = new ProjectsService(database);

    await service.updateProjectStatus(
      lead as Member,
      '55555555-5555-4555-8555-555555555555',
      { status: 'DONE' },
    );

    expect(database.$queryRaw).toHaveBeenCalledOnce();
  });

  it('clears doneAt when the Lead moves a Project out of DONE', async () => {
    const database = createDatabase({
      foundProject: projectRecord({
        status: 'DONE',
        doneAt: new Date('2026-09-16T00:00:00.000Z'),
      }),
      updatedProject: projectRecord({ status: 'IN_PROGRESS', doneAt: null }),
    });
    const service = new ProjectsService(database);

    await service.updateProjectStatus(
      lead as Member,
      '55555555-5555-4555-8555-555555555555',
      { status: 'IN_PROGRESS' },
    );

    expect(database.$queryRaw).toHaveBeenCalledOnce();
  });

  it('does not create duplicate history for a duplicate status request', async () => {
    const existing = projectRecord({ status: 'IN_PROGRESS' });
    const database = createDatabase({ foundProject: existing });
    const service = new ProjectsService(database);

    await expect(
      service.updateProjectStatus(lead as Member, existing.id, {
        status: 'IN_PROGRESS',
      }),
    ).resolves.toMatchObject({ status: 'IN_PROGRESS' });
    expect(database.$queryRaw).toHaveBeenCalledOnce();
  });

  it('lets a CAN_EDIT Project Member change status without granting Lead authority', async () => {
    const editableMember = {
      ...creator,
      id: '66666666-6666-4666-8666-666666666666',
    } as Member;
    const database = createDatabase({
      foundProject: projectRecord({
        members: [{ memberId: editableMember.id, accessLevel: 'CAN_EDIT' }],
      }),
      updatedProject: projectRecord({
        status: 'IN_PROGRESS',
        members: [{ memberId: editableMember.id, accessLevel: 'CAN_EDIT' }],
      }),
    });
    const service = new ProjectsService(database);

    await expect(
      service.updateProjectStatus(
        editableMember,
        '55555555-5555-4555-8555-555555555555',
        { status: 'IN_PROGRESS' },
      ),
    ).resolves.toMatchObject({
      status: 'IN_PROGRESS',
    });
    expect(database.$queryRaw).toHaveBeenCalledOnce();
  });

  it('denies a CAN_VIEW Project Member status authority', async () => {
    const viewMember = {
      ...creator,
      id: '66666666-6666-4666-8666-666666666666',
    } as Member;
    const database = createDatabase({
      foundProject: projectRecord({
        members: [{ memberId: viewMember.id, accessLevel: 'CAN_VIEW' }],
      }),
      statusRows: [],
    });
    const service = new ProjectsService(database);

    await expect(
      service.updateProjectStatus(
        viewMember,
        '55555555-5555-4555-8555-555555555555',
        { status: 'IN_PROGRESS' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.project.update).not.toHaveBeenCalled();
  });

  it.each([
    [
      'an unrelated Member',
      { ...creator, id: '66666666-6666-4666-8666-666666666666' },
    ],
    [
      'an Administrator who is not Lead',
      { ...creator, workspaceRole: WorkspaceRole.ADMINISTRATOR },
    ],
    ['the creator who is not Lead', creator],
  ])('denies status changes to %s', async (_label, actor) => {
    const database = createDatabase({
      foundProject: projectRecord(),
      statusRows: [],
    });
    const service = new ProjectsService(database);

    await expect(
      service.updateProjectStatus(
        actor as Member,
        '55555555-5555-4555-8555-555555555555',
        { status: 'DONE' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.project.update).not.toHaveBeenCalled();
  });

  it('returns not found before authorizing a nonexistent Project status change', async () => {
    const database = createDatabase({ foundProject: null });
    const service = new ProjectsService(database);

    await expect(
      service.updateProjectStatus(
        lead as Member,
        '55555555-5555-4555-8555-555555555555',
        { status: 'DONE' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('correctly calculates derived metrics from stages and outcomes', async () => {
    const projectWithStages = projectRecord({
      stages: [
        {
          id: 'stage-1',
          name: 'Discovery',
          position: 1,
          outcomes: [
            { id: 'o-1', lifecycleStatus: 'ACCEPTED' },
            { id: 'o-2', lifecycleStatus: 'OPEN' },
          ],
        },
        {
          id: 'stage-2',
          name: 'Implementation',
          position: 2,
          outcomes: [{ id: 'o-3', lifecycleStatus: 'NEEDS_REVISION' }],
        },
      ],
    });
    const database = createDatabase({ foundProject: projectWithStages });
    const service = new ProjectsService(database);

    const result = await service.getProject(
      lead as Member,
      '55555555-5555-4555-8555-555555555555',
    );

    expect(result.metrics).toEqual({
      totalOutcomes: 3,
      acceptedOutcomes: 1,
      openOutcomes: 2,
      activeStagesCount: 2,
      activeStages: [
        { id: 'stage-1', name: 'Discovery', openOutcomesCount: 1 },
        { id: 'stage-2', name: 'Implementation', openOutcomesCount: 1 },
      ],
      progressPercentage: 33,
    });
  });
});
