import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

const RATE_LIMIT_KEY = 'prometheus:rate-limit';

type RateLimitRule = {
  group: string;
  limit: number;
  windowSeconds: number;
};

export const ApiRateLimit = (rule: RateLimitRule) =>
  SetMetadata(RATE_LIMIT_KEY, rule);

type RequestWithParams = AuthenticatedRequest & {
  params?: Record<string, string>;
};

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule>(
      RATE_LIMIT_KEY, [context.getHandler(), context.getClass()],
    );
    if (!rule) return true;

    // This guard must follow SupabaseAuthGuard on every annotated route.
    const request = context.switchToHttp().getRequest<RequestWithParams>();
    const memberId = request.currentMember?.id;
    if (!memberId)
      throw new HttpException('Authentication is required.', HttpStatus.UNAUTHORIZED);

    const groupScope = request.params?.projectId ??
      request.params?.departmentId ?? 'workspace';
    const keyHash = createHash('sha256')
      .update(memberId + ':' + rule.group + ':' + groupScope)
      .digest('hex');
    const durationMs = rule.windowSeconds * 1_000;
    const windowStart = new Date(Math.floor(Date.now() / durationMs) * durationMs);

    // The conflict update is atomic even when independent serverless function
    // instances receive requests at the same time. Never use in-memory counters.
    const rows = await this.prisma.$queryRaw<Array<{ hit_count: number }>>(
      Prisma.sql`
        INSERT INTO "api_rate_limits" ("key_hash", "window_start", "hit_count")
        VALUES (${keyHash}, ${windowStart}, 1)
        ON CONFLICT ("key_hash") DO UPDATE
        SET
          "hit_count" = CASE
            WHEN "api_rate_limits"."window_start" = EXCLUDED."window_start"
            THEN "api_rate_limits"."hit_count" + 1
            ELSE 1
          END,
          "window_start" = EXCLUDED."window_start",
          "updated_at" = CURRENT_TIMESTAMP
        RETURNING "hit_count"
      `,
    );
    if (Number(rows[0]?.hit_count) <= rule.limit) return true;

    const retryAfterSeconds = Math.max(
      1, Math.ceil((windowStart.getTime() + durationMs - Date.now()) / 1_000),
    );
    context.switchToHttp()
      .getResponse<{ setHeader?: (key: string, value: string) => void }>()
      .setHeader?.('Retry-After', String(retryAfterSeconds));
    throw new HttpException(
      'Too many requests. Try again later.', HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
