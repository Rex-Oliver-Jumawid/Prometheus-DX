import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
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

export const NOTIFICATION_REFRESH_INTERVAL_MS = 30_000;

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
  return infiniteQueryOptions({
    queryKey: notificationKeys.list(filter),
    queryFn: ({ signal, pageParam }) =>
      apiFetch(
        `/notifications?filter=${filter}` +
          (pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''),
        NotificationListResponseSchema,
        { accessToken, signal },
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: NOTIFICATION_REFRESH_INTERVAL_MS,
    // A deep, manually expanded history must not refetch every older page on a timer.
    // The sidebar unread count continues refreshing; focus/reconnect restores the inbox.
    refetchInterval: (query) =>
      ((query.state.data as InfiniteData<NotificationListResponse> | undefined)?.pages.length ?? 0) > 1
        ? false
        : NOTIFICATION_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
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
    staleTime: NOTIFICATION_REFRESH_INTERVAL_MS,
    refetchInterval: NOTIFICATION_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });
}

type NotificationCacheSnapshot = {
  all: InfiniteData<NotificationListResponse> | undefined;
  unread: InfiniteData<NotificationListResponse> | undefined;
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
        all: queryClient.getQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('all'),
        ),
        unread: queryClient.getQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('unread'),
        ),
        count: queryClient.getQueryData<NotificationUnreadCountResponse>(
          notificationKeys.unreadCount,
        ),
      };
      const wasUnread = Boolean(
        snapshot.all?.pages.some((page) => page.items.some((item) => item.id === id && !item.readAt)) ||
        snapshot.unread?.pages.some((page) => page.items.some((item) => item.id === id)),
      );
      const readAt = new Date().toISOString();

      if (snapshot.all) {
        queryClient.setQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('all'),
          {
            ...snapshot.all,
            pages: snapshot.all.pages.map((page) => ({
              ...page,
              items: page.items.map((item) =>
                item.id === id && !item.readAt ? { ...item, readAt } : item,
              ),
            })),
          },
        );
      }
      if (snapshot.unread) {
        queryClient.setQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('unread'),
          { ...snapshot.unread, pages: snapshot.unread.pages.map((page) => ({
            ...page, items: page.items.filter((item) => item.id !== id),
          })) },
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
        all: queryClient.getQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('all'),
        ),
        unread: queryClient.getQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('unread'),
        ),
        count: queryClient.getQueryData<NotificationUnreadCountResponse>(
          notificationKeys.unreadCount,
        ),
      };
      const readAt = new Date().toISOString();

      if (snapshot.all) {
        queryClient.setQueryData<InfiniteData<NotificationListResponse>>(
          notificationKeys.list('all'),
          {
            ...snapshot.all,
            pages: snapshot.all.pages.map((page) => ({
              ...page, items: page.items.map((item) =>
                item.readAt ? item : { ...item, readAt },
              ),
            })),
          },
        );
      }
      if (snapshot.unread) {
        queryClient.setQueryData(notificationKeys.list('unread'), {
          ...snapshot.unread,
          pages: snapshot.unread.pages.map((page) => ({ ...page, items: [] })),
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
