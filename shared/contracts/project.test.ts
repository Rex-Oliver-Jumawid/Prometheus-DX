import { describe, expect, it } from 'vitest';
import { CreateProjectRequestSchema } from './project';

describe('CreateProjectRequestSchema', () => {
  const input = {
    name: 'Phase 3 Project',
    description: 'A persisted Project.',
    leadMemberId: '11111111-1111-4111-8111-111111111111',
    departmentIds: ['22222222-2222-4222-8222-222222222222'],
  };

  it('requires project details, a Lead, and a Department', () => {
    expect(CreateProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(CreateProjectRequestSchema.safeParse(input).success).toBe(true);
  });

  it('rejects duplicate Department IDs', () => {
    expect(
      CreateProjectRequestSchema.safeParse({
        ...input,
        departmentIds: [input.departmentIds[0], input.departmentIds[0]],
      }).success,
    ).toBe(false);
  });
});
