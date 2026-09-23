import { describe, expect, it } from 'vitest';
import {
  NotificationListQuerySchema,
  NotificationSchema,
} from './notification';

describe('notification contracts', () => {
  it('defaults to All and rejects member-scoping query parameters', () => {
    expect(NotificationListQuerySchema.parse({})).toEqual({ filter: 'all' });
    expect(NotificationListQuerySchema.parse({ filter: 'unread' })).toEqual({
      filter: 'unread',
    });
    expect(
      NotificationListQuerySchema.safeParse({ memberId: 'another-member' })
        .success,
    ).toBe(false);
    expect(
      NotificationListQuerySchema.safeParse({ filter: 'archived' }).success,
    ).toBe(false);
  });

  it('accepts a missing linked context without inventing actor or resource data', () => {
    const record = NotificationSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      type: 'PROJECT_LEAD_ASSIGNED',
      actor: null,
      project: null,
      outcome: null,
      newAccessLevel: null,
      createdAt: '2026-09-22T00:00:00.000Z',
      readAt: null,
    });

    expect(record.project).toBeNull();
    expect(record.readAt).toBeNull();
  });
});
