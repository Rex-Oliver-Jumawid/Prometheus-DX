import { z } from 'zod';
import { ProjectMemberSummarySchema } from './project';

export const ProjectMessageSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  author: ProjectMemberSummarySchema,
  parentMessageId: z.string().uuid().nullable(),
  replyTo: z.object({
    id: z.string().uuid(),
    authorName: z.string(),
    preview: z.string(),
  }).nullable(),
  body: z.string(),
  createdAt: z.string().datetime(),
  editedAt: z.string().datetime().nullable(),
  canEdit: z.boolean(),
});

export const ProjectMessagePageSchema = z.object({
  items: z.array(ProjectMessageSchema),
  nextCursor: z.string().uuid().nullable(),
  canWrite: z.boolean(),
});

export const CreateProjectMessageSchema = z.object({
  body: z.string().trim().min(1, 'Enter a message.').max(4000),
  parentMessageId: z.string().uuid().nullable().default(null),
}).strict();

export const EditProjectMessageSchema = z.object({
  body: z.string().trim().min(1, 'Enter a message.').max(4000),
}).strict();

export type ProjectMessage = z.infer<typeof ProjectMessageSchema>;
export type ProjectMessagePage = z.infer<typeof ProjectMessagePageSchema>;
export type CreateProjectMessage = z.infer<typeof CreateProjectMessageSchema>;
export type EditProjectMessage = z.infer<typeof EditProjectMessageSchema>;
