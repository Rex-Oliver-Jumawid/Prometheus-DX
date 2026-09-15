import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { RegistryModule } from './registry/registry.module';

@Module({
  imports: [DatabaseModule, HealthModule, AuthModule, RegistryModule],
})
export class AppModule {}
