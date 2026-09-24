import type { MemberSchedule, Weekday } from '../../../shared/contracts/schedule';
import type { WorkSession } from '../../../shared/contracts/work-session';
import { WEEKDAYS, clockTimeToMinutes } from '../../../shared/contracts/schedule';
import { getWeekWindow } from '../../../shared/work-session-time';

export type TimelineSegment = {
  start: number;
  end: number;
};

export type ComparedDay = {
  dateKey: string;
  label: string;
  dateLabel: string;
  weekday: Weekday;
  planned: TimelineSegment[];
  actual: TimelineSegment[];
  sessions: WorkSession[];
  plannedMinutes: number;
  workedSeconds: number;
  overlapSeconds: number;
};

export type WeekComparison = {
  days: ComparedDay[];
  plannedMinutes: number;
  workedSeconds: number;
  overlapSeconds: number;
};

const MANILA_OFFSET = 8 * 60 * 60 * 1_000;

function dateKeyFromManilaStart(instant: Date): string {
  return new Date(instant.getTime() + MANILA_OFFSET)
    .toISOString()
    .slice(0, 10);
}

/** The selected week is a Manila-local Monday, not a UTC calendar date. */
export function currentManilaWeek(reference = new Date()): string {
  return dateKeyFromManilaStart(getWeekWindow(reference).start);
}

export function changeWeek(monday: string, amount: number): string {
  const next = new Date(monday + 'T00:00:00.000Z');
  next.setUTCDate(next.getUTCDate() + 7 * amount);
  return next.toISOString().slice(0, 10);
}

export function weekRangeLabel(monday: string): string {
  const start = new Date(monday + 'T00:00:00.000Z');
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const format = (value: Date, month: boolean) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      ...(month ? { month: 'short' as const } : {}),
      day: 'numeric',
    }).format(value);
  return format(start, true) + ' - ' +
    format(end, start.getUTCMonth() !== end.getUTCMonth()) +
    (start.getUTCFullYear() !== end.getUTCFullYear()
      ? ', ' + end.getUTCFullYear()
      : '');
}

function maxOverlapSeconds(
  segment: TimelineSegment,
  planned: TimelineSegment[],
): number {
  return planned.reduce(
    (total, block) =>
      total + Math.max(0, Math.min(segment.end, block.end) - Math.max(segment.start, block.start)) * 60,
    0,
  );
}

/**
 * Derives a Manila-local daily comparison from canonical recurring blocks
 * and persisted WorkSessions. Corrected-but-unresolved sessions never
 * contribute invented Time Out values.
 *
 * The current API returns sessions whose Time In falls within the selected
 * week. A session that started in the previous week cannot be reconstructed
 * here until the history API supports interval-overlap retrieval.
 */
export function compareWeek(
  monday: string,
  schedule: MemberSchedule | null,
  sessions: WorkSession[],
  asOf = new Date(),
): WeekComparison {
  const mondayUtc = Date.parse(monday + 'T00:00:00.000Z');
  const days: ComparedDay[] = WEEKDAYS.map((weekday, index) => {
    const date = new Date(mondayUtc + index * 86_400_000);
    const dateKey = date.toISOString().slice(0, 10);
    const start = Date.parse(dateKey + 'T00:00:00+08:00');
    const end = start + 86_400_000;
    const planned = (schedule?.blocks ?? [])
      .filter((block) => block.weekday === weekday)
      .map((block) => ({
        start: clockTimeToMinutes(block.startTime),
        end: clockTimeToMinutes(block.endTime),
      }))
      .sort((left, right) => left.start - right.start);
    const actual: TimelineSegment[] = [];
    const daySessions: WorkSession[] = [];
    let workedSeconds = 0;
    let overlapSeconds = 0;

    for (const session of sessions) {
      if (session.status === 'NEEDS_CORRECTION') continue;
      const effectiveEnd = session.timeOut
        ? Date.parse(session.timeOut)
        : session.status === 'OPEN'
          ? asOf.getTime()
          : Date.parse(session.timeIn);
      const actualStart = Math.max(start, Date.parse(session.timeIn));
      const actualEnd = Math.min(end, effectiveEnd);
      if (!(actualEnd > actualStart)) continue;
      const segment = {
        start: (actualStart - start) / 60_000,
        end: (actualEnd - start) / 60_000,
      };
      actual.push(segment);
      daySessions.push(session);
      workedSeconds += (actualEnd - actualStart) / 1_000;
      overlapSeconds += maxOverlapSeconds(segment, planned);
    }
    return {
      dateKey,
      weekday,
      label: new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(date),
      dateLabel: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(date),
      planned,
      actual,
      sessions: daySessions,
      plannedMinutes: planned.reduce((total, block) => total + block.end - block.start, 0),
      workedSeconds: Math.round(workedSeconds),
      overlapSeconds: Math.round(overlapSeconds),
    };
  });

  return {
    days,
    plannedMinutes: days.reduce((sum, day) => sum + day.plannedMinutes, 0),
    workedSeconds: days.reduce((sum, day) => sum + day.workedSeconds, 0),
    overlapSeconds: days.reduce((sum, day) => sum + day.overlapSeconds, 0),
  };
}
