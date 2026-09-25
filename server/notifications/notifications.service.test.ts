import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { NotificationsService } from './notifications.service';

const recipientId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const notificationId = '33333333-3333-4333-8333-333333333333';
const createdAt = new Date('2026-09-22T00:00:00.000Z');

function fixture() {
  let readAt: Date | null = null;
  const notification = {
    findMany: vi.fn().mockResolvedValue([
      {
        id: notificationId,
        type: 'PROJECT_MEMBER_ACCESS_CHANGED',
        data: { accessLevel: 'CAN_EDIT' },
        createdAt,
        readAt: null,
        actorMember: { id: otherId, fullName: 'Project Lead' },
        project: { id: '44444444-4444-4444-8444-444444444444', name: 'Launch' },
        outcome: null,
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
    updateMany: vi
      .fn()
      .mockImplementation(
        ({
          where,
          data,
        }: {
          where: { recipientMemberId: string; id?: string };
          data: { readAt: Date };
        }) => {
          if (where.recipientMemberId !== recipientId)
            return Promise.resolve({ count: 0 });
          if (where.id && where.id !== notificationId)
            return Promise.resolve({ count: 0 });
          if (readAt) return Promise.resolve({ count: 0 });
          readAt = data.readAt;
          return Promise.resolve({ count: 1 });
        },
      ),
    findFirst: vi
      .fn()
      .mockImplementation(
        ({ where }: { where: { recipientMemberId: string; id: string } }) =>
          Promise.resolve(
            where.recipientMemberId === recipientId &&
              where.id === notificationId
              ? { readAt }
              : null,
          ),
      ),
  };
  const prisma = { notification } as unknown as PrismaService;
  return { service: new NotificationsService(prisma), notification };
}

describe('NotificationsService', () => {
  it('lists only the current recipient in deterministic order with typed context', async () => {
    const { service, notification } = fixture();

    await expect(service.list(recipientId, { filter: 'all' })).resolves.toEqual(
      {
        items: [
          {
            id: notificationId,
            type: 'PROJECT_MEMBER_ACCESS_CHANGED',
            actor: { id: otherId, fullName: 'Project Lead' },
            project: {
              id: '44444444-4444-4444-8444-444444444444',
              name: 'Launch',
            },
            outcome: null,
            newAccessLevel: 'CAN_EDIT',
            createdAt: createdAt.toISOString(),
            readAt: null,
          },
        ],
        nextCursor: null,
      },
    );
    expect(notification.findMany).toHaveBeenCalledWith({
      where: { recipientMemberId: recipientId },
      relationLoadStrategy: 'join',
      select: expect.any(Object),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 41,
    });

    await service.list(recipientId, { filter: 'unread' });
    expect(notification.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { recipientMemberId: recipientId, readAt: null },
      }),
    );
  });

  it('uses recipient-scoped keyset cursors and limits list page size', async () => {
    const { service, notification } = fixture();
    const rows = Array.from({ length: 41 }, (_, i) => ({
      id: `33333333-3333-4333-8333-${String(41 - i).padStart(12, '0')}`,
      type: 'PROJECT_LEAD_ASSIGNED', data: {}, createdAt, readAt: null,
      actorMember: { id: otherId, fullName: 'Project Lead' },
      project: null, outcome: null,
    }));
    notification.findMany.mockResolvedValueOnce(rows);
    const first = await service.list(recipientId, { filter: 'all' });
    expect(first.items).toHaveLength(40);
    expect(first.nextCursor).toBe(rows[39].id);
    expect(notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 41, where: { recipientMemberId: recipientId } }),
    );

    notification.findFirst.mockResolvedValueOnce({ id: rows[39].id, createdAt });
    notification.findMany.mockResolvedValueOnce([rows[40]]);
    const second = await service.list(recipientId, { filter: 'all', cursor: first.nextCursor! });
    expect(second.items.map((item) => item.id)).toEqual([rows[40].id]);
    expect(second.nextCursor).toBeNull();
    expect(notification.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { recipientMemberId: recipientId, OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: rows[39].id } },
      ] },
    }));
  });

  it('rejects a cursor that does not belong to the recipient', async () => {
    const { service, notification } = fixture();
    notification.findFirst.mockResolvedValueOnce(null);
    await expect(service.list(otherId, { filter: 'all', cursor: notificationId }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(notification.findMany).not.toHaveBeenCalled();
  });

  it('counts unread notifications only for the current recipient', async () => {
    const { service, notification } = fixture();

    await expect(service.unreadCount(recipientId)).resolves.toEqual({
      count: 1,
    });
    expect(notification.count).toHaveBeenCalledWith({
      where: { recipientMemberId: recipientId, readAt: null },
    });
  });

  it('marks one owned notification read idempotently', async () => {
    const { service, notification } = fixture();

    const first = await service.markRead(recipientId, notificationId);
    const second = await service.markRead(recipientId, notificationId);

    expect(second).toEqual(first);
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: {
        id: notificationId,
        recipientMemberId: recipientId,
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    expect(notification.findFirst).toHaveBeenCalledWith({
      where: { id: notificationId, recipientMemberId: recipientId },
      select: { readAt: true },
    });
  });

  it('does not reveal or mutate another recipient notification', async () => {
    const { service, notification } = fixture();

    await expect(
      service.markRead(otherId, notificationId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { id: notificationId, recipientMemberId: otherId, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });

  it('marks all owned unread records and handles an empty update', async () => {
    const { service, notification } = fixture();

    const first = await service.markAllRead(recipientId);
    const second = await service.markAllRead(recipientId);

    expect(first.updatedCount).toBe(1);
    expect(second.updatedCount).toBe(0);
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { recipientMemberId: recipientId, readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
