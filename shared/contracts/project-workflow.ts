import { z } from 'zod';
import {
  ProjectAccessLevelSchema,
  ProjectDepartmentSummarySchema,
  ProjectMemberSummarySchema,
} from './project';

export const ProjectMemberOutcomeSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
});

export const ProjectMemberSchema = z.object({
  member: ProjectMemberSummarySchema,
  accessLevel: ProjectAccessLevelSchema,
  outcomes: z.array(ProjectMemberOutcomeSchema),
});

export const ProjectMembersResponseSchema = z.object({
  projectId: z.string().uuid(),
  canManageAccess: z.boolean(),
  members: z.array(ProjectMemberSchema),
});

export const UpdateProjectMemberAccessRequestSchema = z.object({
  accessLevel: ProjectAccessLevelSchema,
});

export const OutcomeLifecycleStatusSchema = z.enum([
  'OPEN',
  'NEEDS_REVISION',
  'ACCEPTED',
]);

export const AcceptanceCriterionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1),
  position: z.number().int().nonnegative(),
});

export const OutcomePrerequisiteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  lifecycleStatus: OutcomeLifecycleStatusSchema,
  resolved: z.boolean(),
});

export const OutcomeSchema = z.object({
  id: z.string().uuid(),
  stageId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().nullable(),
  lifecycleStatus: OutcomeLifecycleStatusSchema,
  position: z.number().int().nonnegative(),
  departments: z.array(ProjectDepartmentSummarySchema),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  prerequisites: z.array(OutcomePrerequisiteSchema),
  members: z.array(ProjectMemberSummarySchema),
  isLocked: z.boolean(),
  isJoined: z.boolean(),
  hasForReview: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const StageSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  position: z.number().int().nonnegative(),
  outcomes: z.array(OutcomeSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ProjectWorkflowResponseSchema = z.object({
  projectId: z.string().uuid(),
  canManageStructure: z.boolean(),
  stages: z.array(StageSchema),
});

const StageFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Enter a stage name.').max(80),
  description: z.string().trim().max(1000).nullable().optional(),
});

export const CreateStageRequestSchema = StageFieldsSchema;
export const UpdateStageRequestSchema = StageFieldsSchema;

const uniqueUuidArray = (
  message: string,
  minimum = 0,
  minMessage = 'Choose at least one responsible department.',
) =>
  z
    .array(z.string().uuid(message))
    .min(minimum, minMessage)
    .refine((values) => new Set(values).size === values.length, {
      message: 'Choose each item only once.',
    });

const OutcomeFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Enter an outcome title.').max(160),
  description: z.string().trim().max(4000).nullable().optional(),
  departmentIds: uniqueUuidArray('Choose an existing department.', 1),
  acceptanceCriteria: z
    .array(
      z.string().trim().min(1, 'Acceptance criteria cannot be empty.').max(500),
    )
    .min(1, 'Add at least one acceptance criterion.')
    .max(30),
  prerequisiteOutcomeIds: uniqueUuidArray(
    'Choose an existing prerequisite outcome.',
  ).default([]),
  memberIds: uniqueUuidArray('Choose an existing member.').default([]),
});

export const CreateOutcomeRequestSchema = OutcomeFieldsSchema;
export const UpdateOutcomeRequestSchema = OutcomeFieldsSchema;

export type OutcomeLifecycleStatus = z.infer<
  typeof OutcomeLifecycleStatusSchema
>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type ProjectWorkflowResponse = z.infer<
  typeof ProjectWorkflowResponseSchema
>;
export type CreateStageRequest = z.infer<typeof CreateStageRequestSchema>;
export type UpdateStageRequest = z.infer<typeof UpdateStageRequestSchema>;
export type CreateOutcomeRequest = z.infer<typeof CreateOutcomeRequestSchema>;
export type UpdateOutcomeRequest = z.infer<typeof UpdateOutcomeRequestSchema>;
export type ProjectMember = z.infer<typeof ProjectMemberSchema>;
export type ProjectMembersResponse = z.infer<typeof ProjectMembersResponseSchema>;
export type UpdateProjectMemberAccessRequest = z.infer<
  typeof UpdateProjectMemberAccessRequestSchema
>;
