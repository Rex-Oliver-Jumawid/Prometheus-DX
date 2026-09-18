import 'dotenv/config';
import { ForbiddenException } from '@nestjs/common';
import { WorkspaceRole, type Member } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ScheduleService } from './schedule.service';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const service = new ScheduleService(prisma);
const runId = `schedule-integration-${randomUUID()}`;

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
      status: 'ACTIVE',
      workspaceRole,
    },
  });
}

describe.runIf(runDatabaseIntegration)(
  'ScheduleService database integration',
  () => {
    beforeAll(async () => {
      const department = await prisma.department.create({
        data: { name: runId, shortLabel: 'SCHED' },
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
          description: 'Schedule authority isolation fixture.',
          createdByMemberId: projectLead.id,
          leadMemberId: projectLead.id,
          departments: { create: { departmentId } },
        },
      });
    }, 30_000);

    afterAll(async () => {
      await prisma.project.deleteMany({ where: { name: runId } });
      await prisma.member.deleteMany({
        where: { email: { startsWith: runId } },
      });
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      await prisma.$disconnect();
    }, 30_000);

    it('creates, edits, and removes blocks with fresh database reads', async () => {
      await service.replaceMemberSchedule(owner, owner.id, {
        targetWeeklyMinutes: 960,
        blocks: [
          { weekday: 'MONDAY', startTime: '09:00', endTime: '17:00' },
          { weekday: 'TUESDAY', startTime: '09:00', endTime: '17:00' },
        ],
      });

      await expect(service.getMemberSchedule(owner.id)).resolves.toMatchObject({
        memberId: owner.id,
        targetWeeklyMinutes: 960,
        blocks: [
          { weekday: 'MONDAY', startTime: '09:00', endTime: '17:00' },
          { weekday: 'TUESDAY', startTime: '09:00', endTime: '17:00' },
        ],
      });

      await service.replaceMemberSchedule(owner, owner.id, {
        targetWeeklyMinutes: 240,
        blocks: [{ weekday: 'MONDAY', startTime: '08:00', endTime: '12:00' }],
      });
      await expect(service.getMemberSchedule(owner.id)).resolves.toMatchObject({
        targetWeeklyMinutes: 240,
        blocks: [{ weekday: 'MONDAY', startTime: '08:00', endTime: '12:00' }],
      });

      await service.replaceMemberSchedule(owner, owner.id, {
        targetWeeklyMinutes: 0,
        blocks: [],
      });
      await expect(service.getMemberSchedule(owner.id)).resolves.toMatchObject({
        targetWeeklyMinutes: 0,
        blocks: [],
      });
    });

    it('does not grant cross-member authority to administrators or project leads', async () => {
      for (const actor of [administrator, projectLead]) {
        await expect(
          service.replaceMemberSchedule(actor, owner.id, {
            targetWeeklyMinutes: 480,
            blocks: [],
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      }
    });

    it('returns other active members and enforces time ordering in PostgreSQL', async () => {
      await service.replaceMemberSchedule(owner, owner.id, {
        targetWeeklyMinutes: 480,
        blocks: [
          { weekday: 'WEDNESDAY', startTime: '09:00', endTime: '17:00' },
        ],
      });
      const team = await service.getTeamSchedule();
      expect(
        team.members.find((member) => member.id === owner.id)?.schedule,
      ).toMatchObject({
        blocks: [
          { weekday: 'WEDNESDAY', startTime: '09:00', endTime: '17:00' },
        ],
      });

      const schedule = await prisma.memberSchedule.findUniqueOrThrow({
        where: { memberId: owner.id },
      });
      await expect(
        prisma.scheduleBlock.create({
          data: {
            scheduleId: schedule.id,
            weekday: 'THURSDAY',
            startTime: new Date('1970-01-01T17:00:00.000Z'),
            endTime: new Date('1970-01-01T09:00:00.000Z'),
          },
        }),
      ).rejects.toThrow();
    });
  },
);
