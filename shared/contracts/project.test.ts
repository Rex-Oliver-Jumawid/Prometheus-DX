import { describe, expect, it } from 'vitest';
import {
  CreateProjectRequestSchema,
  ProjectCreateOptionsResponseSchema,
  ProjectStatusUpdateResponseSchema,
  UpdateProjectStatusRequestSchema,
} from './project';

describe('CreateProjectRequestSchema', () => {
  const input = {
    name: 'Phase 3 Project',
    description: 'A persisted Project.',
    leadMemberId: '11111111-1111-4111-8111-111111111111',
    ventureIds: ['22222222-2222-4222-8222-222222222222'],
  };

  it('requires project details and a Lead; venture grouping is optional', () => {
    expect(CreateProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(CreateProjectRequestSchema.safeParse(input).success).toBe(true);
    expect(CreateProjectRequestSchema.safeParse({ ...input, ventureIds: [] }).success).toBe(true);
  });

  it('rejects duplicate Venture IDs', () => {
    expect(
      CreateProjectRequestSchema.safeParse({
        ...input,
        ventureIds: [input.ventureIds[0], input.ventureIds[0]],
      }).success,
    ).toBe(false);
  });
});

describe('ProjectStatusUpdateResponseSchema', () => {
  it('accepts the narrow authoritative status mutation response', () => {
    expect(
      ProjectStatusUpdateResponseSchema.safeParse({
        id: '11111111-1111-4111-8111-111111111111',
        status: 'IN_PROGRESS',
        doneAt: null,
        updatedAt: '2026-09-18T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});

describe('UpdateProjectStatusRequestSchema', () => {
  it('only permits user-selectable Project statuses', () => {
    expect(UpdateProjectStatusRequestSchema.safeParse({ status: 'DONE' }).success).toBe(true);
    expect(UpdateProjectStatusRequestSchema.safeParse({ status: 'ARCHIVED' }).success).toBe(false);
  });
});

describe('ProjectCreateOptionsResponseSchema', () => {
  it('only accepts the narrow Project creation data shape', () => {
    expect(
      ProjectCreateOptionsResponseSchema.safeParse({
        leads: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            fullName: 'Active Member',
            email: 'active@example.com',
          },
        ],
        ventures: [
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Operations',
            shortLabel: 'OPS',
          },
        ],
      }).success,
    ).toBe(true);
  });
});
