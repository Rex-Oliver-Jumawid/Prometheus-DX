import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushDeliveryInterceptor } from './push-delivery.interceptor';
import { PushDeliveryService } from './push-delivery.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    PushDeliveryService,
    {
      provide: APP_INTERCEPTOR,
      useClass: PushDeliveryInterceptor,
    },
  ],
})
export class NotificationsModule {}
