import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { serverEnvironment } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: serverEnvironment.clientOrigins,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(serverEnvironment.port, '0.0.0.0');
}

void bootstrap();
