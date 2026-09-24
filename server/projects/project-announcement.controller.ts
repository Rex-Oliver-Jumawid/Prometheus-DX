import {
  BadRequestException,
  Body,
  Controller,
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
  CreateProjectAnnouncementSchema,
  UpdateProjectAnnouncementPinSchema,
} from '../../shared/contracts/project-announcement';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectAnnouncementService } from './project-announcement.service';

@Controller('projects/:projectId/announcements')
@UseGuards(SupabaseAuthGuard)
export class ProjectAnnouncementController {
  constructor(
    @Inject(ProjectAnnouncementService)
    private readonly announcements: ProjectAnnouncementService,
  ) {}

  @Get()
  list(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return this.announcements.list(member, projectId);
  }

  @Post()
  create(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const parsed = CreateProjectAnnouncementSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid announcement.',
      );
    return this.announcements.create(member, projectId, parsed.data);
  }

  @Patch(':announcementId/pin')
  setPinned(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('announcementId', new ParseUUIDPipe({ version: '4' })) announcementId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateProjectAnnouncementPinSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid announcement update.',
      );
    return this.announcements.setPinned(
      member,
      projectId,
      announcementId,
      parsed.data,
    );
  }
}
