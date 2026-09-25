import { HttpException, UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ProjectAnnouncementController } from '../projects/project-announcement.controller';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ScopedRateLimitGuard } from './rate-limit.guard';
import { RATE_LIMIT_METADATA, type RateLimitPolicy } from './rate-limit.decorator';

const policy: RateLimitPolicy = { scope: 'chat-send', limit: 2, windowSeconds: 60 };
const memberId = '22222222-2222-4222-8222-222222222222';

function setup(config: { policy?: RateLimitPolicy | null; id?: string | null; hits?: number } = {}) {
  const headers: Record<string, string> = {};
  const request = { currentMember: config.id === null ? undefined : { id: config.id ?? memberId }, params: {} };
  const response = { setHeader: vi.fn((name: string, value: string) => { headers[name] = value; }) };
  const context = {
    getClass: () => class TestController {},
    getHandler: () => () => {},
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  const reflector = { getAllAndOverride: vi.fn().mockReturnValue(config.policy === undefined ? policy : config.policy) };
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{
    hits: config.hits ?? 1,
    resetAt: new Date(Date.now() + 60_000),
  }]) };
  const guard = new ScopedRateLimitGuard(reflector as unknown as Reflector, prisma as unknown as PrismaService);
  return { guard, context, request, response, headers, prisma, reflector };
}

describe('ScopedRateLimitGuard', () => {
  it('skips endpoints without configured quotas', async () => {
    const { guard, context, prisma } = setup({ policy: null });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('counts authorized members through the shared database, not process memory', async () => {
    const { guard, context, prisma } = setup({ hits: 2 });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('returns 429 and Retry-After after the configured allowance', async () => {
    const { guard, context, headers } = setup({ hits: 3 });
    try {
      await guard.canActivate(context);
      throw new Error('Expected throttling to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(429);
    }
    expect(Number(headers['Retry-After'])).toBeGreaterThan(0);
  });

  it('fails closed before authentication and never persists raw member IDs', async () => {
    const anonymous = setup({ id: null });
    await expect(anonymous.guard.canActivate(anonymous.context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(anonymous.prisma.$queryRaw).not.toHaveBeenCalled();
    // A hash is used in the SQL parameter; no raw member ID enters the bucket key.
    const authorized = setup();
    await authorized.guard.canActivate(authorized.context);
    const sqlParts = authorized.prisma.$queryRaw.mock.calls[0];
    expect(sqlParts.join(' ')).not.toContain(memberId);
    expect(sqlParts.some((part: unknown) => part === memberId)).toBe(false);
  });

  it('surfaces database failures rather than accepting unmetered requests', async () => {
    const { guard, context, prisma } = setup();
    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(guard.canActivate(context)).rejects.toThrow('database unavailable');
  });
  it('protects company-wide announcement posting and pinning with separate quotas', () => {
    const post = Reflect.getMetadata(
      RATE_LIMIT_METADATA, ProjectAnnouncementController.prototype.create,
    ) as RateLimitPolicy;
    const pin = Reflect.getMetadata(
      RATE_LIMIT_METADATA, ProjectAnnouncementController.prototype.setPinned,
    ) as RateLimitPolicy;
    expect(post).toEqual({ scope: 'project-announcement-create', limit: 6, windowSeconds: 60 });
    expect(pin).toEqual({ scope: 'project-announcement-pin', limit: 20, windowSeconds: 60 });
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectAnnouncementController.prototype.create))
      .toContain(ScopedRateLimitGuard);
    expect(Reflect.getMetadata(GUARDS_METADATA, ProjectAnnouncementController.prototype.setPinned))
      .toContain(ScopedRateLimitGuard);
  });

});
