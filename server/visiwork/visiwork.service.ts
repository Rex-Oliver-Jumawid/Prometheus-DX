import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import type {
  CreateVisiWorkMessage,
  SetVisiWorkPresenceRequest,
  UpdateVisiWorkMessage,
  VisiWorkMessage,
  VisiWorkMessageContextResponse,
  VisiWorkMessagePage,
  VisiWorkMessageSearchQuery,
  VisiWorkMessageSearchResponse,
  VisiWorkPresenceResponse,
} from '../../shared/contracts/visiwork';
import { PrismaService } from '../database/prisma.service';
import { PushDeliveryService } from '../notifications/push-delivery.service';

const PAGE_SIZE = 40;
const DELETED_MESSAGE_BODY = '[deleted]';

const messageInclude = {
  member: { select: { id: true, fullName: true, profileImagePath: true } },
  mentions: {
    include: {
      member: { select: { id: true, fullName: true, profileImagePath: true } },
    },
  },
} satisfies Prisma.VisiWorkMessageInclude;

type MessageRecord = Prisma.VisiWorkMessageGetPayload<{
  include: typeof messageInclude;
}>;

type MentionMember = {
  id: string;
  fullName: string;
};

@Injectable()
export class VisiWorkService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PushDeliveryService)
    private readonly pushDeliveries: PushDeliveryService = {
      sendChatMessage: async () => undefined,
    } as unknown as PushDeliveryService,
  ) {}

  async joinVenture(
    member: Member,
    input: SetVisiWorkPresenceRequest,
  ): Promise<VisiWorkPresenceResponse> {
    const venture = await this.prisma.venture.findUnique({
      where: { id: input.ventureId },
      select: { id: true },
    });
    if (!venture) throw new NotFoundException('Venture not found.');

    await this.prisma.member.update({
      where: { id: member.id },
      data: { visiworkVentureId: venture.id },
    });

    return { memberId: member.id, ventureId: venture.id };
  }

  private async requireVenture(ventureId: string) {
    const venture = await this.prisma.venture.findUnique({
      where: { id: ventureId },
      select: { id: true, name: true, shortLabel: true },
    });
    if (!venture) throw new NotFoundException('Venture not found.');
    return venture;
  }

  private async canWriteVenture(member: Member, ventureId: string): Promise<boolean> {
    return (
      member.ventureId === ventureId ||
      member.visiworkVentureId === ventureId ||
      (await this.prisma.ventureMembership.count({ where: { memberId: member.id, ventureId, endedAt: null, venture: { status: 'ACTIVE' } } })) > 0
    );
  }

  private toMessage(record: MessageRecord): VisiWorkMessage {
    const deleted = Boolean(record.deletedAt);
    return {
      id: record.id,
      ventureId: record.ventureId,
      author: record.member,
      body: deleted ? 'Message deleted' : record.body,
      mentions: deleted
        ? []
        : (record.mentions?.map((mention) => mention.member) ?? []),
      editedAt: record.editedAt?.toISOString() ?? null,
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }

  private async resolveMentionedMembers(
    sender: Member,
    body: string,
    mentionMemberIds: string[],
    ventureId?: string,
  ): Promise<MentionMember[]> {
    const uniqueMentionIds = [...new Set(mentionMemberIds)].filter(
      (id) => id !== sender.id,
    );
    if (!uniqueMentionIds.length) return [];

    const candidates = await this.prisma.member.findMany({
      where: {
        id: { in: uniqueMentionIds },
        status: 'ACTIVE',
        ...(ventureId
          ? {
              OR: [{ ventureId }, { visiworkVentureId: ventureId }],
            }
          : {}),
      },
      select: { id: true, fullName: true },
    });

    const lowerBody = body.toLowerCase();
    return candidates.filter((candidate) =>
      lowerBody.includes('@' + candidate.fullName.toLowerCase()),
    );
  }

  private mentionNotificationData(
    messageId: string,
    body: string,
    venture: { name: string; shortLabel: string } | null,
    ventureId: string | null,
  ): Prisma.InputJsonValue {
    return {
      messageId,
      ventureId,
      roomLabel: venture ? venture.shortLabel : 'Visiwork',
      preview: body.slice(0, 180),
    };
  }

  async listMessages(
    member: Member,
    ventureId?: string,
    cursor?: string,
  ): Promise<VisiWorkMessagePage> {
    const roomVentureId = ventureId ?? null;
    if (ventureId) await this.requireVenture(ventureId);

    const previous = cursor
      ? await this.prisma.visiWorkMessage.findFirst({
          where: { id: cursor, ventureId: roomVentureId },
          select: { id: true, createdAt: true },
        })
      : null;

    if (cursor && !previous) {
      throw new BadRequestException('Invalid VisiWork chat cursor.');
    }

    const records = await this.prisma.visiWorkMessage.findMany({
      where: {
        ventureId: roomVentureId,
        ...(previous
          ? {
              OR: [
                { createdAt: { lt: previous.createdAt } },
                { createdAt: previous.createdAt, id: { lt: previous.id } },
              ],
            }
          : {}),
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    });

    const hasMore = records.length > PAGE_SIZE;
    const items = records.slice(0, PAGE_SIZE);
    return {
      items: items.map((record) => this.toMessage(record)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      canWrite: ventureId
        ? await this.canWriteVenture(member, ventureId)
        : true,
    };
  }

  async sendMessage(
    member: Member,
    input: CreateVisiWorkMessage,
    ventureId?: string,
  ): Promise<VisiWorkMessage> {
    const venture = ventureId
      ? await this.requireVenture(ventureId)
      : null;

    if (ventureId && !(await this.canWriteVenture(member, ventureId))) {
      throw new ForbiddenException(
        'Join this venture before sending messages to its room.',
      );
    }

    const mentionedMembers = await this.resolveMentionedMembers(
      member,
      input.body,
      input.mentionMemberIds,
      ventureId,
    );

    const message = await this.prisma.$transaction(async (db) => {
      const created = await db.visiWorkMessage.create({
        data: {
          ventureId: ventureId ?? null,
          memberId: member.id,
          body: input.body,
          mentions: {
            create: mentionedMembers.map((mentioned) => ({
              memberId: mentioned.id,
            })),
          },
        },
        include: messageInclude,
      });

      if (mentionedMembers.length) {
        await db.notification.createMany({
          data: mentionedMembers.map((mentioned) => ({
            recipientMemberId: mentioned.id,
            actorMemberId: member.id,
            type: 'VISIWORK_MENTION',
            eventKey: `visiwork-mention:${created.id}:${mentioned.id}`,
            data: this.mentionNotificationData(
              created.id,
              input.body,
              venture,
              ventureId ?? null,
            ),
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    const excludedMemberIds = [
      member.id,
      ...mentionedMembers.map((mentioned) => mentioned.id),
    ];
    const recipients = await this.prisma.member.findMany({
      where: {
        status: 'ACTIVE',
        id: { notIn: excludedMemberIds },
        ...(ventureId ? { visiworkVentureId: ventureId } : {}),
      },
      select: { id: true },
    });
    const channelLabel = venture ? venture.shortLabel : 'Visiwork';
    const params = new URLSearchParams({ message: message.id });
    if (ventureId) params.set('venture', ventureId);

    await Promise.all([
      ...(recipients.length
        ? [
            this.pushDeliveries.sendChatMessage({
              recipientMemberIds: recipients.map((recipient) => recipient.id),
              channelKey: ventureId
                ? `visiwork:venture:${ventureId}`
                : 'visiwork:general',
              channelLabel,
              body: `${member.fullName}: “${input.body.slice(0, 180)}”`,
              url: `/visiwork?${params.toString()}`,
              tag: `visiwork-message:${message.id}`,
            }),
          ]
        : []),
    ]);
    return this.toMessage(message);
  }

  async updateMessage(
    member: Member,
    messageId: string,
    input: UpdateVisiWorkMessage,
  ): Promise<VisiWorkMessage> {
    const existing = await this.prisma.visiWorkMessage.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });

    if (!existing) throw new NotFoundException('Message not found.');
    if (existing.memberId !== member.id) {
      throw new ForbiddenException('You can only edit your own messages.');
    }
    if (existing.deletedAt) {
      throw new BadRequestException('Deleted messages cannot be edited.');
    }

    const venture = existing.ventureId
      ? await this.requireVenture(existing.ventureId)
      : null;
    const mentionedMembers = await this.resolveMentionedMembers(
      member,
      input.body,
      input.mentionMemberIds,
      existing.ventureId ?? undefined,
    );

    const previousMentionIds = new Set(
      existing.mentions.map((mention) => mention.memberId),
    );
    const nextMentionIds = new Set(
      mentionedMembers.map((mentioned) => mentioned.id),
    );
    const removedMentionIds = [...previousMentionIds].filter(
      (id) => !nextMentionIds.has(id),
    );
    const retainedMentionIds = [...nextMentionIds].filter((id) =>
      previousMentionIds.has(id),
    );
    const addedMembers = mentionedMembers.filter(
      (mentioned) => !previousMentionIds.has(mentioned.id),
    );
    const editedAt = new Date();
    const notificationData = this.mentionNotificationData(
      existing.id,
      input.body,
      venture,
      existing.ventureId,
    );

    const updated = await this.prisma.$transaction(async (db) => {
      const record = await db.visiWorkMessage.update({
        where: { id: existing.id },
        data: {
          body: input.body,
          editedAt,
          mentions: {
            deleteMany: {},
            create: mentionedMembers.map((mentioned) => ({
              memberId: mentioned.id,
            })),
          },
        },
        include: messageInclude,
      });

      if (removedMentionIds.length) {
        await db.notification.deleteMany({
          where: {
            recipientMemberId: { in: removedMentionIds },
            eventKey: { startsWith: `visiwork-mention:${existing.id}:` },
          },
        });
      }

      if (retainedMentionIds.length) {
        await db.notification.updateMany({
          where: {
            recipientMemberId: { in: retainedMentionIds },
            eventKey: { startsWith: `visiwork-mention:${existing.id}:` },
          },
          data: { data: notificationData },
        });
      }

      if (addedMembers.length) {
        await db.notification.createMany({
          data: addedMembers.map((mentioned) => ({
            recipientMemberId: mentioned.id,
            actorMemberId: member.id,
            type: 'VISIWORK_MENTION',
            eventKey: `visiwork-mention:${existing.id}:${mentioned.id}`,
            data: notificationData,
          })),
          skipDuplicates: true,
        });
      }

      return record;
    });

    return this.toMessage(updated);
  }

  async deleteMessage(
    member: Member,
    messageId: string,
  ): Promise<VisiWorkMessage> {
    const existing = await this.prisma.visiWorkMessage.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });

    if (!existing) throw new NotFoundException('Message not found.');
    if (existing.memberId !== member.id) {
      throw new ForbiddenException('You can only delete your own messages.');
    }
    if (existing.deletedAt) return this.toMessage(existing);

    const deletedAt = new Date();
    const deleted = await this.prisma.$transaction(async (db) => {
      const record = await db.visiWorkMessage.update({
        where: { id: existing.id },
        data: {
          body: DELETED_MESSAGE_BODY,
          deletedAt,
          mentions: { deleteMany: {} },
        },
        include: messageInclude,
      });

      await db.notification.deleteMany({
        where: {
          eventKey: { startsWith: `visiwork-mention:${existing.id}:` },
        },
      });

      return record;
    });

    return this.toMessage(deleted);
  }

  async searchMessages(
    member: Member,
    query: VisiWorkMessageSearchQuery,
  ): Promise<VisiWorkMessageSearchResponse> {
    const ventureId = query.ventureId ?? null;
    if (query.ventureId) await this.requireVenture(query.ventureId);

    const records = await this.prisma.visiWorkMessage.findMany({
      where: {
        ventureId,
        deletedAt: null,
        body: { contains: query.q, mode: 'insensitive' },
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
    });

    return { items: records.map((record) => this.toMessage(record)) };
  }

  async messageContext(
    member: Member,
    messageId: string,
  ): Promise<VisiWorkMessageContextResponse> {
    const target = await this.prisma.visiWorkMessage.findUnique({
      where: { id: messageId },
      include: messageInclude,
    });
    if (!target) throw new NotFoundException('Message not found.');
    if (target.ventureId) await this.requireVenture(target.ventureId);

    const before = await this.prisma.visiWorkMessage.findMany({
      where: {
        ventureId: target.ventureId,
        OR: [
          { createdAt: { lt: target.createdAt } },
          { createdAt: target.createdAt, id: { lt: target.id } },
        ],
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 12,
    });

    const after = await this.prisma.visiWorkMessage.findMany({
      where: {
        ventureId: target.ventureId,
        OR: [
          { createdAt: { gt: target.createdAt } },
          { createdAt: target.createdAt, id: { gt: target.id } },
        ],
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 12,
    });

    const items = [...before.reverse(), target, ...after].map((record) =>
      this.toMessage(record),
    );

    return {
      targetMessageId: target.id,
      ventureId: target.ventureId,
      items,
    };
  }
}
