import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { RolesGuard } from './roles.guard';

function context(role: Member['workspaceRole']): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({
      getRequest: () => ({ currentMember: { workspaceRole: role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: () => ['ADMINISTRATOR'],
  } as unknown as Reflector;
  const guard = new RolesGuard(reflector);

  it('allows an Administrator through an Administrator-only API gate', () => {
    expect(guard.canActivate(context('ADMINISTRATOR'))).toBe(true);
  });

  it('denies a Member at the API gate', () => {
    expect(() => guard.canActivate(context('MEMBER'))).toThrow(
      ForbiddenException,
    );
  });
});
