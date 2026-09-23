import { z } from 'zod';

export const SetVisiWorkPresenceRequestSchema = z
  .object({
    departmentId: z.string().uuid('Choose an existing department.'),
  })
  .strict();

export const VisiWorkPresenceResponseSchema = z.object({
  memberId: z.string().uuid(),
  departmentId: z.string().uuid(),
});

export type SetVisiWorkPresenceRequest = z.infer<
  typeof SetVisiWorkPresenceRequestSchema
>;
export type VisiWorkPresenceResponse = z.infer<
  typeof VisiWorkPresenceResponseSchema
>;
