import { z } from 'zod';

export const ProjectStatusSchema = z.enum([
  'PLANNING',
  'IN_PROGRESS',
  'DONE',
  'ARCHIVED',
]);

export const ProjectAccessLevelSchema = z.enum(['CAN_VIEW', 'CAN_EDIT']);

export const ProjectVentureSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  shortLabel: z.string().min(1).max(12),
});

export const ProjectMemberSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  profileImagePath: z.string().nullable().optional(),
});

export const ProjectStageSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  openOutcomesCount: z.number().int().nonnegative(),
});

export const ProjectMetricsSchema = z.object({
  totalOutcomes: z.number().int().nonnegative(),
  openOutcomes: z.number().int().nonnegative(),
  acceptedOutcomes: z.number().int().nonnegative(),
  activeStagesCount: z.number().int().nonnegative(),
  activeStages: z.array(ProjectStageSummarySchema),
  progressPercentage: z.number().int().min(0).max(100),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  status: ProjectStatusSchema,
  lead: ProjectMemberSummarySchema,
  creator: ProjectMemberSummarySchema,
  ventures: z.array(ProjectVentureSummarySchema),
  isParticipating: z.boolean(),
  currentMemberAccess: ProjectAccessLevelSchema.nullable(),
  canChangeStatus: z.boolean(),
  doneAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metrics: ProjectMetricsSchema.optional(),
});

export const ProjectListResponseSchema = z.array(ProjectSchema);
export const ProjectDetailResponseSchema = ProjectSchema;

export const ProjectCreateOptionsResponseSchema = z.object({
  leads: z.array(ProjectMemberSummarySchema),
  ventures: z.array(ProjectVentureSummarySchema),
});

export const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.'),
  description: z.string().trim().min(1, 'Enter a project description.'),
  leadMemberId: z.string().uuid('Choose an active Project Lead.'),
  ventureIds: z
    .array(z.string().uuid('Choose an existing venture.'))
    .refine(
      (ventureIds) => new Set(ventureIds).size === ventureIds.length,
      {
        message: 'Choose each venture only once.',
      },
    ),
});

export const UpdateProjectRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.').max(160),
  description: z.string().trim().min(1, 'Enter a project description.').max(4000),
});

export const UpdateProjectStatusRequestSchema = z.object({
  status: z.enum(['PLANNING', 'IN_PROGRESS', 'DONE']),
});

export const ProjectStatusUpdateResponseSchema = z.object({
  id: z.string().uuid(),
  status: ProjectStatusSchema,
  doneAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export const DeleteProjectResponseSchema = z.object({
  success: z.literal(true),
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectAccessLevel = z.infer<typeof ProjectAccessLevelSchema>;
export type ProjectVentureSummary = z.infer<
  typeof ProjectVentureSummarySchema
>;
export type ProjectMemberSummary = z.infer<typeof ProjectMemberSummarySchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof ProjectDetailResponseSchema>;
export type ProjectCreateOptionsResponse = z.infer<
  typeof ProjectCreateOptionsResponseSchema
>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>;
export type UpdateProjectStatusRequest = z.infer<
  typeof UpdateProjectStatusRequestSchema
>;
export type ProjectStatusUpdateResponse = z.infer<
  typeof ProjectStatusUpdateResponseSchema
>;
export type DeleteProjectResponse = z.infer<typeof DeleteProjectResponseSchema>;
export type ProjectStageSummary = z.infer<typeof ProjectStageSummarySchema>;
export type ProjectMetrics = z.infer<typeof ProjectMetricsSchema>;

export const UpdateProjectVenturesRequestSchema = z.object({ ventureIds: z.array(z.string().uuid()).max(50).refine(v => new Set(v).size === v.length) }).strict();
