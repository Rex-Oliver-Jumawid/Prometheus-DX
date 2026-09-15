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
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const RegistryAccessResponseSchema = z.object({
  allowed: z.literal(true),
  phase: z.literal(1),
});

export type WorkspaceRole = z.infer<typeof WorkspaceRoleSchema>;
export type MemberStatus = z.infer<typeof MemberStatusSchema>;
export type CurrentMember = z.infer<typeof CurrentMemberSchema>;
