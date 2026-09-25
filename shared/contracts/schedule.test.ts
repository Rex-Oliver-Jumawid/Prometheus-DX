import { describe, expect, it } from 'vitest';
import {
  findScheduleConflict,
  UpdateScheduleRequestSchema,
  WEEKDAYS,
} from './schedule';

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

  it.each([
    {
      label: 'an unknown weekday',
      block: { weekday: 'FUNDAY', startTime: '09:00', endTime: '10:00' },
    },
    {
      label: 'a malformed start time',
      block: { weekday: 'MONDAY', startTime: '9:00', endTime: '10:00' },
    },
    {
      label: 'a malformed end time',
      block: { weekday: 'MONDAY', startTime: '09:00', endTime: '24:00' },
    },
    {
      label: 'an equal start and end time',
      block: { weekday: 'MONDAY', startTime: '09:00', endTime: '09:00' },
    },
    {
      label: 'an end time before the start time',
      block: { weekday: 'MONDAY', startTime: '10:00', endTime: '09:00' },
    },
  ])('rejects $label', ({ block }) => {
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 60,
        blocks: [block],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate blocks as an overlap', () => {
    const block = {
      weekday: 'MONDAY' as const,
      startTime: '09:00',
      endTime: '10:00',
    };
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 120,
        blocks: [block, block],
      }).success,
    ).toBe(false);
  });

  it('enforces the block count and weekly target bounds', () => {
    const starts = ['00:00', '06:00', '12:00', '18:00'] as const;
    const ends = ['00:30', '06:30', '12:30', '18:30'] as const;
    const blocks = WEEKDAYS.flatMap((weekday) =>
      starts.map((startTime, index) => ({
        weekday,
        startTime,
        endTime: ends[index],
      })),
    );

    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 0,
        blocks: [],
      }).success,
    ).toBe(true);
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 10_080,
        blocks,
      }).success,
    ).toBe(true);
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: -1,
        blocks: [],
      }).success,
    ).toBe(false);
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 10_081,
        blocks: [],
      }).success,
    ).toBe(false);
    expect(
      UpdateScheduleRequestSchema.safeParse({
        targetWeeklyMinutes: 480,
        blocks: [...blocks, blocks[0]],
      }).success,
    ).toBe(false);
  });
  it('accepts zero or four rest days and rejects duplicates and scheduled rest days', () => {
    const input = { targetWeeklyMinutes: 240, blocks: [{ weekday: 'MONDAY', startTime: '09:00', endTime: '13:00' }] };
    expect(UpdateScheduleRequestSchema.safeParse({ ...input, restDays: [] }).success).toBe(true);
    expect(UpdateScheduleRequestSchema.safeParse({ ...input, restDays: ['THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] }).success).toBe(true);
    expect(UpdateScheduleRequestSchema.safeParse({ ...input, restDays: ['SATURDAY', 'SATURDAY'] }).success).toBe(false);
    expect(UpdateScheduleRequestSchema.safeParse({ ...input, restDays: ['MONDAY'] }).success).toBe(false);
  });
});
