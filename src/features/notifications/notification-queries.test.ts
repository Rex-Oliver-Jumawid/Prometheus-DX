import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_REFRESH_INTERVAL_MS,
  notificationListQuery,
  notificationUnreadCountQuery,
} from './notification-queries';

describe('notification live-refresh query policy', () => {
  it('keeps the open notification list live and recoverable after focus or reconnect', () => {
    const query = notificationListQuery('mentions', 'token');

    expect(query.refetchInterval).toBe(NOTIFICATION_REFRESH_INTERVAL_MS);
    expect(query.refetchIntervalInBackground).toBe(true);
    expect(query.refetchOnWindowFocus).toBe('always');
    expect(query.refetchOnReconnect).toBe('always');
  });

  it('keeps the sidebar unread count on the same live-refresh policy', () => {
    const query = notificationUnreadCountQuery('token');

    expect(query.refetchInterval).toBe(NOTIFICATION_REFRESH_INTERVAL_MS);
    expect(query.refetchIntervalInBackground).toBe(true);
    expect(query.refetchOnWindowFocus).toBe('always');
    expect(query.refetchOnReconnect).toBe('always');
  });
});
