import { Prisma, type NotificationType } from '@prisma/client';

export type NotificationEvent = {
  type: NotificationType;
  sourceEventId: string;
  subjectId?: string;
  actorMemberId: string;
  recipientMemberIds: readonly string[];
  projectId: string;
  outcomeId?: string;
  data?: Prisma.InputJsonObject;
};

export async function writeNotifications(
  db: Prisma.TransactionClient,
  event: NotificationEvent,
): Promise<void> {
  const recipients = [...new Set(event.recipientMemberIds)]
    .filter((memberId) => memberId !== event.actorMemberId)
    .sort();
  if (recipients.length === 0) return;

  const eventKey = [event.type, event.sourceEventId, event.subjectId]
    .filter((part): part is string => Boolean(part))
    .join(':');

  await db.notification.createMany({
    data: recipients.map((recipientMemberId) => ({
      recipientMemberId,
      actorMemberId: event.actorMemberId,
      projectId: event.projectId,
      outcomeId: event.outcomeId ?? null,
      type: event.type,
      eventKey,
      data: event.data ?? {},
    })),
    skipDuplicates: true,
  });
}
