import { describe, expect, it } from 'vitest';
import { SaveVaultItemRequestSchema, SetVaultGrantRequestSchema } from './project-vault';

const valid = {
  title: 'Production .env', kind: 'ENV_FILE', environment: 'PRODUCTION',
  description: 'Secrets for deployment', fileName: '.env.production',
  contentBase64: Buffer.from('KEY=test').toString('base64'),
};
describe('Project Vault request contracts', () => {
  it('accepts a correctly scoped vault file', () => {
    expect(SaveVaultItemRequestSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects empty payloads and invalid type/environment', () => {
    expect(SaveVaultItemRequestSchema.safeParse({ ...valid, contentBase64: '' }).success).toBe(false);
    expect(SaveVaultItemRequestSchema.safeParse({ ...valid, kind: 'SECRET_ADMIN' }).success).toBe(false);
    expect(SaveVaultItemRequestSchema.safeParse({ ...valid, environment: 'CUSTOM' }).success).toBe(false);
  });
  it('rejects oversized payload strings and path-like filenames', () => {
    expect(SaveVaultItemRequestSchema.safeParse({ ...valid, contentBase64: 'A'.repeat(349532) }).success).toBe(false);
    expect(SaveVaultItemRequestSchema.safeParse({ ...valid, fileName: '../.env' }).success).toBe(false);
  });
  it('requires a boolean for a lead approval change', () => {
    expect(SetVaultGrantRequestSchema.safeParse({ approved: true }).success).toBe(true);
    expect(SetVaultGrantRequestSchema.safeParse({ approved: 'true' }).success).toBe(false);
  });
});
