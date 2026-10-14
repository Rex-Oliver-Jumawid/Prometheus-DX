import { describe, expect, it, vi } from 'vitest';
import { WorkSessionIdleReminderService } from './work-session-idle-reminder.service';
import type { PrismaService } from '../database/prisma.service';
import type { PushDeliveryService } from '../notifications/push-delivery.service';

vi.mock('../config/env', () => ({
  serverEnvironment: {
    workSessionMaxHours: 16,
    webPush: { subject: 'mailto:test@example.com', publicKey: 'pub', privateKey: 'priv' },
  },
}));

const memberId = '11111111-1111-4111-8111-111111111111';
const id = '22222222-2222-4222-8222-222222222222';
const now = new Date('2026-10-14T01:00:00Z');

describe('WorkSessionIdleReminderService', () => {
  it('records activity only against an open session and resets its reminder', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new WorkSessionIdleReminderService(
      { workSession: { updateMany } } as unknown as PrismaService,
      {} as PushDeliveryService,
    );
    expect(await service.recordActivity(memberId, now)).toEqual({ recorded: true });
    expect(updateMany).toHaveBeenCalledWith({
      where: { memberId, status: 'OPEN', timeOut: null },
      data: { lastActivityAt: now, idleRemindedAt: null },
    });
  });

  it('claims overdue sessions once and requests a native device push', async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id, memberId, lastActivityAt: new Date('2026-10-14T00:20:00Z'),
    }]);
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const send = vi.fn().mockResolvedValue(1);
    const service = new WorkSessionIdleReminderService(
      { workSession: { findMany, updateMany } } as unknown as PrismaService,
      { sendWorkSessionIdleReminder: send } as unknown as PushDeliveryService,
    );

    expect(await service.deliverDueReminders(now)).toEqual({ checked: 1, sent: 1 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        status: 'OPEN', timeOut: null, idleRemindedAt: null,
      }),
    }));
    expect(send).toHaveBeenCalledWith(memberId, id);
    expect(await service.deliverDueReminders(now)).toEqual({ checked: 1, sent: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('atomically allows a browser banner only after 30 minutes', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const service = new WorkSessionIdleReminderService(
      { workSession: { updateMany } } as unknown as PrismaService,
      {} as PushDeliveryService,
    );
    expect(await service.claimBrowserReminder(memberId, id, now)).toEqual({ claimed: true });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id, memberId, status: 'OPEN', idleRemindedAt: null,
      }),
    }));
  });

  it('does not send if activity wins the race with the scheduler', async () => {
    const send = vi.fn();
    const service = new WorkSessionIdleReminderService(
      { workSession: {
        findMany: vi.fn().mockResolvedValue([{ id, memberId, lastActivityAt: null }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      } } as unknown as PrismaService,
      { sendWorkSessionIdleReminder: send } as unknown as PushDeliveryService,
    );
    expect(await service.deliverDueReminders(now)).toEqual({ checked: 1, sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
