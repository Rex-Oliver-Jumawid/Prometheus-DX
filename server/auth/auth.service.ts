import {
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type Member } from '@prisma/client';
import { createClient, type User } from '@supabase/supabase-js';
import { PrismaService } from '../database/prisma.service';
import { serverEnvironment } from '../config/env';

export const SUPABASE_AUTH_CLIENT = Symbol('SUPABASE_AUTH_CLIENT');

export interface SupabaseAuthClient {
  auth: {
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

    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data.user) {
      throw new UnauthorizedException(
        'Your session is invalid or has expired.',
      );
    }

    const user = data.user;
    const normalizedEmail = user.email?.trim().toLowerCase();

    try {
      let member = await this.prisma.member.findUnique({
        where: { authUserId: user.id },
      });

      if (
        member?.status === 'INVITED' &&
        normalizedEmail &&
        user.email_confirmed_at &&
        member.email.toLowerCase() === normalizedEmail
      ) {
        member = await this.prisma.member.update({
          where: { id: member.id },
          data: { status: 'ACTIVE', deactivatedAt: null },
        });
      }

      if (!member && normalizedEmail && user.email_confirmed_at) {
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
              authUserId: user.id,
              status: 'ACTIVE',
            },
          });

          if (linked.count === 1) {
            member = await this.prisma.member.findUnique({
              where: { id: emailMember.id },
            });
          } else {
            member = await this.prisma.member.findUnique({
              where: { authUserId: user.id },
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
      if (error instanceof ForbiddenException) {
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
