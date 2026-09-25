import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { RATE_LIMIT_METADATA, type RateLimitPolicy } from './rate-limit.decorator';

interface LimitedRequest extends AuthenticatedRequest {
  params?: Record<string, string | undefined>;
  res?: { setHeader(name: string, value: string): void };
}

/** PostgreSQL upserts keep quotas shared across Vercel's independent instances. */
@Injectable()
export class ScopedRateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policy = this.reflector.getAllAndOverride<RateLimitPolicy>(RATE_LIMIT_METADATA, [
      context.getHandler(), context.getClass(),
    ]);
    if (!policy) return true;

    const request = context.switchToHttp().getRequest<LimitedRequest>();
    const memberId = request.currentMember?.id;
    // The authentication guard must run first. Fail closed if the pipeline changes.
    if (!memberId) throw new UnauthorizedException('Sign in to continue.');

    const resource = policy.resourceParam ? request.params?.[policy.resourceParam] ?? '' : '';
    const key = createHash('sha256')
      .update([policy.scope, memberId, resource].join(':'))
      .digest('hex');

    const rows = await this.prisma.$queryRaw<Array<{ hits: number; resetAt: Date }>>`
      INSERT INTO "api_rate_limit_buckets" ("bucket_key", "hits", "reset_at")
      VALUES (${key}, 1, clock_timestamp() + (${policy.windowSeconds}::integer * INTERVAL '1 second'))
      ON CONFLICT ("bucket_key") DO UPDATE
      SET "hits" = CASE
            WHEN "api_rate_limit_buckets"."reset_at" <= clock_timestamp()
              THEN 1
            ELSE "api_rate_limit_buckets"."hits" + 1
          END,
          "reset_at" = CASE
            WHEN "api_rate_limit_buckets"."reset_at" <= clock_timestamp()
              THEN clock_timestamp() + (${policy.windowSeconds}::integer * INTERVAL '1 second')
            ELSE "api_rate_limit_buckets"."reset_at"
          END
      RETURNING "hits", "reset_at" AS "resetAt"
    `;
    const bucket = rows[0];
    if (!bucket) throw new HttpException('Rate limit unavailable.', HttpStatus.SERVICE_UNAVAILABLE);
    if (bucket.hits <= policy.limit) return true;

    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt.getTime() - Date.now()) / 1_000));
    const response = context.switchToHttp().getResponse<{ setHeader(name: string, value: string): void }>();
    response.setHeader('Retry-After', String(retryAfter));
    throw new HttpException('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }
}
