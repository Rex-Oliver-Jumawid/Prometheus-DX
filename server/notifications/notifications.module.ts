import { PushWorkerController } from './push-worker.controller';
import { PushDeliveryService } from './push-delivery.service';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  controllers: [NotificationsController, PushWorkerController],
  providers: [NotificationsService, PushDeliveryService],
  exports: [PushDeliveryService],
})
export class NotificationsModule {}
