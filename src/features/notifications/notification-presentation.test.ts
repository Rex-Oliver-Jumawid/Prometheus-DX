import { describe, expect, it } from 'vitest';
import type { Notification } from '../../../shared/contracts/notification';
import { notificationPath, presentNotification } from './notification-presentation';

describe('notification presentation for VisiWork mentions', () => {
  it('links a General Chat mention directly to the referenced message', () => {
    const notification: Notification = {
      id: '11111111-1111-4111-8111-111111111111',
      type: 'VISIWORK_MENTION',
      actor: {
        id: '22222222-2222-4222-8222-222222222222',
        fullName: 'Rex',
      },
      project: null,
      outcome: null,
      newAccessLevel: null,
      visiworkMention: {
        messageId: '33333333-3333-4333-8333-333333333333',
        departmentId: null,
        roomLabel: 'General Chat',
        preview: 'Can @Oliver review this?',
      },
      createdAt: '2026-09-24T07:00:00.000Z',
      readAt: null,
    };

    expect(presentNotification(notification)).toMatchObject({
      title: 'You were mentioned in VisiWork',
      category: 'Mention',
    });
    expect(notificationPath(notification)).toBe(
      '/visiwork?message=33333333-3333-4333-8333-333333333333',
    );
  });

  it('links a department mention to the room and exact message', () => {
    const notification: Notification = {
      id: '44444444-4444-4444-8444-444444444444',
      type: 'VISIWORK_MENTION',
      actor: null,
      project: null,
      outcome: null,
      newAccessLevel: null,
      visiworkMention: {
        messageId: '55555555-5555-4555-8555-555555555555',
        departmentId: '66666666-6666-4666-8666-666666666666',
        roomLabel: 'R&D Chat',
        preview: 'Please check this.',
      },
      createdAt: '2026-09-24T07:00:00.000Z',
      readAt: null,
    };

    expect(notificationPath(notification)).toBe(
      '/visiwork?message=55555555-5555-4555-8555-555555555555&department=66666666-6666-4666-8666-666666666666',
    );
  });
});
