import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  CorrectWorkSessionRequestSchema,
  WorkSessionWeekQuerySchema,
} from '../../shared/contracts/work-session';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { WorkSessionsService } from './work-sessions.service';

@Controller('work-sessions')
@UseGuards(SupabaseAuthGuard)
export class WorkSessionsController {
  constructor(
    @Inject(WorkSessionsService)
    private readonly workSessionsService: WorkSessionsService,
  ) {}

  @Get('current')
  current(@CurrentMember() member: Member) {
    return this.workSessionsService.getCurrent(member);
  }

  @Post('time-in')
  timeIn(@CurrentMember() member: Member) {
    return this.workSessionsService.timeIn(member);
  }

  @Post('time-out')
  timeOut(@CurrentMember() member: Member) {
    return this.workSessionsService.timeOut(member);
  }

  @Get('history')
  history(@CurrentMember() member: Member, @Query() query: unknown) {
    const parsed = WorkSessionWeekQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message);
    }
    return this.workSessionsService.getHistory(member, parsed.data.week);
  }

  @Post(':workSessionId/corrections')
  correct(
    @CurrentMember() member: Member,
    @Param('workSessionId', new ParseUUIDPipe({ version: '4' }))
    workSessionId: string,
    @Body() body: unknown,
  ) {
    const parsed = CorrectWorkSessionRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid correction.',
      );
    }
    return this.workSessionsService.correct(member, workSessionId, parsed.data);
  }
}
