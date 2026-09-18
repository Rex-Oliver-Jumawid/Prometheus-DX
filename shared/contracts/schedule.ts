import { z } from 'zod';

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export const WeekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const ClockTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:00.');

export const ScheduleBlockInputSchema = z.object({
  weekday: WeekdaySchema,
  startTime: ClockTimeSchema,
  endTime: ClockTimeSchema,
});

export type ScheduleBlockInput = z.infer<typeof ScheduleBlockInputSchema>;

export function clockTimeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function findScheduleConflict(
  blocks: ScheduleBlockInput[],
): { first: number; second: number } | null {
  const indexed = blocks
    .map((block, index) => ({ block, index }))
    .sort(
      (left, right) =>
        WEEKDAYS.indexOf(left.block.weekday) -
          WEEKDAYS.indexOf(right.block.weekday) ||
        clockTimeToMinutes(left.block.startTime) -
          clockTimeToMinutes(right.block.startTime) ||
        clockTimeToMinutes(left.block.endTime) -
          clockTimeToMinutes(right.block.endTime),
    );

  for (let index = 1; index < indexed.length; index += 1) {
    const previous = indexed[index - 1];
    const current = indexed[index];
    if (
      previous.block.weekday === current.block.weekday &&
      clockTimeToMinutes(current.block.startTime) <
        clockTimeToMinutes(previous.block.endTime)
    ) {
      return { first: previous.index, second: current.index };
    }
  }

  return null;
}

export const UpdateScheduleRequestSchema = z
  .object({
    targetWeeklyMinutes: z.number().int().min(0).max(10_080),
    blocks: z.array(ScheduleBlockInputSchema).max(28),
  })
  .superRefine((value, context) => {
    value.blocks.forEach((block, index) => {
      if (
        clockTimeToMinutes(block.startTime) >= clockTimeToMinutes(block.endTime)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Start time must be earlier than end time.',
          path: ['blocks', index, 'endTime'],
        });
      }
    });

    const conflict = findScheduleConflict(value.blocks);
    if (conflict) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Schedule blocks on the same day cannot overlap.',
        path: ['blocks', conflict.second],
      });
    }
  });

export type UpdateScheduleRequest = z.infer<typeof UpdateScheduleRequestSchema>;

export const ScheduleBlockSchema = ScheduleBlockInputSchema.extend({
  id: z.string().uuid(),
});

export const MemberScheduleSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  targetWeeklyMinutes: z.number().int().min(0),
  blocks: z.array(ScheduleBlockSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const MyScheduleResponseSchema = z.object({
  schedule: MemberScheduleSchema.nullable(),
});

export type MemberSchedule = z.infer<typeof MemberScheduleSchema>;

export const TeamScheduleMemberSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  position: z.string().nullable(),
  department: z.object({
    id: z.string().uuid(),
    name: z.string(),
    shortLabel: z.string(),
  }),
  schedule: MemberScheduleSchema.nullable(),
});

export const TeamScheduleResponseSchema = z.object({
  timezone: z.literal('Asia/Manila'),
  members: z.array(TeamScheduleMemberSchema),
});

export type TeamScheduleResponse = z.infer<typeof TeamScheduleResponseSchema>;
