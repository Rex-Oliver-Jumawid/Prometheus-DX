import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import type {
  CreateProjectAnnouncement,
  ProjectAnnouncement,
  ProjectAnnouncementsResponse,
  UpdateProjectAnnouncementPin,
} from '../../shared/contracts/project-announcement';
import { PrismaService } from '../database/prisma.service';

const authorSelect = { id: true, fullName: true, email: true } as const;

@Injectable()
export class ProjectAnnouncementService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async projectFor(member: Member, projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        leadMemberId: true,
        archivedAt: true,
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    return {
      ...project,
      canManage: project.leadMemberId === member.id && project.archivedAt === null,
    };
  }

  private toAnnouncement(record: {
    id: string;
    projectId: string;
    member: { id: string; fullName: string; email: string };
    title: string;
    body: string;
    pinnedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectAnnouncement {
    return {
      id: record.id,
      projectId: record.projectId,
      author: record.member,
      title: record.title,
      body: record.body,
      pinnedAt: record.pinnedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async list(member: Member, projectId: string): Promise<ProjectAnnouncementsResponse> {
    const project = await this.projectFor(member, projectId);
    const rows = await this.prisma.projectAnnouncement.findMany({
      where: { projectId },
      include: { member: { select: authorSelect } },
      orderBy: [
        { pinnedAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 30,
    });

    return {
      items: rows.map((row) => this.toAnnouncement(row)),
      canManage: project.canManage,
    };
  }

  async create(
    member: Member,
    projectId: string,
    input: CreateProjectAnnouncement,
  ): Promise<ProjectAnnouncement> {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, leadMemberId: true, archivedAt: true },
      });
      if (!project) throw new NotFoundException('Project not found.');
      if (project.archivedAt)
        throw new ConflictException('Archived Projects are read-only.');
      if (project.leadMemberId !== member.id)
        throw new ForbiddenException('Only the Project Lead may post announcements.');

      const announcement = await db.projectAnnouncement.create({
        data: {
          projectId,
          memberId: member.id,
          title: input.title,
          body: input.body,
        },
        include: { member: { select: authorSelect } },
      });

      await db.activityLog.create({
        data: {
          actorMemberId: member.id,
          projectId,
          entityType: 'ProjectAnnouncement',
          entityId: announcement.id,
          action: 'PROJECT_ANNOUNCEMENT_POSTED',
          metadata: { title: announcement.title },
        },
      });

      return this.toAnnouncement(announcement);
    });
  }

  async setPinned(
    member: Member,
    projectId: string,
    announcementId: string,
    input: UpdateProjectAnnouncementPin,
  ): Promise<ProjectAnnouncement> {
    return this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const project = await db.project.findUnique({
        where: { id: projectId },
        select: { id: true, leadMemberId: true, archivedAt: true },
      });
      if (!project) throw new NotFoundException('Project not found.');
      if (project.archivedAt)
        throw new ConflictException('Archived Projects are read-only.');
      if (project.leadMemberId !== member.id)
        throw new ForbiddenException('Only the Project Lead may pin announcements.');

      const existing = await db.projectAnnouncement.findFirst({
        where: { id: announcementId, projectId },
        select: { id: true, pinnedAt: true, title: true },
      });
      if (!existing) throw new NotFoundException('Announcement not found.');

      const alreadyPinned = existing.pinnedAt !== null;
      if (alreadyPinned === input.pinned) {
        const unchanged = await db.projectAnnouncement.findUniqueOrThrow({
          where: { id: announcementId },
          include: { member: { select: authorSelect } },
        });
        return this.toAnnouncement(unchanged);
      }

      const updated = await db.projectAnnouncement.update({
        where: { id: announcementId },
        data: { pinnedAt: input.pinned ? new Date() : null },
        include: { member: { select: authorSelect } },
      });

      await db.activityLog.create({
        data: {
          actorMemberId: member.id,
          projectId,
          entityType: 'ProjectAnnouncement',
          entityId: announcementId,
          action: input.pinned
            ? 'PROJECT_ANNOUNCEMENT_PINNED'
            : 'PROJECT_ANNOUNCEMENT_UNPINNED',
          metadata: { title: existing.title },
        },
      });

      return this.toAnnouncement(updated);
    });
  }
}
