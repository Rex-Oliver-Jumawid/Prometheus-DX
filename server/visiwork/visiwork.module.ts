import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { VisiWorkController } from './visiwork.controller';
import { VisiWorkService } from './visiwork.service';

@Module({
  imports: [NotificationsModule],
  controllers: [VisiWorkController],
  providers: [VisiWorkService],
})
export class VisiWorkModule {}
