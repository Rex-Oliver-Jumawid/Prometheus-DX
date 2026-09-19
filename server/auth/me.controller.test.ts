import { BadRequestException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { MeController } from './me.controller';

const member = {
  id: '11111111-1111-4111-8111-111111111111',
  authUserId: '22222222-2222-4222-8222-222222222222',
  email: 'member@example.com',
  fullName: 'Member Example',
  departmentId: '33333333-3333-4333-8333-333333333333',
  workspaceRole: 'MEMBER',
  status: 'ACTIVE',
  position: 'Engineer',
  profileImagePath: null,
  invitationSentAt: null,
  deactivatedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
} as Member;

const department = {
  id: member.departmentId,
  name: 'Research and Development',
  shortLabel: 'R&D',
};

describe('MeController', () => {
  it('returns organization-managed department context with the current member', async () => {
    const prisma = {
      department: {
        findUnique: vi.fn().mockResolvedValue(department),
      },
    } as unknown as PrismaService;
    const controller = new MeController(prisma);

    await expect(controller.getMe(member)).resolves.toMatchObject({
      id: member.id,
      email: member.email,
      department,
    });
  });

  it('updates only self-service profile fields', async () => {
    const update = vi.fn().mockResolvedValue({
      ...member,
      fullName: 'Updated Member',
      position: 'Software Engineer',
    });
    const prisma = {
      member: { update },
      department: {
        findUnique: vi.fn().mockResolvedValue(department),
      },
    } as unknown as PrismaService;
    const controller = new MeController(prisma);

    await expect(
      controller.updateMe(member, {
        fullName: ' Updated Member ',
        position: ' Software Engineer ',
        profileImagePath: null,
      }),
    ).resolves.toMatchObject({
      fullName: 'Updated Member',
      position: 'Software Engineer',
      department,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: member.id },
      data: {
        fullName: 'Updated Member',
        position: 'Software Engineer',
        profileImagePath: null,
      },
    });
  });

  it('rejects organization-managed fields in self-service updates', async () => {
    const update = vi.fn();
    const prisma = {
      member: { update },
    } as unknown as PrismaService;
    const controller = new MeController(prisma);

    await expect(
      controller.updateMe(member, {
        fullName: 'Member Example',
        position: 'Engineer',
        workspaceRole: 'ADMINISTRATOR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
