import { Inject, Injectable } from '@nestjs/common';
import type { TeamWorkSummaryResponse } from '../../shared/contracts/work-session';
import { WORKSPACE_TIMEZONE } from '../../shared/contracts/work-session';
import {
  durationSeconds,
  getWeekWindow,
  referenceDateForWeek,
  weekdayInTimezone,
} from '../../shared/work-session-time';
import { PrismaService } from '../database/prisma.service';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';

@Injectable()
export class TeamService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(WorkSessionsService)
    private readonly workSessions: WorkSessionsService,
  ) {}

  async getSummary(week?: string): Promise<TeamWorkSummaryResponse> {
    const now = new Date();
    const { start, end } = getWeekWindow(referenceDateForWeek(week));
    const today = weekdayInTimezone(now);
    await this.workSessions.refreshStaleSessions(now);

    const members = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        fullName: true,
        position: true,
        profileImagePath: true,
        visiworkDepartmentId: true,
        createdAt: true,
        department: {
          select: { id: true, name: true, shortLabel: true },
        },
        schedule: { include: { blocks: true } },
        workSessions: {
          where: {
            OR: [{ timeIn: { gte: start, lt: end } }, { timeOut: null }],
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    const result = members.map((member) => {
      const scheduledMinutes = (member.schedule?.blocks ?? []).reduce(
        (total, block) =>
          total +
          Math.max(
            0,
            block.endTime.getUTCHours() * 60 +
              block.endTime.getUTCMinutes() -
              (block.startTime.getUTCHours() * 60 +
                block.startTime.getUTCMinutes()),
          ),
        0,
      );
      const weekSessions = member.workSessions.filter(
        (session) => session.timeIn >= start && session.timeIn < end,
      );
      const actualWorkedSeconds = weekSessions.reduce((total, session) => {
        if (session.status === 'NEEDS_CORRECTION') return total;
        return total + durationSeconds(session.timeIn, session.timeOut ?? now);
      }, 0);
      const workingNow = member.workSessions.some(
        (session) => session.status === 'OPEN' && session.timeOut === null,
      );
      const todaySchedule = (member.schedule?.blocks ?? [])
        .filter((block) => block.weekday === today)
        .sort(
          (left, right) =>
            left.startTime.getTime() - right.startTime.getTime() ||
            left.id.localeCompare(right.id),
        )
        .map((block) => ({
          id: block.id,
          weekday: block.weekday,
          startTime: this.clockTime(block.startTime),
          endTime: this.clockTime(block.endTime),
        }));

      return {
        id: member.id,
        fullName: member.fullName,
        position: member.position,
        profileImagePath: member.profileImagePath,
        department: member.department,
        visiworkDepartmentId: member.visiworkDepartmentId,
        workingNow,
        scheduledMinutes,
        actualWorkedSeconds,
        todaySchedule,
      };
    });

    return {
      timezone: WORKSPACE_TIMEZONE,
      asOf: now.toISOString(),
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      summary: {
        memberCount: result.length,
        workingNowCount: result.filter((member) => member.workingNow).length,
        scheduledMinutes: result.reduce(
          (total, member) => total + member.scheduledMinutes,
          0,
        ),
        actualWorkedSeconds: result.reduce(
          (total, member) => total + member.actualWorkedSeconds,
          0,
        ),
      },
      members: result,
    };
  }

  private clockTime(value: Date): string {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(
      value.getUTCMinutes(),
    ).padStart(2, '0')}`;
  }
}
