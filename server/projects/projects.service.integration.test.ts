import 'dotenv/config';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole, type Member, type ProjectStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from './projects.service';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const service = new ProjectsService(prisma);
const runId = `project-status-integration-${randomUUID()}`;

let departmentId: string;
let projectId: string;
let lead: Member;
let editableMember: Member;
let viewMember: Member;
let unrelatedMember: Member;
let administrator: Member;

async function createMember(
  label: string,
  workspaceRole: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  return prisma.member.create({
    data: {
      email: `${runId}-${label}@example.com`,
      fullName: `${label} ${runId}`,
      departmentId,
      status: 'ACTIVE',
      workspaceRole,
    },
  });
}

async function expectDeniedWithoutWrites(actor: Member) {
  const statusBefore = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { status: true },
  });
  const historyBefore = await prisma.projectStatusHistory.count({
    where: { projectId },
  });

  const request = service.updateProjectStatus(actor, projectId, {
    status: 'IN_PROGRESS',
  });

  await expect(request).rejects.toBeInstanceOf(ForbiddenException);
  await expect(request).rejects.toMatchObject({ status: 403 });
  await expect(
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { status: true },
    }),
  ).resolves.toEqual(statusBefore);
  await expect(
    prisma.projectStatusHistory.count({ where: { projectId } }),
  ).resolves.toBe(historyBefore);
}

describe.runIf(runDatabaseIntegration)(
  'ProjectsService raw-SQL status mutation integration',
  () => {
    beforeAll(async () => {
      const department = await prisma.department.create({
        data: {
          name: runId,
          shortLabel: 'PSTAT',
        },
      });
      departmentId = department.id;

      [lead, editableMember, viewMember, unrelatedMember, administrator] =
        await Promise.all([
          createMember('lead'),
          createMember('editor'),
          createMember('viewer'),
          createMember('unrelated'),
          createMember('administrator', WorkspaceRole.ADMINISTRATOR),
        ]);

      const project = await prisma.project.create({
        data: {
          name: runId,
          description: 'Raw-SQL Project status mutation integration fixture.',
          createdByMemberId: unrelatedMember.id,
          leadMemberId: lead.id,
          departments: { create: { departmentId } },
          members: {
            create: [
              { memberId: editableMember.id, accessLevel: 'CAN_EDIT' },
              { memberId: viewMember.id, accessLevel: 'CAN_VIEW' },
            ],
          },
        },
      });
      projectId = project.id;
    }, 30_000);

    beforeEach(async () => {
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'PLANNING', doneAt: null },
      });
      await prisma.projectStatusHistory.deleteMany({ where: { projectId } });
    });

    afterAll(async () => {
      if (projectId) {
        await prisma.project.deleteMany({ where: { id: projectId } });
      }
      await prisma.member.deleteMany({
        where: { email: { startsWith: runId } },
      });
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      await prisma.$disconnect();
    }, 30_000);

    it('allows the Project Lead to change status and persists one history row', async () => {
      await expect(
        service.updateProjectStatus(lead, projectId, {
          status: 'IN_PROGRESS',
        }),
      ).resolves.toMatchObject({ status: 'IN_PROGRESS' });

      const [freshProject, history] = await Promise.all([
        prisma.project.findUniqueOrThrow({ where: { id: projectId } }),
        prisma.projectStatusHistory.findMany({ where: { projectId } }),
      ]);
      expect(freshProject.status).toBe('IN_PROGRESS');
      expect(history).toMatchObject([
        {
          fromStatus: 'PLANNING',
          toStatus: 'IN_PROGRESS',
          changedByMemberId: lead.id,
          changeSource: 'USER',
        },
      ]);
    });

    it('allows a CAN_EDIT Project Member to change status and persists it on a fresh read', async () => {
      await expect(
        service.updateProjectStatus(editableMember, projectId, {
          status: 'DONE',
        }),
      ).resolves.toMatchObject({ status: 'DONE' });

      await expect(
        prisma.project.findUniqueOrThrow({
          where: { id: projectId },
          select: { status: true },
        }),
      ).resolves.toEqual({ status: 'DONE' });
      await expect(
        prisma.projectStatusHistory.count({ where: { projectId } }),
      ).resolves.toBe(1);
    });

    it('returns 403 to a CAN_VIEW Project Member without changing status or history', async () => {
      await expectDeniedWithoutWrites(viewMember);
    });

    it('returns 403 to an unrelated active Member without changing status or history', async () => {
      await expectDeniedWithoutWrites(unrelatedMember);
    });

    it('does not treat Administrator status alone as status-change authority', async () => {
      await expectDeniedWithoutWrites(administrator);
    });

    it('does not append duplicate history when setting the existing status', async () => {
      const existingStatus: ProjectStatus = 'PLANNING';

      await expect(
        service.updateProjectStatus(lead, projectId, {
          status: existingStatus,
        }),
      ).resolves.toMatchObject({ status: existingStatus });
      await expect(
        prisma.projectStatusHistory.count({ where: { projectId } }),
      ).resolves.toBe(0);
    });
  },
);
