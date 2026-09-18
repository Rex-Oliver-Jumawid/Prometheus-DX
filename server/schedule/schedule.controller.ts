import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { Member } from '@prisma/client';
import {
  UpdateScheduleRequestSchema,
  type UpdateScheduleRequest,
} from '../../shared/contracts/schedule';
import { CurrentMember } from '../auth/current-member.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { ScheduleService } from './schedule.service';

@Controller('schedule')
@UseGuards(SupabaseAuthGuard)
export class ScheduleController {
  constructor(
    @Inject(ScheduleService) private readonly scheduleService: ScheduleService,
  ) {}

  @Get('team')
  teamSchedule() {
    return this.scheduleService.getTeamSchedule();
  }

  @Get('me')
  mySchedule(@CurrentMember() currentMember: Member) {
    return this.scheduleService.getMemberSchedule(currentMember.id);
  }

  @Put('me')
  updateMySchedule(
    @CurrentMember() currentMember: Member,
    @Body() body: unknown,
  ) {
    return this.scheduleService.replaceMemberSchedule(
      currentMember,
      currentMember.id,
      this.parseUpdate(body),
    );
  }

  @Put('members/:memberId')
  updateMemberSchedule(
    @CurrentMember() currentMember: Member,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body() body: unknown,
  ) {
    if (currentMember.id !== memberId) {
      throw new ForbiddenException('You can only change your own schedule.');
    }
    return this.scheduleService.replaceMemberSchedule(
      currentMember,
      memberId,
      this.parseUpdate(body),
    );
  }

  private parseUpdate(body: unknown): UpdateScheduleRequest {
    const parsed = UpdateScheduleRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues[0]?.message ?? 'Invalid schedule data.',
      );
    }
    return parsed.data;
  }
}
