import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from './notifications.service';

const runDatabaseIntegration = process.env.RUN_DATABASE_INTEGRATION === '1';
const prisma = new PrismaService();
const service = new NotificationsService(prisma);
const runId = `notification-api-${randomUUID()}`;
const createdAt = new Date('2026-09-22T00:00:00.000Z');

describe.runIf(runDatabaseIntegration)(
  'notification inbox database integration',
  () => {
    let departmentId: string;
    let projectId: string;
    let recipient: Member;
    let otherMember: Member;
    const recipientNotificationIds = [randomUUID(), randomUUID()];
    const otherNotificationId = randomUUID();

    beforeAll(async () => {
      const department = await prisma.department.create({
        data: { name: runId, shortLabel: 'P7API' },
      });
      departmentId = department.id;
      [recipient, otherMember] = await Promise.all(
        ['recipient', 'other'].map((label) =>
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
          description: 'Notification inbox integration fixture.',
          createdByMemberId: otherMember.id,
          leadMemberId: recipient.id,
        },
      });
      projectId = project.id;
      await prisma.notification.createMany({
        data: [
          ...recipientNotificationIds.map((id) => ({
            id,
            recipientMemberId: recipient.id,
            actorMemberId: otherMember.id,
            projectId,
            type: 'PROJECT_MEMBER_ACCESS_CHANGED' as const,
            eventKey: `PROJECT_MEMBER_ACCESS_CHANGED:${id}`,
            data: { accessLevel: 'CAN_EDIT' },
            createdAt,
          })),
          {
            id: otherNotificationId,
            recipientMemberId: otherMember.id,
            actorMemberId: recipient.id,
            projectId,
            type: 'PROJECT_LEAD_ASSIGNED' as const,
            eventKey: `PROJECT_LEAD_ASSIGNED:${otherNotificationId}`,
            data: {},
            createdAt,
          },
        ],
      });
    }, 30_000);

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

    it('lists only owned records with joined context and a stable ID tie-breaker', async () => {
      const [all, unread, count, other] = await Promise.all([
        service.list(recipient.id, { filter: 'all' }),
        service.list(recipient.id, { filter: 'unread' }),
        service.unreadCount(recipient.id),
        service.list(otherMember.id, { filter: 'all' }),
      ]);

      const expectedIds = [...recipientNotificationIds].sort().reverse();
      expect(all.items.map((item) => item.id)).toEqual(expectedIds);
      expect(unread.items.map((item) => item.id)).toEqual(expectedIds);
      expect(count).toEqual({ count: 2 });
      expect(other.items.map((item) => item.id)).toEqual([otherNotificationId]);
      expect(all.items[0]).toMatchObject({
        actor: { id: otherMember.id },
        project: { id: projectId, name: runId },
        newAccessLevel: 'CAN_EDIT',
        readAt: null,
      });
    }, 30_000);

    it('persists owned read changes without altering another member inbox', async () => {
      await expect(
        service.markRead(otherMember.id, recipientNotificationIds[0]),
      ).rejects.toBeInstanceOf(NotFoundException);

      const first = await service.markRead(
        recipient.id,
        recipientNotificationIds[0],
      );
      const retry = await service.markRead(
        recipient.id,
        recipientNotificationIds[0],
      );
      expect(retry).toEqual(first);
      expect(await service.unreadCount(recipient.id)).toEqual({ count: 1 });

      const bulk = await service.markAllRead(recipient.id);
      expect(bulk.updatedCount).toBe(1);
      expect((await service.markAllRead(recipient.id)).updatedCount).toBe(0);
      expect(
        (await service.list(recipient.id, { filter: 'unread' })).items,
      ).toEqual([]);
      expect(await service.unreadCount(recipient.id)).toEqual({ count: 0 });
      expect(await service.unreadCount(otherMember.id)).toEqual({ count: 1 });
      expect(
        await prisma.notification.findUnique({
          where: { id: otherNotificationId },
          select: { readAt: true },
        }),
      ).toEqual({ readAt: null });
    }, 30_000);
  },
);
