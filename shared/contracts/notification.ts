import { z } from 'zod';
import { ProjectAccessLevelSchema } from './project';

export const NotificationTypeSchema = z.enum([
  'PROJECT_LEAD_ASSIGNED',
  'PROJECT_MEMBER_ACCESS_CHANGED',
  'OUTCOME_JOINED',
  'SUBMISSION_CREATED',
  'REVISION_REQUESTED',
  'OUTCOME_ACCEPTED',
  'OUTCOME_REOPENED',
  'DEPENDENCY_UNLOCKED',
  'VISIWORK_MENTION',
  'PROJECT_CHAT_MENTION',
]);

export const NotificationListQuerySchema = z
  .object({
    filter: z.enum(['all', 'unread', 'mentions', 'projects']).default('all'),
    cursor: z.string().uuid().optional(),
  })
  .strict();

const NotificationActorSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
});

const NotificationProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
});

const NotificationOutcomeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
});

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: NotificationTypeSchema,
  actor: NotificationActorSchema.nullable(),
  project: NotificationProjectSchema.nullable(),
  outcome: NotificationOutcomeSchema.nullable(),
  newAccessLevel: ProjectAccessLevelSchema.nullable(),
  projectChatMention: z
    .object({
      messageId: z.string().uuid(),
      preview: z.string(),
    })
    .nullable()
    .optional(),
  visiworkMention: z
    .object({
      messageId: z.string().uuid(),
      departmentId: z.string().uuid().nullable(),
      roomLabel: z.string().min(1),
      preview: z.string(),
    })
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
  readAt: z.string().datetime().nullable(),
});

export const NotificationListResponseSchema = z.object({
  items: z.array(NotificationSchema),
  nextCursor: z.string().uuid().nullable().optional(),
});

export const NotificationUnreadCountResponseSchema = z.object({
  count: z.number().int().nonnegative(),
});

export const NotificationReadResponseSchema = z.object({
  id: z.string().uuid(),
  readAt: z.string().datetime(),
});

export const NotificationReadAllResponseSchema = z.object({
  updatedCount: z.number().int().nonnegative(),
  readAt: z.string().datetime(),
});

export type NotificationType = z.infer<typeof NotificationTypeSchema>;
export type NotificationListQuery = z.infer<
  typeof NotificationListQuerySchema
>;
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationListResponse = z.infer<
  typeof NotificationListResponseSchema
>;
export type NotificationUnreadCountResponse = z.infer<
  typeof NotificationUnreadCountResponseSchema
>;
export type NotificationReadResponse = z.infer<
  typeof NotificationReadResponseSchema
>;
export type NotificationReadAllResponse = z.infer<
  typeof NotificationReadAllResponseSchema
>;
