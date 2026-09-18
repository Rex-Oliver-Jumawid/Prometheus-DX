import { queryOptions } from '@tanstack/react-query';
import {
  NotificationListResponseSchema,
  NotificationSchema,
  UnreadNotificationCountSchema,
  type NotificationListResponse,
  type NotificationView,
  type UnreadNotificationCount,
} from '../../../shared/contracts/notification';
import { apiFetch } from '../../lib/api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

export function notificationsListQuery(accessToken?: string) {
  return queryOptions({
    queryKey: notificationKeys.list,
    queryFn: ({ signal }) =>
      apiFetch('/notifications', NotificationListResponseSchema, {
        accessToken,
        signal,
      }),
    staleTime: 30_000,
  });
}

export function unreadNotificationCountQuery(accessToken?: string) {
  return queryOptions({
    queryKey: notificationKeys.unreadCount,
    queryFn: ({ signal }) =>
      apiFetch('/notifications/unread-count', UnreadNotificationCountSchema, {
        accessToken,
        signal,
      }),
    staleTime: 30_000,
  });
}

export function markNotificationRead(
  notificationId: string,
  accessToken?: string,
) {
  return apiFetch(`/notifications/${notificationId}/read`, NotificationSchema, {
    accessToken,
    method: 'PUT',
  });
}

export function markAllNotificationsRead(accessToken?: string) {
  return apiFetch('/notifications/read-all', UnreadNotificationCountSchema, {
    accessToken,
    method: 'PUT',
  });
}

export interface NotificationCacheSnapshot {
  list?: NotificationListResponse;
  count?: UnreadNotificationCount;
}

export function markNotificationReadInCache(
  current: NotificationListResponse | undefined,
  notificationId: string,
  readAt: string,
) {
  if (!current) return current;
  return {
    notifications: current.notifications.map((notification) =>
      notification.id === notificationId && !notification.readAt
        ? { ...notification, readAt }
        : notification,
    ),
  } satisfies NotificationListResponse;
}

export function markAllNotificationsReadInCache(
  current: NotificationListResponse | undefined,
  readAt: string,
) {
  if (!current) return current;
  return {
    notifications: current.notifications.map((notification) =>
      notification.readAt ? notification : { ...notification, readAt },
    ),
  } satisfies NotificationListResponse;
}

export function notificationDestination(notification: NotificationView) {
  return notification.outcome
    ? `/projects/${notification.project.id}/outcomes/${notification.outcome.id}`
    : `/projects/${notification.project.id}`;
}
