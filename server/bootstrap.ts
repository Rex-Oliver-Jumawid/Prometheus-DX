import 'reflect-metadata';
import { Logger, type INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { serverEnvironment } from './config/env';

export const API_GLOBAL_PREFIX = 'api';

const apiLogger = new Logger('ApiObservability');

export function configureNestApplication(app: INestApplication): void {
  app.use((request: Request, response: Response, next: NextFunction) => {
    const requestId = randomUUID();
    const started = performance.now();
    response.setHeader('X-Request-ID', requestId);
    response.once('finish', () => {
      const elapsed = Math.round(performance.now() - started);
      if (elapsed < 1_000 && response.statusCode < 500) return;
      // Route path only: never persist query strings, message bodies or auth headers.
      const route = request.path.replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      );
      apiLogger.warn(JSON.stringify({
        event: response.statusCode >= 500 ? 'api_error' : 'slow_api_request',
        requestId, method: request.method, route,
        statusCode: response.statusCode, durationMs: elapsed,
      }));
    });
    next();
  });
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
