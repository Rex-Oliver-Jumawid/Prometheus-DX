import { z } from 'zod';

export const ApiErrorResponseSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
  error: z.string(),
  timestamp: z.string(),
  path: z.string(),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
