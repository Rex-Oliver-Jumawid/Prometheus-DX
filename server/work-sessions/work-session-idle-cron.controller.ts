import {
  Controller,
  Get,
  Headers,
  Inject,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { serverEnvironment } from '../config/env';
import { WorkSessionIdleReminderService } from './work-session-idle-reminder.service';

@Controller('work-sessions/idle-reminders')
export class WorkSessionIdleCronController {
  constructor(
    @Inject(WorkSessionIdleReminderService)
    private readonly reminders: WorkSessionIdleReminderService,
  ) {}

  @Get('run')
  run(@Headers('authorization') authorization?: string) {
    // Unlike a member endpoint, this is exclusively for a scheduler. Never
    // accept an unauthenticated request, even in development.
    const secret = serverEnvironment.cronSecret;
    if (!secret) {
      throw new ServiceUnavailableException('The idle reminder scheduler is not configured.');
    }
    const expected = Buffer.from('Bearer ' + secret, 'utf8');
    const provided = Buffer.from(authorization ?? '', 'utf8');
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      throw new UnauthorizedException('Invalid scheduler credentials.');
    }
    return this.reminders.deliverDueReminders();
  }
}
