export {
  notificationPath,
  presentNotification,
} from '../../../shared/notification-presentation';

export function formatNotificationTime(
  isoTimestamp: string,
  now = new Date(),
): string {
  const timestamp = new Date(isoTimestamp);
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - timestamp.getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return 'Just now';
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;
  if (elapsedMinutes < 1_440)
    return `${Math.floor(elapsedMinutes / 60)} hr ago`;
  if (elapsedMinutes < 2_880) return 'Yesterday';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    ...(timestamp.getFullYear() === now.getFullYear()
      ? {}
      : { year: 'numeric' }),
  }).format(timestamp);
}

export function notificationFullTime(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoTimestamp));
}
