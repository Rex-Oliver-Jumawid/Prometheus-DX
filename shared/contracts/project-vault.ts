import { z } from 'zod';

export const VaultItemKindSchema = z.enum([
  'ENV_FILE', 'API_KEY', 'CREDENTIAL', 'SECURE_NOTE', 'FILE',
]);
export const VaultEnvironmentSchema = z.enum([
  'GENERAL', 'DEVELOPMENT', 'STAGING', 'PRODUCTION',
]);
export const VaultContentSchema = z.string().min(4).max(349528)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, 'Provide a valid base64 payload.');

export const SaveVaultItemRequestSchema = z.object({
  title: z.string().trim().min(1).max(160),
  kind: VaultItemKindSchema,
  environment: VaultEnvironmentSchema,
  description: z.string().trim().max(1000),
  fileName: z.string().trim().min(1).max(180).regex(/^[^/\\]+$/).nullable(),
  contentBase64: VaultContentSchema,
});
export const SetVaultGrantRequestSchema = z.object({
  approved: z.boolean(),
});
export const RevealVaultRequestSchema = z.object({
  purpose: z.enum(['REVEAL', 'DOWNLOAD']).default('REVEAL'),
});

export const VaultItemSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string(),
  kind: VaultItemKindSchema,
  environment: VaultEnvironmentSchema,
  description: z.string(),
  fileName: z.string().nullable(),
  currentVersion: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const VaultListResponseSchema = z.object({
  items: z.array(VaultItemSchema),
  canWrite: z.boolean(),
});
export const VaultAccessMemberSchema = z.object({
  memberId: z.string().uuid(),
  name: z.string(),
  accessLevel: z.enum(['CAN_VIEW', 'CAN_EDIT']),
  approved: z.boolean(),
});
export const VaultAccessResponseSchema = z.object({
  isLead: z.boolean(),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  members: z.array(VaultAccessMemberSchema),
});
export const VaultRevealResponseSchema = z.object({
  contentBase64: z.string(),
  fileName: z.string().nullable(),
  kind: VaultItemKindSchema,
});
export const VaultVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
  createdAt: z.string().datetime(),
  byteLength: z.number().int().positive(),
});
export const VaultVersionsResponseSchema = z.object({
  versions: z.array(VaultVersionSchema),
});

export type SaveVaultItemRequest = z.infer<typeof SaveVaultItemRequestSchema>;
export type VaultItem = z.infer<typeof VaultItemSchema>;
export type VaultItemKind = z.infer<typeof VaultItemKindSchema>;
