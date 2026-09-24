import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../../shared/contracts/notification';
import { useAuth } from '../auth/auth-context';
import {
  notificationListQuery,
  notificationUnreadCountQuery,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type NotificationFilter,
} from './notification-queries';
import {
  formatNotificationTime,
  notificationFullTime,
  notificationPath,
  presentNotification,
} from './notification-presentation';
import './notifications.css';

function NotificationRow({
  notification,
  onOpen,
  onRead,
  isOpening,
}: {
  notification: Notification;
  onOpen: (notification: Notification, path: string) => Promise<void>;
  onRead: (id: string) => void;
  isOpening: boolean;
}) {
  const presentation = presentNotification(notification);
  const path = notificationPath(notification);
  const isUnread = !notification.readAt;
  const content = (
    <>
      <span
        className={`notification-icon ${presentation.icon}`}
        aria-hidden="true"
      >
        <img src={`/icons/notifications/${presentation.icon}.svg`} alt="" />
      </span>
      <span className="notification-copy">
        <strong>{presentation.title}</strong>
        <span className="notification-description">
          {presentation.description}
        </span>
        <span className="notification-context">
          <span className="notification-category">{presentation.category}</span>
          <span className="notification-context-name">
            {notification.visiworkMention
              ? notification.visiworkMention.roomLabel
              : notification.project
                ? (notification.outcome?.title ?? notification.project.name)
                : 'Linked context unavailable'}
          </span>
        </span>
      </span>
      <span className="notification-time">
        <time
          dateTime={notification.createdAt}
          title={notificationFullTime(notification.createdAt)}
        >
          {formatNotificationTime(notification.createdAt)}
        </time>
        {isUnread && (
          <span
            className="notification-unread-dot"
            role="img"
            aria-label="Unread"
          />
        )}
      </span>
    </>
  );

  return (
    <li>
      {path ? (
        <button
          type="button"
          className={`notification-row${isUnread ? ' unread' : ''}`}
          data-state={isUnread ? 'unread' : 'read'}
          aria-busy={isOpening}
          disabled={isOpening}
          onClick={() => void onOpen(notification, path)}
        >
          {content}
        </button>
      ) : (
        <article
          className={`notification-row${isUnread ? ' unread' : ''}`}
          data-state={isUnread ? 'unread' : 'read'}
        >
          {content}
          {isUnread && (
            <button
              type="button"
              className="notification-read-unavailable"
              disabled={isOpening}
              onClick={() => onRead(notification.id)}
            >
              Mark as read
            </button>
          )}
        </article>
      )}
    </li>
  );
}

function NotificationsListSkeleton() {
  return (
    <div
      className="notifications-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="notifications-loading-label">
        Loading notifications...
      </span>
      <ol className="notifications-list notifications-skeleton-list" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index}>
            <div className="notification-row notification-skeleton-row">
              <span className="notification-icon notification-skeleton-icon">
                <span className="notification-skeleton-block notification-skeleton-glyph" />
              </span>
              <span className="notification-copy notification-skeleton-copy">
                <span className="notification-skeleton-block notification-skeleton-title" />
                <span className="notification-skeleton-block notification-skeleton-description" />
                <span className="notification-skeleton-block notification-skeleton-context" />
              </span>
              <span className="notification-time notification-skeleton-time">
                <span className="notification-skeleton-block notification-skeleton-timestamp" />
                {index === 0 && (
                  <span className="notification-skeleton-block notification-skeleton-dot" />
                )}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function NotificationsPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const accessToken = session?.access_token;
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const all = useQuery({
    ...notificationListQuery('all', accessToken),
    enabled: Boolean(accessToken),
  });
  const unread = useQuery({
    ...notificationListQuery('unread', accessToken),
    enabled: filter === 'unread' && Boolean(accessToken),
  });
  const mentions = useQuery({
    ...notificationListQuery('mentions', accessToken),
    enabled: filter === 'mentions' && Boolean(accessToken),
  });
  const projects = useQuery({
    ...notificationListQuery('projects', accessToken),
    enabled: filter === 'projects' && Boolean(accessToken),
  });
  const unreadCount = useQuery({
    ...notificationUnreadCountQuery(accessToken),
    enabled: Boolean(accessToken),
  });
  const markRead = useMarkNotificationRead(accessToken);
  const markAllRead = useMarkAllNotificationsRead(accessToken);
  const active =
    filter === 'all'
      ? all
      : filter === 'unread'
        ? unread
        : filter === 'mentions'
          ? mentions
          : projects;
  const count =
    unreadCount.data?.count ??
    all.data?.items.filter((item) => !item.readAt).length ??
    0;
  const error = markRead.error ?? markAllRead.error;

  const openNotification = async (notification: Notification, path: string) => {
    if (!notification.readAt) {
      try {
        await markRead.mutateAsync(notification.id);
      } catch {
        return;
      }
    }
    navigate(path);
  };

  return (
    <section
      className="notifications-page"
      aria-labelledby="notifications-title"
    >
      <header className="notifications-header">
        <div>
          <p className="page-kicker">INBOX</p>
          <h1 id="notifications-title">Notifications</h1>
          <p>
            Stay on top of project updates, reviews, and changes that need your
            attention.
          </p>
        </div>
        <button
          type="button"
          className="notifications-mark-all"
          disabled={count === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          {markAllRead.isPending ? 'Marking as read...' : 'Mark all as read'}
        </button>
      </header>

      <div className="notifications-filters">
        <div role="tablist" aria-label="Filter notifications">
          <button
            type="button"
            id="notifications-all-tab"
            role="tab"
            aria-selected={filter === 'all'}
            aria-controls="notifications-results"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            All
            <span className="notifications-filter-count">
              {all.data?.items.length ?? '…'}
            </span>
          </button>
          <button
            type="button"
            id="notifications-unread-tab"
            role="tab"
            aria-selected={filter === 'unread'}
            aria-controls="notifications-results"
            className={filter === 'unread' ? 'active' : ''}
            onClick={() => setFilter('unread')}
          >
            Unread
            <span className="notifications-filter-count">{count}</span>
          </button>
          <button
            type="button"
            id="notifications-mentions-tab"
            role="tab"
            aria-selected={filter === 'mentions'}
            aria-controls="notifications-results"
            className={filter === 'mentions' ? 'active' : ''}
            onClick={() => setFilter('mentions')}
          >
            Mentions
            <span className="notifications-filter-count">
              {all.data?.items.filter((item) => item.type === 'VISIWORK_MENTION').length ?? '…'}
            </span>
          </button>
          <button
            type="button"
            id="notifications-projects-tab"
            role="tab"
            aria-selected={filter === 'projects'}
            aria-controls="notifications-results"
            className={filter === 'projects' ? 'active' : ''}
            onClick={() => setFilter('projects')}
          >
            Projects
            <span className="notifications-filter-count">
              {all.data?.items.filter((item) => item.type !== 'VISIWORK_MENTION').length ?? '…'}
            </span>
          </button>
        </div>
        <span className="notifications-unread-summary">{count} unread</span>
      </div>

      {error && (
        <p className="notifications-mutation-error" role="alert">
          {error.message}
        </p>
      )}

      <div
        id="notifications-results"
        role="tabpanel"
        aria-labelledby={`notifications-${filter}-tab`}
      >
        {active.isPending ? (
          <NotificationsListSkeleton />
        ) : active.isError ? (
          <div className="notifications-state error" role="alert">
            <h2>Notifications could not be loaded</h2>
            <p>{active.error.message}</p>
            <button type="button" onClick={() => void active.refetch()}>
              Try again
            </button>
          </div>
        ) : active.data.items.length === 0 ? (
          <div className="notifications-state empty">
            <h2>
              {filter === 'all'
                ? 'No notifications yet'
                : filter === 'mentions'
                  ? 'No mentions yet'
                  : filter === 'projects'
                    ? 'No project notifications yet'
                    : "You're all caught up"}
            </h2>
            <p>
              {filter === 'all'
                ? 'Project updates and VisiWork mentions for you will appear here.'
                : filter === 'mentions'
                  ? 'When someone mentions you in VisiWork chat, it will appear here.'
                  : filter === 'projects'
                    ? 'Project and Outcome updates for you will appear here.'
                    : 'There are no unread notifications right now.'}
            </p>
            {filter === 'unread' && (
              <button type="button" onClick={() => setFilter('all')}>
                View all notifications
              </button>
            )}
          </div>
        ) : (
          <ol className="notifications-list" aria-label="Notifications">
            {active.data.items.map((notification) => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onOpen={openNotification}
                onRead={(id) => markRead.mutate(id)}
                isOpening={
                  markRead.isPending && markRead.variables === notification.id
                }
              />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
