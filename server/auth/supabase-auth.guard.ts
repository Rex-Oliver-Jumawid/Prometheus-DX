import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    const value = Array.isArray(authorization) ? authorization[0] : authorization;
    const match = value?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      throw new UnauthorizedException('A valid bearer token is required.');
    }

    request.currentMember = await this.authService.resolveActiveMember(match[1]);
    return true;
  }
}
