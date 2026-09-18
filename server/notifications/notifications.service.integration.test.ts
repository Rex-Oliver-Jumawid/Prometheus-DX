import 'dotenv/config';
import { NotFoundException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { OutcomeDeliveryService } from '../projects/outcome-delivery.service';
import { ProjectWorkflowService } from '../projects/project-workflow.service';
import { NotificationsService } from './notifications.service';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const workflow = new ProjectWorkflowService(prisma);
const delivery = new OutcomeDeliveryService(prisma);
const notifications = new NotificationsService(prisma);
const runId = `notification-integration-${randomUUID()}`;

let departmentId: string;
let projectId: string;
let outcomeId: string;
let criterionId: string;
let lead: Member;
let memberA: Member;
let memberB: Member;
let outsider: Member;

async function createMember(label: string) {
  return prisma.member.create({
    data: {
      email: `${runId}-${label}@example.com`,
      fullName: `${label} ${runId}`,
      departmentId,
      status: 'ACTIVE',
      workspaceRole: 'MEMBER',
    },
  });
}

describe.runIf(runDatabaseIntegration)(
  'Notifications database integration',
  () => {
    beforeAll(async () => {
      const department = await prisma.department.create({
        data: { name: runId, shortLabel: 'NOTIFY' },
      });
      departmentId = department.id;
      [lead, memberA, memberB, outsider] = await Promise.all([
        createMember('lead'),
        createMember('member-a'),
        createMember('member-b'),
        createMember('outsider'),
      ]);
      const project = await prisma.project.create({
        data: {
          name: runId,
          description: 'Notification integration fixture.',
          createdByMemberId: lead.id,
          leadMemberId: lead.id,
          departments: { create: { departmentId } },
          stages: {
            create: {
              name: 'Delivery',
              position: 0,
              outcomes: {
                create: {
                  title: 'Verified notification workflow',
                  position: 0,
                  createdByMemberId: lead.id,
                  departments: { create: { departmentId } },
                  acceptanceCriteria: {
                    create: {
                      description: 'Output is reviewable.',
                      position: 0,
                    },
                  },
                },
              },
            },
          },
        },
        include: {
          stages: {
            include: { outcomes: { include: { acceptanceCriteria: true } } },
          },
        },
      });
      projectId = project.id;
      outcomeId = project.stages[0]!.outcomes[0]!.id;
      criterionId = project.stages[0]!.outcomes[0]!.acceptanceCriteria[0]!.id;
    }, 30_000);

    afterAll(async () => {
      if (projectId) {
        await prisma.notification.deleteMany({ where: { projectId } });
        await prisma.project.deleteMany({ where: { id: projectId } });
      }
      await prisma.member.deleteMany({
        where: { email: { startsWith: runId } },
      });
      if (departmentId) {
        await prisma.department.deleteMany({ where: { id: departmentId } });
      }
      await prisma.$disconnect();
    }, 30_000);

    it('persists the required event notifications idempotently and protects each inbox', async () => {
      await workflow.joinOutcome(memberA, projectId, outcomeId);
      await workflow.joinOutcome(memberA, projectId, outcomeId);
      await workflow.joinOutcome(memberB, projectId, outcomeId);

      await expect(
        prisma.notification.count({
          where: {
            recipientMemberId: lead.id,
            type: 'OUTCOME_JOINED',
          },
        }),
      ).resolves.toBe(2);

      const requestId = randomUUID();
      const submitted = await delivery.submit(memberA, projectId, outcomeId, {
        content: 'Persistent notification output',
        note: 'Ready for review.',
        requestId,
        draftUpdatedAt: null,
      });
      await delivery.submit(memberA, projectId, outcomeId, {
        content: 'Persistent notification output',
        note: 'Ready for review.',
        requestId,
        draftUpdatedAt: null,
      });

      await expect(
        prisma.notification.count({
          where: {
            recipientMemberId: lead.id,
            type: 'SUBMISSION_CREATED',
          },
        }),
      ).resolves.toBe(1);

      const revised = await delivery.requestRevision(
        lead,
        projectId,
        outcomeId,
        {
          criterionIds: [],
          submissionIds: submitted.submissions.map(({ id }) => id),
          note: 'Please address the evidence gap.',
          outcomeUpdatedAt: submitted.outcomeUpdatedAt,
        },
      );
      await expect(
        prisma.notification.findMany({
          where: { type: 'REVISION_REQUESTED', outcomeId },
          orderBy: { recipientMemberId: 'asc' },
          select: { recipientMemberId: true },
        }),
      ).resolves.toEqual(
        [memberA.id, memberB.id]
          .sort()
          .map((recipientMemberId) => ({ recipientMemberId })),
      );

      await delivery.accept(lead, projectId, outcomeId, {
        criterionIds: [criterionId],
        submissionIds: revised.submissions.map(({ id }) => id),
        note: 'Accepted after review.',
        outcomeUpdatedAt: revised.outcomeUpdatedAt,
      });
      await expect(
        prisma.notification.findMany({
          where: { type: 'OUTCOME_ACCEPTED', outcomeId },
          orderBy: { recipientMemberId: 'asc' },
          select: { recipientMemberId: true },
        }),
      ).resolves.toEqual(
        [memberA.id, memberB.id]
          .sort()
          .map((recipientMemberId) => ({ recipientMemberId })),
      );

      const memberAInbox = await notifications.list(memberA);
      const memberBInbox = await notifications.list(memberB);
      const outsiderInbox = await notifications.list(outsider);
      expect(memberAInbox.notifications).toHaveLength(2);
      expect(memberBInbox.notifications).toHaveLength(2);
      expect(outsiderInbox.notifications).toEqual([]);
      expect(
        memberAInbox.notifications.every((item) =>
          memberBInbox.notifications.every((other) => other.id !== item.id),
        ),
      ).toBe(true);

      const memberBNotification = memberBInbox.notifications[0]!;
      await expect(
        notifications.markRead(memberA, memberBNotification.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      const before = await notifications.unreadCount(memberA);
      const marked = await notifications.markRead(
        memberA,
        memberAInbox.notifications[0]!.id,
      );
      const after = await notifications.unreadCount(memberA);
      expect(marked.readAt).not.toBeNull();
      expect(after.count).toBe(before.count - 1);

      const independentClient = new PrismaService();
      try {
        await expect(
          independentClient.notification.findUnique({
            where: { id: marked.id },
            select: { readAt: true },
          }),
        ).resolves.toMatchObject({ readAt: expect.any(Date) });
      } finally {
        await independentClient.$disconnect();
      }
    }, 30_000);
  },
);
