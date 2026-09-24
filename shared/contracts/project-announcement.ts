import { z } from 'zod';
import { ProjectMemberSummarySchema } from './project';

export const ProjectAnnouncementSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  author: ProjectMemberSummarySchema,
  title: z.string(),
  body: z.string(),
  pinnedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProjectAnnouncementsResponseSchema = z.object({
  items: z.array(ProjectAnnouncementSchema),
  canManage: z.boolean(),
  canPost: z.boolean(),
});

export const CreateProjectAnnouncementSchema = z.object({
  title: z.string().trim().min(1, 'Enter an announcement title.').max(160),
  body: z.string().trim().min(1, 'Enter announcement details.').max(1200),
}).strict();

export const UpdateProjectAnnouncementPinSchema = z.object({
  pinned: z.boolean(),
}).strict();

export type ProjectAnnouncement = z.infer<typeof ProjectAnnouncementSchema>;
export type ProjectAnnouncementsResponse = z.infer<typeof ProjectAnnouncementsResponseSchema>;
export type CreateProjectAnnouncement = z.infer<typeof CreateProjectAnnouncementSchema>;
export type UpdateProjectAnnouncementPin = z.infer<typeof UpdateProjectAnnouncementPinSchema>;
