import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
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
  ChatPushChannelKey,
  ChatPushPreferenceRequest,
  ChatPushPreferenceResponse,
  DevicePushConfigResponse,
  DevicePushSubscription,
  DevicePushSubscriptionResponse,
} from '../../shared/contracts/notification';
import { serverEnvironment } from '../config/env';
import { PrismaService } from '../database/prisma.service';

export const notificationSelect = {
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

function visiworkMentionData(
  data: Prisma.JsonValue,
): Notification['visiworkMention'] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const messageId = typeof data.messageId === 'string' ? data.messageId : null;
  const departmentId =
    data.departmentId === null || typeof data.departmentId === 'string'
      ? data.departmentId
      : null;
  const roomLabel =
    typeof data.roomLabel === 'string' ? data.roomLabel : null;
  const preview = typeof data.preview === 'string' ? data.preview : null;
  if (!messageId || !roomLabel || preview === null) return null;
  return { messageId, departmentId, roomLabel, preview };
}

function projectChatMentionData(
  data: Prisma.JsonValue,
): Notification['projectChatMention'] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (typeof data.messageId !== 'string') return null;
  return {
    messageId: data.messageId,
    preview: typeof data.preview === 'string' ? data.preview : '',
  };
}

export function toNotification(record: NotificationRecord): Notification {
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
    ...(record.type === 'VISIWORK_MENTION'
      ? { visiworkMention: visiworkMentionData(record.data) }
      : {}),
    ...(record.type === 'PROJECT_CHAT_MENTION'
      ? { projectChatMention: projectChatMentionData(record.data) }
      : {}),
    createdAt: record.createdAt.toISOString(),
    readAt: record.readAt?.toISOString() ?? null,
  };
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  pushConfig(): DevicePushConfigResponse {
    return {
      enabled: Boolean(serverEnvironment.webPush),
      applicationServerKey: serverEnvironment.webPush?.publicKey ?? null,
    };
  }

  async chatPushPreference(
    memberId: string,
    channelKey: ChatPushChannelKey,
  ): Promise<ChatPushPreferenceResponse> {
    const mute = await this.prisma.chatPushMute.findUnique({
      where: { memberId_channelKey: { memberId, channelKey } },
      select: { memberId: true },
    });
    return { channelKey, muted: Boolean(mute) };
  }

  async setChatPushPreference(
    memberId: string,
    input: ChatPushPreferenceRequest,
  ): Promise<ChatPushPreferenceResponse> {
    if (input.muted) {
      await this.prisma.chatPushMute.upsert({
        where: {
          memberId_channelKey: {
            memberId,
            channelKey: input.channelKey,
          },
        },
        create: {
          memberId,
          channelKey: input.channelKey,
        },
        update: {},
      });
    } else {
      await this.prisma.chatPushMute.deleteMany({
        where: {
          memberId,
          channelKey: input.channelKey,
        },
      });
    }
    return { channelKey: input.channelKey, muted: input.muted };
  }

  async subscribeDevice(
    memberId: string,
    input: DevicePushSubscription,
  ): Promise<DevicePushSubscriptionResponse> {
    if (!serverEnvironment.webPush) {
      throw new ServiceUnavailableException(
        'Device notifications are not configured for this environment.',
      );
    }
    await this.prisma.$transaction(async (db) => {
      await db.pushSubscription.deleteMany({
        where: {
          endpoint: input.endpoint,
          memberId: { not: memberId },
        },
      });
      await db.pushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: {
          memberId,
          endpoint: input.endpoint,
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
        update: {
          p256dh: input.keys.p256dh,
          auth: input.keys.auth,
        },
      });
    });
    return { subscribed: true };
  }

  async unsubscribeDevice(
    memberId: string,
    input: DevicePushSubscription,
  ): Promise<DevicePushSubscriptionResponse> {
    await this.prisma.pushSubscription.deleteMany({
      where: { memberId, endpoint: input.endpoint },
    });
    return { subscribed: false };
  }

  async list(
    recipientMemberId: string,
    query: NotificationListQuery,
  ): Promise<NotificationListResponse> {
    const where: Prisma.NotificationWhereInput = { recipientMemberId };

    if (query.filter === 'unread') {
      where.readAt = null;
    } else if (query.filter === 'mentions') {
      where.type = { in: ['VISIWORK_MENTION', 'PROJECT_CHAT_MENTION'] };
    } else if (query.filter === 'projects') {
      where.type = { notIn: ['VISIWORK_MENTION', 'PROJECT_CHAT_MENTION'] };
    }

    const records = await this.prisma.notification.findMany({
      where,
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
