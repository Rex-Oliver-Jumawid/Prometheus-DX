import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../database/prisma.service';
import { ProjectActivityService } from './project-activity.service';

const projectId = '11111111-1111-4111-8111-111111111111';
const member = { id: '22222222-2222-4222-8222-222222222222' } as Member;
const contributor = { id: '66666666-6666-4666-8666-666666666666' } as Member;
const cursor = '33333333-3333-4333-8333-333333333333';
const event = {
  id: cursor,
  projectId,
  actorMember: { id: member.id, fullName: 'Contributor' },
  outcomeId: '44444444-4444-4444-8444-444444444444',
  entityType: 'OutcomeSubmission',
  entityId: '55555555-5555-4555-8555-555555555555',
  action: 'SUBMISSION_CREATED',
  metadata: { content: 'Private draft evidence', note: 'Confidential note' },
  createdAt: new Date('2026-09-19T13:00:00.000Z'),
};

function setup(options: {
  project?: { id: string; leadMemberId: string } | null;
  matchingCursor?: { id: string; createdAt: Date } | null;
  rows?: Array<
    Omit<typeof event, 'outcomeId' | 'metadata'> & {
      outcomeId: string | null;
      metadata: Record<string, unknown>;
      outcome?: { title: string } | null;
    }
  >;
} = {}) {
  const db = {
    project: { findUnique: vi.fn().mockResolvedValue(options.project === undefined ? { id: projectId, leadMemberId: member.id } : options.project) },
    activityLog: {
      findFirst: vi.fn().mockResolvedValue(options.matchingCursor === undefined ? { id: cursor, createdAt: event.createdAt } : options.matchingCursor),
      findMany: vi.fn().mockResolvedValue(options.rows ?? [event]),
    },
  };
  const service = new ProjectActivityService(db as unknown as PrismaService);
  return { db, service };
}

describe('ProjectActivityService', () => {
  it('returns newest-first events while redacting stored submission content', async () => {
    const { db, service } = setup();
    await expect(service.list(member, projectId)).resolves.toEqual({
      items: [{
        id: cursor,
        actor: event.actorMember,
        outcomeId: event.outcomeId,
        outcomeTitle: null,
        entityType: 'OutcomeSubmission',
        entityId: event.entityId,
        action: 'SUBMISSION_CREATED',
        metadata: {},
        createdAt: '2026-09-19T13:00:00.000Z',
      }],
      nextCursor: null,
      scope: 'PROJECT',
    });
    expect(db.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 26,
      }),
    );
  });

  it('limits non-leads to their own events and scopes pagination cursors to their identity', async () => {
    const { db, service } = setup({
      project: { id: projectId, leadMemberId: member.id },
      rows: [{ ...event, actorMember: { id: contributor.id, fullName: 'Contributor' } }],
    });
    const response = await service.list(contributor, projectId, cursor);
    expect(response.scope).toBe('PERSONAL');
    expect(response.items[0].outcomeTitle).toBeNull();
    expect(db.activityLog.findFirst).toHaveBeenCalledWith({
      where: { id: cursor, projectId, actorMemberId: contributor.id },
      select: { id: true, createdAt: true },
    });
    expect(db.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId,
          actorMemberId: contributor.id,
          OR: [
            { createdAt: { lt: event.createdAt } },
            { createdAt: event.createdAt, id: { lt: cursor } },
          ],
        },
      }),
    );
    const foreignCursor = setup({
      project: { id: projectId, leadMemberId: member.id },
      matchingCursor: null,
    });
    await expect(foreignCursor.service.list(contributor, projectId, cursor))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(foreignCursor.db.activityLog.findMany).not.toHaveBeenCalled();
  });

  it('paginates using a cursor belonging to this project', async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({
      ...event,
      id: `33333333-3333-4333-8333-${String(i).padStart(12, '0')}`,
    }));
    const { db, service } = setup({ rows });
    const response = await service.list(member, projectId, cursor);
    expect(response.items).toHaveLength(25);
    expect(response.nextCursor).toBe(rows[24].id);
    expect(db.activityLog.findFirst).toHaveBeenCalledWith({
      where: { id: cursor, projectId },
      select: { id: true, createdAt: true },
    });
    expect(db.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId,
          OR: [
            { createdAt: { lt: event.createdAt } },
            { createdAt: event.createdAt, id: { lt: cursor } },
          ],
        },
      }),
    );
  });

  it('rejects a nonexistent project and a cursor from another project', async () => {
    const absent = setup({ project: null });
    await expect(absent.service.list(member, projectId)).rejects.toBeInstanceOf(NotFoundException);

    const foreignCursor = setup({ matchingCursor: null });
    await expect(foreignCursor.service.list(member, projectId, cursor)).rejects.toBeInstanceOf(BadRequestException);
    expect(foreignCursor.db.activityLog.findMany).not.toHaveBeenCalled();
  });

  it('preserves safe deletion labels without exposing unreviewed metadata', async () => {
    const deleted = {
      ...event,
      outcomeId: null,
      action: 'OUTCOME_DELETED',
      metadata: { title: 'Retired outcome', content: 'Private submission' },
    };
    const unknown = {
      ...event,
      id: '66666666-6666-4666-8666-666666666666',
      action: 'OUTCOME_PRIVATE_NOTE_CREATED',
      metadata: { title: 'Do not expose', content: 'Private submission' },
    };
    const { service } = setup({ rows: [deleted, unknown] });
    const response = await service.list(member, projectId);
    expect(response.items[0].metadata).toEqual({ title: 'Retired outcome' });
    expect(response.items[0].outcomeId).toBeNull();
    expect(response.items[1].metadata).toEqual({});
    expect(JSON.stringify(response)).not.toContain('Private submission');
  });

  it('includes the referenced Outcome label when available', async () => {
    const { service } = setup({ rows: [{ ...event, outcome: { title: 'Opportunity decision' } }] });
    const response = await service.list(member, projectId);
    expect(response.items[0].outcomeTitle).toBe('Opportunity decision');
  });

  it('allows display-safe feature titles but does not leak arbitrary metadata', async () => {
    const row = { ...event, action: 'FEATURE_CREATED', metadata: { title: 'Design mockups', token: 'secret' } };
    const { service } = setup({ rows: [row] });
    const response = await service.list(member, projectId);
    expect(response.items[0].metadata).toEqual({ title: 'Design mockups' });
  });
});
