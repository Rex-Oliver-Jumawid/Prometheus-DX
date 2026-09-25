import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import type { WorkSessionsService } from '../work-sessions/work-sessions.service';
import { TeamService } from './team.service';

describe('TeamService', () => {
  it('aggregates Registry identity, Schedule, and WorkSessions independently', async () => {
    const prisma = {
      member: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '11111111-1111-4111-8111-111111111111',
            fullName: 'Member One',
            position: 'Designer',
            profileImagePath: 'https://example.com/member-one.jpg',
            visiworkDepartmentId: null,
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
            department: {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Creative',
              shortLabel: 'CRT',
            },
            schedule: {
              blocks: [
                {
                  id: '33333333-3333-4333-8333-333333333333',
                  weekday: 'FRIDAY',
                  startTime: new Date('1970-01-01T09:00:00.000Z'),
                  endTime: new Date('1970-01-01T15:00:00.000Z'),
                },
              ],
            },
            workSessions: [
              {
                timeIn: new Date('2026-09-18T00:00:00.000Z'),
                timeOut: new Date('2026-09-18T05:00:00.000Z'),
                status: 'COMPLETED',
              },
              {
                timeIn: new Date(),
                timeOut: null,
                status: 'OPEN',
              },
            ],
          },
        ]),
      },
    } as unknown as PrismaService;
    const workSessions = {
      refreshStaleSessions: vi.fn(),
    } as unknown as WorkSessionsService;

    const result = await new TeamService(prisma, workSessions).getSummary(
      '2026-09-18',
    );

    expect(result.members[0]).toMatchObject({
      fullName: 'Member One',
      position: 'Designer',
      profileImagePath: 'https://example.com/member-one.jpg',
      department: { name: 'Creative' },
      visiworkDepartmentId: null,
      workingNow: true,
      scheduledMinutes: 360,
    });
    expect(result.members[0].actualWorkedSeconds).toBeGreaterThanOrEqual(
      18_000,
    );
    expect(result.summary.workingNowCount).toBe(1);
  });
});
