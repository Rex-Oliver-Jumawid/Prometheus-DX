import { describe, expect, it } from 'vitest';
import {
  NotificationListResponseSchema,
  UnreadNotificationCountSchema,
} from './notification';

describe('notification contracts', () => {
  it('accepts the backend inbox shape', () => {
    expect(
      NotificationListResponseSchema.parse({
        notifications: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'SUBMISSION_CREATED',
            project: {
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Project',
            },
            outcome: {
              id: '33333333-3333-4333-8333-333333333333',
              title: 'Outcome',
            },
            actor: {
              id: '44444444-4444-4444-8444-444444444444',
              fullName: 'Member',
            },
            createdAt: '2026-09-18T00:00:00.000Z',
            readAt: null,
          },
        ],
      }).notifications,
    ).toHaveLength(1);
    expect(UnreadNotificationCountSchema.parse({ count: 1 })).toEqual({
      count: 1,
    });
  });
});
