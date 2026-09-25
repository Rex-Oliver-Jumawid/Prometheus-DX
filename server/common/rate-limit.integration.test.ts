import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ApiRateLimitGuard } from './rate-limit';

const enabled = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const memberId = randomUUID();
const group = 'rate-limit-integration-' + randomUUID();
const keyHash = createHash('sha256')
  .update(memberId + ':' + group + ':workspace').digest('hex');

describe.runIf(enabled)('API rate limit PostgreSQL integration', () => {
  afterAll(async () => {
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "api_rate_limits" WHERE "key_hash" = ${keyHash}`,
    );
    await prisma.$disconnect();
  });

  it('atomically shares a request limit across simultaneous calls', async () => {
    const rule = { group, limit: 3, windowSeconds: 60 };
    const reflector = {
      getAllAndOverride: () => rule,
    } as unknown as Reflector;
    const guard = new ApiRateLimitGuard(reflector, prisma);
    const context = {
      getHandler: () => function send() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ currentMember: { id: memberId }, params: {} }),
        getResponse: () => ({ setHeader: () => undefined }),
      }),
    } as unknown as ExecutionContext;
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => guard.canActivate(context)),
    );
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(3);
    const denied = results.filter((item) => item.status === 'rejected');
    expect(denied).toHaveLength(3);
    for (const result of denied) {
      if (result.status === 'rejected') expect(result.reason.status).toBe(429);
    }
  });
});
