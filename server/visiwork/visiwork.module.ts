import { Module } from '@nestjs/common';
import { VisiWorkController } from './visiwork.controller';
import { VisiWorkService } from './visiwork.service';

@Module({
  controllers: [VisiWorkController],
  providers: [VisiWorkService],
})
export class VisiWorkModule {}
