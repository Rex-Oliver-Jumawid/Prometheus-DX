import { HttpException, type ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { PrismaService } from '../database/prisma.service';
import { describe, expect, it, vi } from 'vitest';
import { ApiRateLimitGuard } from './rate-limit';

const memberId = '11111111-1111-4111-8111-111111111111';

function fixture(limit = 2) {
  const queryRaw = vi.fn();
  const setHeader = vi.fn();
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue({
      group: 'chat-send', limit, windowSeconds: 60,
    }),
  } as unknown as Reflector;
  const guard = new ApiRateLimitGuard(
    reflector,
    { $queryRaw: queryRaw } as unknown as PrismaService,
  );
  const context = {
    getHandler: () => function send() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({
        currentMember: { id: memberId },
        params: { projectId: '22222222-2222-4222-8222-222222222222' },
      }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  return { guard, context, queryRaw, setHeader };
}

describe('ApiRateLimitGuard', () => {
  it('passes requests below the limit and rejects bursts with Retry-After', async () => {
    const { guard, context, queryRaw, setHeader } = fixture(2);
    queryRaw.mockResolvedValueOnce([{ hit_count: 1 }]);
    queryRaw.mockResolvedValueOnce([{ hit_count: 2 }]);
    queryRaw.mockResolvedValueOnce([{ hit_count: 3 }]);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 429,
    });
    expect(queryRaw).toHaveBeenCalledTimes(3);
    expect(setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('never reads the database for routes without an explicit policy', async () => {
    const { guard, context, queryRaw } = fixture();
    const reflector = (guard as unknown as { reflector: {
      getAllAndOverride: ReturnType<typeof vi.fn>
    } }).reflector;
    reflector.getAllAndOverride.mockReturnValue(null);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('requires an authenticated member before using the database', async () => {
    const { guard, queryRaw, setHeader } = fixture();
    const context = {
      getHandler: () => function send() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ currentMember: null, params: {} }),
        getResponse: () => ({ setHeader }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(HttpException);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
