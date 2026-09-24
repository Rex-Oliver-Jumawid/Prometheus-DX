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
  VisiWorkMessagePage,
  VisiWorkPresenceResponse,
} from '../../shared/contracts/visiwork';
import { PrismaService } from '../database/prisma.service';

const PAGE_SIZE = 40;
const messageInclude = {
  member: {
    select: {
      id: true,
      fullName: true,
    },
  },
} satisfies Prisma.VisiWorkMessageInclude;

type MessageRecord = Prisma.VisiWorkMessageGetPayload<{
  include: typeof messageInclude;
}>;

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

    if (!department) {
      throw new NotFoundException('Department not found.');
    }

    await this.prisma.member.update({
      where: { id: member.id },
      data: { visiworkDepartmentId: department.id },
    });

    return {
      memberId: member.id,
      departmentId: department.id,
    };
  }

  private async requireDepartment(departmentId: string): Promise<void> {
    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });
    if (!department) {
      throw new NotFoundException('Department not found.');
    }
  }

  private canWriteDepartment(member: Member, departmentId: string): boolean {
    return (
      member.departmentId === departmentId ||
      member.visiworkDepartmentId === departmentId
    );
  }

  private toMessage(record: MessageRecord): VisiWorkMessage {
    return {
      id: record.id,
      departmentId: record.departmentId,
      author: record.member,
      body: record.body,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async listMessages(
    member: Member,
    departmentId?: string,
    cursor?: string,
  ): Promise<VisiWorkMessagePage> {
    const roomDepartmentId = departmentId ?? null;
    if (departmentId) {
      await this.requireDepartment(departmentId);
    }

    const previous = cursor
      ? await this.prisma.visiWorkMessage.findFirst({
          where: {
            id: cursor,
            departmentId: roomDepartmentId,
          },
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
                {
                  createdAt: previous.createdAt,
                  id: { lt: previous.id },
                },
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
    if (departmentId) {
      await this.requireDepartment(departmentId);
      if (!this.canWriteDepartment(member, departmentId)) {
        throw new ForbiddenException(
          'Join this department before sending messages to its room.',
        );
      }
    }

    const message = await this.prisma.visiWorkMessage.create({
      data: {
        departmentId: departmentId ?? null,
        memberId: member.id,
        body: input.body,
      },
      include: messageInclude,
    });

    return this.toMessage(message);
  }
}
