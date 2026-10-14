import { Module } from '@nestjs/common';
import { WorkSessionsController } from './work-sessions.controller';
import { WorkSessionsService } from './work-sessions.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkSessionIdleReminderService } from './work-session-idle-reminder.service';
import { WorkSessionIdleCronController } from './work-session-idle-cron.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [WorkSessionsController, WorkSessionIdleCronController],
  providers: [WorkSessionsService, WorkSessionIdleReminderService],
  exports: [WorkSessionsService],
})
export class WorkSessionsModule {}
