import { describe, expect, it } from 'vitest';
import {
  durationSeconds,
  getWeekWindow,
  weekdayInTimezone,
} from './work-session-time';

describe('work session time helpers', () => {
  it('uses Monday-to-Monday Asia/Manila week boundaries in UTC', () => {
    const window = getWeekWindow(new Date('2026-09-18T03:00:00.000Z'));
    expect(window.start.toISOString()).toBe('2026-09-13T16:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-09-20T16:00:00.000Z');
  });

  it('keeps a cross-midnight session as one exact duration', () => {
    expect(
      durationSeconds(
        new Date('2026-09-18T15:30:00.000Z'),
        new Date('2026-09-18T17:15:30.000Z'),
      ),
    ).toBe(6_330);
  });

  it('derives the presentation weekday in Asia/Manila', () => {
    expect(weekdayInTimezone(new Date('2026-09-20T16:30:00.000Z'))).toBe(
      'MONDAY',
    );
  });
});
