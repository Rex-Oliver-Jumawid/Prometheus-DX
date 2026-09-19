import { describe, expect, it } from 'vitest';
import {
  CurrentMemberSchema,
  MemberStatusSchema,
  UpdateCurrentMemberRequestSchema,
  WorkspaceRoleSchema,
} from './member';

describe('member contracts', () => {
  it('accepts canonical member roles and statuses', () => {
    expect(WorkspaceRoleSchema.options).toEqual(['ADMINISTRATOR', 'MEMBER']);
    expect(MemberStatusSchema.options).toEqual([
      'INVITED',
      'ACTIVE',
      'DEACTIVATED',
    ]);
  });

  it('does not expose auth linkage in the current-member response', () => {
    const parsed = CurrentMemberSchema.parse({
      id: '44444444-4444-4444-8444-444444444444',
      email: 'member@example.com',
      fullName: 'Member Example',
      workspaceRole: 'MEMBER',
      status: 'ACTIVE',
      position: null,
      nickname: null,
      phoneNumber: null,
      about: null,
      profileImagePath: null,
      department: {
        id: '66666666-6666-4666-8666-666666666666',
        name: 'Research and Development',
        shortLabel: 'R&D',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authUserId: '55555555-5555-4555-8555-555555555555',
    });

    expect(parsed).not.toHaveProperty('authUserId');
  });

  it('accepts self-service profile fields without organization-managed access fields', () => {
    expect(
      UpdateCurrentMemberRequestSchema.parse({
        fullName: '  Member Example  ',
        position: ' Software Engineer ',
        nickname: ' Oli ',
        phoneNumber: ' +63 917 123 4567 ',
        about: ' Building useful software. ',
        profileImagePath: null,
      }),
    ).toEqual({
      fullName: 'Member Example',
      position: 'Software Engineer',
      nickname: 'Oli',
      phoneNumber: '+63 917 123 4567',
      about: 'Building useful software.',
      profileImagePath: null,
    });

    expect(
      UpdateCurrentMemberRequestSchema.safeParse({
        fullName: '',
        position: null,
        workspaceRole: 'ADMINISTRATOR',
      }).success,
    ).toBe(false);
  });
});
