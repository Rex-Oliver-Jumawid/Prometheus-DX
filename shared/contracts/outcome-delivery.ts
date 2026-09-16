import { z } from 'zod';
import { ProjectMemberSummarySchema } from './project';
import {
  AcceptanceCriterionSchema,
  OutcomeLifecycleStatusSchema,
} from './project-workflow';

const UniqueIds = z
  .array(z.string().uuid())
  .max(10000)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    'Choose each record once.',
  );
export const CriteriaSnapshotSchema = z.array(
  z.object({
    id: z.string().uuid(),
    description: z.string(),
    verified: z.boolean(),
  }),
);
export const ReviewDraftInputSchema = z
  .object({
    criterionIds: UniqueIds,
    note: z.string().trim().max(10000),
    updatedAt: z.string().datetime().nullable(),
    submissionIds: UniqueIds,
  })
  .strict();
export const ReviewDecisionInputSchema = z
  .object({
    criterionIds: UniqueIds,
    note: z.string().trim().max(10000),
    outcomeUpdatedAt: z.string().datetime(),
    submissionIds: UniqueIds,
  })
  .strict();
export const RevisionInputSchema = ReviewDecisionInputSchema.extend({
  note: z
    .string()
    .trim()
    .min(1, 'Explain what the team must revise.')
    .max(10000),
});
export const OutcomeVersionInputSchema = z
  .object({ outcomeUpdatedAt: z.string().datetime() })
  .strict();
export const DependencyOverrideInputSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, 'Explain why this dependency may be skipped.')
      .max(2000),
  })
  .strict();

export type ReviewDraftInput = z.infer<typeof ReviewDraftInputSchema>;
export type ReviewDecisionInput = z.infer<typeof ReviewDecisionInputSchema>;

export const OutputDraftInputSchema = z
  .object({
    content: z.string().trim().max(10000),
    note: z.string().trim().max(10000).default(''),
    updatedAt: z.string().datetime().nullable().default(null),
  })
  .strict();
export const SubmitOutputInputSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, 'Add an output name, text, or link before submitting.')
      .max(10000),
    note: z.string().trim().max(10000).default(''),
    requestId: z.string().uuid(),
    draftUpdatedAt: z.string().datetime().nullable().default(null),
  })
  .strict();
export const OutputDraftSchema = z.object({
  content: z.string(),
  note: z.string(),
  updatedAt: z.string().datetime(),
});
export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  note: z.string(),
  submitter: ProjectMemberSummarySchema,
  reviewStatus: z.enum(['FOR_REVIEW', 'REVIEWED']),
  createdAt: z.string().datetime(),
  reviews: z.array(
    z.object({
      id: z.string().uuid(),
      reviewer: ProjectMemberSummarySchema,
      note: z.string(),
      criteria: CriteriaSnapshotSchema,
      createdAt: z.string().datetime(),
    }),
  ),
});
export const ActivitySchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  actor: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export const OutcomeDeliverySchema = z.object({
  lifecycleStatus: OutcomeLifecycleStatusSchema,
  outcomeUpdatedAt: z.string().datetime(),
  criteria: z.array(AcceptanceCriterionSchema),
  reviewDraft: z
    .object({
      criterionIds: z.array(z.string().uuid()),
      note: z.string(),
      updatedAt: z.string().datetime(),
    })
    .nullable(),
  revisions: z.array(
    z.object({
      id: z.string().uuid(),
      message: z.string(),
      requester: ProjectMemberSummarySchema,
      createdAt: z.string().datetime(),
      resolvedAt: z.string().datetime().nullable(),
    }),
  ),
  acceptances: z.array(
    z.object({
      id: z.string().uuid(),
      acceptedAt: z.string().datetime(),
      acceptedBy: ProjectMemberSummarySchema,
      reopenedAt: z.string().datetime().nullable(),
      reopenedBy: ProjectMemberSummarySchema.nullable(),
      feedback: z.string(),
      criteria: CriteriaSnapshotSchema,
      members: z.array(ProjectMemberSummarySchema),
    }),
  ),
  dependencies: z.array(
    z.object({
      id: z.string().uuid(),
      prerequisiteId: z.string().uuid(),
      title: z.string(),
      resolved: z.boolean(),
      overrideReason: z.string().nullable(),
    }),
  ),
  submissions: z.array(SubmissionSchema),
  draft: OutputDraftSchema.nullable(),
  canSubmit: z.boolean(),
  isLead: z.boolean(),
  hasForReview: z.boolean(),
  activity: z.array(ActivitySchema),
});
export type OutputDraftInput = z.infer<typeof OutputDraftInputSchema>;
export type SubmitOutputInput = z.infer<typeof SubmitOutputInputSchema>;
export type OutcomeDelivery = z.infer<typeof OutcomeDeliverySchema>;
export type Submission = z.infer<typeof SubmissionSchema>;
