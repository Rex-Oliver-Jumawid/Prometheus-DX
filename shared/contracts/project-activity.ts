import { z } from 'zod';

export const ProjectActivitySchema = z.object({
  id: z.string().uuid(),
  actor: z.object({
    id: z.string().uuid(),
    fullName: z.string(),
  }).nullable(),
  outcomeId: z.string().uuid().nullable(),
  outcomeTitle: z.string().nullable(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  action: z.string(),
  metadata: z.unknown(),
  createdAt: z.string().datetime(),
});

export const ProjectActivityPageSchema = z.object({
  items: z.array(ProjectActivitySchema),
  nextCursor: z.string().uuid().nullable(),
  scope: z.enum(['PROJECT', 'PERSONAL']),
});

export type ProjectActivity = z.infer<typeof ProjectActivitySchema>;
export type ProjectActivityPage = z.infer<typeof ProjectActivityPageSchema>;
