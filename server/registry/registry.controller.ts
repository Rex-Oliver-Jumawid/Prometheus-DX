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
import type { Member } from '@prisma/client';
import {
  CompleteAccountSetupRequestSchema,
  CreateDepartmentRequestSchema,
  CreateMemberRequestSchema,
  UpdateDepartmentRequestSchema,
  UpdateMemberRequestSchema,
} from '../../shared/contracts/registry';
import { CurrentMember } from '../auth/current-member.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { WorkspaceRoles } from '../auth/workspace-roles.decorator';
import { RegistryService } from './registry.service';

@Controller('registry')
export class RegistryController {
  constructor(
    @Inject(RegistryService)
    private readonly registryService: RegistryService,
  ) {}

  @Post('account-setup')
  completeAccountSetup(@Body() body: unknown) {
    const parsed = CompleteAccountSetupRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid account setup data.',
      );
    }
    return this.registryService.completeAccountSetup(parsed.data);
  }

  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  overview() {
    return this.registryService.getOverview();
  }

  @Get('access')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  access() {
    return { allowed: true as const, phase: 1 as const };
  }

  @Get('departments')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  listDepartments() {
    return this.registryService.listDepartments();
  }

  @Post('departments')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
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
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
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
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  deleteDepartment(
    @Param('departmentId', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
  ) {
    return this.registryService.deleteDepartment(departmentId);
  }

  @Get('members')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  listMembers() {
    return this.registryService.listMembers();
  }

  @Post('members')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
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
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
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

  @Delete('members/:memberId')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  removeMember(
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @CurrentMember() currentMember: Member,
  ) {
    return this.registryService.removeMember(memberId, currentMember.id);
  }

  @Post('members/:memberId/invitation')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @WorkspaceRoles('ADMINISTRATOR')
  resendMemberInvitation(
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ) {
    return this.registryService.sendMemberInvitation(memberId);
  }
}
