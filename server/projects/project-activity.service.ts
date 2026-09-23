import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Member } from '@prisma/client';
import type { ProjectActivityPage } from '../../shared/contracts/project-activity';
import { PrismaService } from '../database/prisma.service';

const PAGE_SIZE = 25;

/** Project activity is visible to every active authorized workspace member. */
@Injectable()
export class ProjectActivityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    _member: Member,
    projectId: string,
    cursor?: string,
  ): Promise<ProjectActivityPage> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found.');

    if (cursor) {
      const previous = await this.prisma.activityLog.findFirst({
        where: { id: cursor, projectId },
        select: { id: true },
      });
      if (!previous)
        throw new BadRequestException('Invalid project activity cursor.');
    }

    const records = await this.prisma.activityLog.findMany({
      where: { projectId },
      include: {
        actorMember: { select: { id: true, fullName: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    const hasMore = records.length > PAGE_SIZE;
    const items = records.slice(0, PAGE_SIZE);
    return {
      items: items.map((record) => ({
        id: record.id,
        actor: record.actorMember,
        outcomeId: record.outcomeId,
        entityType: record.entityType,
        entityId: record.entityId,
        action: record.action,
        metadata: record.metadata,
        createdAt: record.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }
}
