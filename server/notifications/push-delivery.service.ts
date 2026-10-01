import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import {
  notificationPath,
  presentNotification,
} from '../../shared/notification-presentation';
import { serverEnvironment } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { notificationSelect, toNotification } from './notifications.service';
import { sendWebPush } from './web-push';

const include = {
  subscription: { select: { id: true, endpoint: true, p256dh: true, auth: true } },
  notification: { select: notificationSelect },
} satisfies Prisma.PushDeliveryInclude;

type Delivery = Prisma.PushDeliveryGetPayload<{ include: typeof include }>;

@Injectable()
export class PushDeliveryService {
  private readonly logger = new Logger(PushDeliveryService.name);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async flushAfterCommit(): Promise<void> {
    try {
      await this.flushPendingDeliveries();
    } catch (error) {
      this.logger.error(
        'Device push delivery failed after the database commit.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async flushPendingDeliveries() {
    const vapid = serverEnvironment.webPush;
    if (!vapid) return;

    const now = new Date();
    const leaseCutoff = new Date(now.getTime() - 120_000);
    const candidates = await this.prisma.pushDelivery.findMany({
      where: {
        deliveredAt: null,
        attempts: { lt: 5 },
        nextAttemptAt: { lte: now },
        OR: [{ claimedAt: null }, { claimedAt: { lt: leaseCutoff } }],
      },
      select: { id: true },
      // Keep new, first-attempt notifications ahead of stale retry backlog so
      // a fresh user-facing event is dispatched immediately.
      orderBy: [{ attempts: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: 100,
    });
    if (!candidates.length) return;

    const claimToken = randomUUID();
    await this.prisma.pushDelivery.updateMany({
      where: {
        id: { in: candidates.map((item) => item.id) },
        deliveredAt: null,
        attempts: { lt: 5 },
        nextAttemptAt: { lte: now },
        OR: [{ claimedAt: null }, { claimedAt: { lt: leaseCutoff } }],
      },
      data: { claimToken, claimedAt: now },
    });
    const deliveries = await this.prisma.pushDelivery.findMany({
      where: { claimToken },
      include,
    });
    await Promise.all(deliveries.map((item) => this.deliver(item, vapid)));
  }

  private async deliver(
    delivery: Delivery,
    vapid: NonNullable<typeof serverEnvironment.webPush>,
  ) {
    const notification = toNotification(delivery.notification);
    const presentation = presentNotification(notification);
    const result = await sendWebPush(
      {
        endpoint: delivery.subscription.endpoint,
        p256dh: delivery.subscription.p256dh,
        auth: delivery.subscription.auth,
      },
      {
        notificationId: notification.id,
        title: 'Prometheus',
        body: `${presentation.title}\n${presentation.description}`,
        url: notificationPath(notification) ?? '/notifications',
        tag: notification.id,
      },
      vapid,
    );

    if (result.stale) {
      await this.prisma.pushSubscription.deleteMany({
        where: { id: delivery.subscription.id },
      });
      return;
    }
    if (result.ok) {
      await this.prisma.pushDelivery.updateMany({
        where: { id: delivery.id, claimToken: delivery.claimToken },
        data: {
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          claimToken: null,
          claimedAt: null,
          lastError: null,
        },
      });
      return;
    }

    const attempt = delivery.attempts + 1;
    const delays = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
    await this.prisma.pushDelivery.updateMany({
      where: { id: delivery.id, claimToken: delivery.claimToken },
      data: {
        attempts: { increment: 1 },
        nextAttemptAt: new Date(Date.now() + delays[Math.min(attempt - 1, delays.length - 1)]),
        claimToken: null,
        claimedAt: null,
        lastError: (result.error ?? 'Push delivery failed.').slice(0, 1000),
      },
    });
  }
}
