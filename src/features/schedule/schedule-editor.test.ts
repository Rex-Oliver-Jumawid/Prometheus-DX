import { describe, expect, it } from 'vitest';
import { generateInitialSchedule, initialRestDays, isValidEditorPlacement } from './schedule-editor';

describe('schedule editor placement and generation', () => {
  it('allows independent teammates to overlap because validation only receives own blocks', () => {
    const own = [{ weekday: 'MONDAY' as const, startTime: '09:00', endTime: '11:00' }];
    expect(isValidEditorPlacement(own, 0, { weekday: 'MONDAY', startTime: '10:00', endTime: '12:00' })).toBe(true);
  });

  it('rejects overlapping, inverted and out-of-range own placements', () => {
    const own = [
      { weekday: 'MONDAY' as const, startTime: '09:00', endTime: '11:00' },
      { weekday: 'MONDAY' as const, startTime: '13:00', endTime: '16:00' },
    ];
    expect(isValidEditorPlacement(own, 1, { weekday: 'MONDAY', startTime: '10:00', endTime: '14:00' })).toBe(false);
    expect(isValidEditorPlacement(own, 1, { weekday: 'MONDAY', startTime: '15:00', endTime: '14:00' })).toBe(false);
    expect(isValidEditorPlacement(own, 1, { weekday: 'MONDAY', startTime: '23:00', endTime: '25:00' })).toBe(false);
    expect(isValidEditorPlacement(own, 1, { weekday: 'TUESDAY', startTime: '13:00', endTime: '16:00' })).toBe(true);
  });

  it('generates the configured target across workdays and reports any remaining hours', () => {
    const rest = new Set(['SATURDAY' as const, 'SUNDAY' as const]);
    const complete = generateInitialSchedule(1200, 240, rest);
    expect(complete.blocks).toHaveLength(5);
    expect(complete.blocks[0]).toEqual({ weekday: 'MONDAY', startTime: '14:00', endTime: '18:00' });
    expect(complete.remainingMinutes).toBe(0);
    const incomplete = generateInitialSchedule(2400, 240, rest);
    expect(incomplete.remainingMinutes).toBe(1200);
    expect(initialRestDays(complete.blocks)).toEqual(['SATURDAY', 'SUNDAY']);
  });
});

describe('midnight boundaries', () => {
  it('allows a full day and a late shift ending at midnight', () => {
    expect(isValidEditorPlacement([], 0, { weekday: 'MONDAY', startTime: '00:00', endTime: '24:00' })).toBe(true);
    expect(isValidEditorPlacement([], 0, { weekday: 'MONDAY', startTime: '21:00', endTime: '24:00' })).toBe(true);
    expect(generateInitialSchedule(1440, 1440, new Set()).blocks[0]).toEqual({ weekday: 'MONDAY', startTime: '00:00', endTime: '24:00' });
  });
});
