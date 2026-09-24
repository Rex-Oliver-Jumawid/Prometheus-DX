import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  NotificationListResponseSchema,
  NotificationReadAllResponseSchema,
  NotificationReadResponseSchema,
  NotificationUnreadCountResponseSchema,
  type NotificationListResponse,
  type NotificationUnreadCountResponse,
} from '../../../shared/contracts/notification';
import { apiFetch } from '../../lib/api';

export type NotificationFilter = 'all' | 'unread' | 'mentions' | 'projects';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filter: NotificationFilter) =>
    ['notifications', 'list', filter] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

export function notificationListQuery(
  filter: NotificationFilter,
  accessToken?: string,
) {
  return queryOptions({
    queryKey: notificationKeys.list(filter),
    queryFn: ({ signal }) =>
      apiFetch(
        `/notifications?filter=${filter}`,
        NotificationListResponseSchema,
        { accessToken, signal },
      ),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}

export function notificationUnreadCountQuery(accessToken?: string) {
  return queryOptions({
    queryKey: notificationKeys.unreadCount,
    queryFn: ({ signal }) =>
      apiFetch(
        '/notifications/unread-count',
        NotificationUnreadCountResponseSchema,
        { accessToken, signal },
      ),
    staleTime: 15_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

type NotificationCacheSnapshot = {
  all: NotificationListResponse | undefined;
  unread: NotificationListResponse | undefined;
  count: NotificationUnreadCountResponse | undefined;
};

export function useMarkNotificationRead(accessToken?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    scope: { id: 'notifications-read' },
    mutationFn: (id: string) =>
      apiFetch(`/notifications/${id}/read`, NotificationReadResponseSchema, {
        accessToken,
        method: 'PUT',
      }),
    onMutate: async (id): Promise<NotificationCacheSnapshot> => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const snapshot = {
        all: queryClient.getQueryData<NotificationListResponse>(
          notificationKeys.list('all'),
        ),
        unread: queryClient.getQueryData<NotificationListResponse>(
          notificationKeys.list('unread'),
        ),
        count: queryClient.getQueryData<NotificationUnreadCountResponse>(
          notificationKeys.unreadCount,
        ),
      };
      const wasUnread = Boolean(
        snapshot.all?.items.some((item) => item.id === id && !item.readAt) ||
        snapshot.unread?.items.some((item) => item.id === id),
      );
      const readAt = new Date().toISOString();

      if (snapshot.all) {
        queryClient.setQueryData<NotificationListResponse>(
          notificationKeys.list('all'),
          {
            items: snapshot.all.items.map((item) =>
              item.id === id && !item.readAt ? { ...item, readAt } : item,
            ),
          },
        );
      }
      if (snapshot.unread) {
        queryClient.setQueryData<NotificationListResponse>(
          notificationKeys.list('unread'),
          { items: snapshot.unread.items.filter((item) => item.id !== id) },
        );
      }
      if (wasUnread && snapshot.count) {
        queryClient.setQueryData(notificationKeys.unreadCount, {
          count: Math.max(0, snapshot.count.count - 1),
        });
      }
      return snapshot;
    },
    onError: (_error, _id, snapshot) => {
      if (!snapshot) return;
      if (snapshot.all)
        queryClient.setQueryData(notificationKeys.list('all'), snapshot.all);
      if (snapshot.unread)
        queryClient.setQueryData(
          notificationKeys.list('unread'),
          snapshot.unread,
        );
      if (snapshot.count)
        queryClient.setQueryData(notificationKeys.unreadCount, snapshot.count);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsRead(accessToken?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    scope: { id: 'notifications-read' },
    mutationFn: () =>
      apiFetch('/notifications/read-all', NotificationReadAllResponseSchema, {
        accessToken,
        method: 'PUT',
      }),
    onMutate: async (): Promise<NotificationCacheSnapshot> => {
      await queryClient.cancelQueries({ queryKey: notificationKeys.all });
      const snapshot = {
        all: queryClient.getQueryData<NotificationListResponse>(
          notificationKeys.list('all'),
        ),
        unread: queryClient.getQueryData<NotificationListResponse>(
          notificationKeys.list('unread'),
        ),
        count: queryClient.getQueryData<NotificationUnreadCountResponse>(
          notificationKeys.unreadCount,
        ),
      };
      const readAt = new Date().toISOString();

      if (snapshot.all) {
        queryClient.setQueryData<NotificationListResponse>(
          notificationKeys.list('all'),
          {
            items: snapshot.all.items.map((item) =>
              item.readAt ? item : { ...item, readAt },
            ),
          },
        );
      }
      if (snapshot.unread) {
        queryClient.setQueryData(notificationKeys.list('unread'), {
          items: [],
        });
      }
      if (snapshot.count) {
        queryClient.setQueryData(notificationKeys.unreadCount, { count: 0 });
      }
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      if (!snapshot) return;
      if (snapshot.all)
        queryClient.setQueryData(notificationKeys.list('all'), snapshot.all);
      if (snapshot.unread)
        queryClient.setQueryData(
          notificationKeys.list('unread'),
          snapshot.unread,
        );
      if (snapshot.count)
        queryClient.setQueryData(notificationKeys.unreadCount, snapshot.count);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
