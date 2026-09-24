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
  mentions: z.array(VisiWorkMessageAuthorSchema).default([]),
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
    mentionMemberIds: z.array(z.string().uuid()).max(20).default([]),
  })
  .strict();

export const VisiWorkMessageSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120),
    departmentId: z.string().uuid().optional(),
  })
  .strict();

export const VisiWorkMessageSearchResultSchema = VisiWorkMessageSchema;
export const VisiWorkMessageSearchResponseSchema = z.object({
  items: z.array(VisiWorkMessageSearchResultSchema),
});

export const VisiWorkMessageContextResponseSchema = z.object({
  targetMessageId: z.string().uuid(),
  departmentId: z.string().uuid().nullable(),
  items: z.array(VisiWorkMessageSchema),
});

export type VisiWorkMessage = z.infer<typeof VisiWorkMessageSchema>;
export type VisiWorkMessagePage = z.infer<typeof VisiWorkMessagePageSchema>;
export type CreateVisiWorkMessage = z.infer<
  typeof CreateVisiWorkMessageSchema
>;


export type VisiWorkMessageSearchQuery = z.infer<typeof VisiWorkMessageSearchQuerySchema>;
export type VisiWorkMessageSearchResponse = z.infer<typeof VisiWorkMessageSearchResponseSchema>;
export type VisiWorkMessageContextResponse = z.infer<typeof VisiWorkMessageContextResponseSchema>;
