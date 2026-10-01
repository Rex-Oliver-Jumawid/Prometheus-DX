import type { Notification } from './contracts/notification';

export function presentNotification(notification: Notification) {
  const actor = notification.actor?.fullName;
  const project = notification.project?.name;
  const outcome = notification.outcome?.title;
  switch (notification.type) {
    case 'PROJECT_LEAD_ASSIGNED': return { title: 'You were assigned as Project Lead', description: project ? (actor ? `${actor} assigned you to lead ${project}.` : `You are the Project Lead for ${project}.`) : 'The linked Project is no longer available.', category: 'Project' as const, icon: 'project' as const };
    case 'PROJECT_MEMBER_ACCESS_CHANGED': {
      const access = notification.newAccessLevel === 'CAN_EDIT' ? 'edit' : notification.newAccessLevel === 'CAN_VIEW' ? 'view' : null;
      const change = access ? `changed your access to ${access}` : 'changed your access';
      return { title: 'Your Project access changed', description: `${actor ? `${actor} ${change}` : 'Your access was changed'}${project ? ` on ${project}` : ''}.`, category: 'Project' as const, icon: 'project' as const };
    }
    case 'OUTCOME_ASSIGNED': return { title: 'You were assigned to an Outcome', description: `${actor ? `${actor} assigned you to` : 'You were assigned to'} ${outcome ?? 'an Outcome'}${project ? ` in ${project}` : ''}.`, category: 'Outcome' as const, icon: 'participant' as const };
    case 'OUTCOME_JOINED': return { title: 'A member joined an Outcome', description: `${actor ?? 'A member'} joined ${outcome ?? 'an Outcome'}${project ? ` in ${project}` : ''}.`, category: 'Outcome' as const, icon: 'participant' as const };
    case 'SUBMISSION_CREATED': return { title: 'Output ready for your review', description: `${actor ? `${actor} submitted output` : 'Output was submitted'}${outcome ? ` for ${outcome}` : ''}${project ? ` in ${project}` : ''}.`, category: 'Review' as const, icon: 'review' as const };
    case 'REVISION_REQUESTED': return { title: 'Revision requested', description: `${actor ? `${actor} requested a revision` : 'A revision was requested'}${outcome ? ` for ${outcome}` : ''}.`, category: 'Review' as const, icon: 'review' as const };
    case 'OUTCOME_ACCEPTED': return { title: 'Outcome accepted', description: `${actor ? `${actor} accepted` : 'Accepted'}${outcome ? ` ${outcome}` : ' the Outcome'}.`, category: 'Review' as const, icon: 'review' as const };
    case 'OUTCOME_REOPENED': return { title: 'Outcome reopened', description: `${actor ? `${actor} reopened` : 'Reopened'}${outcome ? ` ${outcome}` : ' the Outcome'}.`, category: 'Review' as const, icon: 'review' as const };
    case 'DEPENDENCY_UNLOCKED': return { title: 'Outcome unlocked', description: `${outcome ?? 'An Outcome'} is ready to work on${project ? ` in ${project}` : ''}.`, category: 'Outcome' as const, icon: 'project' as const };
    case 'PROJECT_CHAT_MENTION': return { title: 'You were mentioned in Project Chat', description: notification.projectChatMention ? `${actor ?? 'A teammate'} mentioned you in ${project ?? 'a project'}: “${notification.projectChatMention.preview}”` : `${actor ?? 'A teammate'} mentioned you in Project Chat.`, category: 'Mention' as const, icon: 'participant' as const };
    case 'VISIWORK_MENTION': return { title: 'You were mentioned in VisiWork', description: notification.visiworkMention ? `${actor ?? 'A teammate'} mentioned you in ${notification.visiworkMention.roomLabel}: “${notification.visiworkMention.preview}”` : `${actor ?? 'A teammate'} mentioned you in VisiWork.`, category: 'Mention' as const, icon: 'participant' as const };
  }
}

export function notificationPath(notification: Notification): string | null {
  if (notification.type === 'VISIWORK_MENTION' && notification.visiworkMention) {
    const params = new URLSearchParams({ message: notification.visiworkMention.messageId });
    if (notification.visiworkMention.departmentId) params.set('department', notification.visiworkMention.departmentId);
    return `/visiwork?${params.toString()}`;
  }
  if (notification.type === 'PROJECT_CHAT_MENTION') {
    if (!notification.project || !notification.projectChatMention) return null;
    const params = new URLSearchParams({ tab: 'chat', message: notification.projectChatMention.messageId });
    return `/projects/${notification.project.id}?${params.toString()}`;
  }
  if (!notification.project) return null;
  if (notification.outcome) return `/projects/${notification.project.id}/outcomes/${notification.outcome.id}`;
  return `/projects/${notification.project.id}`;
}
