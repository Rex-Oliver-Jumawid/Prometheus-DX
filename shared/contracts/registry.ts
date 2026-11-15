import { z } from 'zod';
import { MemberStatusSchema, WorkspaceRoleSchema } from './member';

export const RegistryVentureSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  shortLabel: z.string().min(1).max(12),
  description: z.string().nullable(),
  memberCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  outcomeCount: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RegistryVenturesResponseSchema = z.array(
  RegistryVentureSchema,
);

export const DeleteVentureResponseSchema = z.object({
  id: z.string().uuid(),
});

export const RemoveMemberResponseSchema = z.object({
  id: z.string().uuid(),
});

export const CompleteAccountSetupRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
});

export const CompleteAccountSetupResponseSchema = z.object({
  readyToSignIn: z.literal(true),
});

const VentureDetailsRequestSchema = z.object({
  name: z.string().trim().min(1, 'Enter a venture name.'),
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

export const CreateVentureRequestSchema = VentureDetailsRequestSchema;
export const UpdateVentureRequestSchema = VentureDetailsRequestSchema;

export type RegistryVenture = z.infer<typeof RegistryVentureSchema>;
export type DeleteVentureResponse = z.infer<
  typeof DeleteVentureResponseSchema
>;
export type RemoveMemberResponse = z.infer<typeof RemoveMemberResponseSchema>;
export type CompleteAccountSetupRequest = z.infer<
  typeof CompleteAccountSetupRequestSchema
>;
export type CompleteAccountSetupResponse = z.infer<
  typeof CompleteAccountSetupResponseSchema
>;
export type CreateVentureRequest = z.infer<
  typeof CreateVentureRequestSchema
>;
export type UpdateVentureRequest = z.infer<
  typeof UpdateVentureRequestSchema
>;
export type VentureFormValues = z.input<
  typeof VentureDetailsRequestSchema
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
  ventures: z.array(z.object({ id: z.string().uuid(), name: z.string(), shortLabel: z.string() })).optional(),
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  profileImagePath: z.string().nullable(),
  ventureId: z.string().uuid().nullable(),
  venture: z.object({
    id: z.string().uuid(),
    name: z.string(),
    shortLabel: z.string().min(1).max(12),
  }).nullable(),
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

export const RegistryOverviewResponseSchema = z.object({
  ventures: RegistryVenturesResponseSchema,
  members: RegistryMembersResponseSchema,
});

const MemberDetailsRequestSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the member's full name."),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  ventureId: z.string().uuid('Choose a venture.').nullable().default(null),
  position: z.string().trim().min(1, "Enter the member's position."),
  workspaceRole: WorkspaceRoleSchema,
  status: MemberStatusSchema,
});

export const CreateMemberRequestSchema = MemberDetailsRequestSchema.extend({
  status: z.literal('INVITED').default('INVITED'),
});
export const UpdateMemberRequestSchema = MemberDetailsRequestSchema;

export type RegistryMember = z.infer<typeof RegistryMemberSchema>;
export type RegistryOverviewResponse = z.infer<
  typeof RegistryOverviewResponseSchema
>;
export type CreateMemberRequest = z.infer<typeof CreateMemberRequestSchema>;
export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;
export type MemberFormValues = z.input<typeof MemberDetailsRequestSchema>;
