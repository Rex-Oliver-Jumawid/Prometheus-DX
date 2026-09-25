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
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { Member } from '@prisma/client';
import {
  CreateProjectMessageSchema,
  DeleteProjectMessageSchema,
  EditProjectMessageSchema,
  ProjectMessageSearchQuerySchema,
} from '../../shared/contracts/project-chat';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ProjectChatService } from './project-chat.service';
import { ScopedRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';

@Controller('projects/:projectId/messages')
@UseGuards(SupabaseAuthGuard)
export class ProjectChatController {
  constructor(
    @Inject(ProjectChatService) private readonly chat: ProjectChatService,
  ) {}

  @Get('search')
  @UseGuards(ScopedRateLimitGuard)
  @RateLimit({ scope: 'project-chat-search', limit: 60, windowSeconds: 60 })
  search(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query() query: unknown,
  ) {
    const parsed = ProjectMessageSearchQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid search.');
    return this.chat.search(member, projectId, parsed.data);
  }

  @Get(':messageId/context')
  context(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ) {
    return this.chat.context(member, projectId, messageId);
  }

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
  @UseGuards(ScopedRateLimitGuard)
  @RateLimit({ scope: 'project-chat-send', limit: 30, windowSeconds: 60 })
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

  @Delete(':messageId')
  remove(
    @CurrentMember() member: Member,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() body: unknown,
  ) {
    const parsed = DeleteProjectMessageSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Invalid message.');
    return this.chat.remove(member, projectId, messageId, parsed.data);
  }
}
