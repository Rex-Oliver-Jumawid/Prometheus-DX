import { Module } from '@nestjs/common';
import { WorkSessionsModule } from '../work-sessions/work-sessions.module';
import { TeamController } from './team.controller';
import { TeamService } from './team.service';

@Module({
  imports: [WorkSessionsModule],
  controllers: [TeamController],
  providers: [TeamService],
})
export class TeamModule {}
