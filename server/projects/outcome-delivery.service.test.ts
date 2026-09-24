import { ForbiddenException, ConflictException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { OutcomeDeliveryService } from './outcome-delivery.service';

const version = '2026-09-17T00:00:00.000Z';
const decision = {
  criterionIds: [],
  submissionIds: [],
  note: 'Feedback',
  outcomeUpdatedAt: version,
};

function fixture(
  role: 'ADMINISTRATOR' | 'MEMBER' = 'MEMBER',
  accessLevel: 'CAN_VIEW' | 'CAN_EDIT' | null = null,
) {
  const outcome = {
    id: 'outcome',
    stage: { projectId: 'project', project: { leadMemberId: 'lead' } },
    lifecycleStatus: 'OPEN',
    updatedAt: new Date(version),
    members: [],
    prerequisites: [],
    acceptanceCriteria: [],
  };
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    outcome: { findUnique: vi.fn().mockResolvedValue(outcome) },
    projectMember: {
      findUnique: vi.fn().mockResolvedValue(
        accessLevel ? { accessLevel } : null,
      ),
    },
  };
  const prisma = {
    ...db,
    $transaction: (action: (db: unknown) => unknown) => action(db),
  };
  const service = new OutcomeDeliveryService(
    prisma as unknown as PrismaService,
  );
  const member = { id: 'not-lead', workspaceRole: role } as Member;
  return { service, member, outcome, db };
}

describe('Outcome delivery authority', () => {
  for (const role of ['ADMINISTRATOR', 'MEMBER'] as const) {
    it.each([
      'review',
      'draft',
      'revision',
      'resolve',
      'accept',
      'reopen',
      'override',
    ])(`${role} cannot perform non-Lead %s`, async (action) => {
      const { service, member } = fixture(role);
      const actions: Record<string, () => Promise<unknown>> = {
        review: () =>
          service.reviewSubmission(
            member,
            'project',
            'outcome',
            'submission',
            decision,
          ),
        draft: () =>
          service.saveReviewDraft(member, 'project', 'outcome', {
            criterionIds: [],
            submissionIds: [],
            note: '',
            updatedAt: null,
          }),
        revision: () =>
          service.requestRevision(member, 'project', 'outcome', decision),
        resolve: () =>
          service.resolveRevision(member, 'project', 'outcome', version),
        accept: () => service.accept(member, 'project', 'outcome', decision),
        reopen: () => service.reopen(member, 'project', 'outcome', version),
        override: () =>
          service.overrideDependency(
            member,
            'project',
            'outcome',
            'dependency',
            'Reason',
          ),
      };
      await expect(actions[action]()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  }

  it('grants review authority to CAN_EDIT without making the Member Project Lead', async () => {
    const { service, member, outcome, db } = fixture('MEMBER', 'CAN_EDIT');
    const guard = service as unknown as {
      requireProjectEditor: (
        database: typeof db,
        currentOutcome: typeof outcome,
        currentMember: Member,
      ) => Promise<void>;
    };

    await expect(
      guard.requireProjectEditor(db, outcome, member),
    ).resolves.toBeUndefined();
    expect(outcome.stage.project.leadMemberId).not.toBe(member.id);
  });

  it('keeps CAN_VIEW and unrelated Administrators out of Project editor actions', async () => {
    for (const [role, accessLevel] of [
      ['MEMBER', 'CAN_VIEW'],
      ['ADMINISTRATOR', null],
    ] as const) {
      const { service, member, outcome, db } = fixture(role, accessLevel);
      const guard = service as unknown as {
        requireProjectEditor: (
          database: typeof db,
          currentOutcome: typeof outcome,
          currentMember: Member,
        ) => Promise<void>;
      };
      await expect(
        guard.requireProjectEditor(db, outcome, member),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('does not grant Outcome work to the persisted Lead without membership', async () => {
    const { service, member } = fixture();
    member.id = 'lead';
    await expect(
      service.saveDraft(member, 'project', 'outcome', {
        content: 'Draft',
        note: '',
        updatedAt: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.submit(member, 'project', 'outcome', {
        content: 'Output',
        note: '',
        requestId: 'request',
        draftUpdatedAt: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a stale Lead decision before writing records', async () => {
    const { service, member } = fixture();
    member.id = 'lead';
    await expect(
      service.accept(member, 'project', 'outcome', {
        ...decision,
        outcomeUpdatedAt: '2026-09-16T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
