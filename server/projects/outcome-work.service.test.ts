import { describe, expect, it } from 'vitest';
import { workPermissions } from './outcome-work.service';

describe('Outcome work permissions', () => {
  const open = {
    lifecycleStatus: 'OPEN' as const,
    members: [{ memberId: 'member' }],
    prerequisites: [],
  };

  it('requires Outcome Membership even for Project Lead or Administrator identities', () => {
    expect(workPermissions(open, 'lead')).toEqual({
      canPlan: false,
      canExecute: false,
    });
    expect(workPermissions(open, 'admin')).toEqual({
      canPlan: false,
      canExecute: false,
    });
    expect(workPermissions(open, 'member')).toEqual({
      canPlan: true,
      canExecute: true,
    });
  });

  it('does not infer work authority from project-level edit access', () => {
    expect(workPermissions(open, 'project-editor')).toEqual({
      canPlan: false,
      canExecute: false,
    });
  });

  it('closes accepted work while allowing revision work for Outcome Members', () => {
    expect(
      workPermissions({ ...open, lifecycleStatus: 'ACCEPTED' }, 'member'),
    ).toEqual({ canPlan: false, canExecute: false });
    expect(
      workPermissions({ ...open, lifecycleStatus: 'NEEDS_REVISION' }, 'member'),
    ).toEqual({ canPlan: true, canExecute: true });
  });

  it('blocks execution while an unresolved prerequisite locks the outcome', () => {
    expect(
      workPermissions(
        {
          ...open,
          prerequisites: [
            {
              id: 'dependency',
              outcomeId: 'outcome',
              prerequisiteOutcomeId: 'prerequisite',
              overrideResolvedAt: null,
              overrideResolvedByMemberId: null,
              overrideReason: null,
              createdAt: new Date(),
              prerequisiteOutcome: { lifecycleStatus: 'OPEN' as const },
            },
          ],
        },
        'member',
      ),
    ).toEqual({ canPlan: true, canExecute: false });
  });
});
