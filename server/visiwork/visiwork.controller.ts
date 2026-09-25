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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import { z } from 'zod';
import {
  CreateVisiWorkMessageSchema,
  SetVisiWorkPresenceRequestSchema,
  UpdateVisiWorkMessageSchema,
  VisiWorkMessageSearchQuerySchema,
} from '../../shared/contracts/visiwork';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { VisiWorkService } from './visiwork.service';
import { ScopedRateLimitGuard } from '../rate-limit/rate-limit.guard';
import { RateLimit } from '../rate-limit/rate-limit.decorator';

@Controller('visiwork')
@UseGuards(SupabaseAuthGuard)
export class VisiWorkController {
  constructor(
    @Inject(VisiWorkService)
    private readonly visiworkService: VisiWorkService,
  ) {}

  private validateCursor(cursor?: string): string | undefined {
    if (cursor === undefined) return undefined;
    if (!z.string().uuid().safeParse(cursor).success) {
      throw new BadRequestException('Invalid VisiWork chat cursor.');
    }
    return cursor;
  }

  @Put('presence')
  joinDepartment(
    @CurrentMember() member: Member,
    @Body() body: unknown,
  ) {
    const parsed = SetVisiWorkPresenceRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid VisiWork department.',
      );
    }
    return this.visiworkService.joinDepartment(member, parsed.data);
  }

  @Get('messages/search')
  @UseGuards(ScopedRateLimitGuard)
  @RateLimit({ scope: 'visiwork-search', limit: 60, windowSeconds: 60 })
  searchMessages(
    @CurrentMember() member: Member,
    @Query() query: unknown,
  ) {
    const parsed = VisiWorkMessageSearchQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid search.',
      );
    }
    return this.visiworkService.searchMessages(member, parsed.data);
  }

  @Get('messages/:messageId/context')
  messageContext(
    @CurrentMember() member: Member,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ) {
    return this.visiworkService.messageContext(member, messageId);
  }

  @Patch('messages/:messageId')
  updateMessage(
    @CurrentMember() member: Member,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
    @Body() body: unknown,
  ) {
    const parsed = UpdateVisiWorkMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid message.',
      );
    }
    return this.visiworkService.updateMessage(member, messageId, parsed.data);
  }

  @Delete('messages/:messageId')
  deleteMessage(
    @CurrentMember() member: Member,
    @Param('messageId', new ParseUUIDPipe({ version: '4' })) messageId: string,
  ) {
    return this.visiworkService.deleteMessage(member, messageId);
  }

  @Get('messages')
  listGeneralMessages(
    @CurrentMember() member: Member,
    @Query('cursor') cursor?: string,
  ) {
    return this.visiworkService.listMessages(
      member,
      undefined,
      this.validateCursor(cursor),
    );
  }

  @Post('messages')
  @UseGuards(ScopedRateLimitGuard)
  @RateLimit({ scope: 'visiwork-send', limit: 30, windowSeconds: 60 })
  sendGeneralMessage(
    @CurrentMember() member: Member,
    @Body() body: unknown,
  ) {
    const parsed = CreateVisiWorkMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid message.',
      );
    }
    return this.visiworkService.sendMessage(member, parsed.data);
  }

  @Get('departments/:departmentId/messages')
  listDepartmentMessages(
    @CurrentMember() member: Member,
    @Param('departmentId', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.visiworkService.listMessages(
      member,
      departmentId,
      this.validateCursor(cursor),
    );
  }

  @Post('departments/:departmentId/messages')
  @UseGuards(ScopedRateLimitGuard)
  @RateLimit({ scope: 'visiwork-send', limit: 30, windowSeconds: 60 })
  sendDepartmentMessage(
    @CurrentMember() member: Member,
    @Param('departmentId', new ParseUUIDPipe({ version: '4' }))
    departmentId: string,
    @Body() body: unknown,
  ) {
    const parsed = CreateVisiWorkMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid message.',
      );
    }
    return this.visiworkService.sendMessage(
      member,
      parsed.data,
      departmentId,
    );
  }
}
