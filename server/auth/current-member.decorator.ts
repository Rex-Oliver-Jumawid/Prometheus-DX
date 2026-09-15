import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Member } from '@prisma/client';
import type { AuthenticatedRequest } from './auth.types';

export const CurrentMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Member => {
    const member = context.switchToHttp().getRequest<AuthenticatedRequest>().currentMember;
    if (!member) {
      throw new Error('CurrentMember used without SupabaseAuthGuard.');
    }
    return member;
  },
);
