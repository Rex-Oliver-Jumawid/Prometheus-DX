import { z } from 'zod';
import { ProjectMemberSummarySchema } from './project';

export const ProjectMessageSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  outcomeId: z.string().uuid().nullable().default(null),
  author: ProjectMemberSummarySchema,
  parentMessageId: z.string().uuid().nullable(),
  replyTo: z.object({
    id: z.string().uuid(),
    authorName: z.string(),
    preview: z.string(),
  }).nullable(),
  body: z.string(),
  mentions: z.array(z.object({ id: z.string().uuid(), fullName: z.string() })).default([]),
  deletedAt: z.string().datetime().nullable().default(null),
  canDelete: z.boolean().default(false),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  canEdit: z.boolean(),
});

export const ProjectMessagePageSchema = z.object({
  items: z.array(ProjectMessageSchema),
  nextCursor: z.string().uuid().nullable(),
  canWrite: z.boolean(),
});

export const ProjectMessageSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
}).strict();

export const ProjectMessageSearchResponseSchema = z.object({ items: z.array(ProjectMessageSchema) });
export const ProjectMessageContextResponseSchema = z.object({
  targetMessageId: z.string().uuid(),
  items: z.array(ProjectMessageSchema),
});

export const DeleteProjectMessageSchema = z.object({
  expectedEditedAt: z.string().datetime().nullable(),
}).strict();

export const CreateProjectMessageSchema = z.object({
  body: z.string().trim().min(1, 'Enter a message.').max(4000),
  parentMessageId: z.string().uuid().nullable().default(null),
  mentionMemberIds: z.array(z.string().uuid()).max(20).default([]),
}).strict();

export const EditProjectMessageSchema = z.object({
  body: z.string().trim().min(1, 'Enter a message.').max(4000),
  expectedEditedAt: z.string().datetime().nullable(),
  mentionMemberIds: z.array(z.string().uuid()).max(20).optional(),
}).strict();

export type ProjectMessage = z.infer<typeof ProjectMessageSchema>;
export type ProjectMessagePage = z.infer<typeof ProjectMessagePageSchema>;
export type CreateProjectMessage = z.input<typeof CreateProjectMessageSchema>;
export type EditProjectMessage = z.input<typeof EditProjectMessageSchema>;
export type DeleteProjectMessage = z.infer<typeof DeleteProjectMessageSchema>;
export type ProjectMessageSearchQuery = z.infer<typeof ProjectMessageSearchQuerySchema>;
