import type { INestApplication } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { requestMetrics } from './common/middleware/request-metrics';
import { serverEnvironment } from './config/env';
import { API_GLOBAL_PREFIX, configureNestApplication } from './bootstrap';

describe('configureNestApplication', () => {
  it('applies the shared API prefix, CORS policy, and exception filter', () => {
    const setGlobalPrefix = vi.fn();
    const enableCors = vi.fn();
    const useGlobalFilters = vi.fn();
    const use = vi.fn();
    const app = {
      setGlobalPrefix,
      enableCors,
      useGlobalFilters,
      use,
    } as unknown as INestApplication;

    configureNestApplication(app);

    expect(setGlobalPrefix).toHaveBeenCalledWith(API_GLOBAL_PREFIX);
    expect(use).toHaveBeenCalledWith(requestMetrics);
    expect(enableCors).toHaveBeenCalledWith({
      origin: serverEnvironment.clientOrigins,
      credentials: true,
    });
    expect(useGlobalFilters).toHaveBeenCalledWith(
      expect.any(AllExceptionsFilter),
    );
  });
});
