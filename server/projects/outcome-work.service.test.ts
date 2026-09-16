import { describe, expect, it } from 'vitest';
import { workPermissions } from './outcome-work.service';
import {
  EditWorkItemSchema,
  TaskStateInputSchema,
  WorkItemInputSchema,
} from '../../shared/contracts/outcome-work';

describe('Outcome work permissions', () => {
  const open = {
    lifecycleStatus: 'OPEN' as const,
    members: [{ memberId: 'member' }],
    prerequisites: [],
  };
  it('requires Outcome Membership even for a Lead or Administrator', () => {
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
  it('closes accepted work while allowing revision work', () => {
    expect(
      workPermissions({ ...open, lifecycleStatus: 'ACCEPTED' }, 'member'),
    ).toEqual({ canPlan: false, canExecute: false });
    expect(
      workPermissions({ ...open, lifecycleStatus: 'NEEDS_REVISION' }, 'member'),
    ).toEqual({ canPlan: true, canExecute: true });
  });
});

describe('Work validation', () => {
  it('rejects blank and oversized titles and client-supplied authority', () => {
    expect(WorkItemInputSchema.safeParse({ title: '  ' }).success).toBe(false);
    expect(
      WorkItemInputSchema.safeParse({ title: 'a'.repeat(201) }).success,
    ).toBe(false);
    expect(
      WorkItemInputSchema.safeParse({
        title: 'Work',
        createdByMemberId: 'someone',
      }).success,
    ).toBe(false);
  });
  it('requires a version on edits and state changes', () => {
    expect(EditWorkItemSchema.safeParse({ title: 'Work' }).success).toBe(false);
    expect(TaskStateInputSchema.safeParse({ status: 'DONE' }).success).toBe(
      false,
    );
    expect(
      TaskStateInputSchema.safeParse({
        status: 'ACCEPTED',
        updatedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });
});
