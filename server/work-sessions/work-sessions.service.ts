import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Member, type WorkSession } from '@prisma/client';
import type {
  CorrectWorkSessionRequest,
  CurrentWorkSessionResponse,
  WorkSessionHistoryResponse,
} from '../../shared/contracts/work-session';
import { WORKSPACE_TIMEZONE } from '../../shared/contracts/work-session';
import {
  durationSeconds,
  getWeekWindow,
  referenceDateForWeek,
} from '../../shared/work-session-time';
import { serverEnvironment } from '../config/env';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WorkSessionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getCurrent(member: Member): Promise<CurrentWorkSessionResponse> {
    const now = new Date();
    await this.refreshStaleSessions(now, member.id);
    const session = await this.prisma.workSession.findFirst({
      where: { memberId: member.id, timeOut: null },
      orderBy: [{ timeIn: 'desc' }, { id: 'desc' }],
    });
    return {
      timezone: WORKSPACE_TIMEZONE,
      asOf: now.toISOString(),
      session: session ? this.toSession(session, now) : null,
    };
  }

  async timeIn(member: Member): Promise<CurrentWorkSessionResponse> {
    const now = new Date();
    await this.refreshStaleSessions(now, member.id);
    const unresolved = await this.prisma.workSession.findFirst({
      where: { memberId: member.id, timeOut: null },
    });
    if (unresolved) {
      throw new ConflictException(
        unresolved.status === 'NEEDS_CORRECTION'
          ? 'Correct the unresolved work session before timing in again.'
          : 'A work session is already active.',
      );
    }

    try {
      const session = await this.prisma.workSession.create({
        data: { memberId: member.id, timeIn: now, status: 'OPEN' },
      });
      return {
        timezone: WORKSPACE_TIMEZONE,
        asOf: now.toISOString(),
        session: this.toSession(session, now),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A work session is already unresolved.');
      }
      throw error;
    }
  }

  async timeOut(member: Member): Promise<CurrentWorkSessionResponse> {
    const now = new Date();
    await this.refreshStaleSessions(now, member.id);
    const session = await this.prisma.workSession.findFirst({
      where: { memberId: member.id, timeOut: null },
    });
    if (!session) {
      throw new ConflictException('There is no active work session to end.');
    }
    if (session.status === 'NEEDS_CORRECTION') {
      throw new ConflictException(
        'This work session needs correction before it can be completed.',
      );
    }
    if (now.getTime() < session.timeIn.getTime()) {
      throw new BadRequestException('Time Out must not precede Time In.');
    }

    const completed = await this.prisma.$transaction(async (database) => {
      const update = await database.workSession.updateMany({
        where: {
          id: session.id,
          memberId: member.id,
          status: 'OPEN',
          timeOut: null,
        },
        data: { status: 'COMPLETED', timeOut: now },
      });
      if (update.count !== 1) {
        throw new ConflictException(
          'The active work session was already changed. Refresh and try again.',
        );
      }
      return database.workSession.findUniqueOrThrow({
        where: { id: session.id },
      });
    });

    return {
      timezone: WORKSPACE_TIMEZONE,
      asOf: now.toISOString(),
      session: this.toSession(completed, now),
    };
  }

  async getHistory(
    member: Member,
    week?: string,
  ): Promise<WorkSessionHistoryResponse> {
    return this.historyForMember(member.id, week);
  }

  async getMemberHistory(
    requester: Member,
    memberId: string,
    week?: string,
  ): Promise<WorkSessionHistoryResponse> {
    if (requester.id !== memberId) {
      // Team summary already exposes active teammates' weekly work totals.
      // Restrict detailed history to the same active workspace population.
      const target = await this.prisma.member.findFirst({
        where: { id: memberId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Active member not found.');
    }
    return this.historyForMember(memberId, week);
  }

  private async historyForMember(
    memberId: string,
    week?: string,
  ): Promise<WorkSessionHistoryResponse> {
    const now = new Date();
    await this.refreshStaleSessions(now, memberId);
    const { start, end } = getWeekWindow(referenceDateForWeek(week));
    const sessions = await this.prisma.workSession.findMany({
      where: {
        memberId,
        timeIn: { gte: start, lt: end },
      },
      orderBy: [{ timeIn: 'desc' }, { id: 'desc' }],
    });
    const mapped = sessions.map((session) => this.toSession(session, now));
    return {
      timezone: WORKSPACE_TIMEZONE,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      totalDurationSeconds: mapped.reduce(
        (total, session) => total + session.durationSeconds,
        0,
      ),
      sessions: mapped,
    };
  }

  async correct(
    member: Member,
    workSessionId: string,
    input: CorrectWorkSessionRequest,
  ) {
    const existing = await this.prisma.workSession.findUnique({
      where: { id: workSessionId },
    });
    if (!existing) throw new NotFoundException('Work session not found.');
    if (existing.memberId !== member.id) {
      throw new ForbiddenException(
        'You can only correct your own work sessions.',
      );
    }
    if (existing.status !== 'NEEDS_CORRECTION' || existing.timeOut !== null) {
      throw new ConflictException(
        'Only a session needing correction can be corrected.',
      );
    }

    const newTimeIn = new Date(input.newTimeIn);
    const newTimeOut = new Date(input.newTimeOut);
    const now = new Date();
    if (newTimeOut.getTime() < newTimeIn.getTime()) {
      throw new BadRequestException('Time Out must not precede Time In.');
    }
    if (newTimeOut.getTime() > now.getTime()) {
      throw new BadRequestException(
        'Corrected Time Out cannot be in the future.',
      );
    }

    return this.prisma.$transaction(async (database) => {
      const update = await database.workSession.updateMany({
        where: {
          id: existing.id,
          memberId: member.id,
          status: 'NEEDS_CORRECTION',
          timeOut: null,
        },
        data: { timeIn: newTimeIn, timeOut: newTimeOut, status: 'COMPLETED' },
      });
      if (update.count !== 1) {
        throw new ConflictException(
          'The work session was already changed. Refresh and try again.',
        );
      }
      const correction = await database.workSessionCorrection.create({
        data: {
          workSessionId: existing.id,
          memberId: member.id,
          previousTimeIn: existing.timeIn,
          previousTimeOut: existing.timeOut,
          newTimeIn,
          newTimeOut,
          reason: input.reason.trim(),
        },
      });
      const session = await database.workSession.findUniqueOrThrow({
        where: { id: existing.id },
      });
      return {
        session: this.toSession(session, now),
        correction: {
          id: correction.id,
          workSessionId: correction.workSessionId,
          memberId: correction.memberId,
          previousTimeIn: correction.previousTimeIn.toISOString(),
          previousTimeOut: correction.previousTimeOut?.toISOString() ?? null,
          newTimeIn: correction.newTimeIn.toISOString(),
          newTimeOut: correction.newTimeOut.toISOString(),
          reason: correction.reason,
          createdAt: correction.createdAt.toISOString(),
        },
      };
    });
  }

  async refreshStaleSessions(
    now = new Date(),
    memberId?: string,
  ): Promise<void> {
    const threshold = new Date(
      now.getTime() - serverEnvironment.workSessionMaxHours * 60 * 60 * 1_000,
    );
    await this.prisma.workSession.updateMany({
      where: {
        ...(memberId ? { memberId } : {}),
        status: 'OPEN',
        timeOut: null,
        timeIn: { lt: threshold },
      },
      data: { status: 'NEEDS_CORRECTION' },
    });
  }

  private toSession(session: WorkSession, asOf: Date) {
    const effectiveEnd =
      session.timeOut ?? (session.status === 'OPEN' ? asOf : session.timeIn);
    return {
      id: session.id,
      memberId: session.memberId,
      timeIn: session.timeIn.toISOString(),
      timeOut: session.timeOut?.toISOString() ?? null,
      status: session.status,
      durationSeconds: durationSeconds(session.timeIn, effectiveEnd),
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }
}
