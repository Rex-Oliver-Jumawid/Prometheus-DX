import { Controller, Get, Headers, Inject } from '@nestjs/common';
import { requireScheduler } from '../common/require-scheduler';
import { PushDeliveryService } from './push-delivery.service';

@Controller('notifications/push')
export class PushWorkerController {
  constructor(
    @Inject(PushDeliveryService)
    private readonly deliveries: PushDeliveryService,
  ) {}
  @Get('run')
  async run(@Headers('authorization') authorization?: string) {
    requireScheduler(authorization);
    await this.deliveries.flushPendingDeliveries();
    return { success: true };
  }
}
