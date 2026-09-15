import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { AuthService, type SupabaseAuthClient } from './auth.service';

const activeMember = {
  id: '44444444-4444-4444-8444-444444444444',
  authUserId: '55555555-5555-4555-8555-555555555555',
  email: 'member@example.com',
  fullName: 'Member Example',
  workspaceRole: 'MEMBER',
  status: 'ACTIVE',
  position: null,
  profileImagePath: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Member;

function supabase(
  user: Partial<User> | null,
  error: { message: string } | null = null,
): SupabaseAuthClient {
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error }) },
  } as SupabaseAuthClient;
}

function prisma(member: Member | null) {
  return {
    member: {
      findUnique: vi.fn().mockResolvedValue(member),
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn(),
    },
  } as unknown as PrismaService;
}

describe('AuthService', () => {
  it('resolves the active member from the verified Supabase identity', async () => {
    const service = new AuthService(
      prisma(activeMember),
      supabase({ id: activeMember.authUserId! }),
    );
    await expect(service.resolveActiveMember('token')).resolves.toEqual(
      activeMember,
    );
  });

  it('denies an authenticated identity with no Prometheus membership', async () => {
    const service = new AuthService(
      prisma(null),
      supabase({ id: '66666666-6666-4666-8666-666666666666' }),
    );
    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies a deactivated member', async () => {
    const member = {
      ...activeMember,
      status: 'DEACTIVATED',
      deactivatedAt: new Date(),
    } satisfies Member;
    const service = new AuthService(
      prisma(member),
      supabase({ id: activeMember.authUserId! }),
    );
    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('distinguishes an invalid authentication token from workspace denial', async () => {
    const service = new AuthService(
      prisma(null),
      supabase(null, { message: 'invalid' }),
    );
    await expect(
      service.resolveActiveMember('bad-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
