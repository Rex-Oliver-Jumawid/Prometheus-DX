import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import type { InvitationDelivery } from './invitation.service';
import { RegistryService } from './registry.service';

const department = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Research and Development',
  shortLabel: 'R&D',
  description: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const member = {
  id: '22222222-2222-4222-8222-222222222222',
  authUserId: null,
  email: 'invited@example.com',
  fullName: 'Invited Member',
  departmentId: department.id,
  department,
  position: 'Engineer',
  workspaceRole: 'MEMBER' as const,
  status: 'INVITED' as const,
  profileImagePath: null,
  invitationSentAt: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function delivery(send = vi.fn().mockResolvedValue(undefined)) {
  return {
    sendAccountSetupInvitation: send,
  } satisfies InvitationDelivery;
}

describe('RegistryService invitation behavior', () => {
  it('keeps one invited Member when initial delivery is unavailable', async () => {
    const send = vi.fn().mockRejectedValue(new Error('unavailable'));
    const database = {
      department: { findUnique: vi.fn().mockResolvedValue(department) },
      member: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(member),
        findUnique: vi.fn().mockResolvedValue(member),
        update: vi.fn(),
      },
    } as unknown as PrismaService;
    const service = new RegistryService(database, delivery(send));

    await expect(
      service.createMember({
        email: member.email,
        fullName: member.fullName,
        departmentId: member.departmentId,
        position: member.position,
        workspaceRole: member.workspaceRole,
        status: member.status,
      }),
    ).resolves.toMatchObject({
      id: member.id,
      status: 'INVITED',
      authenticationStatus: 'SETUP_PENDING',
      invitationDeliveryStatus: 'NOT_SENT',
    });
    expect(database.member.create).toHaveBeenCalledOnce();
    expect(database.member.update).not.toHaveBeenCalled();
  });

  it('records a successful invitation resend without creating another Member', async () => {
    const sentMember = { ...member, invitationSentAt: new Date() };
    const database = {
      member: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            id: member.id,
            authUserId: null,
            status: 'INVITED',
          })
          .mockResolvedValueOnce(member),
        update: vi.fn().mockResolvedValue(sentMember),
        create: vi.fn(),
      },
    } as unknown as PrismaService;
    const send = vi.fn().mockResolvedValue(undefined);
    const service = new RegistryService(database, delivery(send));

    await expect(
      service.sendMemberInvitation(member.id),
    ).resolves.toMatchObject({
      id: member.id,
      invitationDeliveryStatus: 'SENT',
    });
    expect(send).toHaveBeenCalledWith({
      email: member.email,
      fullName: member.fullName,
    });
    expect(database.member.create).not.toHaveBeenCalled();
  });

  it('rejects invitation delivery after account linkage', async () => {
    const database = {
      member: {
        findUnique: vi.fn().mockResolvedValue({
          id: member.id,
          authUserId: '33333333-3333-4333-8333-333333333333',
          status: 'ACTIVE',
        }),
      },
    } as unknown as PrismaService;
    const service = new RegistryService(database, delivery());

    await expect(
      service.sendMemberInvitation(member.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invitation delivery while the Member is deactivated', async () => {
    const database = {
      member: {
        findUnique: vi.fn().mockResolvedValue({
          id: member.id,
          authUserId: null,
          status: 'DEACTIVATED',
        }),
      },
    } as unknown as PrismaService;
    const service = new RegistryService(database, delivery());

    await expect(
      service.sendMemberInvitation(member.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
