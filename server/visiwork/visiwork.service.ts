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
  VisiWorkMessage,
  VisiWorkMessageContextResponse,
  VisiWorkMessagePage,
  VisiWorkMessageSearchQuery,
  VisiWorkMessageSearchResponse,
  VisiWorkPresenceResponse,
} from '../../shared/contracts/visiwork';
import { PrismaService } from '../database/prisma.service';

const PAGE_SIZE = 40;
const messageInclude = {
  member: { select: { id: true, fullName: true } },
  mentions: {
    include: { member: { select: { id: true, fullName: true } } },
  },
} satisfies Prisma.VisiWorkMessageInclude;

type MessageRecord = Prisma.VisiWorkMessageGetPayload<{ include: typeof messageInclude }>;

@Injectable()
export class VisiWorkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async joinDepartment(member: Member, input: SetVisiWorkPresenceRequest): Promise<VisiWorkPresenceResponse> {
    const department = await this.prisma.department.findUnique({ where: { id: input.departmentId }, select: { id: true } });
    if (!department) throw new NotFoundException('Department not found.');
    await this.prisma.member.update({ where: { id: member.id }, data: { visiworkDepartmentId: department.id } });
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
    return member.departmentId === departmentId || member.visiworkDepartmentId === departmentId;
  }

  private toMessage(record: MessageRecord): VisiWorkMessage {
    return {
      id: record.id,
      departmentId: record.departmentId,
      author: record.member,
      body: record.body,
      mentions: record.mentions?.map((mention) => mention.member) ?? [],
      createdAt: record.createdAt.toISOString(),
    };
  }

  async listMessages(member: Member, departmentId?: string, cursor?: string): Promise<VisiWorkMessagePage> {
    const roomDepartmentId = departmentId ?? null;
    if (departmentId) await this.requireDepartment(departmentId);
    const previous = cursor
      ? await this.prisma.visiWorkMessage.findFirst({ where: { id: cursor, departmentId: roomDepartmentId }, select: { id: true, createdAt: true } })
      : null;
    if (cursor && !previous) throw new BadRequestException('Invalid VisiWork chat cursor.');
    const records = await this.prisma.visiWorkMessage.findMany({
      where: {
        departmentId: roomDepartmentId,
        ...(previous ? { OR: [{ createdAt: { lt: previous.createdAt } }, { createdAt: previous.createdAt, id: { lt: previous.id } }] } : {}),
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
      canWrite: departmentId ? this.canWriteDepartment(member, departmentId) : true,
    };
  }

  async sendMessage(member: Member, input: CreateVisiWorkMessage, departmentId?: string): Promise<VisiWorkMessage> {
    const department = departmentId ? await this.requireDepartment(departmentId) : null;
    if (departmentId && !this.canWriteDepartment(member, departmentId)) {
      throw new ForbiddenException('Join this department before sending messages to its room.');
    }

    const uniqueMentionIds = [...new Set(input.mentionMemberIds)].filter((id) => id !== member.id);
    const mentionedMembers = uniqueMentionIds.length
      ? (
          await this.prisma.member.findMany({
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
          })
        ).filter((mentioned) =>
          input.body.toLowerCase().includes('@' + mentioned.fullName.toLowerCase()),
        )
      : [];

    const message = await this.prisma.$transaction(async (db) => {
      const created = await db.visiWorkMessage.create({
        data: {
          departmentId: departmentId ?? null,
          memberId: member.id,
          body: input.body,
          mentions: {
            create: mentionedMembers.map((mentioned) => ({ memberId: mentioned.id })),
          },
        },
        include: messageInclude,
      });

      if (mentionedMembers.length) {
        const preview = input.body.slice(0, 180);
        await db.notification.createMany({
          data: mentionedMembers.map((mentioned) => ({
            recipientMemberId: mentioned.id,
            actorMemberId: member.id,
            type: 'VISIWORK_MENTION',
            eventKey: `visiwork-mention:${created.id}:${mentioned.id}`,
            data: {
              messageId: created.id,
              departmentId: departmentId ?? null,
              roomLabel: department ? `${department.shortLabel} Chat` : 'General Chat',
              preview,
            },
          })),
          skipDuplicates: true,
        });
      }
      return created;
    });

    return this.toMessage(message);
  }

  async searchMessages(member: Member, query: VisiWorkMessageSearchQuery): Promise<VisiWorkMessageSearchResponse> {
    const departmentId = query.departmentId ?? null;
    if (query.departmentId) await this.requireDepartment(query.departmentId);
    const records = await this.prisma.visiWorkMessage.findMany({
      where: {
        departmentId,
        body: { contains: query.q, mode: 'insensitive' },
      },
      include: messageInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
    });
    return { items: records.map((record) => this.toMessage(record)) };
  }

  async messageContext(member: Member, messageId: string): Promise<VisiWorkMessageContextResponse> {
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
    const items = [...before.reverse(), target, ...after].map((record) => this.toMessage(record));
    return { targetMessageId: target.id, departmentId: target.departmentId, items };
  }
}
