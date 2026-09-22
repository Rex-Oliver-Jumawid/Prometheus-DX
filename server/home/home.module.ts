import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { WorkSessionsModule } from '../work-sessions/work-sessions.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [ProjectsModule, WorkSessionsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
