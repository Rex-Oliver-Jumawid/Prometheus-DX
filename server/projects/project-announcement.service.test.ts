import { ForbiddenException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ProjectAnnouncementService } from './project-announcement.service';

const projectId = '11111111-1111-4111-8111-111111111111';
const lead = {
  id: '22222222-2222-4222-8222-222222222222',
  fullName: 'Project Lead',
  email: 'lead@example.com',
} as Member;
const other = {
  id: '33333333-3333-4333-8333-333333333333',
} as Member;
const announcementId = '44444444-4444-4444-8444-444444444444';

const record = {
  id: announcementId,
  projectId,
  memberId: lead.id,
  member: { id: lead.id, fullName: 'Project Lead', email: 'lead@example.com' },
  title: 'Project guidance',
  body: 'Keep output notes specific.',
  pinnedAt: null,
  createdAt: new Date('2026-09-24T11:00:00.000Z'),
  updatedAt: new Date('2026-09-24T11:00:00.000Z'),
};

function setup(member = lead) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    project: {
      findUnique: vi.fn().mockResolvedValue({
        id: projectId,
        leadMemberId: lead.id,
        archivedAt: null,
      }),
    },
    projectAnnouncement: {
      create: vi.fn().mockResolvedValue(record),
      findFirst: vi.fn().mockResolvedValue({
        id: announcementId,
        pinnedAt: null,
        title: record.title,
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue(record),
      update: vi.fn().mockResolvedValue({
        ...record,
        pinnedAt: new Date('2026-09-24T11:05:00.000Z'),
      }),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const db = {
    project: {
      findUnique: vi.fn().mockResolvedValue({
        id: projectId,
        leadMemberId: lead.id,
        archivedAt: null,
      }),
    },
    projectAnnouncement: {
      findMany: vi.fn().mockResolvedValue([record]),
    },
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new ProjectAnnouncementService(db as unknown as PrismaService);
  return { db, tx, service, member };
}

describe('ProjectAnnouncementService', () => {
  it('lists announcements and exposes management only to the Project Lead', async () => {
    const leadSetup = setup(lead);
    await expect(leadSetup.service.list(lead, projectId)).resolves.toMatchObject({
      canManage: true,
      items: [{ id: announcementId, title: record.title }],
    });

    const otherSetup = setup(other);
    await expect(otherSetup.service.list(other, projectId)).resolves.toMatchObject({
      canManage: false,
      items: [{ id: announcementId }],
    });
  });

  it('posts an announcement and writes a safe activity event atomically', async () => {
    const { tx, service } = setup();
    await service.create(lead, projectId, {
      title: record.title,
      body: record.body,
    });

    expect(tx.projectAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId,
          memberId: lead.id,
          title: record.title,
          body: record.body,
        }),
      }),
    );
    expect(tx.activityLog.create).toHaveBeenCalledWith({
      data: {
        actorMemberId: lead.id,
        projectId,
        entityType: 'ProjectAnnouncement',
        entityId: announcementId,
        action: 'PROJECT_ANNOUNCEMENT_POSTED',
        metadata: { title: record.title },
      },
    });
  });

  it('prevents non-leads from posting announcements', async () => {
    const { service, tx } = setup(other);
    await expect(
      service.create(other, projectId, {
        title: record.title,
        body: record.body,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.projectAnnouncement.create).not.toHaveBeenCalled();
  });

  it('pins announcements and records the pin in Project Activity', async () => {
    const { service, tx } = setup();
    const response = await service.setPinned(
      lead,
      projectId,
      announcementId,
      { pinned: true },
    );

    expect(response.pinnedAt).toBe('2026-09-24T11:05:00.000Z');
    expect(tx.projectAnnouncement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: announcementId },
        data: { pinnedAt: expect.any(Date) },
      }),
    );
    expect(tx.activityLog.create).toHaveBeenCalledWith({
      data: {
        actorMemberId: lead.id,
        projectId,
        entityType: 'ProjectAnnouncement',
        entityId: announcementId,
        action: 'PROJECT_ANNOUNCEMENT_PINNED',
        metadata: { title: record.title },
      },
    });
  });
});
