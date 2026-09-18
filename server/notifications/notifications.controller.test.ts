import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';

describe('NotificationsController', () => {
  it('derives inbox and read-state ownership exclusively from CurrentMember', () => {
    const list = vi.fn();
    const markRead = vi.fn();
    const controller = new NotificationsController({
      list,
      markRead,
    } as unknown as NotificationsService);
    const member = { id: '11111111-1111-4111-8111-111111111111' } as Member;
    const notificationId = '22222222-2222-4222-8222-222222222222';

    controller.list(member);
    controller.markRead(member, notificationId);

    expect(list).toHaveBeenCalledWith(member);
    expect(markRead).toHaveBeenCalledWith(member, notificationId);
  });
});
