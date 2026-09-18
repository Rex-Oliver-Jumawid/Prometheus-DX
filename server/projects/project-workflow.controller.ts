import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  CreateOutcomeRequestSchema,
  CreateStageRequestSchema,
  UpdateOutcomeRequestSchema,
  UpdateStageRequestSchema,
  UpdateProjectMemberAccessRequestSchema,
  type CreateOutcomeRequest,
  type CreateStageRequest,
  type UpdateOutcomeRequest,
  type UpdateStageRequest,
  type UpdateProjectMemberAccessRequest,
} from '../../shared/contracts/project-workflow';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectWorkflowService } from './project-workflow.service';

@Controller('projects/:projectId')
@UseGuards(SupabaseAuthGuard)
export class ProjectWorkflowController {
  constructor(
    @Inject(ProjectWorkflowService)
    private readonly workflowService: ProjectWorkflowService,
  ) {}

  @Get('workflow')
  getWorkflow(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.workflowService.getWorkflow(currentMember, projectId);
  }

  @Get('members')
  getProjectMembers(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.workflowService.getProjectMembers(currentMember, projectId);
  }

  @Patch('members/:memberId/access')
  updateProjectMemberAccess(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateProjectMemberAccessRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid Project Member access.',
      );
    }
    return this.workflowService.updateProjectMemberAccess(
      currentMember,
      projectId,
      memberId,
      parsed.data satisfies UpdateProjectMemberAccessRequest,
    );
  }

  @Post('stages')
  createStage(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const parsed = CreateStageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid stage data.',
      );
    }
    return this.workflowService.createStage(
      currentMember,
      projectId,
      parsed.data satisfies CreateStageRequest,
    );
  }

  @Patch('stages/:stageId')
  updateStage(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('stageId', new ParseUUIDPipe({ version: '4' })) stageId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateStageRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid stage data.',
      );
    }
    return this.workflowService.updateStage(
      currentMember,
      projectId,
      stageId,
      parsed.data satisfies UpdateStageRequest,
    );
  }

  @Post('stages/:stageId/outcomes')
  createOutcome(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('stageId', new ParseUUIDPipe({ version: '4' })) stageId: string,
    @Body() body: unknown,
  ) {
    const parsed = CreateOutcomeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid outcome data.',
      );
    }
    return this.workflowService.createOutcome(
      currentMember,
      projectId,
      stageId,
      parsed.data satisfies CreateOutcomeRequest,
    );
  }

  @Get('outcomes/:outcomeId')
  getOutcome(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('outcomeId', new ParseUUIDPipe({ version: '4' })) outcomeId: string,
  ) {
    return this.workflowService.getOutcome(currentMember, projectId, outcomeId);
  }

  @Patch('outcomes/:outcomeId')
  updateOutcome(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('outcomeId', new ParseUUIDPipe({ version: '4' })) outcomeId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateOutcomeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid outcome data.',
      );
    }
    return this.workflowService.updateOutcome(
      currentMember,
      projectId,
      outcomeId,
      parsed.data satisfies UpdateOutcomeRequest,
    );
  }

  @Post('outcomes/:outcomeId/join')
  joinOutcome(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('outcomeId', new ParseUUIDPipe({ version: '4' })) outcomeId: string,
  ) {
    return this.workflowService.joinOutcome(
      currentMember,
      projectId,
      outcomeId,
    );
  }

  @Delete('outcomes/:outcomeId/members/:memberId')
  removeOutcomeMember(
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('outcomeId', new ParseUUIDPipe({ version: '4' })) outcomeId: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ) {
    return this.workflowService.rejectOutcomeMemberRemoval(
      projectId,
      outcomeId,
      memberId,
    );
  }

  @Delete('outcomes/:outcomeId')
  async deleteOutcome(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('outcomeId', new ParseUUIDPipe({ version: '4' })) outcomeId: string,
  ) {
    await this.workflowService.deleteOutcome(
      currentMember,
      projectId,
      outcomeId,
    );
    return { success: true };
  }

  @Delete('stages/:stageId')
  async deleteStage(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('stageId', new ParseUUIDPipe({ version: '4' })) stageId: string,
  ) {
    await this.workflowService.deleteStage(
      currentMember,
      projectId,
      stageId,
    );
    return { success: true };
  }
}
