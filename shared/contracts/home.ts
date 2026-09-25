import { z } from 'zod';
import { ProjectAccessLevelSchema, ProjectStatusSchema } from './project';
import { WORKSPACE_TIMEZONE } from './work-session';

export const HomeProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: ProjectStatusSchema,
  progressPercentage: z.number().int().min(0).max(100),
  relationship: z.enum(['LEAD', 'PARTICIPANT']),
  accessLevel: ProjectAccessLevelSchema.nullable(),
});

export const HomeWorkingMemberSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  profileImagePath: z.string().nullable(),
  department: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    shortLabel: z.string().min(1),
  }),
});

export const HomeAttentionItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['REVIEW', 'REVISION']),
  projectId: z.string().uuid(),
  outcomeId: z.string().uuid(),
  title: z.string().min(1),
  projectName: z.string().min(1),
  stageName: z.string().min(1),
  detail: z.string().nullable(),
});

export const HomeDashboardResponseSchema = z.object({
  timezone: z.literal(WORKSPACE_TIMEZONE),
  asOf: z.string().datetime(),
  summary: z.object({
    workingNow: z.number().int().nonnegative(),
    activeProjects: z.number().int().nonnegative(),
    totalProjects: z.number().int().nonnegative(),
    awaitingReview: z.number().int().nonnegative(),
    revisionRequests: z.number().int().nonnegative(),
    actualWorkedSeconds: z.number().int().nonnegative(),
    plannedMinutes: z.number().int().nonnegative(),
  }),
  projects: z.object({
    leading: z.array(HomeProjectSchema),
    participating: z.array(HomeProjectSchema),
  }),
  workingNow: z.array(HomeWorkingMemberSchema),
  needsAttention: z.array(HomeAttentionItemSchema),
});

export type HomeProject = z.infer<typeof HomeProjectSchema>;
export type HomeWorkingMember = z.infer<typeof HomeWorkingMemberSchema>;
export type HomeAttentionItem = z.infer<typeof HomeAttentionItemSchema>;
export type HomeDashboardResponse = z.infer<typeof HomeDashboardResponseSchema>;
