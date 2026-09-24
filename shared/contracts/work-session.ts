import { z } from 'zod';
import { ScheduleBlockSchema } from './schedule';

export const WORKSPACE_TIMEZONE = 'Asia/Manila' as const;

export const WorkSessionStatusSchema = z.enum([
  'OPEN',
  'COMPLETED',
  'NEEDS_CORRECTION',
]);

export type WorkSessionStatus = z.infer<typeof WorkSessionStatusSchema>;

export const WorkSessionSchema = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  timeIn: z.string().datetime(),
  timeOut: z.string().datetime().nullable(),
  status: WorkSessionStatusSchema,
  durationSeconds: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WorkSession = z.infer<typeof WorkSessionSchema>;

export const CurrentWorkSessionResponseSchema = z.object({
  timezone: z.literal(WORKSPACE_TIMEZONE),
  asOf: z.string().datetime(),
  session: WorkSessionSchema.nullable(),
});

export type CurrentWorkSessionResponse = z.infer<
  typeof CurrentWorkSessionResponseSchema
>;

export const WorkSessionHistoryResponseSchema = z.object({
  timezone: z.literal(WORKSPACE_TIMEZONE),
  weekStart: z.string().datetime(),
  weekEnd: z.string().datetime(),
  totalDurationSeconds: z.number().int().nonnegative(),
  sessions: z.array(WorkSessionSchema),
});

export type WorkSessionHistoryResponse = z.infer<
  typeof WorkSessionHistoryResponseSchema
>;

export const CorrectWorkSessionRequestSchema = z
  .object({
    newTimeIn: z.string().datetime(),
    newTimeOut: z.string().datetime(),
    reason: z.string().trim().min(3).max(1_000),
  })
  .superRefine((value, context) => {
    if (Date.parse(value.newTimeOut) < Date.parse(value.newTimeIn)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Time Out must not precede Time In.',
        path: ['newTimeOut'],
      });
    }
  });

export type CorrectWorkSessionRequest = z.infer<
  typeof CorrectWorkSessionRequestSchema
>;

export const WorkSessionCorrectionSchema = z.object({
  id: z.string().uuid(),
  workSessionId: z.string().uuid(),
  memberId: z.string().uuid(),
  previousTimeIn: z.string().datetime(),
  previousTimeOut: z.string().datetime().nullable(),
  newTimeIn: z.string().datetime(),
  newTimeOut: z.string().datetime(),
  reason: z.string(),
  createdAt: z.string().datetime(),
});

export const CorrectWorkSessionResponseSchema = z.object({
  session: WorkSessionSchema,
  correction: WorkSessionCorrectionSchema,
});

export const WorkSessionWeekQuerySchema = z.object({
  week: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Week must use YYYY-MM-DD.')
    .optional(),
});

export const TeamWorkMemberSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  position: z.string().nullable(),
  department: z.object({
    id: z.string().uuid(),
    name: z.string(),
    shortLabel: z.string(),
  }),
  visiworkDepartmentId: z.string().uuid().nullable(),
  workingNow: z.boolean(),
  scheduledMinutes: z.number().int().nonnegative(),
  actualWorkedSeconds: z.number().int().nonnegative(),
  todaySchedule: z.array(ScheduleBlockSchema),
});

export const TeamWorkSummaryResponseSchema = z.object({
  timezone: z.literal(WORKSPACE_TIMEZONE),
  asOf: z.string().datetime(),
  weekStart: z.string().datetime(),
  weekEnd: z.string().datetime(),
  summary: z.object({
    memberCount: z.number().int().nonnegative(),
    workingNowCount: z.number().int().nonnegative(),
    scheduledMinutes: z.number().int().nonnegative(),
    actualWorkedSeconds: z.number().int().nonnegative(),
  }),
  members: z.array(TeamWorkMemberSchema),
});

export type TeamWorkSummaryResponse = z.infer<
  typeof TeamWorkSummaryResponseSchema
>;
