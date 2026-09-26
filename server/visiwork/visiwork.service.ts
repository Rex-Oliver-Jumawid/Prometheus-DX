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

const PAGE_SIZE = 40;
const DELETED_MESSAGE_BODY = '[deleted]';

const messageInclude = {
  member: { select: { id: true, fullName: true, profileImagePath: true } },
  mentions: {
    include: { member: { select: { id: true, fullName: true, profileImagePath: true } } },
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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async joinDepartment(
    member: Member,
    input: SetVisiWorkPresenceRequest,
  ): Promise<VisiWorkPresenceResponse> {
    const department = await this.prisma.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true },
    });
    if (!department) throw new NotFoundException('Department not found.');

    await this.prisma.member.update({
      where: { id: member.id },
      data: { visiworkDepartmentId: department.id },
    });

    return { memberId: member.id, departmentId: department.id };
  }

  private async requireDepartment(departmentId: string) {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, shortLabel: true },
    });
    if (!department) throw new NotFoundException('Department not found.');
    return department;
  }

  private canWriteDepartment(member: Member, departmentId: string): boolean {
    return (
      member.departmentId === departmentId ||
      member.visiworkDepartmentId === departmentId
    );
  }

  private toMessage(record: MessageRecord): VisiWorkMessage {
    const deleted = Boolean(record.deletedAt);
    return {
      id: record.id,
      departmentId: record.departmentId,
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
    departmentId?: string,
  ): Promise<MentionMember[]> {
    const uniqueMentionIds = [...new Set(mentionMemberIds)].filter(
      (id) => id !== sender.id,
    );
    if (!uniqueMentionIds.length) return [];

    const candidates = await this.prisma.member.findMany({
      where: {
        id: { in: uniqueMentionIds },
        status: 'ACTIVE',
        ...(departmentId
          ? {
              OR: [
                { departmentId },
                { visiworkDepartmentId: departmentId },
              ],
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
    department: { shortLabel: string } | null,
    departmentId: string | null,
  ): Prisma.InputJsonValue {
    return {
      messageId,
      departmentId,
      roomLabel: department ? `${department.shortLabel} Chat` : 'General Chat',
      preview: body.slice(0, 180),
    };
  }

  async listMessages(
    member: Member,
    departmentId?: string,
    cursor?: string,
  ): Promise<VisiWorkMessagePage> {
    const roomDepartmentId = departmentId ?? null;
    if (departmentId) await this.requireDepartment(departmentId);

    const previous = cursor
      ? await this.prisma.visiWorkMessage.findFirst({
          where: { id: cursor, departmentId: roomDepartmentId },
          select: { id: true, createdAt: true },
        })
      : null;

    if (cursor && !previous) {
      throw new BadRequestException('Invalid VisiWork chat cursor.');
    }

    const records = await this.prisma.visiWorkMessage.findMany({
      where: {
        departmentId: roomDepartmentId,
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
      canWrite: departmentId
        ? this.canWriteDepartment(member, departmentId)
        : true,
    };
  }

  async sendMessage(
    member: Member,
    input: CreateVisiWorkMessage,
    departmentId?: string,
  ): Promise<VisiWorkMessage> {
    const department = departmentId
      ? await this.requireDepartment(departmentId)
      : null;

    if (departmentId && !this.canWriteDepartment(member, departmentId)) {
      throw new ForbiddenException(
        'Join this department before sending messages to its room.',
      );
    }

    const mentionedMembers = await this.resolveMentionedMembers(
      member,
      input.body,
      input.mentionMemberIds,
      departmentId,
    );

    const message = await this.prisma.$transaction(async (db) => {
      const created = await db.visiWorkMessage.create({
        data: {
          departmentId: departmentId ?? null,
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
              department,
              departmentId ?? null,
            ),
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

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

    const department = existing.departmentId
      ? await this.requireDepartment(existing.departmentId)
      : null;
    const mentionedMembers = await this.resolveMentionedMembers(
      member,
      input.body,
      input.mentionMemberIds,
      existing.departmentId ?? undefined,
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
      department,
      existing.departmentId,
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
    const departmentId = query.departmentId ?? null;
    if (query.departmentId) await this.requireDepartment(query.departmentId);

    const records = await this.prisma.visiWorkMessage.findMany({
      where: {
        departmentId,
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
    if (target.departmentId) await this.requireDepartment(target.departmentId);

    const before = await this.prisma.visiWorkMessage.findMany({
      where: {
        departmentId: target.departmentId,
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
        departmentId: target.departmentId,
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
      departmentId: target.departmentId,
      items,
    };
  }
}
