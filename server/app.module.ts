import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RegistryModule } from './registry/registry.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    DatabaseModule,
    HealthModule,
    AuthModule,
    RegistryModule,
    ProjectsModule,
  ],
})
export class AppModule {}
