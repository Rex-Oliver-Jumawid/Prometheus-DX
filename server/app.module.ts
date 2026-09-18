import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RegistryModule } from './registry/registry.module';
import { ProjectsModule } from './projects/projects.module';
import { ScheduleModule } from './schedule/schedule.module';
import { TeamModule } from './team/team.module';
import { WorkSessionsModule } from './work-sessions/work-sessions.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    AuthModule,
    RegistryModule,
    ProjectsModule,
    ScheduleModule,
    WorkSessionsModule,
    TeamModule,
    NotificationsModule,
  ],
})
export class AppModule {}
