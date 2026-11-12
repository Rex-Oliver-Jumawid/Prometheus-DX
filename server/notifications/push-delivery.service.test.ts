import { afterEach, describe, expect, it, vi } from 'vitest';
import { serverEnvironment } from '../config/env';
import { PushDeliveryService } from './push-delivery.service';
import { sendWebPush } from './web-push';
vi.mock('./web-push', () => ({ sendWebPush: vi.fn() }));

const payload = {
  notificationId: 'message-1',
  title: 'Chat',
  body: 'hello',
  url: '/visiwork',
  tag: 'message-1',
};
function fixture() {
  const delivery = {
    id: 'job-1',
    claimToken: 'claim',
    attempts: 0,
    notification: null,
    payload,
    channelKey: 'visiwork:general',
    subscription: {
      id: 'device-1',
      memberId: 'member-1',
      endpoint: 'https://fcm.googleapis.com/push/token',
      p256dh: 'key',
      auth: 'secret',
      member: { visiworkDepartmentId: null, status: 'ACTIVE' },
    },
  };
  const db = {
    visiWorkMessage: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          body: 'current body',
          member: { fullName: 'Author' },
        }),
    },
    chatPushMute: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([delivery.subscription]),
      deleteMany: vi.fn(),
    },
    pushDelivery: {
      createMany: vi.fn(),
      findMany: vi
        .fn()
        .mockResolvedValueOnce([{ id: delivery.id }])
        .mockResolvedValue([delivery]),
      updateMany: vi.fn(),
    },
  };
  return { db, service: new PushDeliveryService(db as never) };
}
describe('durable background push delivery', () => {
  const previous = serverEnvironment.webPush;
  afterEach(() => {
    serverEnvironment.webPush = previous;
    vi.clearAllMocks();
  });
  function enablePush() {
    serverEnvironment.webPush = {
      subject: 'mailto:test@example.com',
      publicKey: 'key',
      privateKey: 'secret',
    };
  }
  it('persists chat delivery without making a provider request', async () => {
    enablePush();
    const { db, service } = fixture();
    await service.sendChatMessage({
      recipientMemberIds: ['member-1'],
      channelKey: 'visiwork:general',
      channelLabel: 'General',
      body: 'hello',
      url: '/visiwork',
      tag: 'message-1',
    });
    expect(db.pushDelivery.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          subscriptionId: 'device-1',
          payload: expect.objectContaining({ body: 'hello' }),
        }),
      ],
    });
    expect(sendWebPush).not.toHaveBeenCalled();
  });
  it('claims queued work and records retry state after a transient failure', async () => {
    enablePush();
    vi.mocked(sendWebPush).mockResolvedValue({
      ok: false,
      stale: false,
      error: 'timeout',
    });
    const { db, service } = fixture();
    await service.flushPendingDeliveries();
    expect(db.pushDelivery.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ claimToken: expect.any(String) }),
      }),
    );
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'job-1', claimToken: 'claim' },
        data: expect.objectContaining({
          attempts: { increment: 1 },
          claimToken: null,
          nextAttemptAt: expect.any(Date),
        }),
      }),
    );
  });
  it('rechecks mute preferences before sending queued content', async () => {
    enablePush();
    const { db, service } = fixture();
    db.chatPushMute.findUnique.mockResolvedValue({
      memberId: 'member-1',
    } as never);
    await service.flushPendingDeliveries();
    expect(sendWebPush).not.toHaveBeenCalled();
    expect(db.pushDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deliveredAt: expect.any(Date) }),
      }),
    );
  });
  it('uses current message content after an edit', async () => {
    enablePush();
    vi.mocked(sendWebPush).mockResolvedValue({
      ok: true,
      stale: false,
      error: null,
    });
    const { service } = fixture();
    await service.flushPendingDeliveries();
    expect(sendWebPush).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: 'Author: “current body”' }),
      expect.anything(),
    );
  });
  it('suppresses queued content after message deletion', async () => {
    enablePush();
    const { db, service } = fixture();
    db.visiWorkMessage.findFirst.mockResolvedValue(null);
    await service.flushPendingDeliveries();
    expect(sendWebPush).not.toHaveBeenCalled();
  });
});
