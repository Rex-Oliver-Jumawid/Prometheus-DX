import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { Member } from '@prisma/client';
import {
  CreateProjectRequestSchema,
  type CreateProjectRequest,
} from '../../shared/contracts/project';
import { ProjectsService } from './projects.service';

@Controller('projects')
@UseGuards(SupabaseAuthGuard)
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projectsService: ProjectsService,
  ) {}

  @Get()
  listProjects() {
    return this.projectsService.listProjects();
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
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.projectsService.getProject(projectId);
  }
}
