import { describe, expect, it } from 'vitest';
import { CreateMemberRequestSchema } from './registry';
import {
  VentureMembershipRequestSchema,
  VentureSettingsSchema,
} from './venture';

const memberId = '11111111-1111-4111-8111-111111111111';
describe('venture contracts', () => {
  it('allows multiple operational roles but never accepts financial privileges', () => {
    const input = {
      memberId,
      founder: true,
      active: true,
      roles: ['CEO', 'CTO'],
      permissions: [],
    };
    expect(VentureMembershipRequestSchema.parse(input).roles).toEqual([
      'CEO',
      'CTO',
    ]);
    expect(
      VentureMembershipRequestSchema.safeParse({
        ...input,
        permissions: ['finance.manage'],
      }).success,
    ).toBe(false);
    expect(
      VentureMembershipRequestSchema.safeParse({
        ...input,
        roles: ['CEO', 'CEO'],
      }).success,
    ).toBe(false);
    expect(
      VentureMembershipRequestSchema.safeParse({
        ...input,
        actorMemberId: memberId,
      }).success,
    ).toBe(false);
  });
  it('validates hierarchy IDs, status, and bounded settings', () => {
    const input = {
      name: 'Parkey',
      shortLabel: 'PK',
      description: null,
      parentId: null,
      status: 'ACTIVE',
    };
    expect(VentureSettingsSchema.safeParse(input).success).toBe(true);
    expect(
      VentureSettingsSchema.safeParse({ ...input, parentId: 'bad' }).success,
    ).toBe(false);
    expect(
      VentureSettingsSchema.safeParse({ ...input, shortLabel: 'x'.repeat(13) })
        .success,
    ).toBe(false);
  });
  it('does not require a venture to invite a workspace member', () => {
    const result = CreateMemberRequestSchema.parse({
      email: 'new@example.test',
      fullName: 'New Member',
      position: 'Engineer',
      workspaceRole: 'MEMBER',
    });
    expect(result.ventureId).toBeNull();
  });
});
