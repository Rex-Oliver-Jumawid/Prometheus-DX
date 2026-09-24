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

export const VisiWorkMessageAuthorSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
});

export const VisiWorkMessageSchema = z.object({
  id: z.string().uuid(),
  departmentId: z.string().uuid().nullable(),
  author: VisiWorkMessageAuthorSchema,
  body: z.string(),
  createdAt: z.string().datetime(),
});

export const VisiWorkMessagePageSchema = z.object({
  items: z.array(VisiWorkMessageSchema),
  nextCursor: z.string().uuid().nullable(),
  canWrite: z.boolean(),
});

export const CreateVisiWorkMessageSchema = z
  .object({
    body: z.string().trim().min(1, 'Enter a message.').max(2000),
  })
  .strict();

export type VisiWorkMessage = z.infer<typeof VisiWorkMessageSchema>;
export type VisiWorkMessagePage = z.infer<typeof VisiWorkMessagePageSchema>;
export type CreateVisiWorkMessage = z.infer<
  typeof CreateVisiWorkMessageSchema
>;

