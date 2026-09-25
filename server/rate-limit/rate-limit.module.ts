import { Global, Module } from '@nestjs/common';
import { ScopedRateLimitGuard } from './rate-limit.guard';

@Global()
@Module({
  providers: [ScopedRateLimitGuard],
  exports: [ScopedRateLimitGuard],
})
export class RateLimitModule {}
