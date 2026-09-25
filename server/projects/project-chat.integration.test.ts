import 'dotenv/config';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ProjectChatService } from './project-chat.service';
import { ProjectAnnouncementService } from './project-announcement.service';
import { ProjectActivityService } from './project-activity.service';
import { ProjectActivityPageSchema } from '../../shared/contracts/project-activity';
import { ProjectMessagePageSchema } from '../../shared/contracts/project-chat';
import { ProjectAnnouncementsResponseSchema } from '../../shared/contracts/project-announcement';

const enabled = process.env.RUN_DATABASE_INTEGRATION === '1';
const db = new PrismaService();
const chat = new ProjectChatService(db);
const runId = 'project-chat-integration-' + randomUUID();
let departmentId = '';
let projectId = '';
let secondProjectId = '';
let lead: Awaited<ReturnType<typeof db.member.create>>;
let participant: typeof lead;
let viewer: typeof lead;
let admin: typeof lead;

describe.runIf(enabled)('Project Chat PostgreSQL integration', () => {
  beforeAll(async () => {
    const department = await db.department.create({
      data: { name: runId, shortLabel: 'CHAT' },
    });
    departmentId = department.id;
    [lead, participant, viewer, admin] = await Promise.all(
      ['lead', 'participant', 'viewer', 'admin'].map((label) => db.member.create({
        data: {
          email: runId + '-' + label + '@example.com',
          fullName: label,
          status: 'ACTIVE',
          workspaceRole: label === 'admin' ? 'ADMINISTRATOR' : 'MEMBER',
          departmentId,
        },
      })),
    );
    const projects = await Promise.all(
      ['primary', 'secondary'].map((name) => db.project.create({
        data: {
          name: runId + '-' + name,
          description: 'Project Chat integration fixture.',
          createdByMemberId: lead.id,
          leadMemberId: lead.id,
          departments: { create: { departmentId } },
        },
      })),
    );
    projectId = projects[0].id;
    secondProjectId = projects[1].id;
    await db.projectMember.create({
      data: { projectId, memberId: participant.id, accessLevel: 'CAN_VIEW' },
    });
  }, 30_000);

  afterAll(async () => {
    if (projectId || secondProjectId) {
      await db.project.deleteMany({
        where: { id: { in: [projectId, secondProjectId].filter(Boolean) } },
      });
    }
    if (departmentId) {
      await db.member.deleteMany({ where: { email: { startsWith: runId } } });
      await db.department.delete({ where: { id: departmentId } });
    }
    await db.$disconnect();
  }, 30_000);

  it('loads a fresh Project with an empty conversation and announcement rail', async () => {
    const announcements = new ProjectAnnouncementService(db);
    const emptyChat = await chat.list(lead, projectId);
    const emptyAnnouncements = await announcements.list(lead, projectId);

    expect(ProjectMessagePageSchema.parse(emptyChat)).toEqual({
      items: [],
      nextCursor: null,
      canWrite: true,
    });
    expect(ProjectAnnouncementsResponseSchema.parse(emptyAnnouncements)).toEqual({
      items: [],
      canManage: true,
      canPost: true,
    });

    const viewerChat = await chat.list(viewer, projectId);
    const viewerAnnouncements = await announcements.list(viewer, projectId);
    expect(ProjectMessagePageSchema.parse(viewerChat)).toMatchObject({
      items: [],
      canWrite: true,
    });
    expect(ProjectAnnouncementsResponseSchema.parse(viewerAnnouncements)).toEqual({
      items: [],
      canManage: false,
      canPost: true,
    });
  });

  it('shares safe Project Activity with every authorized employee and isolates other projects', async () => {
    const leadLogId = randomUUID();
    const memberLogId = randomUUID();
    const foreignLogId = randomUUID();
    await db.activityLog.createMany({
      data: [
        {
          id: leadLogId, projectId, actorMemberId: lead.id,
          entityType: 'Feature', entityId: randomUUID(),
          action: 'FEATURE_CREATED', metadata: { title: 'Lead feature' },
        },
        {
          id: memberLogId, projectId, actorMemberId: participant.id,
          entityType: 'Feature', entityId: randomUUID(),
          action: 'FEATURE_CREATED', metadata: { title: 'Member feature' },
        },
        {
          id: foreignLogId, projectId: secondProjectId, actorMemberId: participant.id,
          entityType: 'Feature', entityId: randomUUID(),
          action: 'FEATURE_CREATED', metadata: { title: 'Another Project' },
        },
      ],
    });
    const activity = new ProjectActivityService(db);
    const [leadView, memberView, adminView, outsiderView] = await Promise.all([
      activity.list(lead, projectId),
      activity.list(participant, projectId),
      activity.list(admin, projectId),
      activity.list(viewer, projectId),
    ]);
    for (const view of [leadView, memberView, adminView, outsiderView]) {
      expect(ProjectActivityPageSchema.parse(view).scope).toBe('PROJECT');
      expect(view.items.map((item) => item.id)).toEqual(
        expect.arrayContaining([leadLogId, memberLogId]),
      );
      expect(view.items.some((item) => item.id === foreignLogId)).toBe(false);
    }
    const otherProjectView = await activity.list(participant, secondProjectId);
    expect(otherProjectView.items.map((item) => item.id).toContain(foreignLogId);
    expect(otherProjectView.items.map((item) => item.id)).not.toContain(leadLogId);
    await expect(activity.list(participant, projectId, foreignLogId))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets unrelated employees post announcements but reserves pinning for the Lead', async () => {
    const announcements = new ProjectAnnouncementService(db);
    const posted = await announcements.create(viewer, projectId, {
      title: 'Company update', body: 'Shared with every employee.',
    });
    expect(posted.author.id).toBe(viewer.id);
    expect((await announcements.list(viewer, projectId))).toMatchObject({
      canPost: true, canManage: false,
    });
    await expect(announcements.setPinned(viewer, projectId, posted.id, { pinned: true }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(announcements.setPinned(lead, projectId, posted.id, { pinned: true }))
      .resolves.toMatchObject({ id: posted.id });
  });

  it('persists replies, restricts author edits and isolates other Project messages', async () => {
    const root = await chat.send(lead, projectId, {
      body: 'Discussion opened', parentMessageId: null,
    });
    const reply = await chat.send(participant, projectId, {
      body: 'Reply persisted', parentMessageId: root.id,
    });
    const foreign = await chat.send(lead, secondProjectId, {
      body: 'Unrelated Project', parentMessageId: null,
    });

    const read = await chat.list(viewer, projectId);
    expect(read.canWrite).toBe(true);
    expect(read.items.find((item) => item.id === reply.id)?.replyTo?.id).toBe(root.id);
    expect(read.items.some((item) => item.id === foreign.id)).toBe(false);
    const outsiderMessage = await chat.send(viewer, projectId, {
      body: 'Company-wide input', parentMessageId: null,
    });
    expect(outsiderMessage.author.id).toBe(viewer.id);
    await expect(chat.edit(viewer, projectId, outsiderMessage.id, {
      body: 'Updated company-wide input', expectedEditedAt: null,
    })).resolves.toMatchObject({ body: 'Updated company-wide input' });
    await expect(chat.send(participant, projectId, {
      body: 'Cross-Project reply', parentMessageId: foreign.id,
    })).rejects.toBeInstanceOf(BadRequestException);
    await expect(chat.edit(lead, projectId, reply.id, {
      body: 'Not my message', expectedEditedAt: null,
    })).rejects.toBeInstanceOf(ForbiddenException);
    // The same author can write in both Projects, but cannot address a message
    // through the wrong Project's route.
    await expect(chat.edit(lead, secondProjectId, root.id, {
      body: 'Wrong Project', expectedEditedAt: null,
    })).rejects.toBeInstanceOf(NotFoundException);
    await chat.edit(participant, projectId, reply.id, { body: 'Author edit persisted', expectedEditedAt: null });
    const persisted = await db.projectMessage.findUniqueOrThrow({ where: { id: reply.id } });
    expect(persisted.body).toBe('Author edit persisted');
    expect(persisted.editedAt).not.toBeNull();
  });

  it('keeps Project Chat mention notifications synchronized through edits and deletion', async () => {
    const created = await chat.send(participant, projectId, {
      body: '@lead please review this',
      parentMessageId: null,
      mentionMemberIds: [lead.id],
    });
    const eventKey = 'PROJECT_CHAT_MENTION:' + created.id;

    let notification = await db.notification.findFirst({
      where: {
        recipientMemberId: lead.id,
        type: 'PROJECT_CHAT_MENTION',
        eventKey,
      },
    });
    expect(notification).not.toBeNull();
    expect(notification?.data).toMatchObject({
      messageId: created.id,
      preview: '@lead please review this',
    });

    const retained = await chat.edit(participant, projectId, created.id, {
      body: '@lead updated review request',
      expectedEditedAt: null,
      mentionMemberIds: [lead.id],
    });
    notification = await db.notification.findFirst({
      where: {
        recipientMemberId: lead.id,
        type: 'PROJECT_CHAT_MENTION',
        eventKey,
      },
    });
    expect(notification?.data).toMatchObject({
      messageId: created.id,
      preview: '@lead updated review request',
    });

    const removed = await chat.edit(participant, projectId, created.id, {
      body: 'No mention remains',
      expectedEditedAt: retained.editedAt,
      mentionMemberIds: [],
    });
    expect(await db.notification.count({
      where: {
        recipientMemberId: lead.id,
        type: 'PROJECT_CHAT_MENTION',
        eventKey,
      },
    })).toBe(0);

    const readded = await chat.edit(participant, projectId, created.id, {
      body: '@lead mention restored',
      expectedEditedAt: removed.editedAt,
      mentionMemberIds: [lead.id],
    });
    expect(await db.notification.count({
      where: {
        recipientMemberId: lead.id,
        type: 'PROJECT_CHAT_MENTION',
        eventKey,
      },
    })).toBe(1);

    await chat.remove(participant, projectId, created.id, {
      expectedEditedAt: readded.editedAt,
    });
    expect(await db.notification.count({
      where: {
        recipientMemberId: lead.id,
        type: 'PROJECT_CHAT_MENTION',
        eventKey,
      },
    })).toBe(0);
  });

  it('paginates deterministically even if a newer message arrives', async () => {
    await db.projectMessage.createMany({
      data: Array.from({ length: 32 }, (_, i) => ({
        projectId,
        memberId: lead.id,
        body: 'Pagination item ' + i,
      })),
    });
    const countBefore = await db.projectMessage.count({ where: { projectId } });
    const first = await chat.list(lead, projectId);
    expect(first.items).toHaveLength(30);
    expect(first.nextCursor).not.toBeNull();
    await chat.send(lead, projectId, { body: 'Newer item', parentMessageId: null });
    const second = await chat.list(lead, projectId, first.nextCursor!);
    const all = [...first.items, ...second.items];
    expect(all).toHaveLength(countBefore);
    expect(new Set(all.map((item) => item.id)).size).toBe(countBefore);
    expect(all.every((item) => item.body !== 'Unrelated Project')).toBe(true);
  });

  it('enforces archived Project read-only behavior', async () => {
    await db.project.update({
      where: { id: projectId }, data: { archivedAt: new Date() },
    });
    try {
      await expect(chat.send(lead, projectId, {
        body: 'After archive', parentMessageId: null,
      })).rejects.toBeInstanceOf(ConflictException);
      const read = await chat.list(participant, projectId);
      expect(read.canWrite).toBe(false);
      expect(read.items.every((item) => !item.canEdit)).toBe(true);
    } finally {
      await db.project.update({ where: { id: projectId }, data: { archivedAt: null } });
    }
  });

  it('keeps direct browser roles from accessing Project collaboration tables', async () => {
    const tables = [
      'public.project_messages',
      'public.project_message_mentions',
      'public.project_announcements',
    ];
    const roles = await db.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
    `;

    for (const table of tables) {
      const [security] = await db.$queryRaw<Array<{ rls: boolean }>>`
        SELECT relrowsecurity AS rls
        FROM pg_class
        WHERE oid = ${table}::regclass
      `;
      expect(security.rls).toBe(true);

      for (const { rolname } of roles) {
        const [permissions] = await db.$queryRaw<Array<{ readable: boolean; writable: boolean }>>`
          SELECT has_table_privilege(${rolname}, ${table}, 'SELECT') AS readable,
                 has_table_privilege(${rolname}, ${table}, 'INSERT,UPDATE,DELETE') AS writable
        `;
        expect(permissions).toEqual({ readable: false, writable: false });
      }
    }
  });
});
