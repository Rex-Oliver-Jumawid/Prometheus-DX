import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import {
  createClient,
  type JwtPayload,
  type User,
} from '@supabase/supabase-js';
import { z } from 'zod';
import { PrismaService } from '../database/prisma.service';
import { serverEnvironment } from '../config/env';

export const SUPABASE_AUTH_CLIENT = Symbol('SUPABASE_AUTH_CLIENT');
const AuthSubjectSchema = z.string().uuid();

export interface SupabaseAuthClient {
  auth: {
    getClaims(accessToken: string): Promise<{
      data: { claims: JwtPayload } | null;
      error: { message: string } | null;
    }>;
    getUser(accessToken: string): Promise<{
      data: { user: User | null };
      error: { message: string } | null;
    }>;
  };
}

export function createSupabaseAuthClient(): SupabaseAuthClient | null {
  if (!serverEnvironment.supabaseUrl || !serverEnvironment.supabaseAnonKey) {
    return null;
  }

  return createClient(
    serverEnvironment.supabaseUrl,
    serverEnvironment.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

@Injectable()
export class AuthService {
  private readonly activeMemberLookups = new Map<string, Promise<Member>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SUPABASE_AUTH_CLIENT)
    private readonly supabase: SupabaseAuthClient | null,
  ) {}

  async resolveActiveMember(accessToken: string): Promise<Member> {
    if (!this.supabase) {
      throw new ServiceUnavailableException(
        'Authentication is not configured.',
      );
    }

    let verification: Awaited<
      ReturnType<SupabaseAuthClient['auth']['getClaims']>
    >;
    try {
      verification = await this.supabase.auth.getClaims(accessToken);
    } catch {
      throw new ServiceUnavailableException(
        'Authentication verification is temporarily unavailable.',
      );
    }
    const { data, error } = verification;
    if (error || !data?.claims) {
      throw new UnauthorizedException(
        'Your session is invalid or has expired.',
      );
    }

    const claims = data.claims;
    const subject = AuthSubjectSchema.safeParse(claims.sub);
    const expectedIssuer = `${serverEnvironment.supabaseUrl!.replace(/\/$/, '')}/auth/v1`;
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (
      !subject.success ||
      claims.iss !== expectedIssuer ||
      !audience.includes('authenticated')
    ) {
      throw new UnauthorizedException(
        'Your session is invalid or has expired.',
      );
    }

    const authUserId = subject.data;
    const pending = this.activeMemberLookups.get(authUserId);
    if (pending) return pending;

    const member = this.resolveVerifiedIdentity(authUserId, accessToken);
    this.activeMemberLookups.set(authUserId, member);

    try {
      return await member;
    } finally {
      if (this.activeMemberLookups.get(authUserId) === member) {
        this.activeMemberLookups.delete(authUserId);
      }
    }
  }

  private async resolveVerifiedIdentity(
    authUserId: string,
    accessToken: string,
  ): Promise<Member> {
    let verifiedUser: User | undefined;

    try {
      let member = await this.prisma.member.findUnique({
        where: { authUserId },
      });

      if (!member || member.status === 'INVITED') {
        const { data, error } = await this.supabase!.auth.getUser(accessToken);
        if (error || !data.user || data.user.id !== authUserId) {
          throw new UnauthorizedException(
            'Your session is invalid or has expired.',
          );
        }
        verifiedUser = data.user;
      }

      const normalizedEmail = verifiedUser?.email?.trim().toLowerCase();

      if (
        member?.status === 'INVITED' &&
        normalizedEmail &&
        verifiedUser?.email_confirmed_at &&
        member.email.toLowerCase() === normalizedEmail
      ) {
        member = await this.prisma.member.update({
          where: { id: member.id },
          data: { status: 'ACTIVE', deactivatedAt: null },
        });
      }

      if (!member && normalizedEmail && verifiedUser?.email_confirmed_at) {
        const emailMember = await this.prisma.member.findFirst({
          where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        });

        if (
          emailMember &&
          !emailMember.authUserId &&
          emailMember.status !== 'DEACTIVATED'
        ) {
          const linked = await this.prisma.member.updateMany({
            where: {
              id: emailMember.id,
              authUserId: null,
              status: { in: ['INVITED', 'ACTIVE'] },
            },
            data: {
              authUserId,
              status: 'ACTIVE',
            },
          });

          if (linked.count === 1) {
            member = await this.prisma.member.findUnique({
              where: { id: emailMember.id },
            });
          } else {
            member = await this.prisma.member.findUnique({
              where: { authUserId },
            });
          }
        }
      }

      if (!member || member.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'This account does not have access to Prometheus.',
        );
      }

      return member;
    } catch (error) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ForbiddenException(
          'This account does not have access to Prometheus.',
        );
      }

      throw new ServiceUnavailableException(
        'Workspace authorization is temporarily unavailable.',
      );
    }
  }
}
