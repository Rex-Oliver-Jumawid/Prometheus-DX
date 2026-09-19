import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CreateDepartmentRequestSchema,
  CreateMemberRequestSchema,
  UpdateDepartmentRequestSchema,
  UpdateMemberRequestSchema,
} from '../../shared/contracts/registry';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { WorkspaceRoles } from '../auth/workspace-roles.decorator';
import { RegistryService } from './registry.service';

@Controller('registry')
@UseGuards(SupabaseAuthGuard, RolesGuard)
@WorkspaceRoles('ADMINISTRATOR')
export class RegistryController {
  constructor(
    @Inject(RegistryService)
    private readonly registryService: RegistryService,
  ) {}

  @Get()
  overview() {
    return this.registryService.getOverview();
  }

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

  @Delete('departments/:departmentId')
  deleteDepartment(
    @Param('departmentId', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
  ) {
    return this.registryService.deleteDepartment(departmentId);
  }

  @Get('members')
  listMembers() {
    return this.registryService.listMembers();
  }

  @Post('members')
  createMember(@Body() body: unknown) {
    const parsed = CreateMemberRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid member data.',
      );
    }

    return this.registryService.createMember(parsed.data);
  }

  @Patch('members/:memberId')
  updateMember(
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateMemberRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid member data.',
      );
    }

    return this.registryService.updateMember(memberId, parsed.data);
  }

  @Post('members/:memberId/invitation')
  resendMemberInvitation(
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ) {
    return this.registryService.sendMemberInvitation(memberId);
  }
}
