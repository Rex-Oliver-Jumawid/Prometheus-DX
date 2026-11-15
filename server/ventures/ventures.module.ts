import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VenturesController } from './ventures.controller';
import { VenturesService } from './ventures.service';

@Module({
  imports: [AuthModule],
  controllers: [VenturesController],
  providers: [VenturesService],
})
export class VenturesModule {}
