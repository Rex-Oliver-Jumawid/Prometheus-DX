import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type {
  Member,
  MemberSchedule as PrismaMemberSchedule,
  ScheduleBlock as PrismaScheduleBlock,
} from '@prisma/client';
import type {
  MemberSchedule,
  TeamScheduleResponse,
  UpdateScheduleRequest,
  Weekday,
} from '../../shared/contracts/schedule';
import {
  findScheduleConflict,
  WEEKDAYS,
} from '../../shared/contracts/schedule';
import { PrismaService } from '../database/prisma.service';

type ScheduleWithBlocks = PrismaMemberSchedule & {
  blocks: PrismaScheduleBlock[];
};

@Injectable()
export class ScheduleService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getTeamSchedule(): Promise<TeamScheduleResponse> {
    const members = await this.prisma.member.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        fullName: true,
        position: true,
        department: {
          select: { id: true, name: true, shortLabel: true },
        },
        schedule: {
          include: {
            blocks: {
              orderBy: [
                { weekday: 'asc' },
                { startTime: 'asc' },
                { endTime: 'asc' },
                { id: 'asc' },
              ],
            },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      timezone: 'Asia/Manila',
      members: members.map((member) => ({
        ...member,
        schedule: member.schedule
          ? this.toSchedule(member.schedule as ScheduleWithBlocks)
          : null,
      })),
    };
  }

  async getMemberSchedule(memberId: string): Promise<MemberSchedule | null> {
    const schedule = await this.prisma.memberSchedule.findUnique({
      where: { memberId },
      include: {
        blocks: {
          orderBy: [
            { weekday: 'asc' },
            { startTime: 'asc' },
            { endTime: 'asc' },
            { id: 'asc' },
          ],
        },
      },
    });
    return schedule ? this.toSchedule(schedule) : null;
  }

  async replaceMemberSchedule(
    currentMember: Member,
    memberId: string,
    input: UpdateScheduleRequest,
  ): Promise<MemberSchedule> {
    if (currentMember.id !== memberId) {
      throw new ForbiddenException('You can only change your own schedule.');
    }
    if (findScheduleConflict(input.blocks)) {
      throw new BadRequestException(
        'Schedule blocks on the same day cannot overlap.',
      );
    }

    // Older callers omitted rest days and relied on the last two unscheduled
    // days. An explicit [] must remain [] and survive a save/reload.
    const restDays = input.restDays ?? WEEKDAYS.filter(
      (day) => !input.blocks.some((block) => block.weekday === day),
    ).slice(-2);

    const schedule = await this.prisma.$transaction(async (database) => {
      const saved = await database.memberSchedule.upsert({
        where: { memberId },
        create: { memberId, targetWeeklyMinutes: input.targetWeeklyMinutes, restDays },
        update: { targetWeeklyMinutes: input.targetWeeklyMinutes, restDays },
      });

      await database.scheduleBlock.deleteMany({
        where: { scheduleId: saved.id },
      });
      if (input.blocks.length > 0) {
        await database.scheduleBlock.createMany({
          data: input.blocks.map((block) => ({
            scheduleId: saved.id,
            weekday: block.weekday,
            startTime: this.toDatabaseTime(block.startTime),
            endTime: this.toDatabaseTime(block.endTime),
          })),
        });
      }

      return database.memberSchedule.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          blocks: {
            orderBy: [
              { weekday: 'asc' },
              { startTime: 'asc' },
              { endTime: 'asc' },
              { id: 'asc' },
            ],
          },
        },
      });
    });

    return this.toSchedule(schedule);
  }

  private toDatabaseTime(value: string): Date {
    return new Date(`1970-01-01T${value}:00.000Z`);
  }

  private toClockTime(value: Date): string {
    return `${String(value.getUTCHours()).padStart(2, '0')}:${String(
      value.getUTCMinutes(),
    ).padStart(2, '0')}`;
  }

  private toSchedule(schedule: ScheduleWithBlocks): MemberSchedule {
    return {
      id: schedule.id,
      memberId: schedule.memberId,
      targetWeeklyMinutes: schedule.targetWeeklyMinutes,
      restDays: schedule.restDays,
      blocks: [...schedule.blocks]
        .sort(
          (left, right) =>
            WEEKDAYS.indexOf(left.weekday as Weekday) -
              WEEKDAYS.indexOf(right.weekday as Weekday) ||
            left.startTime.getTime() - right.startTime.getTime() ||
            left.endTime.getTime() - right.endTime.getTime() ||
            left.id.localeCompare(right.id),
        )
        .map((block) => ({
          id: block.id,
          weekday: block.weekday,
          startTime: this.toClockTime(block.startTime),
          endTime: this.toClockTime(block.endTime),
        })),
      createdAt: schedule.createdAt.toISOString(),
      updatedAt: schedule.updatedAt.toISOString(),
    };
  }
}
