import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(SupabaseAuthGuard)
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  list(@CurrentMember() currentMember: Member) {
    return this.notificationsService.list(currentMember);
  }

  @Get('unread-count')
  unreadCount(@CurrentMember() currentMember: Member) {
    return this.notificationsService.unreadCount(currentMember);
  }

  @Put('read-all')
  markAllRead(@CurrentMember() currentMember: Member) {
    return this.notificationsService.markAllRead(currentMember);
  }

  @Put(':notificationId/read')
  markRead(
    @CurrentMember() currentMember: Member,
    @Param('notificationId', new ParseUUIDPipe({ version: '4' }))
    notificationId: string,
  ) {
    return this.notificationsService.markRead(currentMember, notificationId);
  }
}
