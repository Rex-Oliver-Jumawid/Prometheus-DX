import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WorkSessionWeekQuerySchema } from '../../shared/contracts/work-session';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { TeamService } from './team.service';

@Controller('team')
@UseGuards(SupabaseAuthGuard)
export class TeamController {
  constructor(@Inject(TeamService) private readonly teamService: TeamService) {}

  @Get()
  getSummary(@Query() query: unknown) {
    const parsed = WorkSessionWeekQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message);
    }
    return this.teamService.getSummary(parsed.data.week);
  }
}
