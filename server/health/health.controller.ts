import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DatabaseHealthResponseSchema,
  HealthResponseSchema,
  type DatabaseHealthResponse,
  type HealthResponse,
} from '../../shared/contracts/health';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get()
  health(): HealthResponse {
    return HealthResponseSchema.parse({
      status: 'ok',
      service: 'prometheus-api',
      timestamp: new Date().toISOString(),
    });
  }

  @Get('database')
  async database(): Promise<DatabaseHealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return DatabaseHealthResponseSchema.parse({
        status: 'ok',
        database: 'reachable',
        timestamp: new Date().toISOString(),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Database is currently unavailable.',
      );
    }
  }
}
