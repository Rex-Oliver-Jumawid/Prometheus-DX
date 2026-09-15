import { describe, expect, it } from 'vitest';
import { CurrentMemberSchema, MemberStatusSchema, WorkspaceRoleSchema } from './member';

describe('member contracts', () => {
  it('accepts canonical member roles and statuses', () => {
    expect(WorkspaceRoleSchema.options).toEqual(['ADMINISTRATOR', 'MEMBER']);
    expect(MemberStatusSchema.options).toEqual(['INVITED', 'ACTIVE', 'DEACTIVATED']);
  });

  it('does not expose auth linkage in the current-member response', () => {
    const parsed = CurrentMemberSchema.parse({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'member@example.com',
      fullName: 'Member Example',
      workspaceRole: 'MEMBER',
      status: 'ACTIVE',
      position: null,
      profileImagePath: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authUserId: '55555555-5555-4555-8555-555555555555',
    });

    expect(parsed).not.toHaveProperty('authUserId');
  });
});
