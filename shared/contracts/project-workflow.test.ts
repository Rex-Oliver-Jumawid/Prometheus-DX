import { describe, expect, it } from 'vitest';
import {
  CreateOutcomeRequestSchema,
  CreateStageRequestSchema,
  UpdateOutcomeRequestSchema,
} from './project-workflow';

const departmentId = '11111111-1111-4111-8111-111111111111';
const prerequisiteId = '22222222-2222-4222-8222-222222222222';

describe('project workflow contracts', () => {
  it('trims valid Stage input and rejects a missing name', () => {
    expect(CreateStageRequestSchema.parse({ name: '  Discovery  ' })).toEqual({
      name: 'Discovery',
    });
    expect(CreateStageRequestSchema.safeParse({ name: ' ' }).success).toBe(
      false,
    );
  });

  it('accepts canonical Outcome metadata', () => {
    expect(
      CreateOutcomeRequestSchema.parse({
        title: '  Validated opportunity  ',
        description: '  Confirm demand.  ',
        departmentIds: [departmentId],
        acceptanceCriteria: ['  Interview evidence exists.  '],
        prerequisiteOutcomeIds: [prerequisiteId],
      }),
    ).toEqual({
      title: 'Validated opportunity',
      description: 'Confirm demand.',
      departmentIds: [departmentId],
      acceptanceCriteria: ['Interview evidence exists.'],
      prerequisiteOutcomeIds: [prerequisiteId],
      memberIds: [],
    });
  });

  it('rejects duplicate Department, member, and prerequisite references', () => {
    const memberId = '33333333-3333-4333-8333-333333333333';
    const base = {
      title: 'Validated opportunity',
      departmentIds: [departmentId],
      acceptanceCriteria: ['Interview evidence exists.'],
      prerequisiteOutcomeIds: [prerequisiteId],
      memberIds: [memberId],
    };
    expect(
      UpdateOutcomeRequestSchema.safeParse({
        ...base,
        departmentIds: [departmentId, departmentId],
      }).success,
    ).toBe(false);
    expect(
      UpdateOutcomeRequestSchema.safeParse({
        ...base,
        prerequisiteOutcomeIds: [prerequisiteId, prerequisiteId],
      }).success,
    ).toBe(false);
    expect(
      UpdateOutcomeRequestSchema.safeParse({
        ...base,
        memberIds: [memberId, memberId],
      }).success,
    ).toBe(false);
  });
});
