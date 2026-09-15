import { describe, expect, it } from 'vitest';
import { DatabaseHealthResponseSchema, HealthResponseSchema } from './health';

describe('foundation health contracts', () => {
  it('accepts a valid API health payload', () => {
    const result = HealthResponseSchema.safeParse({
      status: 'ok',
      service: 'prometheus-api',
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(true);
  });

  it('rejects an invalid database health payload', () => {
    const result = DatabaseHealthResponseSchema.safeParse({
      status: 'ok',
      database: 'unknown',
      timestamp: new Date().toISOString(),
    });

    expect(result.success).toBe(false);
  });
});
