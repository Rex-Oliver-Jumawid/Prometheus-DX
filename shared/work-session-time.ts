import { WORKSPACE_TIMEZONE } from './contracts/work-session';
import type { Weekday } from './contracts/schedule';

type CalendarDate = { year: number; month: number; day: number };

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour: read('hour'),
    minute: read('minute'),
    second: read('second'),
  };
}

function localMidnightToUtc(date: CalendarDate, timeZone: string): Date {
  const target = Date.UTC(date.year, date.month - 1, date.day);
  let candidate = target;
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const parts = zonedParts(new Date(candidate), timeZone);
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    candidate += target - represented;
  }
  return new Date(candidate);
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

export function getWeekWindow(
  reference: Date,
  timeZone = WORKSPACE_TIMEZONE,
): { start: Date; end: Date } {
  const local = zonedParts(reference, timeZone);
  const date = { year: local.year, month: local.month, day: local.day };
  const weekday = new Date(
    Date.UTC(date.year, date.month - 1, date.day),
  ).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = addCalendarDays(date, -daysSinceMonday);
  return {
    start: localMidnightToUtc(monday, timeZone),
    end: localMidnightToUtc(addCalendarDays(monday, 7), timeZone),
  };
}

export function referenceDateForWeek(value?: string): Date {
  if (!value) return new Date();
  return new Date(`${value}T12:00:00.000Z`);
}

export function weekdayInTimezone(
  reference: Date,
  timeZone = WORKSPACE_TIMEZONE,
): Weekday {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
  }).format(reference);
  return weekday.toUpperCase() as Weekday;
}

export function durationSeconds(timeIn: Date, timeOut: Date): number {
  return Math.max(
    0,
    Math.floor((timeOut.getTime() - timeIn.getTime()) / 1_000),
  );
}
