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
  parentMessageId: null,
  parent: null,
  body: 'Weekly update',
  createdAt: new Date('2026-09-23T01:00:00Z'),
  editedAt: null,
  member: { id: memberId, fullName: 'Project Member', email: 'member@example.com' },
};

function setup(options: {
  project?: { id: string; leadMemberId: string; archivedAt: Date | null; members: { memberId: string }[] } | null;
  parent?: { id: string } | null;
  original?: { id: string; memberId: string } | null;
  rows?: typeof message[];
} = {}) {
  const project = options.project === undefined
    ? { id: projectId, leadMemberId: leadId, archivedAt: null, members: [{ memberId }] }
    : options.project;
  const db = {
    project: { findUnique: vi.fn().mockResolvedValue(project) },
    projectMessage: {
      findFirst: vi.fn().mockImplementation((query: { where: { id: string } }) => {
        if (query.where.id === messageId)
          return Promise.resolve(options.original === undefined ? { id: messageId, memberId } : options.original);
        return Promise.resolve(options.parent === undefined ? { id: query.where.id } : options.parent);
      }),
      findMany: vi.fn().mockResolvedValue(options.rows ?? [message]),
      create: vi.fn().mockResolvedValue(message),
      update: vi.fn().mockResolvedValue({ ...message, body: 'Edited update', editedAt: new Date('2026-09-23T02:00:00Z') }),
    },
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
        data: { projectId, memberId, body: 'Member update', parentMessageId: null },
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
      where: { id: parentMessageId, projectId },
      select: { id: true },
    });
    expect(db.projectMessage.create).not.toHaveBeenCalled();
  });

  it('restricts editing to the original author', async () => {
    const { service, db } = setup();
    await expect(
      service.edit(lead, projectId, messageId, { body: 'Not my message' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.edit(member, projectId, messageId, { body: 'Edited update' }))
      .resolves.toMatchObject({ body: 'Edited update', canEdit: true, editedAt: '2026-09-23T02:00:00.000Z' });
    expect(db.projectMessage.update).toHaveBeenCalledTimes(1);
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
