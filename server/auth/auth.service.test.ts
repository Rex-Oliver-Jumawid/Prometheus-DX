import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { AuthService, type SupabaseAuthClient } from './auth.service';

const TEST_SUPABASE_URL = 'https://test.supabase.co';

vi.mock('../config/env', () => ({
  serverEnvironment: {
    supabaseUrl: 'https://test.supabase.co',
  },
}));

const activeMember = {
  id: '44444444-4444-4444-8444-444444444444',
  authUserId: '55555555-5555-4555-8555-555555555555',
  email: 'member@example.com',
  fullName: 'Member Example',
  departmentId: '11111111-1111-4111-8111-111111111111',
  workspaceRole: 'MEMBER',
  status: 'ACTIVE',
  position: null,
  nickname: null,
  phoneNumber: null,
  about: null,
  profileImagePath: null,
  invitationSentAt: null,
  deactivatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies Member;

function supabase(
  user: Partial<User> | null,
  error: { message: string } | null = null,
): SupabaseAuthClient {
  const claims = user?.id
    ? {
        sub: user.id,
        iss: `${TEST_SUPABASE_URL}/auth/v1`,
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1_000) + 3_600,
        iat: Math.floor(Date.now() / 1_000),
        role: 'authenticated',
        aal: 'aal1' as const,
        session_id: '88888888-8888-4888-8888-888888888888',
      }
    : undefined;
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: error || !claims ? null : { claims },
        error,
      }),
      getUser: vi.fn().mockResolvedValue({ data: { user }, error }),
    },
  } as unknown as SupabaseAuthClient;
}

function prisma(input: {
  byAuth?: Member | null;
  byEmail?: Member | null;
  linked?: Member | null;
  updateManyCount?: number;
}) {
  const findUnique = vi
    .fn()
    .mockResolvedValueOnce(input.byAuth ?? null)
    .mockResolvedValue(input.linked ?? null);
  return {
    member: {
      findUnique,
      findFirst: vi.fn().mockResolvedValue(input.byEmail ?? null),
      updateMany: vi
        .fn()
        .mockResolvedValue({ count: input.updateManyCount ?? 0 }),
      update: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...(input.byAuth ?? activeMember),
          ...data,
        }),
      ),
    },
  } as unknown as PrismaService;
}

const confirmedUser = {
  id: activeMember.authUserId!,
  email: activeMember.email,
  email_confirmed_at: new Date().toISOString(),
} satisfies Partial<User>;

describe('AuthService', () => {
  it('resolves the active member from the stable Supabase identity', async () => {
    const auth = supabase(confirmedUser);
    const service = new AuthService(prisma({ byAuth: activeMember }), auth);
    await expect(service.resolveActiveMember('token')).resolves.toEqual(
      activeMember,
    );
    expect(auth.auth.getClaims).toHaveBeenCalledWith('token');
    expect(auth.auth.getUser).not.toHaveBeenCalled();
  });

  it('coalesces concurrent active-member lookups after verifying each token', async () => {
    const database = prisma({ byAuth: activeMember, linked: activeMember });
    const auth = supabase(confirmedUser);
    const service = new AuthService(database, auth);

    await expect(
      Promise.all([
        service.resolveActiveMember('token'),
        service.resolveActiveMember('token'),
      ]),
    ).resolves.toEqual([activeMember, activeMember]);
    expect(auth.auth.getClaims).toHaveBeenCalledTimes(2);
    expect(database.member.findUnique).toHaveBeenCalledTimes(1);
  });

  it('rejects verified claims from the wrong issuer', async () => {
    const auth = supabase(confirmedUser);
    vi.mocked(auth.auth.getClaims).mockResolvedValue({
      data: {
        claims: {
          sub: confirmedUser.id,
          iss: 'https://untrusted.example/auth/v1',
          aud: 'authenticated',
          exp: Math.floor(Date.now() / 1_000) + 3_600,
          iat: Math.floor(Date.now() / 1_000),
          role: 'authenticated',
          aal: 'aal1',
          session_id: '88888888-8888-4888-8888-888888888888',
        },
      },
      error: null,
    });
    const database = prisma({ byAuth: activeMember });
    const service = new AuthService(database, auth);

    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(database.member.findUnique).not.toHaveBeenCalled();
  });

  it('rechecks membership on sequential requests and rejects deactivation immediately', async () => {
    const deactivated = {
      ...activeMember,
      status: 'DEACTIVATED',
      deactivatedAt: new Date(),
    } satisfies Member;
    const database = {
      member: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(activeMember)
          .mockResolvedValueOnce(deactivated),
      },
    } as unknown as PrismaService;
    const service = new AuthService(database, supabase(confirmedUser));

    await expect(service.resolveActiveMember('token')).resolves.toEqual(
      activeMember,
    );
    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(database.member.findUnique).toHaveBeenCalledTimes(2);
  });

  it('links a confirmed first sign-in to the existing invited member', async () => {
    const invited = {
      ...activeMember,
      authUserId: null,
      status: 'INVITED',
    } satisfies Member;
    const linked = {
      ...invited,
      authUserId: confirmedUser.id,
      status: 'ACTIVE',
    } satisfies Member;
    const database = prisma({
      byAuth: null,
      byEmail: invited,
      linked,
      updateManyCount: 1,
    });
    const service = new AuthService(database, supabase(confirmedUser));

    await expect(service.resolveActiveMember('token')).resolves.toEqual(linked);
    expect(database.member.updateMany).toHaveBeenCalledWith({
      where: {
        id: invited.id,
        authUserId: null,
        status: { in: ['INVITED', 'ACTIVE'] },
      },
      data: { authUserId: confirmedUser.id, status: 'ACTIVE' },
    });
  });

  it('activates a backend-linked invited member on confirmed first use', async () => {
    const invited = { ...activeMember, status: 'INVITED' } satisfies Member;
    const database = prisma({ byAuth: invited });
    const service = new AuthService(database, supabase(confirmedUser));

    await expect(service.resolveActiveMember('token')).resolves.toMatchObject({
      status: 'ACTIVE',
      authUserId: activeMember.authUserId,
    });
    expect(database.member.update).toHaveBeenCalledWith({
      where: { id: invited.id },
      data: { status: 'ACTIVE', deactivatedAt: null },
    });
  });

  it('resolves the linkage created by a concurrent first-sign-in request', async () => {
    const invited = {
      ...activeMember,
      authUserId: null,
      status: 'INVITED',
    } satisfies Member;
    const database = prisma({
      byAuth: null,
      byEmail: invited,
      linked: activeMember,
      updateManyCount: 0,
    });
    const service = new AuthService(database, supabase(confirmedUser));

    await expect(service.resolveActiveMember('token')).resolves.toEqual(
      activeMember,
    );
    expect(database.member.findUnique).toHaveBeenLastCalledWith({
      where: { authUserId: confirmedUser.id },
    });
  });

  it('does not link an invited member before Supabase confirms the email', async () => {
    const invited = {
      ...activeMember,
      authUserId: null,
      status: 'INVITED',
    } satisfies Member;
    const database = prisma({ byEmail: invited });
    const service = new AuthService(
      database,
      supabase({ id: confirmedUser.id, email: confirmedUser.email }),
    );

    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(database.member.updateMany).not.toHaveBeenCalled();
  });

  it('denies an authenticated identity with no Prometheus membership', async () => {
    const service = new AuthService(
      prisma({}),
      supabase({
        id: '66666666-6666-4666-8666-666666666666',
        email: 'unknown@example.com',
        email_confirmed_at: new Date().toISOString(),
      }),
    );
    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('does not relink an email that belongs to another auth identity', async () => {
    const database = prisma({
      byEmail: {
        ...activeMember,
        authUserId: '77777777-7777-4777-8777-777777777777',
      },
    });
    const service = new AuthService(database, supabase(confirmedUser));

    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(database.member.updateMany).not.toHaveBeenCalled();
  });

  it('denies a deactivated member on every request', async () => {
    const member = {
      ...activeMember,
      status: 'DEACTIVATED',
      deactivatedAt: new Date(),
    } satisfies Member;
    const service = new AuthService(
      prisma({ byAuth: member }),
      supabase(confirmedUser),
    );
    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.resolveActiveMember('token')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('distinguishes an invalid token from workspace denial', async () => {
    const service = new AuthService(
      prisma({}),
      supabase(null, { message: 'invalid' }),
    );
    await expect(
      service.resolveActiveMember('bad-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
