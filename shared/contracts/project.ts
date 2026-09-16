import { z } from 'zod';

export const ProjectStatusSchema = z.enum([
  'PLANNING',
  'IN_PROGRESS',
  'DONE',
  'ARCHIVED',
]);

export const ProjectDepartmentSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  shortLabel: z.string().min(1).max(12),
});

export const ProjectMemberSummarySchema = z.object({
  id: z.string().uuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  status: ProjectStatusSchema,
  lead: ProjectMemberSummarySchema,
  creator: ProjectMemberSummarySchema,
  departments: z.array(ProjectDepartmentSummarySchema),
  doneAt: z.string().datetime().nullable(),
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProjectListResponseSchema = z.array(ProjectSchema);
export const ProjectDetailResponseSchema = ProjectSchema;

export const ProjectCreateOptionsResponseSchema = z.object({
  leads: z.array(ProjectMemberSummarySchema),
  departments: z.array(ProjectDepartmentSummarySchema),
});

export const CreateProjectRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a project name.'),
  description: z.string().trim().min(1, 'Enter a project description.'),
  leadMemberId: z.string().uuid('Choose an active Project Lead.'),
  departmentIds: z
    .array(z.string().uuid('Choose an existing department.'))
    .min(1, 'Choose at least one department.')
    .refine(
      (departmentIds) => new Set(departmentIds).size === departmentIds.length,
      {
        message: 'Choose each department only once.',
      },
    ),
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectDepartmentSummary = z.infer<
  typeof ProjectDepartmentSummarySchema
>;
export type ProjectMemberSummary = z.infer<typeof ProjectMemberSummarySchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;
export type ProjectDetailResponse = z.infer<typeof ProjectDetailResponseSchema>;
export type ProjectCreateOptionsResponse = z.infer<
  typeof ProjectCreateOptionsResponseSchema
>;
export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>;
