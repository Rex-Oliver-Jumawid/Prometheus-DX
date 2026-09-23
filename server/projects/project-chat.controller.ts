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
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { Member } from '@prisma/client';
import {
  CreateProjectMessageSchema,
  EditProjectMessageSchema,
} from '../../shared/contracts/project-chat';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectChatService } from './project-chat.service';

@Controller('projects/:projectId/messages')
@UseGuards(SupabaseAuthGuard)
export class ProjectChatController {
  constructor(
    @Inject(ProjectChatService) private readonly chat: ProjectChatService,
  ) {}

  @Get()
  list(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('cursor') cursor?: string,
  ) {
    if (cursor !== undefined && !z.string().uuid().safeParse(cursor).success)
      throw new BadRequestException('Invalid Project chat cursor.');
    return this.chat.list(member, projectId, cursor);
  }

  @Post()
  send(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const parsed = CreateProjectMessageSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid message.');
    return this.chat.send(member, projectId, parsed.data);
  }

  @Patch(':messageId')
  edit(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() body: unknown,
  ) {
    const parsed = EditProjectMessageSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid message.');
    return this.chat.edit(member, projectId, messageId, parsed.data);
  }
}
