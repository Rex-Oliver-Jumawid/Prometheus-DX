import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  DevicePushSubscriptionSchema,
  NotificationListQuerySchema,
} from '../../shared/contracts/notification';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  @Get()
  list(@CurrentMember() member: Member, @Query() query: unknown) {
    const parsed = NotificationListQuerySchema.safeParse(query);
    if (!parsed.success)
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid notification filter.',
      );
    return this.notifications.list(member.id, parsed.data);
  }

  @Get('unread-count')
  unreadCount(@CurrentMember() member: Member) {
    return this.notifications.unreadCount(member.id);
  }

  @Get('push/config')
  pushConfig() {
    return this.notifications.pushConfig();
  }

  @Put('push/subscription')
  subscribeDevice(@CurrentMember() member: Member, @Body() body: unknown) {
    const parsed = DevicePushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid push subscription.',
      );
    }
    return this.notifications.subscribeDevice(member.id, parsed.data);
  }

  @Delete('push/subscription')
  unsubscribeDevice(@CurrentMember() member: Member, @Body() body: unknown) {
    const parsed = DevicePushSubscriptionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid push subscription.',
      );
    }
    return this.notifications.unsubscribeDevice(member.id, parsed.data);
  }

  @Put('read-all')
  markAllRead(@CurrentMember() member: Member) {
    return this.notifications.markAllRead(member.id);
  }

  @Put(':id/read')
  markRead(
    @CurrentMember() member: Member,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.notifications.markRead(member.id, id);
  }
}
