import { BadRequestException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { WorkSessionsController } from './work-sessions.controller';
import type { WorkSessionsService } from './work-sessions.service';

describe('WorkSessionsController', () => {
  it('derives Time In ownership exclusively from CurrentMember', () => {
    const timeIn = vi.fn();
    const service = { timeIn } as unknown as WorkSessionsService;
    const controller = new WorkSessionsController(service);
    const member = { id: '11111111-1111-4111-8111-111111111111' } as Member;

    controller.timeIn(member);

    expect(timeIn).toHaveBeenCalledWith(member);
  });

  it('passes the signed-in member to the shared history authorization check', () => {
    const getMemberHistory = vi.fn();
    const controller = new WorkSessionsController({
      getMemberHistory,
    } as unknown as WorkSessionsService);
    const member = { id: '11111111-1111-4111-8111-111111111111' } as Member;
    controller.memberHistory(member, '22222222-2222-4222-8222-222222222222', {
      week: '2026-09-21',
    });
    expect(getMemberHistory).toHaveBeenCalledWith(
      member, '22222222-2222-4222-8222-222222222222', '2026-09-21',
    );
  });

  it('rejects malformed correction input before the service', () => {
    const correct = vi.fn();
    const controller = new WorkSessionsController({
      correct,
    } as unknown as WorkSessionsService);

    expect(() =>
      controller.correct(
        { id: '11111111-1111-4111-8111-111111111111' } as Member,
        '22222222-2222-4222-8222-222222222222',
        {
          newTimeIn: '2026-09-18T04:00:00.000Z',
          newTimeOut: '2026-09-18T03:00:00.000Z',
          reason: 'No',
        },
      ),
    ).toThrow(BadRequestException);
    expect(correct).not.toHaveBeenCalled();
  });
});
