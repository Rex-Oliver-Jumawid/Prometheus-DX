import { type Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { writeNotifications } from './notification-writer';

const event = {
  type: 'REVISION_REQUESTED' as const,
  sourceEventId: 'revision-id',
  actorMemberId: 'lead-id',
  recipientMemberIds: ['member-b', 'lead-id', 'member-a', 'member-b'],
  projectId: 'project-id',
  outcomeId: 'outcome-id',
};

describe('writeNotifications', () => {
  it('deduplicates and orders recipients, excludes the actor, and uses a stable source key', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    const db = { notification: { createMany } } as unknown as Prisma.TransactionClient;

    await writeNotifications(db, event);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          recipientMemberId: 'member-a',
          actorMemberId: 'lead-id',
          projectId: 'project-id',
          outcomeId: 'outcome-id',
          type: 'REVISION_REQUESTED',
          eventKey: 'REVISION_REQUESTED:revision-id',
          data: {},
        },
        {
          recipientMemberId: 'member-b',
          actorMemberId: 'lead-id',
          projectId: 'project-id',
          outcomeId: 'outcome-id',
          type: 'REVISION_REQUESTED',
          eventKey: 'REVISION_REQUESTED:revision-id',
          data: {},
        },
      ],
      skipDuplicates: true,
    });
  });

  it('skips persistence when the actor is the only recipient', async () => {
    const createMany = vi.fn();
    const db = { notification: { createMany } } as unknown as Prisma.TransactionClient;

    await writeNotifications(db, { ...event, recipientMemberIds: ['lead-id'] });

    expect(createMany).not.toHaveBeenCalled();
  });

  it('separates subject-specific unlock events', async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const db = { notification: { createMany } } as unknown as Prisma.TransactionClient;

    await writeNotifications(db, {
      ...event,
      type: 'DEPENDENCY_UNLOCKED',
      sourceEventId: 'acceptance-id',
      subjectId: 'dependent-outcome-id',
    });

    expect(createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            eventKey: 'DEPENDENCY_UNLOCKED:acceptance-id:dependent-outcome-id',
          }),
        ]),
      }),
    );
  });
});
