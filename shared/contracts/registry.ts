import { z } from 'zod';
import { MemberStatusSchema, WorkspaceRoleSchema } from './member';

export const RegistryDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortLabel: z.string().min(1).max(12),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RegistryDepartmentsResponseSchema = z.array(
  RegistryDepartmentSchema,
);

const DepartmentDetailsRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a department name.'),
  shortLabel: z
    .string()
    .trim()
    .max(12, 'Use 12 characters or fewer.')
    .optional()
    .default(''),
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((value) => (value ? value : null)),
});

export const CreateDepartmentRequestSchema = DepartmentDetailsRequestSchema;
export const UpdateDepartmentRequestSchema = DepartmentDetailsRequestSchema;

export type RegistryDepartment = z.infer<typeof RegistryDepartmentSchema>;
export type CreateDepartmentRequest = z.infer<
  typeof CreateDepartmentRequestSchema
>;
export type UpdateDepartmentRequest = z.infer<
  typeof UpdateDepartmentRequestSchema
>;
export type DepartmentFormValues = z.input<
  typeof DepartmentDetailsRequestSchema
>;

export const RegistryAuthenticationStatusSchema = z.enum([
  'SETUP_PENDING',
  'LINKED',
]);

export const RegistryInvitationDeliveryStatusSchema = z.enum([
  'NOT_SENT',
  'SENT',
]);

export const RegistryMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  departmentId: z.string().uuid(),
  department: z.object({
    id: z.string().uuid(),
    name: z.string(),
    shortLabel: z.string().min(1).max(12),
  }),
  position: z.string().nullable(),
  workspaceRole: WorkspaceRoleSchema,
  status: MemberStatusSchema,
  authenticationStatus: RegistryAuthenticationStatusSchema,
  invitationDeliveryStatus: RegistryInvitationDeliveryStatusSchema,
  invitationSentAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RegistryMembersResponseSchema = z.array(RegistryMemberSchema);

const MemberDetailsRequestSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the member's full name."),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  departmentId: z.string().uuid('Choose a department.'),
  position: z.string().trim().min(1, "Enter the member's position."),
  workspaceRole: WorkspaceRoleSchema,
  status: MemberStatusSchema,
});

export const CreateMemberRequestSchema = MemberDetailsRequestSchema.extend({
  status: z.literal('INVITED').default('INVITED'),
});
export const UpdateMemberRequestSchema = MemberDetailsRequestSchema;

export type RegistryMember = z.infer<typeof RegistryMemberSchema>;
export type CreateMemberRequest = z.infer<typeof CreateMemberRequestSchema>;
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;
export type MemberFormValues = z.input<typeof MemberDetailsRequestSchema>;
