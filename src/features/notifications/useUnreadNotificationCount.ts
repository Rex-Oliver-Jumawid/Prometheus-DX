import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { unreadNotificationCountQuery } from './notification-queries';

export function useUnreadNotificationCount() {
  const { session } = useAuth();
  return useQuery({
    ...unreadNotificationCountQuery(session?.access_token),
    enabled: Boolean(session?.access_token),
  });
}
