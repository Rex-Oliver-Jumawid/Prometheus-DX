import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateDepartmentRequestSchema,
  UpdateDepartmentRequestSchema,
} from '../../shared/contracts/registry';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { WorkspaceRoles } from '../auth/workspace-roles.decorator';
import { RegistryService } from './registry.service';

@Controller('registry')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@WorkspaceRoles('ADMINISTRATOR')
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get('access')
  access() {
    return { allowed: true as const, phase: 1 as const };
  }

  @Get('departments')
  listDepartments() {
    return this.registryService.listDepartments();
  }

  @Post('departments')
  createDepartment(@Body() body: unknown) {
    const parsed = CreateDepartmentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid department data.',
      );
    }

    return this.registryService.createDepartment(parsed.data);
  }

  @Patch('departments/:departmentId')
  updateDepartment(
    @Param('departmentId', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateDepartmentRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid department data.',
      );
    }

    return this.registryService.updateDepartment(departmentId, parsed.data);
  }
}
