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
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { Member } from '@prisma/client';
import {
  CreateProjectRequestSchema,
  UpdateProjectRequestSchema,
  UpdateProjectStatusRequestSchema,
  type CreateProjectRequest,
  type UpdateProjectRequest,
  type UpdateProjectStatusRequest,
} from '../../shared/contracts/project';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(SupabaseAuthGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  listProjects(@CurrentMember() currentMember: Member) {
    return this.projectsService.listProjects(currentMember);
  }

  @Get('create-options')
  createOptions() {
    return this.projectsService.getCreateOptions();
  }

  @Post()
  createProject(@CurrentMember() currentMember: Member, @Body() body: unknown) {
    const parsed = CreateProjectRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid project data.',
      );
    }

    return this.projectsService.createProject(
      currentMember,
      parsed.data satisfies CreateProjectRequest,
    );
  }

  @Get(':projectId')
  getProject(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.projectsService.getProject(currentMember, projectId);
  }

  @Patch(':projectId')
  updateProject(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateProjectRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid project data.',
      );
    }
    return this.projectsService.updateProject(
      currentMember,
      projectId,
      parsed.data satisfies UpdateProjectRequest,
    );
  }

  @Delete(':projectId')
  deleteProject(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.projectsService.deleteProject(currentMember, projectId);
  }

  @Patch(':projectId/status')
  updateProjectStatus(
    @CurrentMember() currentMember: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateProjectStatusRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid project status.',
      );
    }

    return this.projectsService.updateProjectStatus(
      currentMember,
      projectId,
      parsed.data satisfies UpdateProjectStatusRequest,
    );
  }
}
