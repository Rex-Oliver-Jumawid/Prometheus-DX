import { type Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { OutcomeDelivery } from '../../shared/contracts/outcome-delivery';
import type { PrismaService } from '../database/prisma.service';
import { OutcomeDeliveryService } from './outcome-delivery.service';

const projectId = '11111111-1111-4111-8111-111111111111';
const outcomeId = '22222222-2222-4222-8222-222222222222';
const lead = { id: '33333333-3333-4333-8333-333333333333' } as Member;
const memberA = { id: '44444444-4444-4444-8444-444444444444' } as Member;
const memberB = { id: '55555555-5555-4555-8555-555555555555' } as Member;
const version = '2026-09-22T00:00:00.000Z';
const submissionId = '66666666-6666-4666-8666-666666666666';
const revisionId = '77777777-7777-4777-8777-777777777777';
const acceptanceId = '88888888-8888-4888-8888-888888888888';
const dependentOutcomeId = '99999999-9999-4999-8999-999999999999';

type Dependency = {
  id: string;
  overrideResolvedAt: Date | null;
  prerequisiteOutcome: {
    lifecycleStatus: 'OPEN' | 'ACCEPTED';
    title: string;
  };
};

function fixture() {
  const outcome: {
    id: string;
    stage: { projectId: string; project: { leadMemberId: string } };
    lifecycleStatus: 'OPEN' | 'NEEDS_REVISION' | 'ACCEPTED';
    updatedAt: Date;
    members: { memberId: string }[];
    prerequisites: Dependency[];
    acceptanceCriteria: never[];
  } = {
    id: outcomeId,
    stage: { projectId, project: { leadMemberId: lead.id } },
    lifecycleStatus: 'OPEN',
    updatedAt: new Date(version),
    members: [lead, memberA, memberB].map((person) => ({ memberId: person.id })),
    prerequisites: [],
    acceptanceCriteria: [],
  };
  let submitted = false;
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    outcome: {
      findUnique: vi.fn().mockResolvedValue(outcome),
      update: vi.fn().mockResolvedValue(outcome),
    },
    outcomeSubmission: {
      findUnique: vi.fn().mockImplementation(() =>
        Promise.resolve(
          submitted
            ? { id: submissionId, content: 'Output', note: '' }
            : null,
        ),
      ),
      create: vi.fn().mockImplementation(() => {
        submitted = true;
        return Promise.resolve({ id: submissionId });
      }),
      findMany: vi.fn().mockResolvedValue([
        { id: submissionId, reviewStatus: 'FOR_REVIEW' },
      ]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    outcomeOutputDraft: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    outcomeReviewDraft: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    outcomeRevisionRequest: {
      create: vi.fn().mockResolvedValue({ id: revisionId }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    outcomeAcceptance: {
      create: vi.fn().mockResolvedValue({ id: acceptanceId }),
      findFirst: vi.fn().mockResolvedValue({ id: acceptanceId }),
      update: vi.fn().mockResolvedValue({ id: acceptanceId }),
    },
    outcomeDependency: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    submissionReview: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    activityLog: { create: vi.fn().mockResolvedValue({}) },
    notification: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    ...db,
    $transaction: (action: (transaction: typeof db) => unknown) => action(db),
  } as unknown as PrismaService;
  const service = new OutcomeDeliveryService(prisma);
  vi.spyOn(service, 'getDelivery').mockResolvedValue({} as OutcomeDelivery);
  return { service, db, outcome };
}

const decision = {
  criterionIds: [],
  submissionIds: [submissionId],
  note: 'Please revise this output.',
  outcomeUpdatedAt: version,
};

describe('Outcome notification source transactions', () => {
  it('notifies the Lead once when a submission request is retried', async () => {
    const { service, db } = fixture();
    const input = {
      content: 'Output',
      note: '',
      requestId: 'request-id',
      draftUpdatedAt: null,
    };

    await service.submit(memberA, projectId, outcomeId, input);
    await service.submit(memberA, projectId, outcomeId, input);

    expect(db.outcomeSubmission.create).toHaveBeenCalledTimes(1);
    expect(db.notification.createMany).toHaveBeenCalledTimes(1);
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          recipientMemberId: lead.id,
          actorMemberId: memberA.id,
          type: 'SUBMISSION_CREATED',
          eventKey: `SUBMISSION_CREATED:${submissionId}`,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('notifies current Outcome Members except the Lead who requested revision', async () => {
    const { service, db } = fixture();

    await service.requestRevision(lead, projectId, outcomeId, decision);

    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ recipientMemberId: memberA.id }),
        expect.objectContaining({ recipientMemberId: memberB.id }),
      ],
      skipDuplicates: true,
    });
    expect(db.notification.createMany.mock.calls[0][0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'REVISION_REQUESTED',
          eventKey: `REVISION_REQUESTED:${revisionId}`,
        }),
      ]),
    );
  });

  it('notifies accepted members and only dependent Outcomes that actually unlock', async () => {
    const { service, db } = fixture();
    const stillLockedOutcomeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    db.outcomeDependency.findMany.mockResolvedValue([
      {
        outcomeId: dependentOutcomeId,
        outcome: {
          members: [{ memberId: memberA.id }],
          prerequisites: [
            {
              overrideResolvedAt: null,
              prerequisiteOutcome: { lifecycleStatus: 'ACCEPTED' },
            },
          ],
        },
      },
      {
        outcomeId: stillLockedOutcomeId,
        outcome: {
          members: [{ memberId: memberB.id }],
          prerequisites: [
            {
              overrideResolvedAt: null,
              prerequisiteOutcome: { lifecycleStatus: 'OPEN' },
            },
          ],
        },
      },
    ]);

    await service.accept(lead, projectId, outcomeId, decision);

    expect(db.notification.createMany).toHaveBeenCalledTimes(2);
    expect(db.notification.createMany).toHaveBeenNthCalledWith(1, {
      data: [
        expect.objectContaining({
          recipientMemberId: memberA.id,
          type: 'OUTCOME_ACCEPTED',
          eventKey: `OUTCOME_ACCEPTED:${acceptanceId}`,
        }),
        expect.objectContaining({
          recipientMemberId: memberB.id,
          type: 'OUTCOME_ACCEPTED',
        }),
      ],
      skipDuplicates: true,
    });
    expect(db.notification.createMany).toHaveBeenNthCalledWith(2, {
      data: [
        expect.objectContaining({
          recipientMemberId: memberA.id,
          outcomeId: dependentOutcomeId,
          eventKey: `DEPENDENCY_UNLOCKED:ACCEPTANCE:${acceptanceId}:${dependentOutcomeId}`,
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('notifies current Outcome Members when an acceptance is reopened', async () => {
    const { service, db, outcome } = fixture();
    outcome.lifecycleStatus = 'ACCEPTED';

    await service.reopen(lead, projectId, outcomeId, version);

    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          recipientMemberId: memberA.id,
          eventKey: `OUTCOME_REOPENED:${acceptanceId}`,
        }),
        expect.objectContaining({ recipientMemberId: memberB.id }),
      ],
      skipDuplicates: true,
    });
  });

  it('notifies dependent members only when an override resolves the last lock', async () => {
    const { service, db, outcome } = fixture();
    const dependencyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    outcome.prerequisites = [
      {
        id: dependencyId,
        overrideResolvedAt: null,
        prerequisiteOutcome: { lifecycleStatus: 'OPEN', title: 'Prerequisite' },
      },
    ];

    await service.overrideDependency(
      lead,
      projectId,
      outcomeId,
      dependencyId,
      'Proceed with the available evidence.',
    );

    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          recipientMemberId: memberA.id,
          type: 'DEPENDENCY_UNLOCKED',
          eventKey: `DEPENDENCY_UNLOCKED:OVERRIDE:${dependencyId}:${outcomeId}`,
        }),
        expect.objectContaining({ recipientMemberId: memberB.id }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not announce an override as an unlock while another edge remains unresolved', async () => {
    const { service, db, outcome } = fixture();
    const dependencyId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    outcome.prerequisites = [
      {
        id: dependencyId,
        overrideResolvedAt: null,
        prerequisiteOutcome: { lifecycleStatus: 'OPEN', title: 'First' },
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        overrideResolvedAt: null,
        prerequisiteOutcome: { lifecycleStatus: 'OPEN', title: 'Second' },
      },
    ];

    await service.overrideDependency(
      lead,
      projectId,
      outcomeId,
      dependencyId,
      'The first prerequisite is waived.',
    );

    expect(db.notification.createMany).not.toHaveBeenCalled();
  });
});
