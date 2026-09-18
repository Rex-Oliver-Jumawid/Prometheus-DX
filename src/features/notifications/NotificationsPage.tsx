import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  NotificationListResponse,
  NotificationType,
  NotificationView,
  UnreadNotificationCount,
} from '../../../shared/contracts/notification';
import { useAuth } from '../auth/auth-context';
import {
  markAllNotificationsRead,
  markAllNotificationsReadInCache,
  markNotificationRead,
  markNotificationReadInCache,
  notificationDestination,
  notificationKeys,
  notificationsListQuery,
  type NotificationCacheSnapshot,
} from './notification-queries';
import './notifications.css';

type NotificationFilter = 'all' | 'unread';

const notificationCopy: Record<
  NotificationType,
  { title: string; kind: string; icon: string }
> = {
  OUTCOME_JOINED: { title: 'Outcome joined', kind: 'Project', icon: '+' },
  SUBMISSION_CREATED: {
    title: 'Output ready for review',
    kind: 'Review',
    icon: '✓',
  },
  REVISION_REQUESTED: {
    title: 'Revision requested',
    kind: 'Review',
    icon: '↺',
  },
  OUTCOME_ACCEPTED: { title: 'Outcome accepted', kind: 'Review', icon: '✓' },
};

function actorName(notification: NotificationView) {
  return notification.actor?.fullName ?? 'A team member';
}

function notificationMessage(notification: NotificationView) {
  const actor = actorName(notification);
  const outcome = notification.outcome?.title;
  switch (notification.type) {
    case 'OUTCOME_JOINED':
      return `${actor} joined ${outcome ?? 'an Outcome'} in ${notification.project.name}.`;
    case 'SUBMISSION_CREATED':
      return `${actor} submitted output for ${outcome ?? 'an Outcome'} in ${notification.project.name}.`;
    case 'REVISION_REQUESTED':
      return `${actor} requested a revision for ${outcome ?? 'an Outcome'} in ${notification.project.name}.`;
    case 'OUTCOME_ACCEPTED':
      return `${actor} accepted ${outcome ?? 'an Outcome'} in ${notification.project.name}.`;
  }
}

function formatNotificationTime(value: string, now = new Date()) {
  const date = new Date(value);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (absoluteSeconds < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 7) return formatter.format(days, 'day');
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Notifications could not be loaded. Please try again.';
}

export function NotificationsPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const notifications = useQuery({
    ...notificationsListQuery(accessToken),
    enabled: Boolean(accessToken),
  });

  const snapshotAndCancel = async (): Promise<NotificationCacheSnapshot> => {
    await Promise.all([
      queryClient.cancelQueries({ queryKey: notificationKeys.list }),
      queryClient.cancelQueries({ queryKey: notificationKeys.unreadCount }),
    ]);
    return {
      list: queryClient.getQueryData(notificationKeys.list),
      count: queryClient.getQueryData(notificationKeys.unreadCount),
    };
  };
  const restoreSnapshot = (snapshot?: NotificationCacheSnapshot) => {
    if (!snapshot) return;
    if (snapshot.list)
      queryClient.setQueryData(notificationKeys.list, snapshot.list);
    if (snapshot.count)
      queryClient.setQueryData(notificationKeys.unreadCount, snapshot.count);
  };
  const reconcile = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: notificationKeys.list }),
      queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount }),
    ]);

  const markRead = useMutation({
    mutationFn: (notificationId: string) =>
      markNotificationRead(notificationId, accessToken),
    onMutate: async (notificationId) => {
      const snapshot = await snapshotAndCancel();
      const wasUnread = snapshot.list?.notifications.some(
        (item) => item.id === notificationId && !item.readAt,
      );
      const readAt = new Date().toISOString();
      queryClient.setQueryData<NotificationListResponse>(
        notificationKeys.list,
        (current) =>
          markNotificationReadInCache(current, notificationId, readAt),
      );
      if (wasUnread) {
        queryClient.setQueryData<UnreadNotificationCount>(
          notificationKeys.unreadCount,
          (current) => ({ count: Math.max(0, (current?.count ?? 1) - 1) }),
        );
      }
      return snapshot;
    },
    onError: (_error, _notificationId, snapshot) => restoreSnapshot(snapshot),
    onSettled: reconcile,
  });

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(accessToken),
    onMutate: async () => {
      const snapshot = await snapshotAndCancel();
      queryClient.setQueryData<NotificationListResponse>(
        notificationKeys.list,
        (current) =>
          markAllNotificationsReadInCache(current, new Date().toISOString()),
      );
      queryClient.setQueryData<UnreadNotificationCount>(
        notificationKeys.unreadCount,
        { count: 0 },
      );
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreSnapshot(snapshot),
    onSettled: reconcile,
  });

  const allItems = notifications.data?.notifications ?? [];
  const unreadCount = allItems.filter((item) => !item.readAt).length;
  const visibleItems =
    filter === 'unread'
      ? allItems.filter((notification) => !notification.readAt)
      : allItems;
  const mutationError = markRead.error ?? markAllRead.error;

  const openNotification = (notification: NotificationView) => {
    if (!notification.readAt && !markRead.isPending) {
      markRead.mutate(notification.id);
    }
    navigate(notificationDestination(notification));
  };

  return (
    <section
      className="notifications-page"
      aria-labelledby="notifications-title"
    >
      <header className="notifications-header">
        <div>
          <p className="notifications-eyebrow">Inbox</p>
          <h1 id="notifications-title">Notifications</h1>
          <p className="notifications-intro">
            Stay on top of Project, Outcome, submission, and review activity.
          </p>
        </div>
        <button
          type="button"
          className="notifications-mark-all"
          disabled={
            !unreadCount || markAllRead.isPending || notifications.isPending
          }
          onClick={() => markAllRead.mutate()}
        >
          {markAllRead.isPending ? 'Marking as read...' : 'Mark all as read'}
        </button>
      </header>

      {!notifications.isPending && notifications.data && (
        <div className="notifications-toolbar">
          <div
            className="notifications-filters"
            role="tablist"
            aria-label="Filter notifications"
          >
            {(['all', 'unread'] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={filter === value ? 'active' : ''}
                onClick={() => setFilter(value)}
              >
                {value === 'all' ? 'All' : 'Unread'}
                <span>{value === 'all' ? allItems.length : unreadCount}</span>
              </button>
            ))}
          </div>
          <p>
            {unreadCount ? `${unreadCount} unread` : 'You are all caught up'}
          </p>
        </div>
      )}

      {mutationError && (
        <div className="notifications-mutation-error" role="alert">
          <span>{errorMessage(mutationError)}</span>
          <button
            type="button"
            onClick={() => {
              markRead.reset();
              markAllRead.reset();
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {notifications.isPending ? (
        <div className="notifications-list" aria-label="Loading notifications">
          {[0, 1, 2].map((item) => (
            <div className="notification-skeleton" key={item} />
          ))}
        </div>
      ) : notifications.isError && !notifications.data ? (
        <div className="notifications-state" role="alert">
          <span className="notifications-state-icon" aria-hidden="true">
            !
          </span>
          <strong>Notifications could not be loaded.</strong>
          <p>{errorMessage(notifications.error)}</p>
          <button type="button" onClick={() => void notifications.refetch()}>
            Retry
          </button>
        </div>
      ) : allItems.length === 0 ? (
        <div className="notifications-state">
          <span className="notifications-state-icon" aria-hidden="true">
            ✓
          </span>
          <strong>No notifications yet</strong>
          <p>
            Project and Outcome activity that involves you will appear here.
          </p>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="notifications-state">
          <span className="notifications-state-icon" aria-hidden="true">
            ✓
          </span>
          <strong>You are all caught up</strong>
          <p>There are no unread notifications.</p>
        </div>
      ) : (
        <div className="notifications-list" aria-live="polite">
          {visibleItems.map((notification) => {
            const copy = notificationCopy[notification.type];
            const isUnread = !notification.readAt;
            const created = new Date(notification.createdAt);
            return (
              <button
                key={notification.id}
                type="button"
                className={`notification-card${isUnread ? ' unread' : ''}`}
                onClick={() => openNotification(notification)}
                aria-label={`${isUnread ? 'Unread: ' : ''}${copy.title}. ${notificationMessage(notification)}`}
              >
                <span className="notification-card-icon" aria-hidden="true">
                  {copy.icon}
                </span>
                <span className="notification-card-copy">
                  <strong>{copy.title}</strong>
                  <span className="notification-message">
                    {notificationMessage(notification)}
                  </span>
                  <span className="notification-meta">
                    <span>{copy.kind}</span>
                    <span
                      className="notification-project"
                      title={notification.project.name}
                    >
                      {notification.project.name}
                    </span>
                    {notification.outcome && (
                      <span
                        className="notification-outcome"
                        title={notification.outcome.title}
                      >
                        {notification.outcome.title}
                      </span>
                    )}
                  </span>
                </span>
                <span className="notification-card-side">
                  <time
                    dateTime={notification.createdAt}
                    title={created.toLocaleString()}
                  >
                    {formatNotificationTime(notification.createdAt)}
                  </time>
                  {isUnread && (
                    <span className="notification-unread-indicator">
                      Unread
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
