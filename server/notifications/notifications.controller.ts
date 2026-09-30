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
import { PushDeliveryService } from './push-delivery.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
    @Inject(PushDeliveryService)
    private readonly pushDeliveries: PushDeliveryService,
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
  async markAllRead(@CurrentMember() member: Member) {
    const response = await this.notifications.markAllRead(member.id);
    await this.pushDeliveries.flushAfterCommit();
    return response;
  }

  @Put(':id/read')
  async markRead(
    @CurrentMember() member: Member,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    const response = await this.notifications.markRead(member.id, id);
    await this.pushDeliveries.flushAfterCommit();
    return response;
  }
}
