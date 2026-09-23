import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { Member } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OutcomeDelivery } from '../../shared/contracts/outcome-delivery';
import { PrismaService } from '../database/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { OutcomeDeliveryService } from '../projects/outcome-delivery.service';
import { writeNotifications } from './notification-writer';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const runId = `phase-7-notifications-${randomUUID()}`;

describe.runIf(runDatabaseIntegration)('notification transaction integration', () => {
  let departmentId: string;
  let projectId: string;
  let outcomeId: string;
  let creator: Member;
  let lead: Member;
  let participant: Member;

  beforeAll(async () => {
    const department = await prisma.department.create({
      data: { name: runId, shortLabel: 'P7TEST' },
    });
    departmentId = department.id;
    [creator, lead, participant] = await Promise.all(
      ['creator', 'lead', 'participant'].map((label) =>
        prisma.member.create({
          data: {
            email: `${runId}-${label}@example.com`,
            fullName: `${label} ${runId}`,
            departmentId,
            status: 'ACTIVE',
          },
        }),
      ),
    );
    const project = await prisma.project.create({
      data: {
        name: runId,
        description: 'Notification transaction integration fixture.',
        createdByMemberId: creator.id,
        leadMemberId: lead.id,
      },
    });
    projectId = project.id;
    const stage = await prisma.stage.create({
      data: { projectId, name: 'Delivery', position: 0 },
    });
    const outcome = await prisma.outcome.create({
      data: {
        stageId: stage.id,
        title: 'Submit a real output',
        position: 0,
        createdByMemberId: lead.id,
        members: { create: { memberId: participant.id } },
      },
    });
    outcomeId = outcome.id;
    await prisma.projectMember.create({
      data: { projectId, memberId: participant.id, accessLevel: 'CAN_VIEW' },
    });
  }, 30_000);

  beforeEach(async () => {
    await prisma.notification.deleteMany({ where: { projectId } });
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.notification.deleteMany({ where: { projectId } });
      await prisma.project.deleteMany({ where: { id: projectId } });
    }
    await prisma.member.deleteMany({
      where: { email: { startsWith: runId } },
    });
    if (departmentId)
      await prisma.department.deleteMany({ where: { id: departmentId } });
    await prisma.$disconnect();
  }, 30_000);

  it('persists one notification per recipient and source event across a retry', async () => {
    const sourceEventId = randomUUID();
    const event = {
      type: 'REVISION_REQUESTED' as const,
      sourceEventId,
      actorMemberId: creator.id,
      recipientMemberIds: [participant.id, lead.id, participant.id, creator.id],
      projectId,
    };

    await prisma.$transaction(async (db) => {
      await writeNotifications(db, event);
      await writeNotifications(db, event);
    });

    const records = await prisma.notification.findMany({
      where: { projectId },
      orderBy: { recipientMemberId: 'asc' },
    });
    expect(records).toHaveLength(2);
    expect(records.map((item) => item.recipientMemberId)).toEqual(
      [lead.id, participant.id].sort(),
    );
    expect(records.every((item) => item.eventKey === `REVISION_REQUESTED:${sourceEventId}`)).toBe(true);
    expect(records.every((item) => item.readAt === null)).toBe(true);
  });

  it('rolls a notification back with its source transaction', async () => {
    await expect(
      prisma.$transaction(async (db) => {
        await writeNotifications(db, {
          type: 'SUBMISSION_CREATED',
          sourceEventId: randomUUID(),
          actorMemberId: creator.id,
          recipientMemberIds: [lead.id],
          projectId,
        });
        throw new Error('Source operation failed.');
      }),
    ).rejects.toThrow('Source operation failed.');
    await expect(prisma.notification.count({ where: { projectId } })).resolves.toBe(0);
  });

  it('creates a Lead notification in the Project creation transaction', async () => {
    const project = await new ProjectsService(prisma).createProject(creator, {
      name: `${runId}-created`,
      description: 'Project Lead assignment notification.',
      leadMemberId: lead.id,
      departmentIds: [departmentId],
    });

    try {
      const records = await prisma.notification.findMany({
        where: { projectId: project.id },
      });
      expect(records).toMatchObject([
        {
          recipientMemberId: lead.id,
          actorMemberId: creator.id,
          type: 'PROJECT_LEAD_ASSIGNED',
          eventKey: `PROJECT_LEAD_ASSIGNED:${project.id}`,
        },
      ]);
    } finally {
      await prisma.notification.deleteMany({ where: { projectId: project.id } });
      await prisma.project.delete({ where: { id: project.id } });
    }
  });

  it('persists a Lead notification for a real Outcome submission', async () => {
    const input = {
      content: 'Completed output',
      note: '',
      requestId: randomUUID(),
      draftUpdatedAt: null,
    };
    const service = new OutcomeDeliveryService(prisma);
    vi.spyOn(service, 'getDelivery').mockResolvedValue({} as OutcomeDelivery);

    await service.submit(participant, projectId, outcomeId, input);

    const [submissions, notifications] = await Promise.all([
      prisma.outcomeSubmission.findMany({ where: { outcomeId } }),
      prisma.notification.findMany({ where: { outcomeId } }),
    ]);
    expect(submissions).toHaveLength(1);
    expect(notifications).toMatchObject([
      {
        recipientMemberId: lead.id,
        actorMemberId: participant.id,
        projectId,
        outcomeId,
        type: 'SUBMISSION_CREATED',
        eventKey: `SUBMISSION_CREATED:${submissions[0].id}`,
      },
    ]);
  });
});
