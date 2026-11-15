import { describe, expect, it, vi } from 'vitest';
import type { Member } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { PrismaService } from '../database/prisma.service';
import { VenturesService } from './ventures.service';

const ventureId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const actor = {
  id: memberId,
  workspaceRole: 'MEMBER',
  status: 'ACTIVE',
} as Member;
const admin = { ...actor, workspaceRole: 'ADMINISTRATOR' } as Member;
const settings = {
  name: 'Parkey',
  shortLabel: 'PK',
  description: null,
  parentId: null,
  status: 'ACTIVE' as const,
};
const input = {
  memberId,
  founder: true,
  roles: ['CEO', 'CTO'] as ('CEO' | 'CTO')[],
  permissions: [],
  active: true,
};
function setup(
  permissions: string[] = [],
  options: { endedAt?: Date; archived?: boolean } = {},
) {
  const membership = {
    id: 'membership',
    permissions,
    roles: ['CEO'],
    endedAt: options.endedAt ?? null,
    founder: false,
  };
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    venture: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          id: ventureId,
          ...settings,
          status: options.archived ? 'ARCHIVED' : 'ACTIVE',
        }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: ventureId }),
      update: vi.fn().mockResolvedValue({ id: ventureId }),
    },
    ventureMembership: {
      findUnique: vi.fn().mockResolvedValue(membership),
      upsert: vi.fn().mockResolvedValue({ id: 'membership' }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    member: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ id: memberId, status: 'ACTIVE', ventureId: null }),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    ventureAuditEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (client: typeof db) => unknown) =>
    fn(db),
  );
  return { db, service: new VenturesService(db as unknown as PrismaService) };
}
describe('venture authorization and history', () => {
  it('does not grant a CEO metadata management authority', async () => {
    const { service, db } = setup();
    await expect(
      service.save(actor, settings, ventureId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.venture.update).not.toHaveBeenCalled();
  });
  it('denies an ended membership even if it retains a stale grant', async () => {
    const { service } = setup(['venture.manage'], { endedAt: new Date() });
    await expect(
      service.save(actor, settings, ventureId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
  it('does not let a scoped manager create another venture', async () => {
    const { service } = setup(['venture.manage']);
    await expect(service.save(actor, settings)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('supports explicitly granted metadata management and audits the actor', async () => {
    const { service, db } = setup(['venture.manage']);
    await service.save(actor, settings, ventureId);
    expect(db.ventureAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorMemberId: memberId,
          action: 'VENTURE_UPDATED',
        }),
      }),
    );
  });
  it('rejects self-parent and multi-level cycles before writing', async () => {
    const { service, db } = setup();
    await expect(
      service.save(admin, { ...settings, parentId: ventureId }, ventureId),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.venture.update).not.toHaveBeenCalled();
    db.venture.findUnique.mockResolvedValue({
      id: ventureId,
      ...settings,
      parentId: ventureId,
    });
    await expect(
      service.save(admin, { ...settings, parentId: memberId }, ventureId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects delegated permission escalation', async () => {
    const { service, db } = setup(['venture.members.manage']);
    await expect(
      service.membership(actor, ventureId, {
        ...input,
        permissions: ['venture.manage'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.ventureMembership.upsert).not.toHaveBeenCalled();
  });
  it('allows multiple roles with unchanged scoped permissions', async () => {
    const { service, db } = setup(['venture.members.manage']);
    await service.membership(actor, ventureId, {
      ...input,
      permissions: ['venture.members.manage'],
    });
    expect(db.ventureMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ roles: ['CEO', 'CTO'] }),
      }),
    );
  });
  it('ends membership, revokes grants, clears focus, and records previous values', async () => {
    const { service, db } = setup(['venture.manage']);
    await service.membership(admin, ventureId, { ...input, active: false });
    expect(db.ventureMembership.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          permissions: [],
          endedAt: expect.any(Date),
        }),
      }),
    );
    const candidate = db.ventureMembership.upsert.mock.calls[0][0].create;
    expect(candidate.joinedAt).toEqual(candidate.endedAt);
    expect(db.member.updateMany).toHaveBeenCalledWith({
      where: { id: memberId, visiworkVentureId: ventureId },
      data: { visiworkVentureId: null },
    });
    expect(db.ventureAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            before: expect.objectContaining({
              permissions: ['venture.manage'],
            }),
          }),
        }),
      }),
    );
  });
  it('refuses member changes in archived ventures', async () => {
    const { service } = setup([], { archived: true });
    await expect(
      service.membership(admin, ventureId, input),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('requires an active workspace member for admission', async () => {
    const { service, db } = setup();
    db.member.findUnique.mockResolvedValue({
      id: memberId,
      ventureId: null,
      status: 'DEACTIVATED',
    });
    await expect(
      service.membership(admin, ventureId, input),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
