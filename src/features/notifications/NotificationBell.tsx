import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { NavIcon } from '../shell/Icons';
import { unreadNotificationCountQuery } from './notification-queries';

function unreadLabel(count: number) {
  return `${count} unread notification${count === 1 ? '' : 's'}`;
}

export function NotificationBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="notification-count-badge" aria-label={unreadLabel(count)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function NotificationBell() {
  const { session } = useAuth();
  const countQuery = useQuery({
    ...unreadNotificationCountQuery(session?.access_token),
    enabled: Boolean(session?.access_token),
  });
  const count = countQuery.data?.count ?? 0;
  const label = count
    ? `Open notifications, ${unreadLabel(count)}`
    : 'Open notifications';

  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        `notification-bell${isActive ? ' active' : ''}`
      }
      aria-label={label}
    >
      <NavIcon name="notifications" />
      <NotificationBadge count={count} />
    </NavLink>
  );
}
