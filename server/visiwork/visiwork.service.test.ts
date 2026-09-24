import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@prisma/client';
import type { PrismaService } from '../database/prisma.service';
import { VisiWorkService } from './visiwork.service';

const memberId = '11111111-1111-4111-8111-111111111111';
const homeDepartmentId = '22222222-2222-4222-8222-222222222222';
const joinedDepartmentId = '33333333-3333-4333-8333-333333333333';

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

describe('VisiWorkService', () => {
  it('moves the current member focus to the joined department', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: joinedDepartmentId }),
      },
      member: {
        update: vi.fn().mockResolvedValue({ id: memberId }),
      },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).joinDepartment(member(), {
      departmentId: joinedDepartmentId,
    });

    expect(prisma.department.findUnique).toHaveBeenCalledWith({
      where: { id: joinedDepartmentId },
      select: { id: true },
    });
    expect(prisma.member.update).toHaveBeenCalledWith({
      where: { id: memberId },
      data: { visiworkDepartmentId: joinedDepartmentId },
    });
    expect(result).toEqual({
      memberId,
      departmentId: joinedDepartmentId,
    });
  });

  it('returns persisted general-room messages newest-first from storage', async () => {
    const prisma = {
      visiWorkMessage: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: '44444444-4444-4444-8444-444444444444',
            departmentId: null,
            memberId,
            body: 'Morning team',
            createdAt: new Date('2026-09-24T01:00:00.000Z'),
            member: { id: memberId, fullName: 'Member One' },
          },
        ]),
      },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).listMessages(member());

    expect(prisma.visiWorkMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { departmentId: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 41,
      }),
    );
    expect(result).toEqual({
      items: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          departmentId: null,
          author: { id: memberId, fullName: 'Member One' },
          body: 'Morning team',
          createdAt: '2026-09-24T01:00:00.000Z',
        },
      ],
      nextCursor: null,
      canWrite: true,
    });
  });

  it('allows a member to send to the department they joined', async () => {
    const focusedMember = member({
      visiworkDepartmentId: joinedDepartmentId,
    });
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: joinedDepartmentId }),
      },
      visiWorkMessage: {
        create: vi.fn().mockResolvedValue({
          id: '55555555-5555-4555-8555-555555555555',
          departmentId: joinedDepartmentId,
          memberId,
          body: 'I can help here.',
          createdAt: new Date('2026-09-24T01:05:00.000Z'),
          member: { id: memberId, fullName: 'Member One' },
        }),
      },
    } as unknown as PrismaService;

    const result = await new VisiWorkService(prisma).sendMessage(
      focusedMember,
      { body: 'I can help here.' },
      joinedDepartmentId,
    );

    expect(result.departmentId).toBe(joinedDepartmentId);
    expect(result.body).toBe('I can help here.');
  });

  it('blocks department-room sending until the member belongs to or joins it', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue({ id: joinedDepartmentId }),
      },
      visiWorkMessage: {
        create: vi.fn(),
      },
    } as unknown as PrismaService;

    await expect(
      new VisiWorkService(prisma).sendMessage(
        member(),
        { body: 'Should not send' },
        joinedDepartmentId,
      ),
    ).rejects.toThrow(
      'Join this department before sending messages to its room.',
    );
    expect(prisma.visiWorkMessage.create).not.toHaveBeenCalled();
  });
});
