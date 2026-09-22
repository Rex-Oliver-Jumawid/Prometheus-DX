import {
  WEEKDAYS,
  clockTimeToMinutes,
  type ScheduleBlockInput,
  type Weekday,
} from '../../../shared/contracts/schedule';

export const EDITOR_START_MINUTES = 7 * 60;
// The current API accepts HH:mm up to 23:59, but not 24:00.
export const EDITOR_END_MINUTES = 23 * 60;
export const EDITOR_STEP_MINUTES = 60;

export function editorClock(minutes: number): string {
  return (
    String(Math.floor(minutes / 60)).padStart(2, '0') +
    ':' +
    String(minutes % 60).padStart(2, '0')
  );
}

export function isValidEditorPlacement(
  blocks: ScheduleBlockInput[],
  index: number,
  proposed: ScheduleBlockInput,
): boolean {
  const start = clockTimeToMinutes(proposed.startTime);
  const end = clockTimeToMinutes(proposed.endTime);
  if (start < EDITOR_START_MINUTES || end > EDITOR_END_MINUTES || end <= start) {
    return false;
  }
  return !blocks.some(
    (block, otherIndex) =>
      otherIndex !== index &&
      block.weekday === proposed.weekday &&
      start < clockTimeToMinutes(block.endTime) &&
      end > clockTimeToMinutes(block.startTime),
  );
}

export function initialRestDays(blocks: ScheduleBlockInput[]): Weekday[] {
  if (!blocks.length) return ['SATURDAY', 'SUNDAY'];
  return WEEKDAYS.filter((day) => !blocks.some((block) => block.weekday === day));
}

export function generateInitialSchedule(
  targetMinutes: number,
  dailyMinutes: number,
  restDays: ReadonlySet<Weekday>,
): { blocks: ScheduleBlockInput[]; remainingMinutes: number } {
  const blocks: ScheduleBlockInput[] = [];
  let remainingMinutes = targetMinutes;
  // Match finalmodel.html's 2 PM starting point, shifting earlier if a
  // longer daily block otherwise could not fit in the existing API's range.
  const start = Math.min(14 * 60, EDITOR_END_MINUTES - dailyMinutes);
  for (const weekday of WEEKDAYS) {
    if (restDays.has(weekday) || remainingMinutes <= 0) continue;
    const duration = Math.min(
      dailyMinutes,
      remainingMinutes,
      EDITOR_END_MINUTES - start,
    );
    if (duration <= 0) continue;
    blocks.push({
      weekday,
      startTime: editorClock(start),
      endTime: editorClock(start + duration),
    });
    remainingMinutes -= duration;
  }
  return { blocks, remainingMinutes };
}
