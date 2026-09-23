import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ProjectAccessLevelSchema,
  type ProjectAccessLevel,
} from '../../shared/contracts/project';
import type {
  Notification,
  NotificationListQuery,
  NotificationListResponse,
  NotificationReadAllResponse,
  NotificationReadResponse,
  NotificationUnreadCountResponse,
} from '../../shared/contracts/notification';
import { PrismaService } from '../database/prisma.service';

const notificationSelect = {
  id: true,
  type: true,
  data: true,
  createdAt: true,
  readAt: true,
  actorMember: { select: { id: true, fullName: true } },
  project: { select: { id: true, name: true } },
  outcome: { select: { id: true, title: true } },
} satisfies Prisma.NotificationSelect;

type NotificationRecord = Prisma.NotificationGetPayload<{
  select: typeof notificationSelect;
}>;

function newAccessLevel(data: Prisma.JsonValue): ProjectAccessLevel | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const parsed = ProjectAccessLevelSchema.safeParse(data.accessLevel);
  return parsed.success ? parsed.data : null;
}

function toNotification(record: NotificationRecord): Notification {
  return {
    id: record.id,
    type: record.type,
    actor: record.actorMember,
    project: record.project,
    outcome: record.outcome,
    newAccessLevel:
      record.type === 'PROJECT_MEMBER_ACCESS_CHANGED'
        ? newAccessLevel(record.data)
        : null,
    createdAt: record.createdAt.toISOString(),
    readAt: record.readAt?.toISOString() ?? null,
  };
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    recipientMemberId: string,
    query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    const records = await this.prisma.notification.findMany({
      where: {
        recipientMemberId,
        ...(query.filter === 'unread' ? { readAt: null } : {}),
      },
      relationLoadStrategy: 'join',
      select: notificationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return { items: records.map(toNotification) };
  }

  async unreadCount(
    recipientMemberId: string,
  ): Promise<NotificationUnreadCountResponse> {
    const count = await this.prisma.notification.count({
      where: { recipientMemberId, readAt: null },
    });
    return { count };
  }

  async markRead(
    recipientMemberId: string,
    notificationId: string,
  ): Promise<NotificationReadResponse> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientMemberId, readAt: null },
      data: { readAt: new Date() },
    });
    const record = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientMemberId },
      select: { readAt: true },
    });
    if (!record) throw new NotFoundException('Notification not found.');
    if (!record.readAt)
      throw new ConflictException('Notification could not be marked read.');
    return { id: notificationId, readAt: record.readAt.toISOString() };
  }

  async markAllRead(
    recipientMemberId: string,
  ): Promise<NotificationReadAllResponse> {
    const readAt = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { recipientMemberId, readAt: null },
      data: { readAt },
    });
    return { updatedCount: result.count, readAt: readAt.toISOString() };
  }
}
