import { z } from 'zod';

export const WorkItemInputSchema = z
  .object({
    title: z.string().trim().min(1, 'Enter a title.').max(200),
    description: z.string().trim().max(5000).default(''),
  })
  .strict();

export const EditWorkItemSchema = WorkItemInputSchema.extend({
  updatedAt: z.string().datetime(),
});

export const TaskStateInputSchema = z
  .object({
    status: z.enum(['TODO', 'DONE']),
    updatedAt: z.string().datetime(),
  })
  .strict();

const WorkItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  position: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TaskSchema = WorkItemSchema.extend({
  status: z.enum(['TODO', 'DONE']),
  completedAt: z.string().datetime().nullable(),
});
export const FeatureSchema = WorkItemSchema.extend({
  tasks: z.array(TaskSchema),
});
export const OutcomeWorkSchema = z.object({
  features: z.array(FeatureSchema),
  canPlan: z.boolean(),
  canExecute: z.boolean(),
  completedTasks: z.number().int(),
  totalTasks: z.number().int(),
  progress: z.number().min(0).max(100).nullable(),
});

export type WorkItemInput = z.infer<typeof WorkItemInputSchema>;
export type EditWorkItem = z.infer<typeof EditWorkItemSchema>;
export type TaskStateInput = z.infer<typeof TaskStateInputSchema>;
export type OutcomeWork = z.infer<typeof OutcomeWorkSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type Task = z.infer<typeof TaskSchema>;
