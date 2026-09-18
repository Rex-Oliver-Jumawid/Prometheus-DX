import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { Member, WorkSession } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { WorkSessionsService } from './work-sessions.service';

const currentMember = { id: '11111111-1111-4111-8111-111111111111' } as Member;

const session = (overrides: Partial<WorkSession> = {}): WorkSession => ({
  id: '22222222-2222-4222-8222-222222222222',
  memberId: currentMember.id,
  timeIn: new Date('2026-09-18T00:00:00.000Z'),
  timeOut: null,
  status: 'OPEN',
  createdAt: new Date('2026-09-18T00:00:00.000Z'),
  updatedAt: new Date('2026-09-18T00:00:00.000Z'),
  ...overrides,
});

describe('WorkSessionsService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-18T04:00:00.000Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('denies Time In while an unresolved session exists', async () => {
    const prisma = {
      workSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(session()),
      },
    } as unknown as PrismaService;

    await expect(
      new WorkSessionsService(prisma).timeIn(currentMember),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('atomically completes only the authenticated member active session', async () => {
    const completed = session({
      timeOut: new Date('2026-09-18T04:00:00.000Z'),
      status: 'COMPLETED',
    });
    const database = {
      workSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue(completed),
      },
    };
    const prisma = {
      workSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(session()),
      },
      $transaction: vi.fn((callback) => callback(database)),
    } as unknown as PrismaService;

    const result = await new WorkSessionsService(prisma).timeOut(currentMember);

    expect(database.workSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          memberId: currentMember.id,
          status: 'OPEN',
          timeOut: null,
        }),
      }),
    );
    expect(result.session?.durationSeconds).toBe(14_400);
  });

  it('marks stale open sessions for correction without closing them', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = { workSession: { updateMany } } as unknown as PrismaService;

    await new WorkSessionsService(prisma).refreshStaleSessions(
      new Date('2026-09-18T20:00:00.000Z'),
      currentMember.id,
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        memberId: currentMember.id,
        status: 'OPEN',
        timeOut: null,
        timeIn: { lt: new Date('2026-09-18T04:00:00.000Z') },
      },
      data: { status: 'NEEDS_CORRECTION' },
    });
  });

  it('denies correction of another member session regardless of role', async () => {
    const prisma = {
      workSession: {
        findUnique: vi
          .fn()
          .mockResolvedValue(
            session({ memberId: '33333333-3333-4333-8333-333333333333' }),
          ),
      },
    } as unknown as PrismaService;

    await expect(
      new WorkSessionsService(prisma).correct(
        { ...currentMember, workspaceRole: 'ADMINISTRATOR' },
        session().id,
        {
          newTimeIn: '2026-09-18T00:00:00.000Z',
          newTimeOut: '2026-09-18T03:00:00.000Z',
          reason: 'Forgot to time out.',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('keeps multiple weekly sessions separate and totals exact duration', async () => {
    const prisma = {
      workSession: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findMany: vi.fn().mockResolvedValue([
          session({
            id: '22222222-2222-4222-8222-222222222223',
            timeIn: new Date('2026-09-18T15:00:00.000Z'),
            timeOut: new Date('2026-09-18T17:00:00.000Z'),
            status: 'COMPLETED',
          }),
          session({
            timeOut: new Date('2026-09-18T01:30:00.000Z'),
            status: 'COMPLETED',
          }),
        ]),
      },
    } as unknown as PrismaService;

    const result = await new WorkSessionsService(prisma).getHistory(
      currentMember,
      '2026-09-18',
    );

    expect(result.sessions).toHaveLength(2);
    expect(result.totalDurationSeconds).toBe(12_600);
  });
});
