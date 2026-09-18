import 'dotenv/config';
import type { Member } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';
import { TeamService } from './team.service';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const workSessions = new WorkSessionsService(prisma);
const service = new TeamService(prisma, workSessions);
const runId = `team-integration-${randomUUID()}`;

let departmentId: string;
let workingMember: Member;
let emptyMember: Member;

describe.runIf(runDatabaseIntegration)('TeamService database integration', () => {
  beforeAll(async () => {
    const department = await prisma.department.create({
      data: { name: runId, shortLabel: 'TEAM' },
    });
    departmentId = department.id;
    [workingMember, emptyMember] = await Promise.all([
      prisma.member.create({
        data: {
          email: `${runId}-working@example.com`,
          fullName: `Working ${runId}`,
          departmentId,
          position: 'Integration Designer',
          status: 'ACTIVE',
          schedule: {
            create: {
              targetWeeklyMinutes: 360,
              blocks: {
                create: {
                  weekday: 'MONDAY',
                  startTime: new Date('1970-01-01T09:00:00.000Z'),
                  endTime: new Date('1970-01-01T15:00:00.000Z'),
                },
              },
            },
          },
        },
      }),
      prisma.member.create({
        data: {
          email: `${runId}-empty@example.com`,
          fullName: `Empty ${runId}`,
          departmentId,
          position: null,
          status: 'ACTIVE',
        },
      }),
    ]);
    await prisma.workSession.create({
      data: {
        memberId: workingMember.id,
        timeIn: new Date(Date.now() - 3 * 60 * 60 * 1_000),
        timeOut: new Date(Date.now() - 2 * 60 * 60 * 1_000),
        status: 'COMPLETED',
      },
    });
    await workSessions.timeIn(workingMember);
  }, 30_000);

  afterAll(async () => {
    const memberIds = [workingMember?.id, emptyMember?.id].filter(
      Boolean,
    ) as string[];
    await prisma.workSession.deleteMany({
      where: { memberId: { in: memberIds } },
    });
    await prisma.member.deleteMany({ where: { id: { in: memberIds } } });
    if (departmentId) {
      await prisma.department.deleteMany({ where: { id: departmentId } });
    }
    await prisma.$disconnect();
  }, 30_000);

  it('derives identity, planned minutes, actual work, and Working Now from canonical records', async () => {
    const team = await service.getSummary();
    const result = team.members.find((member) => member.id === workingMember.id);

    expect(result).toMatchObject({
      position: 'Integration Designer',
      department: { id: departmentId, name: runId, shortLabel: 'TEAM' },
      workingNow: true,
      scheduledMinutes: 360,
    });
    expect(result?.actualWorkedSeconds).toBeGreaterThanOrEqual(3_600);

    await workSessions.timeOut(workingMember);
    const afterTimeOut = await service.getSummary();
    expect(
      afterTimeOut.members.find((member) => member.id === workingMember.id),
    ).toMatchObject({ workingNow: false, scheduledMinutes: 360 });
  });

  it('returns intentional zero values for a member without schedule or history', async () => {
    const team = await service.getSummary();
    expect(team.members.find((member) => member.id === emptyMember.id)).toMatchObject({
      position: null,
      workingNow: false,
      scheduledMinutes: 0,
      actualWorkedSeconds: 0,
      todaySchedule: [],
    });
  });
});
