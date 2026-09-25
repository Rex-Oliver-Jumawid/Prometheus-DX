import { ConflictException } from '@nestjs/common';
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

function setup(member = lead, isProjectMember = false, archivedAt: Date | null = null) {
  const members = isProjectMember || member.id === lead.id ? [{ memberId: member.id }] : [];
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    project: {
      findUnique: vi.fn().mockResolvedValue({
        id: projectId,
        leadMemberId: lead.id,
        archivedAt,
        members,
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
        archivedAt,
        members,
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
  it('lets every authorized employee manage announcements in active Projects', async () => {
    const leadSetup = setup(lead);
    await expect(leadSetup.service.list(lead, projectId)).resolves.toMatchObject({
      canManage: true,
      canPost: true,
      items: [{ id: announcementId, title: record.title }],
    });

    const otherSetup = setup(other);
    await expect(otherSetup.service.list(other, projectId)).resolves.toMatchObject({
      canManage: true,
      canPost: true,
      items: [{ id: announcementId }],
    });
  });

  it('lets Project Members announce and pin', async () => {
    const { service, tx } = setup(other, true);
    await expect(service.list(other, projectId)).resolves.toMatchObject({
      canPost: true,
      canManage: true,
    });
    await expect(service.create(other, projectId, {
      title: record.title,
      body: record.body,
    })).resolves.toMatchObject({ id: announcementId });
    expect(tx.projectAnnouncement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberId: other.id }),
      }),
    );
    await expect(service.setPinned(other, projectId, announcementId, { pinned: true }))
      .resolves.toMatchObject({ id: announcementId, pinnedAt: '2026-09-24T11:05:00.000Z' });
    expect(tx.projectAnnouncement.update).toHaveBeenCalledOnce();
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

  it('allows non-project employees to announce and pin', async () => {
    const { service, tx } = setup(other);
    await expect(service.create(other, projectId, {
      title: record.title,
      body: record.body,
    })).resolves.toMatchObject({ id: announcementId });
    expect(tx.projectAnnouncement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ memberId: other.id, projectId }),
    }));
    await expect(service.setPinned(other, projectId, announcementId, { pinned: true }))
      .resolves.toMatchObject({ id: announcementId, pinnedAt: '2026-09-24T11:05:00.000Z' });
  });

  it('returns archived Projects as read-only and rejects pin attempts', async () => {
    const archived = setup(other, false, new Date('2026-09-25T00:00:00.000Z'));
    await expect(archived.service.list(other, projectId)).resolves.toMatchObject({
      canPost: false, canManage: false,
    });
    await expect(archived.service.setPinned(other, projectId, announcementId, { pinned: true }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(archived.tx.projectAnnouncement.update).not.toHaveBeenCalled();
  });

  it('records unpin actions by non-project employees', async () => {
    const outsider = setup(other);
    outsider.tx.projectAnnouncement.findFirst.mockResolvedValueOnce({
      id: announcementId, pinnedAt: new Date('2026-09-24T11:05:00.000Z'), title: record.title,
    });
    outsider.tx.projectAnnouncement.update.mockResolvedValueOnce({
      ...record, pinnedAt: null,
    });
    const result = await outsider.service.setPinned(other, projectId, announcementId, { pinned: false });
    expect(result.pinnedAt).toBeNull();
    expect(outsider.tx.activityLog.create).toHaveBeenCalledWith({
      data: {
        actorMemberId: other.id, projectId,
        entityType: 'ProjectAnnouncement', entityId: announcementId,
        action: 'PROJECT_ANNOUNCEMENT_UNPINNED',
        metadata: { title: record.title },
      },
    });
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
