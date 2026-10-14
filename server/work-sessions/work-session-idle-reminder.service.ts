import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { serverEnvironment } from '../config/env';
import { PushDeliveryService } from '../notifications/push-delivery.service';

export const IDLE_REMINDER_MS = 30 * 60_000;

@Injectable()
export class WorkSessionIdleReminderService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PushDeliveryService) private readonly push: PushDeliveryService,
  ) {}

  async recordActivity(memberId: string, now = new Date()) {
    // Authenticated browser interaction, not a polling heartbeat. Reset the
    // one-shot reminder only after genuine activity in a still-open session.
    const result = await this.prisma.workSession.updateMany({
      where: { memberId, status: 'OPEN', timeOut: null },
      data: { lastActivityAt: now, idleRemindedAt: null },
    });
    return { recorded: result.count > 0 };
  }

  async claimBrowserReminder(memberId: string, workSessionId: string, now = new Date()) {
    const cutoff = new Date(now.getTime() - IDLE_REMINDER_MS);
    const result = await this.prisma.workSession.updateMany({
      where: {
        id: workSessionId,
        memberId,
        status: 'OPEN',
        timeOut: null,
        idleRemindedAt: null,
        OR: [
          { lastActivityAt: { lte: cutoff } },
          { lastActivityAt: null, timeIn: { lte: cutoff } },
        ],
      },
      data: { idleRemindedAt: now },
    });
    return { claimed: result.count === 1 };
  }

  async deliverDueReminders(now = new Date()) {
    if (!serverEnvironment.webPush) return { checked: 0, sent: 0 };
    const cutoff = new Date(now.getTime() - IDLE_REMINDER_MS);
    const stillValidFrom = new Date(
      now.getTime() - serverEnvironment.workSessionMaxHours * 60 * 60_000,
    );
    const due = await this.prisma.workSession.findMany({
      where: {
        status: 'OPEN',
        timeOut: null,
        timeIn: { gte: stillValidFrom },
        idleRemindedAt: null,
        OR: [
          { lastActivityAt: { lte: cutoff } },
          { lastActivityAt: null, timeIn: { lte: cutoff } },
        ],
      },
      select: { id: true, memberId: true, lastActivityAt: true },
      take: 100,
      orderBy: [{ timeIn: 'asc' }, { id: 'asc' }],
    });

    let sent = 0;
    for (const session of due) {
      // Atomic claim protects against overlapping scheduler invocations and
      // simultaneous activity from another device.
      const claimed = await this.prisma.workSession.updateMany({
        where: {
          id: session.id,
          status: 'OPEN',
          timeOut: null,
          idleRemindedAt: null,
          ...(session.lastActivityAt
            ? { lastActivityAt: { lte: cutoff, equals: session.lastActivityAt } }
            : { lastActivityAt: null, timeIn: { lte: cutoff } }),
        },
        data: { idleRemindedAt: now },
      });
      if (claimed.count === 1) {
        sent += await this.push.sendWorkSessionIdleReminder(
          session.memberId,
          session.id,
        );
      }
    }
    return { checked: due.length, sent };
  }
}
