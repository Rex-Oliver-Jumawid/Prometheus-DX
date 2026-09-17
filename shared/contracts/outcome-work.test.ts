import { describe, expect, it } from 'vitest';
import {
  EditWorkItemSchema,
  OutcomeWorkSchema,
  TaskStateInputSchema,
  WorkItemInputSchema,
} from './outcome-work';

describe('Outcome work contracts', () => {
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

  it('requires optimistic concurrency versions on edits and state changes', () => {
    expect(EditWorkItemSchema.safeParse({ title: 'Work' }).success).toBe(false);
    expect(TaskStateInputSchema.safeParse({ status: 'DONE' }).success).toBe(
      false,
    );
  });

  it('accepts only TODO and DONE task state transitions', () => {
    const updatedAt = new Date().toISOString();
    expect(TaskStateInputSchema.safeParse({ status: 'TODO', updatedAt }).success).toBe(
      true,
    );
    expect(TaskStateInputSchema.safeParse({ status: 'DONE', updatedAt }).success).toBe(
      true,
    );
    expect(
      TaskStateInputSchema.safeParse({ status: 'ACCEPTED', updatedAt }).success,
    ).toBe(false);
  });

  it('rejects impossible progress values at the response boundary', () => {
    const base = {
      features: [],
      canPlan: false,
      canExecute: false,
      completedTasks: 0,
      totalTasks: 0,
    };
    expect(OutcomeWorkSchema.safeParse({ ...base, progress: null }).success).toBe(
      true,
    );
    expect(OutcomeWorkSchema.safeParse({ ...base, progress: -1 }).success).toBe(
      false,
    );
    expect(OutcomeWorkSchema.safeParse({ ...base, progress: 101 }).success).toBe(
      false,
    );
  });
});
