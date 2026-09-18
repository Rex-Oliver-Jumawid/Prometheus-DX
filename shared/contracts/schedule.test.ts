import { describe, expect, it } from 'vitest';
import { findScheduleConflict, UpdateScheduleRequestSchema } from './schedule';

describe('schedule contracts', () => {
  it('accepts adjacent blocks and finds overlapping blocks deterministically', () => {
    const adjacent = [
      { weekday: 'MONDAY' as const, startTime: '09:00', endTime: '12:00' },
      { weekday: 'MONDAY' as const, startTime: '12:00', endTime: '13:00' },
    ];
    expect(findScheduleConflict(adjacent)).toBeNull();

    const overlapping = [
      { weekday: 'MONDAY' as const, startTime: '13:00', endTime: '16:00' },
      { weekday: 'MONDAY' as const, startTime: '09:00', endTime: '14:00' },
    ];
    expect(findScheduleConflict(overlapping)).toEqual({ first: 1, second: 0 });
  });

  it('rejects invalid clock ranges and overlaps', () => {
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 480,
        blocks: [{ weekday: 'TUESDAY', startTime: '12:00', endTime: '11:00' }],
      }).success,
    ).toBe(false);

    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 480,
        blocks: [
          { weekday: 'TUESDAY', startTime: '09:00', endTime: '12:00' },
          { weekday: 'TUESDAY', startTime: '11:00', endTime: '13:00' },
        ],
      }).success,
    ).toBe(false);
  });
});
