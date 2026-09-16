import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MemberStatus, WorkspaceRole, type Member } from '@prisma/client';
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
    doneAt: null,
    archivedAt: null,
    createdAt: new Date('2026-09-16T00:00:00.000Z'),
    updatedAt: new Date('2026-09-16T00:00:00.000Z'),
    createdByMember: creator,
    leadMember: lead,
    departments: [{ department }],
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
  } = {},
) {
  const database = {
    member: {
      findUnique: vi
        .fn()
        .mockResolvedValue('foundLead' in options ? options.foundLead : lead),
    },
    department: {
      findMany: vi
        .fn()
        .mockResolvedValue(options.foundDepartments ?? [{ id: department.id }]),
    },
    project: {
      findMany: vi.fn().mockResolvedValue(options.listedProjects ?? []),
      findUnique: vi
        .fn()
        .mockResolvedValue(
          'foundProject' in options ? options.foundProject : null,
        ),
      create: vi
        .fn()
        .mockResolvedValue(options.createdProject ?? projectRecord()),
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
  it('lets an active authorized Member list all Projects', async () => {
    const database = createDatabase({ listedProjects: [projectRecord()] });
    const service = new ProjectsService(database);

    await expect(service.listProjects()).resolves.toMatchObject([
      { id: '55555555-5555-4555-8555-555555555555', lead, creator },
    ]);
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
      service.getProject('55555555-5555-4555-8555-555555555555'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
