import { ForbiddenException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ScheduleService } from './schedule.service';

const member = (overrides: Partial<Member> = {}): Member => ({
  id: '11111111-1111-4111-8111-111111111111',
  authUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  email: 'member@example.com',
  fullName: 'Member One',
  departmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  visiworkDepartmentId: null,
  workspaceRole: 'MEMBER',
  status: 'ACTIVE',
  position: null,
  nickname: null,
  phoneNumber: null,
  about: null,
  profileImagePath: null,
  invitationSentAt: null,
  deactivatedAt: null,
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  ...overrides,
});

describe('ScheduleService', () => {
  it('denies another member even when the caller is an administrator', async () => {
    const service = new ScheduleService({} as PrismaService);

    await expect(
      service.replaceMemberSchedule(
        member({ workspaceRole: 'ADMINISTRATOR' }),
        '22222222-2222-4222-8222-222222222222',
        { targetWeeklyMinutes: 0, blocks: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('atomically replaces the caller schedule, including removing all blocks', async () => {
    const upsert = vi.fn().mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
    });
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const createMany = vi.fn();
    const findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      memberId: '11111111-1111-4111-8111-111111111111',
      targetWeeklyMinutes: 0,
      restDays: ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      createdAt: new Date('2026-09-18T00:00:00.000Z'),
      updatedAt: new Date('2026-09-18T01:00:00.000Z'),
      blocks: [],
    });
    const database = {
      memberSchedule: { upsert, findUniqueOrThrow },
      scheduleBlock: { deleteMany, createMany },
    };
    const transaction = vi.fn(
      (operation: (value: typeof database) => unknown) => operation(database),
    );
    const service = new ScheduleService({
      $transaction: transaction,
    } as unknown as PrismaService);

    const result = await service.replaceMemberSchedule(member(), member().id, {
      targetWeeklyMinutes: 0,
      restDays: ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      blocks: [],
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledWith({
      where: { memberId: member().id },
      create: {
        memberId: member().id,
        targetWeeklyMinutes: 0,
        restDays: ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      },
      update: {
        targetWeeklyMinutes: 0,
        restDays: ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { scheduleId: '33333333-3333-4333-8333-333333333333' },
    });
    expect(createMany).not.toHaveBeenCalled();
    expect(result.blocks).toEqual([]);
    expect(result.restDays).toEqual(['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);
  });

  it('stores midnight endpoints and restores the end-of-day API value', async () => {
    const createMany = vi.fn();
    const schedule = {
      id: '33333333-3333-4333-8333-333333333333', memberId: member().id,
      targetWeeklyMinutes: 1440, restDays: [],
      createdAt: new Date('2026-09-18T00:00:00Z'), updatedAt: new Date('2026-09-18T00:00:00Z'),
      blocks: [{ id: '44444444-4444-4444-8444-444444444444', weekday: 'MONDAY',
        startTime: new Date('1970-01-01T00:00:00Z'), endTime: new Date('1970-01-01T00:00:00Z') }],
    };
    const database = {
      memberSchedule: { upsert: vi.fn().mockResolvedValue(schedule), findUniqueOrThrow: vi.fn().mockResolvedValue(schedule) },
      scheduleBlock: { deleteMany: vi.fn(), createMany },
    };
    const service = new ScheduleService({
      $transaction: (operation: (value: typeof database) => unknown) => operation(database),
      memberSchedule: { findUnique: vi.fn().mockResolvedValue(schedule) },
    } as unknown as PrismaService);
    const saved = await service.replaceMemberSchedule(member(), member().id, {
      targetWeeklyMinutes: 1440, restDays: [],
      blocks: [{ weekday: 'MONDAY', startTime: '00:00', endTime: '24:00' }],
    });
    expect(createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      startTime: new Date('1970-01-01T00:00:00Z'), endTime: new Date('1970-01-01T00:00:00Z'),
    })] });
    expect(saved.blocks[0]).toMatchObject({ startTime: '00:00', endTime: '24:00' });
    expect((await service.getMemberSchedule(member().id))?.blocks[0]).toMatchObject({ startTime: '00:00', endTime: '24:00' });
  });

  it('lists only active Registry members in deterministic name order', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        fullName: 'Alpha Member',
        position: 'Designer',
        department: {
          id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          name: 'Creatives',
          shortLabel: 'CRT',
        },
        schedule: null,
      },
    ]);
    const service = new ScheduleService({
      member: { findMany },
    } as unknown as PrismaService);

    await expect(service.getTeamSchedule()).resolves.toEqual({
      timezone: 'Asia/Manila',
      members: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          fullName: 'Alpha Member',
          position: 'Designer',
          department: {
            id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
            name: 'Creatives',
            shortLabel: 'CRT',
          },
          schedule: null,
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ACTIVE' },
        orderBy: [{ fullName: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });
});
