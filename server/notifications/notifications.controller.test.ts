import { BadRequestException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsController } from './notifications.controller';
import type { NotificationsService } from './notifications.service';

const currentMember = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceRole: 'ADMINISTRATOR',
} as Member;
const notificationId = '22222222-2222-4222-8222-222222222222';

function fixture() {
  const service = {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  };
  return {
    controller: new NotificationsController(
      service as unknown as NotificationsService,
    ),
    service,
  };
}

describe('NotificationsController', () => {
  it('uses only the authenticated member for both list filters and unread count', () => {
    const { controller, service } = fixture();

    controller.list(currentMember, {});
    controller.list(currentMember, { filter: 'unread' });
    controller.unreadCount(currentMember);

    expect(service.list).toHaveBeenNthCalledWith(1, currentMember.id, {
      filter: 'all',
    });
    expect(service.list).toHaveBeenNthCalledWith(2, currentMember.id, {
      filter: 'unread',
    });
    expect(service.unreadCount).toHaveBeenCalledWith(currentMember.id);
  });

  it('rejects attempts to select another member through query parameters', () => {
    const { controller, service } = fixture();

    expect(() =>
      controller.list(currentMember, {
        filter: 'all',
        memberId: notificationId,
      }),
    ).toThrow(BadRequestException);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('uses the authenticated member for individual and bulk read mutations', () => {
    const { controller, service } = fixture();

    controller.markRead(currentMember, notificationId);
    controller.markAllRead(currentMember);

    expect(service.markRead).toHaveBeenCalledWith(
      currentMember.id,
      notificationId,
    );
    expect(service.markAllRead).toHaveBeenCalledWith(currentMember.id);
  });
});
