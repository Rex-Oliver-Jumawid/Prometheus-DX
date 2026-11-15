import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import type { InvitationDelivery } from './invitation.service';
import { RegistryService } from './registry.service';

const venture = {
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
  ventureId: venture.id,
  venture,
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
  it('archives an unreferenced venture without deleting history', async () => {
    const database = {
      venture: {
        findUnique: vi.fn().mockResolvedValue({
          id: venture.id,
          _count: { members: 0, projects: 0, outcomes: 0 },
        }),
        update: vi.fn().mockResolvedValue(venture),
      },
    } as unknown as PrismaService;
    const service = new RegistryService(database, delivery());

    await expect(service.deleteVenture(venture.id)).resolves.toEqual({
      id: venture.id,
    });
    expect(database.venture.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: venture.id }, data: expect.objectContaining({ status: 'ARCHIVED' })
    }));
  });

  it('archives a referenced venture while retaining existing links', async () => {
    const database = {
      venture: {
        findUnique: vi.fn().mockResolvedValue({
          id: venture.id,
          _count: { members: 1, projects: 0, outcomes: 0 },
        }),
        update: vi.fn().mockResolvedValue(venture),
      },
    } as unknown as PrismaService;
    const service = new RegistryService(database, delivery());

    await expect(service.deleteVenture(venture.id)).resolves.toEqual({ id: venture.id });
    expect(database.venture.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ARCHIVED' }) }));
  });

  it('loads Registry ventures and members in one overview operation', async () => {
    const database = {
      venture: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            {
              ...venture,
              _count: { members: 1, projects: 2, outcomes: 3 },
            },
          ]),
      },
      member: { findMany: vi.fn().mockResolvedValue([member]) },
    } as unknown as PrismaService;
    const service = new RegistryService(database, delivery());

    await expect(service.getOverview()).resolves.toMatchObject({
      ventures: [
        {
          id: venture.id,
          memberCount: 1,
          projectCount: 2,
          outcomeCount: 3,
        },
      ],
      members: [{ id: member.id, ventureId: venture.id }],
    });
    expect(database.venture.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      include: {
        _count: {
          select: {
            members: {
              where: {
                NOT: {
                  status: 'DEACTIVATED',
                  authUserId: null,
                  invitationSentAt: null,
                },
              },
            },
            memberships: { where: { endedAt: null, member: { NOT: { status: 'DEACTIVATED', authUserId: null, invitationSentAt: null } } } },
            projects: true,
            outcomes: true,
          },
        },
      },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
    });
    expect(database.member.findMany).toHaveBeenCalledOnce();
  });

  it('keeps one invited Member when initial delivery is unavailable', async () => {
    const send = vi.fn().mockRejectedValue(new Error('unavailable'));
    const database = {
      venture: { findUnique: vi.fn().mockResolvedValue(venture) },
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
        ventureId: member.ventureId,
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

  it('keeps the persisted Member pending when delivery times out', async () => {
    const send = vi
      .fn()
      .mockRejectedValue(
        new ServiceUnavailableException(
          'The invitation could not be delivered. Try again.',
        ),
      );
    const database = {
      venture: { findUnique: vi.fn().mockResolvedValue(venture) },
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
        ventureId: member.ventureId,
        position: member.position,
        workspaceRole: member.workspaceRole,
        status: member.status,
      }),
    ).resolves.toMatchObject({
      id: member.id,
      invitationDeliveryStatus: 'NOT_SENT',
      invitationSentAt: null,
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
