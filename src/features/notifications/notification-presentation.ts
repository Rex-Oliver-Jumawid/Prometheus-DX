import type { Notification } from '../../../shared/contracts/notification';

type NotificationPresentation = {
  title: string;
  description: string;
  category: 'Review' | 'Outcome' | 'Project' | 'Mention';
  icon: 'review' | 'participant' | 'project';
};

export function presentNotification(
  notification: Notification,
): NotificationPresentation {
  const actor = notification.actor?.fullName;
  const project = notification.project?.name;
  const outcome = notification.outcome?.title;

  switch (notification.type) {
    case 'PROJECT_LEAD_ASSIGNED':
      return {
        title: 'You were assigned as Project Lead',
        description: project
          ? actor
            ? `${actor} assigned you to lead ${project}.`
            : `You are the Project Lead for ${project}.`
          : 'The linked Project is no longer available.',
        category: 'Project',
        icon: 'project',
      };
    case 'PROJECT_MEMBER_ACCESS_CHANGED': {
      const access =
        notification.newAccessLevel === 'CAN_EDIT'
          ? 'edit'
          : notification.newAccessLevel === 'CAN_VIEW'
            ? 'view'
            : null;
      const change = access
        ? `changed your access to ${access}`
        : 'changed your access';
      return {
        title: 'Your Project access changed',
        description: `${actor ? `${actor} ${change}` : `Your access was changed`}${project ? ` on ${project}` : ''}.`,
        category: 'Project',
        icon: 'project',
      };
    }
    case 'OUTCOME_JOINED':
      return {
        title: 'A member joined an Outcome',
        description: `${actor ?? 'A member'} joined ${outcome ?? 'an Outcome'}${project ? ` in ${project}` : ''}.`,
        category: 'Outcome',
        icon: 'participant',
      };
    case 'SUBMISSION_CREATED':
      return {
        title: 'Output ready for your review',
        description: `${actor ? `${actor} submitted output` : 'Output was submitted'}${outcome ? ` for ${outcome}` : ''}${project ? ` in ${project}` : ''}.`,
        category: 'Review',
        icon: 'review',
      };
    case 'REVISION_REQUESTED':
      return {
        title: 'Revision requested',
        description: `${actor ? `${actor} requested a revision` : 'A revision was requested'}${outcome ? ` for ${outcome}` : ''}.`,
        category: 'Review',
        icon: 'review',
      };
    case 'OUTCOME_ACCEPTED':
      return {
        title: 'Outcome accepted',
        description: `${actor ? `${actor} accepted` : 'Accepted'}${outcome ? ` ${outcome}` : ' the Outcome'}.`,
        category: 'Review',
        icon: 'review',
      };
    case 'OUTCOME_REOPENED':
      return {
        title: 'Outcome reopened',
        description: `${actor ? `${actor} reopened` : 'Reopened'}${outcome ? ` ${outcome}` : ' the Outcome'}.`,
        category: 'Review',
        icon: 'review',
      };
    case 'DEPENDENCY_UNLOCKED':
      return {
        title: 'Outcome unlocked',
        description: `${outcome ?? 'An Outcome'} is ready to work on${project ? ` in ${project}` : ''}.`,
        category: 'Outcome',
        icon: 'project',
      };
    case 'VISIWORK_MENTION': {
      const mention = notification.visiworkMention;
      return {
        title: 'You were mentioned in VisiWork',
        description: mention
          ? `${actor ?? 'A teammate'} mentioned you in ${mention.roomLabel}: “${mention.preview}”`
          : `${actor ?? 'A teammate'} mentioned you in VisiWork.`,
        category: 'Mention',
        icon: 'participant',
      };
    }
  }
}

export function notificationPath(notification: Notification): string | null {
  if (notification.type === 'VISIWORK_MENTION' && notification.visiworkMention) {
    const params = new URLSearchParams({
      message: notification.visiworkMention.messageId,
    });
    if (notification.visiworkMention.departmentId) {
      params.set('department', notification.visiworkMention.departmentId);
    }
    return `/visiwork?${params.toString()}`;
  }
  if (!notification.project) return null;
  if (notification.outcome)
    return `/projects/${notification.project.id}/outcomes/${notification.outcome.id}`;
  return `/projects/${notification.project.id}`;
}

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
