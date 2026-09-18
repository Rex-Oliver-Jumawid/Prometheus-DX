import 'dotenv/config';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole, type Member } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { WorkSessionsService } from './work-sessions.service';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const service = new WorkSessionsService(prisma);
const runId = `work-session-integration-${randomUUID()}`;

let departmentId: string;
let owner: Member;
let administrator: Member;
let projectLead: Member;

async function createMember(
  label: string,
  workspaceRole: WorkspaceRole = WorkspaceRole.MEMBER,
) {
  return prisma.member.create({
    data: {
      email: `${runId}-${label}@example.com`,
      fullName: `${label} ${runId}`,
      departmentId,
      position: `${label} position`,
      status: 'ACTIVE',
      workspaceRole,
    },
  });
}

describe.runIf(runDatabaseIntegration)(
  'WorkSessionsService database integration',
  () => {
    beforeAll(async () => {
      const department = await prisma.department.create({
        data: { name: runId, shortLabel: 'WORK' },
      });
      departmentId = department.id;
      [owner, administrator, projectLead] = await Promise.all([
        createMember('owner'),
        createMember('administrator', WorkspaceRole.ADMINISTRATOR),
        createMember('project-lead'),
      ]);
      await prisma.project.create({
        data: {
          name: runId,
          description: 'Work Session authority isolation fixture.',
          createdByMemberId: projectLead.id,
          leadMemberId: projectLead.id,
          departments: { create: { departmentId } },
        },
      });
    }, 30_000);

    afterAll(async () => {
      const memberIds = [owner?.id, administrator?.id, projectLead?.id].filter(
        Boolean,
      ) as string[];
      await prisma.workSessionCorrection.deleteMany({
        where: { memberId: { in: memberIds } },
      });
      await prisma.workSession.deleteMany({
        where: { memberId: { in: memberIds } },
      });
      await prisma.project.deleteMany({ where: { name: runId } });
      await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      await prisma.$disconnect();
    }, 30_000);

    it('allows only one of two simultaneous Time In requests', async () => {
      const results = await Promise.allSettled([
        service.timeIn(owner),
        service.timeIn(owner),
      ]);

      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected'),
      ).toHaveLength(1);
      await expect(
        prisma.workSession.count({
          where: { memberId: owner.id, timeOut: null },
        }),
      ).resolves.toBe(1);
    });

    it('persists Time Out and prevents a repeated Time Out', async () => {
      const completed = await service.timeOut(owner);
      expect(completed.session).toMatchObject({ status: 'COMPLETED' });
      expect(completed.session?.timeOut).not.toBeNull();
      await expect(service.timeOut(owner)).rejects.toThrow(
        'There is no active work session to end.',
      );
    });

    it('enforces the unresolved invariant for direct concurrent writes', async () => {
      const first = await prisma.workSession.create({
        data: { memberId: projectLead.id, timeIn: new Date() },
      });
      await expect(
        prisma.workSession.create({
          data: { memberId: projectLead.id, timeIn: new Date() },
        }),
      ).rejects.toThrow();
      await prisma.workSession.update({
        where: { id: first.id },
        data: { status: 'COMPLETED', timeOut: new Date() },
      });
    });

    it('denies Administrator and Project Lead correction authority', async () => {
      const stale = await prisma.workSession.create({
        data: {
          memberId: owner.id,
          timeIn: new Date(Date.now() - 20 * 60 * 60 * 1_000),
          status: 'NEEDS_CORRECTION',
        },
      });
      for (const actor of [administrator, projectLead]) {
        await expect(
          service.correct(actor, stale.id, {
            newTimeIn: new Date(Date.now() - 4 * 60 * 60 * 1_000).toISOString(),
            newTimeOut: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
            reason: 'Correction authority isolation.',
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
      await service.correct(owner, stale.id, {
        newTimeIn: new Date(Date.now() - 4 * 60 * 60 * 1_000).toISOString(),
        newTimeOut: new Date(Date.now() - 60 * 60 * 1_000).toISOString(),
        reason: 'Forgot to record Time Out.',
      });
      await expect(
        prisma.workSessionCorrection.count({
          where: { workSessionId: stale.id, memberId: owner.id },
        }),
      ).resolves.toBe(1);
    });

    it('returns separate sessions and preserves a cross-midnight duration', async () => {
      const crossMidnight = await prisma.workSession.create({
        data: {
          memberId: owner.id,
          timeIn: new Date('2026-09-18T15:30:00.000Z'),
          timeOut: new Date('2026-09-18T17:15:30.000Z'),
          status: 'COMPLETED',
        },
      });
      await prisma.workSession.create({
        data: {
          memberId: owner.id,
          timeIn: new Date('2026-09-19T01:00:00.000Z'),
          timeOut: new Date('2026-09-19T02:00:00.000Z'),
          status: 'COMPLETED',
        },
      });

      const history = await service.getHistory(owner, '2026-09-18');
      expect(history.sessions.length).toBeGreaterThanOrEqual(2);
      expect(
        history.sessions.find((session) => session.id === crossMidnight.id),
      ).toMatchObject({ durationSeconds: 6_330 });
    });
  },
);
