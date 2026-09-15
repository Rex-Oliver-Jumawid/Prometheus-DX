import { z } from 'zod';

const TimestampSchema = z.string().datetime();

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('prometheus-api'),
  timestamp: TimestampSchema,
});

export const DatabaseHealthResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('reachable'),
  timestamp: TimestampSchema,
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type DatabaseHealthResponse = z.infer<
  typeof DatabaseHealthResponseSchema
>;
