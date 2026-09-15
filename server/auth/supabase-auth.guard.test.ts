import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthService } from './auth.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

function context(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as unknown as ExecutionContext;
}

describe('SupabaseAuthGuard', () => {
  it('denies an API request without a bearer token before member lookup', async () => {
    const authService = { resolveActiveMember: vi.fn() } as unknown as AuthService;
    const guard = new SupabaseAuthGuard(authService);
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.resolveActiveMember).not.toHaveBeenCalled();
  });
});
