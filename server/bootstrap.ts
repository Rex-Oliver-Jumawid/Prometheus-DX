import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { serverEnvironment } from './config/env';

export const API_GLOBAL_PREFIX = 'api';

export function configureNestApplication(app: INestApplication): void {
  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableCors({
    origin: serverEnvironment.clientOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
}

export async function createNestApplication(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule);
  configureNestApplication(app);
  return app;
}
