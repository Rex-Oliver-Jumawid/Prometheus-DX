import { z } from 'zod';

export const WorkspaceRoleSchema = z.enum(['ADMINISTRATOR', 'MEMBER']);
export const MemberStatusSchema = z.enum(['INVITED', 'ACTIVE', 'DEACTIVATED']);

export const CurrentMemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1),
  workspaceRole: WorkspaceRoleSchema,
  status: z.literal('ACTIVE'),
  position: z.string().nullable(),
  profileImagePath: z.string().nullable(),
  department: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    shortLabel: z.string().min(1),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UpdateCurrentMemberRequestSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    position: z.string().trim().max(120).nullable(),
    profileImagePath: z.string().trim().nullable().optional(),
  })
  .strict();

export const RegistryAccessResponseSchema = z.object({
  allowed: z.literal(true),
  phase: z.literal(1),
});

export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export type MemberStatus = z.infer<typeof MemberStatusSchema>;
export type CurrentMember = z.infer<typeof CurrentMemberSchema>;
export type UpdateCurrentMemberRequest = z.infer<
  typeof UpdateCurrentMemberRequestSchema
>;
