import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ProjectVaultService } from './project-vault.service';
import { serverEnvironment } from '../config/env';

function transactionFixture(project: unknown) {
  const db = {
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    project: { findUnique: vi.fn().mockResolvedValue(project) },
    projectVaultItem: { findMany: vi.fn().mockResolvedValue([]) },
    projectVaultGrant: { findMany: vi.fn().mockResolvedValue([]) },
    projectMember: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return { db, prisma: { $transaction: vi.fn(async (fn: (value: typeof db) => Promise<unknown>) => fn(db)) } };
}

const member = { id: '00000000-0000-4000-8000-000000000010', status: 'ACTIVE' };
const projectId = '00000000-0000-4000-8000-000000000020';
const itemId = '00000000-0000-4000-8000-000000000030';

describe('Project Vault permission boundary and authenticated encryption', () => {
  const previousKey = serverEnvironment.vaultEncryptionKey;
  beforeEach(() => { serverEnvironment.vaultEncryptionKey = Buffer.alloc(32, 7).toString('base64'); });
  afterEach(() => { serverEnvironment.vaultEncryptionKey = previousKey; });

  it('encrypts without storing plaintext and validates project/item/version as AAD', () => {
    const { prisma } = transactionFixture(null);
    const service = new ProjectVaultService(prisma as never);
    const plaintext = Buffer.from('SUPABASE_URL=example\nAPI_KEY=example-secret');
    const encrypted = service['encrypt'](plaintext, projectId, itemId, 1);
    expect(encrypted.ciphertext).not.toContain('example-secret');
    expect(encrypted.nonce).toHaveLength(16);
    expect(encrypted.authTag).toHaveLength(24);
    expect(service['decrypt'](encrypted, projectId, itemId, 1)).toEqual(plaintext);
    expect(() => service['decrypt'](encrypted, projectId, itemId, 2)).toThrow();
    expect(() => service['decrypt'](encrypted, itemId, projectId, 1)).toThrow();
    expect(() => service['decrypt']({ ...encrypted, ciphertext: Buffer.from('tamper').toString('base64') }, projectId, itemId, 1)).toThrow();
  });

  it('denies self-joined project members without a lead approval', async () => {
    const createdAt = new Date('2026-10-01');
    const { db, prisma } = transactionFixture({
      leadMemberId: '00000000-0000-4000-8000-000000000099',
      archivedAt: null,
      members: [{ accessLevel: 'CAN_EDIT', createdAt }],
      vaultGrants: [],
    });
    const service = new ProjectVaultService(prisma as never);
    await expect(service.list(member as never, projectId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.projectVaultItem.findMany).not.toHaveBeenCalled();
  });

  it('does not honor a grant from a previous project membership', async () => {
    const { db, prisma } = transactionFixture({
      leadMemberId: '00000000-0000-4000-8000-000000000099',
      archivedAt: null,
      members: [{ accessLevel: 'CAN_VIEW', createdAt: new Date('2026-11-05') }],
      vaultGrants: [{ approvedAt: new Date('2026-10-01') }],
    });
    const service = new ProjectVaultService(prisma as never);
    await expect(service.list(member as never, projectId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.projectVaultItem.findMany).not.toHaveBeenCalled();
  });

  it('permits approved current members but not edits by CAN_VIEW users', async () => {
    const { prisma } = transactionFixture({
      leadMemberId: '00000000-0000-4000-8000-000000000099',
      archivedAt: null,
      members: [{ accessLevel: 'CAN_VIEW', createdAt: new Date('2026-10-01') }],
      vaultGrants: [{ approvedAt: new Date('2026-11-05') }],
    });
    const service = new ProjectVaultService(prisma as never);
    await expect(service.list(member as never, projectId)).resolves.toEqual({ canWrite: false, items: [] });
  });

  it('denies a member whose workspace account is deactivated', async () => {
    const { prisma } = transactionFixture({
      leadMemberId: member.id,
      archivedAt: null,
      members: [],
      vaultGrants: [],
    });
    const service = new ProjectVaultService(prisma as never);
    await expect(service.list({ ...member, status: 'DEACTIVATED' } as never, projectId))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
});
