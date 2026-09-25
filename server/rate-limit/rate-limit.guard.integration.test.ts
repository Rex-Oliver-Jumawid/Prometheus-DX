import 'dotenv/config';
import { HttpException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { createHash, randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { ScopedRateLimitGuard } from './rate-limit.guard';

const enabled = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const first = randomUUID();
const second = randomUUID();
const scope = 'rate-limit-integration-' + randomUUID();
const policy = { scope, limit: 2, windowSeconds: 60 };
const guard = new ScopedRateLimitGuard({ getAllAndOverride: () => policy } as unknown as Reflector, prisma);

function context(memberId: string) {
  const headers = { setHeader: vi.fn() };
  const ctx = {
    getClass: () => class TestController {},
    getHandler: () => () => {},
    switchToHttp: () => ({
      getRequest: () => ({ currentMember: { id: memberId }, params: {} }),
      getResponse: () => headers,
    }),
  } as unknown as ExecutionContext;
  return { ctx, headers };
}

function key(memberId: string) {
  return createHash('sha256').update([scope, memberId, ''].join(':')).digest('hex');
}

describe.runIf(enabled)('API quotas PostgreSQL integration', () => {
  afterAll(async () => {
    await prisma.apiRateLimitBucket.deleteMany({ where: { key: { in: [key(first), key(second)] } } });
    await prisma.$disconnect();
  });

  it('shares atomic request counts and isolates each authenticated member', async () => {
    await expect(guard.canActivate(context(first).ctx)).resolves.toBe(true);
    await expect(guard.canActivate(context(first).ctx)).resolves.toBe(true);
    const limited = context(first);
    await expect(guard.canActivate(limited.ctx)).rejects.toMatchObject({ status: 429 });
    expect(limited.headers.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    await expect(guard.canActivate(context(second).ctx)).resolves.toBe(true);
    expect(await prisma.apiRateLimitBucket.findUnique({ where: { key: key(first) } }))
      .toMatchObject({ hits: 3 });
  });

  it('opens a new window after the stored reset timestamp expires', async () => {
    await prisma.apiRateLimitBucket.update({
      where: { key: key(first) }, data: { resetAt: new Date(Date.now() - 1_000) },
    });
    await expect(guard.canActivate(context(first).ctx)).resolves.toBe(true);
    expect(await prisma.apiRateLimitBucket.findUnique({ where: { key: key(first) } }))
      .toMatchObject({ hits: 1 });
  });
});
