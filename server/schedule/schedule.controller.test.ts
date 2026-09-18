import { ForbiddenException } from '@nestjs/common';
import type { Member } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleController } from './schedule.controller';
import type { ScheduleService } from './schedule.service';

describe('ScheduleController', () => {
  it('rejects a direct attempt to update another member schedule', () => {
    const service = {
      replaceMemberSchedule: vi.fn(),
    } as unknown as ScheduleService;
    const controller = new ScheduleController(service);
    const administrator = {
      id: '11111111-1111-4111-8111-111111111111',
      workspaceRole: 'ADMINISTRATOR',
    } as Member;

    expect(() =>
      controller.updateMemberSchedule(
        administrator,
        '22222222-2222-4222-8222-222222222222',
        { targetWeeklyMinutes: 0, blocks: [] },
      ),
    ).toThrow(ForbiddenException);
    expect(service.replaceMemberSchedule).not.toHaveBeenCalled();
  });
});
