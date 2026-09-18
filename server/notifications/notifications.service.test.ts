import { NotFoundException } from '@nestjs/common';
import type { Member, Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import {
  createNotificationEvent,
  NotificationsService,
} from './notifications.service';

const memberA = {
  id: '11111111-1111-4111-8111-111111111111',
} as Member;
const memberBId = '22222222-2222-4222-8222-222222222222';
const projectId = '33333333-3333-4333-8333-333333333333';
const outcomeId = '44444444-4444-4444-8444-444444444444';

describe('notification event creation', () => {
  it('targets unique non-actor recipients with a database idempotency key', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    await createNotificationEvent(
      { notification: { createMany } } as unknown as Prisma.TransactionClient,
      {
        type: 'REVISION_REQUESTED',
        sourceEventId: '55555555-5555-4555-8555-555555555555',
        recipientMemberIds: [memberA.id, memberBId, memberBId],
        actorMemberId: memberA.id,
        projectId,
        outcomeId,
      },
    );

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          recipientMemberId: memberBId,
          type: 'REVISION_REQUESTED',
          eventKey: 'REVISION_REQUESTED:55555555-5555-4555-8555-555555555555',
          projectId,
          outcomeId,
          actorMemberId: memberA.id,
        },
      ],
      skipDuplicates: true,
    });
  });
});

describe('NotificationsService inbox authority', () => {
  it('always scopes inbox and unread queries to CurrentMember', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(3);
    const service = new NotificationsService({
      notification: { findMany, count },
    } as unknown as PrismaService);

    await expect(service.list(memberA)).resolves.toEqual({ notifications: [] });
    await expect(service.unreadCount(memberA)).resolves.toEqual({ count: 3 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipientMemberId: memberA.id } }),
    );
    expect(count).toHaveBeenCalledWith({
      where: { recipientMemberId: memberA.id, readAt: null },
    });
  });

  it('cannot mark another member notification read', async () => {
    const update = vi.fn();
    const service = new NotificationsService({
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
        update,
      },
    } as unknown as PrismaService);

    await expect(
      service.markRead(memberA, '66666666-6666-4666-8666-666666666666'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });
});
