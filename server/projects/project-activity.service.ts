import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Member } from '@prisma/client';
import type { ProjectActivityPage } from '../../shared/contracts/project-activity';
import { PrismaService } from '../database/prisma.service';

const PAGE_SIZE = 25;

// The stored JSON can include private submission text. Expose only display-safe fields.
function safeMetadata(action: string, raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const fields = raw as Record<string, unknown>;
  const result: Record<string, string> = {};
  // Only explicitly reviewed action types may disclose their display titles.
  if (
    [
      'FEATURE_CREATED', 'FEATURE_UPDATED', 'FEATURE_DELETED',
      'TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED',
      'TASK_REOPENED', 'TASK_DELETED',
      'OUTCOME_CREATED', 'OUTCOME_UPDATED', 'OUTCOME_DELETED',
    ].includes(action) && typeof fields.title === 'string'
  ) result.title = fields.title;
  if (
    ['STAGE_CREATED', 'STAGE_UPDATED', 'STAGE_DELETED'].includes(action) &&
    typeof fields.name === 'string'
  ) result.title = fields.name;
  if (action === 'PROJECT_CREATED' && typeof fields.name === 'string')
    result.title = fields.name;
  if (
    ['PROJECT_ANNOUNCEMENT_POSTED', 'PROJECT_ANNOUNCEMENT_PINNED', 'PROJECT_ANNOUNCEMENT_UNPINNED'].includes(action) &&
    typeof fields.title === 'string'
  ) result.title = fields.title;
  if (action === 'PROJECT_MEMBER_ACCESS_CHANGED') {
    if (typeof fields.previousAccess === 'string')
      result.previousAccess = fields.previousAccess;
    if (typeof fields.newAccess === 'string')
      result.newAccess = fields.newAccess;
  }
  if (action === 'PROJECT_STATUS_CHANGED') {
    if (typeof fields.fromStatus === 'string') result.fromStatus = fields.fromStatus;
    if (typeof fields.toStatus === 'string') result.toStatus = fields.toStatus;
  }
  return result;
}

/** Activity is project-wide for administrators and leads, personal for project members. */
@Injectable()
export class ProjectActivityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(
    member: Member,
    projectId: string,
    cursor?: string,
  ): Promise<ProjectActivityPage> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        leadMemberId: true,
        members: {
          where: { memberId: member.id },
          select: { memberId: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    const privileged = member.workspaceRole === 'ADMINISTRATOR' ||
      project.leadMemberId === member.id;
    if (!privileged && project.members.length === 0)
      throw new ForbiddenException('Only Project Members may view their activity.');
    const scope = privileged ? 'PROJECT' : 'PERSONAL';
    const actorFilter = privileged ? {} : { actorMemberId: member.id };

    const previous = cursor
      ? await this.prisma.activityLog.findFirst({
          where: { id: cursor, projectId, ...actorFilter },
          select: { id: true, createdAt: true },
        })
      : null;
    if (cursor && !previous)
      throw new BadRequestException('Invalid project activity cursor.');

    // Keyset pagination preserves the older-page boundary when new events arrive.
    const records = await this.prisma.activityLog.findMany({
      where: {
        projectId,
        ...actorFilter,
        ...(previous
          ? {
              OR: [
                { createdAt: { lt: previous.createdAt } },
                { createdAt: previous.createdAt, id: { lt: previous.id } },
              ],
            }
          : {}),
      },
      include: {
        actorMember: { select: { id: true, fullName: true } },
        outcome: { select: { title: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    });
    const hasMore = records.length > PAGE_SIZE;
    const items = records.slice(0, PAGE_SIZE);
    return {
      items: items.map((record) => ({
        id: record.id,
        actor: record.actorMember,
        outcomeId: record.outcomeId,
        outcomeTitle: record.outcome?.title ?? null,
        entityType: record.entityType,
        entityId: record.entityId,
        action: record.action,
        metadata: safeMetadata(record.action, record.metadata),
        createdAt: record.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
      scope,
    };
  }
}
