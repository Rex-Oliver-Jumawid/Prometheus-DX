import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import type {
  CreateProjectMessage,
  DeleteProjectMessage,
  EditProjectMessage,
  ProjectMessageSearchQuery,
  ProjectMessage,
  ProjectMessagePage,
} from '../../shared/contracts/project-chat';
import { PrismaService } from '../database/prisma.service';
import { writeNotifications } from '../notifications/notification-writer';

const PAGE_SIZE = 30;
const personSelect = { id: true, fullName: true, email: true } as const;
const messageInclude = {
  member: { select: personSelect },
  parent: {
    select: {
      id: true,
      body: true,
      deletedAt: true,
      member: { select: { fullName: true } },
    },
  },
  mentions: { include: { member: { select: { id: true, fullName: true } } } },
} satisfies Prisma.ProjectMessageInclude;

type MessageRecord = Prisma.ProjectMessageGetPayload<{
  include: typeof messageInclude;
}>;

@Injectable()
export class ProjectChatService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async projectFor(
    member: Member,
    projectId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        leadMemberId: true,
        archivedAt: true,
        members: {
          where: { memberId: member.id },
          select: { memberId: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return project;
  }

  private canWrite(
    member: Member,
    project: Awaited<ReturnType<ProjectChatService['projectFor']>>,
  ) {
    return (
      project.archivedAt === null &&
      (project.leadMemberId === member.id || project.members.length > 0)
    );
  }

  private requireWrite(
    member: Member,
    project: Awaited<ReturnType<ProjectChatService['projectFor']>>,
  ) {
    if (project.archivedAt !== null)
      throw new ConflictException('Archived Projects are read-only.');
    if (!this.canWrite(member, project))
      throw new ForbiddenException(
        'Only the Project Lead and Project Members may send or edit chat messages.',
      );
  }

  /** Resolve only active people assigned to this Project, never arbitrary workspace IDs. */
  private async validatedMentions(
    db: Prisma.TransactionClient,
    member: Member,
    project: Awaited<ReturnType<ProjectChatService['projectFor']>>,
    projectId: string,
    body: string,
    ids: string[],
  ) {
    const requested = [...new Set(ids)].filter((id) => id !== member.id);
    if (!requested.length) return [];
    const [people, memberships] = await Promise.all([
      db.member.findMany({
        where: { id: { in: requested }, status: 'ACTIVE' },
        select: { id: true, fullName: true },
      }),
      db.projectMember.findMany({
        where: { projectId, memberId: { in: requested } },
        select: { memberId: true },
      }),
    ]);
    const permitted = new Set([project.leadMemberId, ...memberships.map((row) => row.memberId)]);
    const matches = people.filter((person) =>
      permitted.has(person.id) &&
      body.toLocaleLowerCase().includes('@' + person.fullName.toLocaleLowerCase()),
    );
    if (matches.length !== requested.length)
      throw new BadRequestException('Mention an active Project Member who appears in the message.');
    return matches;
  }

  private toMessage(
    record: MessageRecord,
    currentMemberId: string,
    canWrite = true,
  ): ProjectMessage {
    return {
      id: record.id,
      projectId: record.projectId,
      outcomeId: record.outcomeId,
      author: record.member,
      parentMessageId: record.parentMessageId,
      replyTo: record.parent
        ? {
            id: record.parent.id,
            authorName: record.parent.member.fullName,
            preview: record.parent.deletedAt ? '[Message deleted]' : record.parent.body.slice(0, 160),
          }
        : null,
      body: record.deletedAt ? '[Message deleted]' : record.body,
      mentions: record.deletedAt ? [] : (record.mentions ?? []).map((entry) => entry.member),
      deletedAt: record.deletedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      editedAt: record.editedAt?.toISOString() ?? null,
      canEdit: canWrite && !record.deletedAt && record.memberId === currentMemberId,
      canDelete: canWrite && !record.deletedAt && record.memberId === currentMemberId,
    };
  }

  async list(
    member: Member,
    projectId: string,
    cursor?: string,
  ): Promise<ProjectMessagePage> {
    const project = await this.projectFor(member, projectId);
    const previous = cursor
      ? await this.prisma.projectMessage.findFirst({
          where: { id: cursor, projectId, outcomeId: null },
          select: { id: true, createdAt: true },
        })
      : null;
    if (cursor && !previous)
      throw new BadRequestException('Invalid Project chat cursor.');

    const records = await this.prisma.projectMessage.findMany({
      where: {
        projectId,
        outcomeId: null,
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
      items: items.map((item) =>
        this.toMessage(item, member.id, this.canWrite(member, project)),
      ),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      canWrite: this.canWrite(member, project),
    };
  }

  async search(
    member: Member,
    projectId: string,
    query: ProjectMessageSearchQuery,
  ) {
    const project = await this.projectFor(member, projectId);
    const rows = await this.prisma.projectMessage.findMany({
      where: {
        projectId,
        outcomeId: null,
        deletedAt: null,
        body: { contains: query.q, mode: 'insensitive' },
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
    });
    return { items: rows.map((row) => this.toMessage(row, member.id, this.canWrite(member, project))) };
  }

  async context(member: Member, projectId: string, messageId: string) {
    const project = await this.projectFor(member, projectId);
    const target = await this.prisma.projectMessage.findFirst({
      where: { id: messageId, projectId, outcomeId: null },
      include: messageInclude,
    });
    if (!target) throw new NotFoundException('Message not found in this Project.');
    const older = await this.prisma.projectMessage.findMany({
      where: { projectId, outcomeId: null, OR: [
        { createdAt: { lt: target.createdAt } },
        { createdAt: target.createdAt, id: { lt: target.id } },
      ] },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 15,
    });
    const newer = await this.prisma.projectMessage.findMany({
      where: { projectId, outcomeId: null, OR: [
        { createdAt: { gt: target.createdAt } },
        { createdAt: target.createdAt, id: { gt: target.id } },
      ] },
      include: messageInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 15,
    });
    return {
      targetMessageId: messageId,
      items: [...older.reverse(), target, ...newer].map((row) =>
        this.toMessage(row, member.id, this.canWrite(member, project))),
    };
  }

  async send(
    member: Member,
    projectId: string,
    input: CreateProjectMessage,
  ): Promise<ProjectMessage> {
    return this.prisma.$transaction(async (db) => {
      // Project workflow access changes take this same lock.
      // Check authorization and persist the message while holding it.
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const project = await this.projectFor(member, projectId, db);
      this.requireWrite(member, project);
      if (input.parentMessageId) {
        const parent = await db.projectMessage.findFirst({
          where: {
            id: input.parentMessageId,
            projectId,
            outcomeId: null,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!parent)
          throw new BadRequestException('Reply must reference a message in this Project.');
      }
      const mentions = await this.validatedMentions(
        db, member, project, projectId, input.body, input.mentionMemberIds ?? [],
      );
      const message = await db.projectMessage.create({
        data: {
          projectId,
          outcomeId: null,
          memberId: member.id,
          body: input.body,
          parentMessageId: input.parentMessageId,
          ...(mentions.length ? { mentions: { create: mentions.map((person) => ({ memberId: person.id })) } } : {}),
        },
        include: messageInclude,
      });
      if (mentions.length > 0) {
        await writeNotifications(db, {
          type: 'PROJECT_CHAT_MENTION',
          sourceEventId: message.id,
          actorMemberId: member.id,
          recipientMemberIds: mentions.map((person) => person.id),
          projectId,
          data: {
            messageId: message.id,
            preview: input.body.slice(0, 140),
          },
        });
      }
      return this.toMessage(message, member.id);
    });
  }

  async edit(
    member: Member,
    projectId: string,
    messageId: string,
    input: EditProjectMessage,
  ): Promise<ProjectMessage> {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const project = await this.projectFor(member, projectId, db);
      this.requireWrite(member, project);
      const original = await db.projectMessage.findFirst({
        where: { id: messageId, projectId, outcomeId: null },
        select: {
          id: true,
          memberId: true,
          editedAt: true,
          deletedAt: true,
          mentions: { select: { memberId: true } },
        },
      });
      if (!original) throw new NotFoundException('Message not found.');
      if (original.memberId !== member.id)
        throw new ForbiddenException('Only the author may edit this message.');
      if (original.deletedAt) throw new ConflictException('Deleted messages cannot be edited.');
      // A stale editor must not replace another tab's more recent changes.
      if ((original.editedAt?.toISOString() ?? null) !== input.expectedEditedAt)
        throw new ConflictException('This message was edited elsewhere. Cancel and reopen the editor.');
      const requestedMentionIds =
        input.mentionMemberIds ??
        original.mentions.map((mention) => mention.memberId);
      const mentions = await this.validatedMentions(
        db,
        member,
        project,
        projectId,
        input.body,
        requestedMentionIds,
      );
      const previousMentionIds = new Set(
        original.mentions.map((mention) => mention.memberId),
      );
      const nextMentionIds = new Set(
        mentions.map((mention) => mention.id),
      );
      const removedMentionIds = [...previousMentionIds].filter(
        (id) => !nextMentionIds.has(id),
      );
      const retainedMentionIds = [...nextMentionIds].filter((id) =>
        previousMentionIds.has(id),
      );
      const addedMembers = mentions.filter(
        (mention) => !previousMentionIds.has(mention.id),
      );
      const notificationData = {
        messageId,
        preview: input.body.slice(0, 140),
      };
      const updated = await db.projectMessage.update({
        where: { id: messageId },
        data: {
          body: input.body,
          editedAt: new Date(),
          mentions: {
            deleteMany: {},
            create: mentions.map((person) => ({ memberId: person.id })),
          },
        },
        include: messageInclude,
      });

      const eventKey = 'PROJECT_CHAT_MENTION:' + messageId;
      if (removedMentionIds.length) {
        await db.notification.deleteMany({
          where: {
            recipientMemberId: { in: removedMentionIds },
            type: 'PROJECT_CHAT_MENTION',
            eventKey,
          },
        });
      }
      if (retainedMentionIds.length) {
        await db.notification.updateMany({
          where: {
            recipientMemberId: { in: retainedMentionIds },
            type: 'PROJECT_CHAT_MENTION',
            eventKey,
          },
          data: { data: notificationData },
        });
      }
      if (addedMembers.length) {
        await writeNotifications(db, {
          type: 'PROJECT_CHAT_MENTION',
          sourceEventId: messageId,
          actorMemberId: member.id,
          recipientMemberIds: addedMembers.map((mention) => mention.id),
          projectId,
          data: notificationData,
        });
      }

      return this.toMessage(updated, member.id);
    });
  }

  /** A tombstone preserves replies without disclosing the removed message. */
  async remove(
    member: Member,
    projectId: string,
    messageId: string,
    input: DeleteProjectMessage,
  ): Promise<ProjectMessage> {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const project = await this.projectFor(member, projectId, db);
      this.requireWrite(member, project);
      const original = await db.projectMessage.findFirst({
        where: { id: messageId, projectId, outcomeId: null },
        select: { id: true, memberId: true, editedAt: true, deletedAt: true },
      });
      if (!original) throw new NotFoundException('Message not found.');
      if (original.memberId !== member.id)
        throw new ForbiddenException('Only the author may delete this message.');
      if (original.deletedAt) throw new ConflictException('Message was already deleted.');
      if ((original.editedAt?.toISOString() ?? null) !== input.expectedEditedAt)
        throw new ConflictException('Message changed elsewhere. Refresh before deleting.');
      const updated = await db.projectMessage.update({
        where: { id: messageId },
        data: {
          body: '[Message deleted]',
          deletedAt: new Date(),
          mentions: { deleteMany: {} },
        },
        include: messageInclude,
      });
      await db.notification.deleteMany({
        where: {
          type: 'PROJECT_CHAT_MENTION',
          eventKey: 'PROJECT_CHAT_MENTION:' + messageId,
        },
      });
      return this.toMessage(updated, member.id);
    });
  }
}
