import { z } from 'zod';

export const VentureRoleSchema = z.enum(['CEO', 'CTO', 'COO', 'DEVOPS']);
export const VenturePermissionSchema = z.enum([
  'venture.manage',
  'venture.members.manage',
]);
export const VentureSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    shortLabel: z.string().trim().min(1).max(12),
    description: z.string().trim().max(2000).nullable(),
    parentId: z.string().uuid().nullable(),
    status: z.enum(['ACTIVE', 'ARCHIVED']),
  })
  .strict();
export const VentureMembershipRequestSchema = z
  .object({
    memberId: z.string().uuid(),
    founder: z.boolean(),
    roles: z
      .array(VentureRoleSchema)
      .max(4)
      .refine((v) => new Set(v).size === v.length, 'Choose each role once.'),
    permissions: z
      .array(VenturePermissionSchema)
      .max(2)
      .refine(
        (v) => new Set(v).size === v.length,
        'Choose each permission once.',
      ),
    active: z.boolean(),
  })
  .strict();
export const VentureSummarySchema = VentureSettingsSchema.extend({
  id: z.string().uuid(),
  canManage: z.boolean(),
  canManageMembers: z.boolean(),
  canGrantPermissions: z.boolean(),
});
export const VentureMembershipSchema = VentureMembershipRequestSchema.extend({
  id: z.string().uuid(),
  fullName: z.string(),
  memberStatus: z.string(),
  joinedAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
});
export const VentureDetailSchema = z.object({
  venture: VentureSummarySchema,
  members: z.array(VentureMembershipSchema),
  candidates: z.array(
    z.object({ id: z.string().uuid(), fullName: z.string() }),
  ),
  history: z.array(
    z.object({
      id: z.string().uuid(),
      action: z.string(),
      createdAt: z.string().datetime(),
    }),
  ),
});
export const VentureListSchema = z.array(VentureSummarySchema);
export type VentureSettings = z.infer<typeof VentureSettingsSchema>;
export type VentureMembershipRequest = z.infer<
  typeof VentureMembershipRequestSchema
>;
export type VentureSummary = z.infer<typeof VentureSummarySchema>;
export type VentureDetail = z.infer<typeof VentureDetailSchema>;

export const VentureWriteResponseSchema = z.object({ id: z.string().uuid() });
