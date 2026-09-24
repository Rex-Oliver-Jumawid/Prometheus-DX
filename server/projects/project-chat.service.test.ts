import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ProjectChatService } from './project-chat.service';

const projectId = '11111111-1111-4111-8111-111111111111';
const leadId = '22222222-2222-4222-8222-222222222222';
const memberId = '33333333-3333-4333-8333-333333333333';
const viewerId = '44444444-4444-4444-8444-444444444444';
const messageId = '55555555-5555-4555-8555-555555555555';
const lead = { id: leadId } as Member;
const member = { id: memberId } as Member;
const viewer = { id: viewerId } as Member;

const message = {
  id: messageId,
  projectId,
  memberId,
  outcomeId: null,
  parentMessageId: null,
  parent: null,
  body: 'Weekly update',
  createdAt: new Date('2026-09-23T01:00:00Z'),
  editedAt: null,
  deletedAt: null,
  mentions: [],
  member: { id: memberId, fullName: 'Project Member', email: 'member@example.com' },
};

function setup(options: {
  project?: { id: string; leadMemberId: string; archivedAt: Date | null; members: { memberId: string }[] } | null;
  parent?: { id: string } | null;
  original?: {
    id: string;
    memberId: string;
    editedAt?: Date | null;
    deletedAt?: Date | null;
    mentions?: Array<{ memberId: string }>;
  } | null;
  rows?: typeof message[];
} = {}) {
  const project = options.project === undefined
    ? { id: projectId, leadMemberId: leadId, archivedAt: null, members: [{ memberId }] }
    : options.project;
  const transactionDb = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: projectId }]),
    project: {
      findUnique: vi.fn().mockImplementation((query: {
        select: { members: { where: { memberId: string } } };
      }) => Promise.resolve(project
        ? {
            ...project,
            members: project.members.filter(
              (entry) => entry.memberId === query.select.members.where.memberId,
            ),
          }
        : null)),
    },
    member: {
      findMany: vi.fn().mockResolvedValue([{ id: leadId, fullName: 'Project Lead' }]),
    },
    projectMember: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    notification: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    projectMessage: {
      findFirst: vi.fn().mockImplementation((query: { where: { id: string } }) => {
        if (query.where.id === messageId)
          return Promise.resolve(
            options.original === undefined
              ? {
                  id: messageId,
                  memberId,
                  createdAt: message.createdAt,
                  editedAt: null,
                  deletedAt: null,
                  mentions: [],
                }
              : options.original
                ? {
                    editedAt: null,
                    deletedAt: null,
                    mentions: [],
                    ...options.original,
                  }
                : null,
          );
        return Promise.resolve(options.parent === undefined ? { id: query.where.id } : options.parent);
      }),
      findMany: vi.fn().mockResolvedValue(options.rows ?? [message]),
      create: vi.fn().mockResolvedValue(message),
      update: vi.fn().mockResolvedValue({ ...message, body: 'Edited update', editedAt: new Date('2026-09-23T02:00:00Z') }),
    },
  };
  const db = {
    ...transactionDb,
    $transaction: vi.fn(async (operation: (client: typeof transactionDb) => Promise<unknown>) =>
      operation(transactionDb)),
  };
  return { service: new ProjectChatService(db as unknown as PrismaService), db };
}

describe('ProjectChatService', () => {
  it('lets authorized viewers read messages but not post', async () => {
    const { service, db } = setup();
    const response = await service.list(viewer, projectId);
    expect(response.canWrite).toBe(false);
    expect(response.items[0]).toMatchObject({
      id: messageId,
      author: message.member,
      body: 'Weekly update',
      canEdit: false,
    });
    await expect(service.send(viewer, projectId, { body: 'Hello', parentMessageId: null }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(db.projectMessage.create).not.toHaveBeenCalled();
  });

  it('allows the Lead and Project Members to send without granting viewers write access', async () => {
    const { service, db } = setup();
    await expect(service.send(lead, projectId, { body: 'Lead update', parentMessageId: null }))
      .resolves.toMatchObject({ id: messageId });
    await expect(service.send(member, projectId, { body: 'Member update', parentMessageId: null }))
      .resolves.toMatchObject({ id: messageId });
    expect(db.projectMessage.create).toHaveBeenCalledTimes(2);
    expect(db.projectMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          projectId,
          outcomeId: null,
          memberId,
          body: 'Member update',
          parentMessageId: null,
        },
      }),
    );
  });

  it('sends a notification for an authorized Project Lead mention', async () => {
    const { service, db } = setup();
    await service.send(member, projectId, {
      body: 'Please review @Project Lead',
      parentMessageId: null,
      mentionMemberIds: [leadId],
    });
    expect(db.projectMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mentions: { create: [{ memberId: leadId }] },
        }),
      }),
    );
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'PROJECT_CHAT_MENTION',
          eventKey: 'PROJECT_CHAT_MENTION:' + messageId,
          actorMemberId: memberId,
          recipientMemberId: leadId,
          projectId,
          data: {
            messageId,
            preview: 'Please review @Project Lead',
          },
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('rejects mentions of people who are not part of the Project', async () => {
    const { service, db } = setup();
    await expect(service.send(member, projectId, {
      body: 'Hello @Outside Member',
      parentMessageId: null,
      mentionMemberIds: [viewerId],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(db.projectMessage.create).not.toHaveBeenCalled();
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it('checks permissions after locking the Project, so a revoked Member cannot post', async () => {
    const { service, db } = setup();
    let releaseLock!: () => void;
    db.$queryRaw.mockImplementation(
      () => new Promise((resolve) => { releaseLock = () => resolve([{ id: projectId }]); }),
    );
    const attempt = service.send(member, projectId, { body: 'Stale permission', parentMessageId: null });
    await vi.waitFor(() => expect(db.$queryRaw).toHaveBeenCalledTimes(1));
    db.project.findUnique.mockResolvedValue({
      id: projectId, leadMemberId: leadId, archivedAt: null, members: [],
    });
    releaseLock();
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.projectMessage.create).not.toHaveBeenCalled();
  });

  it('uses a timestamp and UUID boundary for older messages', async () => {
    const { service, db } = setup();
    await service.list(member, projectId, messageId);
    expect(db.projectMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId,
          outcomeId: null,
          OR: [
            { createdAt: { lt: message.createdAt } },
            { createdAt: message.createdAt, id: { lt: messageId } },
          ],
        },
      }),
    );
  });

  it('rejects cross-Project replies before creating messages', async () => {
    const parentMessageId = '66666666-6666-4666-8666-666666666666';
    const { service, db } = setup({ parent: null });
    await expect(
      service.send(member, projectId, { body: 'Reply', parentMessageId }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.projectMessage.findFirst).toHaveBeenCalledWith({
      where: {
        id: parentMessageId,
        projectId,
        outcomeId: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(db.projectMessage.create).not.toHaveBeenCalled();
  });

  it('restricts editing to the original author', async () => {
    const { service, db } = setup();
    await expect(
      service.edit(lead, projectId, messageId, { body: 'Not my message', expectedEditedAt: null }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.edit(member, projectId, messageId, { body: 'Edited update', expectedEditedAt: null }))
      .resolves.toMatchObject({ body: 'Edited update', canEdit: true, editedAt: '2026-09-23T02:00:00.000Z' });
    expect(db.projectMessage.update).toHaveBeenCalledTimes(1);
  });

  it('rejects stale edits without overwriting a newer message', async () => {
    const latestEdit = new Date('2026-09-23T02:00:00.000Z');
    const { service, db } = setup({
      original: { id: messageId, memberId, editedAt: latestEdit },
    });
    await expect(
      service.edit(member, projectId, messageId, {
        body: 'Overwrites newer text',
        expectedEditedAt: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.projectMessage.update).not.toHaveBeenCalled();
    await expect(
      service.edit(member, projectId, messageId, {
        body: 'Edited update',
        expectedEditedAt: latestEdit.toISOString(),
      }),
    ).resolves.toMatchObject({ body: 'Edited update' });
  });

  it('synchronizes mention notifications when an author edits mentions', async () => {
    const added = setup();
    await added.service.edit(member, projectId, messageId, {
      body: 'Please review @Project Lead',
      expectedEditedAt: null,
      mentionMemberIds: [leadId],
    });
    expect(added.db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: 'PROJECT_CHAT_MENTION',
          recipientMemberId: leadId,
          eventKey: 'PROJECT_CHAT_MENTION:' + messageId,
          data: {
            messageId,
            preview: 'Please review @Project Lead',
          },
        }),
      ],
      skipDuplicates: true,
    });

    const retained = setup({
      original: {
        id: messageId,
        memberId,
        editedAt: null,
        deletedAt: null,
        mentions: [{ memberId: leadId }],
      },
    });
    await retained.service.edit(member, projectId, messageId, {
      body: 'Updated note for @Project Lead',
      expectedEditedAt: null,
      mentionMemberIds: [leadId],
    });
    expect(retained.db.notification.updateMany).toHaveBeenCalledWith({
      where: {
        recipientMemberId: { in: [leadId] },
        type: 'PROJECT_CHAT_MENTION',
        eventKey: 'PROJECT_CHAT_MENTION:' + messageId,
      },
      data: {
        data: {
          messageId,
          preview: 'Updated note for @Project Lead',
        },
      },
    });

    const removed = setup({
      original: {
        id: messageId,
        memberId,
        editedAt: null,
        deletedAt: null,
        mentions: [{ memberId: leadId }],
      },
    });
    await removed.service.edit(member, projectId, messageId, {
      body: 'No mention now',
      expectedEditedAt: null,
      mentionMemberIds: [],
    });
    expect(removed.db.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        recipientMemberId: { in: [leadId] },
        type: 'PROJECT_CHAT_MENTION',
        eventKey: 'PROJECT_CHAT_MENTION:' + messageId,
      },
    });
  });

  it('removes Project Chat mention notifications when the author deletes a message', async () => {
    const { service, db } = setup();
    await service.remove(member, projectId, messageId, { expectedEditedAt: null });
    expect(db.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        type: 'PROJECT_CHAT_MENTION',
        eventKey: 'PROJECT_CHAT_MENTION:' + messageId,
      },
    });
  });

  it('rejects archived Project writes and nonexistent Project reads', async () => {
    const archived = setup({
      project: { id: projectId, leadMemberId: leadId, members: [], archivedAt: new Date() },
    });
    await expect(archived.service.send(lead, projectId, { body: 'Late', parentMessageId: null }))
      .rejects.toBeInstanceOf(ConflictException);
    expect((await archived.service.list(lead, projectId)).canWrite).toBe(false);

    const missing = setup({ project: null });
    await expect(missing.service.list(member, projectId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a stable pagination cursor for older messages', async () => {
    const rows = Array.from({ length: 31 }, (_, i) => ({
      ...message,
      id: `77777777-7777-4777-8777-${String(i).padStart(12, '0')}`,
    }));
    const { service } = setup({ rows });
    const response = await service.list(member, projectId);
    expect(response.items).toHaveLength(30);
    expect(response.nextCursor).toBe(rows[29].id);
  });
});
