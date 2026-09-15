import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '@prisma/client';
import type { AuthenticatedRequest } from './auth.types';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowed?.length) return true;

    const member = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>().currentMember;
    if (!member || !allowed.includes(member.workspaceRole)) {
      throw new ForbiddenException(
        'You do not have permission to access this resource.',
      );
    }
    return true;
  }
}
