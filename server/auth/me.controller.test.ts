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
  ventureId: '33333333-3333-4333-8333-333333333333',
  workspaceRole: 'MEMBER',
  status: 'ACTIVE',
  position: 'Engineer',
  nickname: null,
  phoneNumber: null,
  about: null,
  profileImagePath: null,
  invitationSentAt: null,
  deactivatedAt: null,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
} as Member;

const venture = {
  id: member.ventureId,
  name: 'Research and Development',
  shortLabel: 'R&D',
};

describe('MeController', () => {
  it('allows an active workspace member without a primary venture', async () => {
    const findUnique = vi.fn();
    const controller = new MeController({ venture: { findUnique } } as unknown as PrismaService);
    await expect(controller.getMe({ ...member, ventureId: null })).resolves.toMatchObject({ id: member.id, venture: null });
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('returns organization-managed venture context with the current member', async () => {
    const prisma = {
      venture: {
        findUnique: vi.fn().mockResolvedValue(venture),
      },
    } as unknown as PrismaService;
    const controller = new MeController(prisma);

    await expect(controller.getMe(member)).resolves.toMatchObject({
      id: member.id,
      email: member.email,
      venture,
    });
  });

  it('updates only self-service profile fields', async () => {
    const update = vi.fn().mockResolvedValue({
      ...member,
      fullName: 'Updated Member',
      position: 'Software Engineer',
      nickname: 'Oli',
      phoneNumber: '+63 917 123 4567',
      about: 'Building useful software.',
    });
    const prisma = {
      member: { update },
      venture: {
        findUnique: vi.fn().mockResolvedValue(venture),
      },
    } as unknown as PrismaService;
    const controller = new MeController(prisma);

    await expect(
      controller.updateMe(member, {
        fullName: ' Updated Member ',
        position: ' Software Engineer ',
        nickname: ' Oli ',
        phoneNumber: ' +63 917 123 4567 ',
        about: ' Building useful software. ',
        profileImagePath: null,
      }),
    ).resolves.toMatchObject({
      fullName: 'Updated Member',
      position: 'Software Engineer',
      nickname: 'Oli',
      phoneNumber: '+63 917 123 4567',
      about: 'Building useful software.',
      venture,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: member.id },
      data: {
        fullName: 'Updated Member',
        position: 'Software Engineer',
        nickname: 'Oli',
        phoneNumber: '+63 917 123 4567',
        about: 'Building useful software.',
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
        nickname: null,
        phoneNumber: null,
        about: null,
        workspaceRole: 'ADMINISTRATOR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
