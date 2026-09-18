import { z } from 'zod';

export const NotificationTypeSchema = z.enum([
  'OUTCOME_JOINED',
  'SUBMISSION_CREATED',
  'REVISION_REQUESTED',
  'OUTCOME_ACCEPTED',
]);

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  project: z.object({ id: z.string().uuid(), name: z.string() }),
  outcome: z.object({ id: z.string().uuid(), title: z.string() }).nullable(),
  actor: z.object({ id: z.string().uuid(), fullName: z.string() }).nullable(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationSchema),
});

export const UnreadNotificationCountSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type NotificationView = z.infer<typeof NotificationSchema>;
export type NotificationListResponse = z.infer<
  typeof NotificationListResponseSchema
>;
export type UnreadNotificationCount = z.infer<
  typeof UnreadNotificationCountSchema
>;
