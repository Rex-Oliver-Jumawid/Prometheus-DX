import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { Member } from '@prisma/client';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectActivityService } from './project-activity.service';

@Controller('projects/:projectId/activity')
@UseGuards(SupabaseAuthGuard)
export class ProjectActivityController {
  constructor(
    @Inject(ProjectActivityService)
    private readonly activityService: ProjectActivityService,
  ) {}

  @Get()
  list(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('cursor') cursor?: string,
  ) {
    if (cursor !== undefined && !z.string().uuid().safeParse(cursor).success)
      throw new BadRequestException('Invalid project activity cursor.');
    return this.activityService.list(member, projectId, cursor);
  }
}
