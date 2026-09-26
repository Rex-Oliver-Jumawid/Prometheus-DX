import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { VisiWorkService } from './visiwork.service';

const memberId = '11111111-1111-4111-8111-111111111111';
const homeDepartmentId = '22222222-2222-4222-8222-222222222222';
const joinedDepartmentId = '33333333-3333-4333-8333-333333333333';
const mentionedMemberId = '66666666-6666-4666-8666-666666666666';

function member(overrides: Partial<Member> = {}): Member {
  return {
    id: memberId,
    authUserId: null,
    email: 'member@example.com',
    fullName: 'Member One',
    departmentId: homeDepartmentId,
    visiworkDepartmentId: null,
    workspaceRole: 'MEMBER',
    status: 'ACTIVE',
    position: 'Developer',
    nickname: null,
    phoneNumber: null,
    about: null,
    profileImagePath: null,
    invitationSentAt: null,
    deactivatedAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

function storedMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    departmentId: null,
    memberId,
    body: 'Morning team',
    editedAt: null,
    deletedAt: null,
    createdAt: new Date('2026-09-24T01:00:00.000Z'),
    member: { id: memberId, fullName: 'Member One' },
    mentions: [],
    ...overrides,
  };
}

describe('VisiWorkService', () => {
  it('moves the current member focus to the joined department', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({
          id: joinedDepartmentId,
          shortLabel: 'R&D',
        }),
      },
      member: {
        update: vi.fn().mockResolvedValue({ id: memberId }),
      },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).joinDepartment(member(), {
      departmentId: joinedDepartmentId,
    });

    expect(result).toEqual({ memberId, departmentId: joinedDepartmentId });
  });

  it('returns persisted general-room messages with mentions', async () => {
    const prisma = {
      visiWorkMessage: {
        findMany: vi.fn().mockResolvedValue([
          storedMessage({
            member: { id: memberId, fullName: 'Member One', profileImagePath: '/profiles/member-one.png' },
            mentions: [
              {
                memberId: mentionedMemberId,
                member: { id: mentionedMemberId, fullName: 'Oliver' },
              },
            ],
          }),
        ]),
      },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).listMessages(member());

    expect(result.items[0]).toMatchObject({
      body: 'Morning team',
      author: { profileImagePath: '/profiles/member-one.png' },
      mentions: [{ id: mentionedMemberId, fullName: 'Oliver' }],
    });
  });

  it('persists mentions and creates mention notifications atomically', async () => {
    const message = storedMessage({
      body: 'Please check this @Oliver',
      mentions: [
        {
          memberId: mentionedMemberId,
          member: { id: mentionedMemberId, fullName: 'Oliver' },
        },
      ],
    });
    const createMessage = vi.fn().mockResolvedValue(message);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      member: {
        findMany: vi.fn().mockResolvedValue([
          { id: mentionedMemberId, fullName: 'Oliver' },
        ]),
      },
      $transaction: vi.fn().mockImplementation(async (callback) =>
        callback({
          visiWorkMessage: { create: createMessage },
          notification: { createMany },
        }),
      ),
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).sendMessage(member(), {
      body: 'Please check this @Oliver',
      mentionMemberIds: [mentionedMemberId],
    });

    expect(createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mentions: {
            create: [{ memberId: mentionedMemberId }],
          },
        }),
      }),
    );
    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            recipientMemberId: mentionedMemberId,
            actorMemberId: memberId,
            type: 'VISIWORK_MENTION',
          }),
        ],
      }),
    );
    expect(result.mentions).toEqual([
      { id: mentionedMemberId, fullName: 'Oliver' },
    ]);
  });

  it('searches only the current room and returns matching persisted messages', async () => {
    const findMany = vi.fn().mockResolvedValue([
      storedMessage({ body: 'The quotation workflow is ready.' }),
    ]);
    const prisma = {
      visiWorkMessage: { findMany },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).searchMessages(member(), {
      q: 'quotation',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          departmentId: null,
          deletedAt: null,
          body: { contains: 'quotation', mode: 'insensitive' },
        },
      }),
    );
    expect(result.items[0].body).toContain('quotation');
  });

  it('loads message context around an exact message for deep linking', async () => {
    const target = storedMessage();
    const before = storedMessage({
      id: '77777777-7777-4777-8777-777777777777',
      createdAt: new Date('2026-09-24T00:59:00.000Z'),
      body: 'Before',
    });
    const after = storedMessage({
      id: '88888888-8888-4888-8888-888888888888',
      createdAt: new Date('2026-09-24T01:01:00.000Z'),
      body: 'After',
    });
    const prisma = {
      visiWorkMessage: {
        findUnique: vi.fn().mockResolvedValue(target),
        findMany: vi
          .fn()
          .mockResolvedValueOnce([before])
          .mockResolvedValueOnce([after]),
      },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).messageContext(
      member(),
      target.id,
    );

    expect(result.targetMessageId).toBe(target.id);
    expect(result.items.map((item) => item.body)).toEqual([
      'Before',
      'Morning team',
      'After',
    ]);
  });

  it('edits an owned message and records the edited timestamp', async () => {
    const existing = storedMessage();
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(
        storedMessage({
          body: data.body,
          editedAt: data.editedAt,
        }),
      ),
    );
    const prisma = {
      visiWorkMessage: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      member: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation(async (callback) =>
        callback({
          visiWorkMessage: { update },
          notification: {
            deleteMany: vi.fn(),
            updateMany: vi.fn(),
            createMany: vi.fn(),
          },
        }),
      ),
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).updateMessage(
      member(),
      existing.id,
      { body: 'Updated message', mentionMemberIds: [] },
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existing.id },
        data: expect.objectContaining({
          body: 'Updated message',
          editedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.body).toBe('Updated message');
    expect(result.editedAt).toBeTruthy();
    expect(result.deletedAt).toBeNull();
  });

  it('soft deletes an owned message, clears mentions, and removes mention notifications', async () => {
    const existing = storedMessage({
      mentions: [
        {
          memberId: mentionedMemberId,
          member: { id: mentionedMemberId, fullName: 'Oliver' },
        },
      ],
    });
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockImplementation(({ data }) =>
      Promise.resolve(
        storedMessage({
          body: data.body,
          deletedAt: data.deletedAt,
          mentions: [],
        }),
      ),
    );
    const prisma = {
      visiWorkMessage: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
      $transaction: vi.fn().mockImplementation(async (callback) =>
        callback({
          visiWorkMessage: { update },
          notification: { deleteMany },
        }),
      ),
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).deleteMessage(
      member(),
      existing.id,
    );

    expect(result.body).toBe('Message deleted');
    expect(result.deletedAt).toBeTruthy();
    expect(result.mentions).toEqual([]);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        eventKey: { startsWith: `visiwork-mention:${existing.id}:` },
      },
    });
  });

  it('does not allow another member to edit or delete someone else’s message', async () => {
    const existing = storedMessage();
    const prisma = {
      visiWorkMessage: {
        findUnique: vi.fn().mockResolvedValue(existing),
      },
    } as unknown as PrismaService;
    const other = member({
      id: '99999999-9999-4999-8999-999999999999',
    });
    const service = new VisiWorkService(prisma);

    await expect(
      service.updateMessage(other, existing.id, {
        body: 'Not mine',
        mentionMemberIds: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deleteMessage(other, existing.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks department-room sending until the member belongs to or joins it', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({
          id: joinedDepartmentId,
          shortLabel: 'R&D',
        }),
      },
    } as unknown as PrismaService;

    await expect(
      new VisiWorkService(prisma).sendMessage(
        member(),
        { body: 'Should not send', mentionMemberIds: [] },
        joinedDepartmentId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
