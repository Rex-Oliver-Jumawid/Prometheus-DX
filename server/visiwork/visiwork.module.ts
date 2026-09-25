import { Module } from '@nestjs/common';
import { ApiRateLimitGuard } from '../common/rate-limit';
import { VisiWorkController } from './visiwork.controller';
import { VisiWorkService } from './visiwork.service';

@Module({
  controllers: [VisiWorkController],
  providers: [VisiWorkService, ApiRateLimitGuard],
})
export class VisiWorkModule {}
