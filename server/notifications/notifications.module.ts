import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushDeliveryInterceptor } from './push-delivery.interceptor';
import { PushDeliveryService } from './push-delivery.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDeliveryService,
    PushDeliveryInterceptor,
  ],
  exports: [PushDeliveryService],
})
export class NotificationsModule {}
