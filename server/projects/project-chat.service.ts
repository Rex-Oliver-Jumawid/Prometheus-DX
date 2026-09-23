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
  EditProjectMessage,
  ProjectMessage,
  ProjectMessagePage,
} from '../../shared/contracts/project-chat';
import { PrismaService } from '../database/prisma.service';

const PAGE_SIZE = 30;
const personSelect = { id: true, fullName: true, email: true } as const;
const messageInclude = {
  member: { select: personSelect },
  parent: {
    select: {
      id: true,
      body: true,
      member: { select: { fullName: true } },
    },
  },
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

  private toMessage(record: MessageRecord, currentMemberId: string): ProjectMessage {
    return {
      id: record.id,
      projectId: record.projectId,
      author: record.member,
      parentMessageId: record.parentMessageId,
      replyTo: record.parent
        ? {
            id: record.parent.id,
            authorName: record.parent.member.fullName,
            preview: record.parent.body.slice(0, 160),
          }
        : null,
      body: record.body,
      createdAt: record.createdAt.toISOString(),
      editedAt: record.editedAt?.toISOString() ?? null,
      canEdit: record.memberId === currentMemberId,
    };
  }

  async list(
    member: Member,
    projectId: string,
    cursor?: string,
  ): Promise<ProjectMessagePage> {
    const project = await this.projectFor(member, projectId);
    if (cursor) {
      const previous = await this.prisma.projectMessage.findFirst({
        where: { id: cursor, projectId },
        select: { id: true },
      });
      if (!previous)
        throw new BadRequestException('Invalid Project chat cursor.');
    }
    const records = await this.prisma.projectMessage.findMany({
      where: { projectId },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = records.length > PAGE_SIZE;
    const items = records.slice(0, PAGE_SIZE);
    return {
      items: items.map((item) => this.toMessage(item, member.id)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      canWrite: this.canWrite(member, project),
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
          where: { id: input.parentMessageId, projectId },
          select: { id: true },
        });
        if (!parent)
          throw new BadRequestException('Reply must reference a message in this Project.');
      }
      const message = await db.projectMessage.create({
        data: {
          projectId,
          memberId: member.id,
          body: input.body,
          parentMessageId: input.parentMessageId,
        },
        include: messageInclude,
      });
      return this.toMessage(message, member.id);
    });
  }

  async edit(
    member: Member,
    projectId: string,
    messageId: string,
    input: EditProjectMessage,
  ): Promise<ProjectMessage> {
    const project = await this.projectFor(member, projectId);
    this.requireWrite(member, project);
    const original = await this.prisma.projectMessage.findFirst({
      where: { id: messageId, projectId },
      select: { id: true, memberId: true },
    });
    if (!original) throw new NotFoundException('Message not found.');
    if (original.memberId !== member.id)
      throw new ForbiddenException('Only the author may edit this message.');

    const updated = await this.prisma.projectMessage.update({
      where: { id: messageId },
      data: { body: input.body, editedAt: new Date() },
      include: messageInclude,
    });
    return this.toMessage(updated, member.id);
  }
}
