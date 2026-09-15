import { Controller, Get, UseGuards } from '@nestjs/common';
import { RegistryAccessResponseSchema } from '../../shared/contracts/member';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { WorkspaceRoles } from '../auth/workspace-roles.decorator';

@Controller('registry')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@WorkspaceRoles('ADMINISTRATOR')
export class RegistryController {
  @Get('access')
  access() {
    return RegistryAccessResponseSchema.parse({ allowed: true, phase: 1 });
  }
}
