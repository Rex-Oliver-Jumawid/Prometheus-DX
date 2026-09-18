import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma, type Member } from '@prisma/client';
import type {
  NotificationListResponse,
  NotificationView,
  UnreadNotificationCount,
} from '../../shared/contracts/notification';
import { PrismaService } from '../database/prisma.service';

const notificationInclude = {
  project: { select: { id: true, name: true } },
  outcome: { select: { id: true, title: true } },
  actorMember: { select: { id: true, fullName: true } },
} satisfies Prisma.NotificationInclude;

type NotificationRecord = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

type EventInput = {
  type: NotificationType;
  sourceEventId: string;
  recipientMemberIds: string[];
  actorMemberId: string;
  projectId: string;
  outcomeId: string;
};

export async function createNotificationEvent(
  db: Prisma.TransactionClient,
  input: EventInput,
) {
  const recipients = [
    ...new Set(
      input.recipientMemberIds.filter((id) => id !== input.actorMemberId),
    ),
  ];
  if (!recipients.length) return;
  const eventKey = `${input.type}:${input.sourceEventId}`;
  await db.notification.createMany({
    data: recipients.map((recipientMemberId) => ({
      recipientMemberId,
      type: input.type,
      eventKey,
      projectId: input.projectId,
      outcomeId: input.outcomeId,
      actorMemberId: input.actorMemberId,
    })),
    skipDuplicates: true,
  });
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(currentMember: Member): Promise<NotificationListResponse> {
    const notifications = await this.prisma.notification.findMany({
      where: { recipientMemberId: currentMember.id },
      include: notificationInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { notifications: notifications.map(this.toView) };
  }

  async unreadCount(currentMember: Member): Promise<UnreadNotificationCount> {
    return {
      count: await this.prisma.notification.count({
        where: { recipientMemberId: currentMember.id, readAt: null },
      }),
    };
  }

  async markRead(
    currentMember: Member,
    notificationId: string,
  ): Promise<NotificationView> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientMemberId: currentMember.id },
      include: notificationInclude,
    });
    if (!notification) throw new NotFoundException('Notification not found.');
    if (notification.readAt) return this.toView(notification);
    const updated = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
      include: notificationInclude,
    });
    return this.toView(updated);
  }

  async markAllRead(currentMember: Member): Promise<UnreadNotificationCount> {
    await this.prisma.notification.updateMany({
      where: { recipientMemberId: currentMember.id, readAt: null },
      data: { readAt: new Date() },
    });
    return this.unreadCount(currentMember);
  }

  private readonly toView = (
    notification: NotificationRecord,
  ): NotificationView => ({
    id: notification.id,
    type: notification.type,
    project: notification.project,
    outcome: notification.outcome,
    actor: notification.actorMember,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  });
}
