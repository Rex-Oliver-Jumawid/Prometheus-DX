import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type Member, Prisma } from '@prisma/client';
import type {
  OutcomeDelivery,
  OutputDraftInput,
  SubmitOutputInput,
  ReviewDraftInput,
  ReviewDecisionInput,
} from '../../shared/contracts/outcome-delivery';
import { CriteriaSnapshotSchema } from '../../shared/contracts/outcome-delivery';
import { PrismaService } from '../database/prisma.service';

const contextInclude = {
  stage: {
    select: { projectId: true, project: { select: { leadMemberId: true } } },
  },
  members: { select: { memberId: true } },
  acceptanceCriteria: { orderBy: { position: 'asc' as const } },
  prerequisites: {
    include: {
      prerequisiteOutcome: { select: { lifecycleStatus: true, title: true } },
    },
  },
} satisfies Prisma.OutcomeInclude;
type Context = Prisma.OutcomeGetPayload<{ include: typeof contextInclude }>;
const personSelect = { id: true, fullName: true, email: true } as const;

@Injectable()
export class OutcomeDeliveryService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private async context(
    db: Prisma.TransactionClient,
    projectId: string,
    outcomeId: string,
  ) {
    const outcome = await db.outcome.findUnique({
      where: { id: outcomeId },
      include: contextInclude,
    });
    if (!outcome || outcome.stage.projectId !== projectId)
      throw new NotFoundException('Outcome not found.');
    return outcome;
  }

  private isLocked(outcome: Context) {
    return outcome.prerequisites.some(
      (dependency) =>
        !dependency.overrideResolvedAt &&
        dependency.prerequisiteOutcome.lifecycleStatus !== 'ACCEPTED',
    );
  }

  private requireMember(outcome: Context, member: Member) {
    if (!outcome.members.some((item) => item.memberId === member.id))
      throw new ForbiddenException(
        'Only Outcome Members may submit or save output drafts.',
      );
  }

  private requireOpen(outcome: Context) {
    if (outcome.lifecycleStatus === 'ACCEPTED')
      throw new ConflictException(
        'Accepted Outcomes are closed to submissions.',
      );
    if (this.isLocked(outcome))
      throw new ConflictException(
        'Resolve the prerequisite before submitting Output.',
      );
  }

  async getDelivery(
    member: Member,
    projectId: string,
    outcomeId: string,
  ): Promise<OutcomeDelivery> {
    const outcome = await this.context(this.prisma, projectId, outcomeId);
    const [submissions, draft, activity, reviewDraft, revisions, acceptances] =
      await Promise.all([
        this.prisma.outcomeSubmission.findMany({
          where: { outcomeId },
          include: {
            submittedByMember: { select: personSelect },
            reviews: {
              include: { reviewedByMember: { select: personSelect } },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.outcomeOutputDraft.findUnique({
          where: { outcomeId_memberId: { outcomeId, memberId: member.id } },
        }),
        this.prisma.activityLog.findMany({
          where: { outcomeId },
          include: { actorMember: { select: { fullName: true } } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        outcome.stage.project.leadMemberId === member.id
          ? this.prisma.outcomeReviewDraft.findUnique({
              where: { outcomeId_memberId: { outcomeId, memberId: member.id } },
            })
          : Promise.resolve(null),
        this.prisma.outcomeRevisionRequest.findMany({
          where: { outcomeId },
          include: { requestedByMember: { select: personSelect } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.outcomeAcceptance.findMany({
          where: { outcomeId },
          include: {
            acceptedByMember: { select: personSelect },
            reopenedByMember: { select: personSelect },
            members: { include: { member: { select: personSelect } } },
          },
          orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
        }),
      ]);
    return {
      lifecycleStatus: outcome.lifecycleStatus,
      outcomeUpdatedAt: outcome.updatedAt.toISOString(),
      criteria: outcome.acceptanceCriteria.map((item) => ({
        id: item.id,
        description: item.description,
        position: item.position,
      })),
      reviewDraft: reviewDraft
        ? {
            criterionIds: reviewDraft.criterionIds.filter((id) =>
              outcome.acceptanceCriteria.some((item) => item.id === id),
            ),
            note: reviewDraft.note,
            updatedAt: reviewDraft.updatedAt.toISOString(),
          }
        : null,
      revisions: revisions.map((item) => ({
        id: item.id,
        message: item.message,
        requester: item.requestedByMember,
        createdAt: item.createdAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
      acceptances: acceptances.map((item) => ({
        id: item.id,
        acceptedAt: item.acceptedAt.toISOString(),
        acceptedBy: item.acceptedByMember,
        reopenedAt: item.reopenedAt?.toISOString() ?? null,
        reopenedBy: item.reopenedByMember,
        feedback: item.feedback,
        criteria: CriteriaSnapshotSchema.parse(item.criteriaSnapshot),
        members: item.members.map((credit) => credit.member),
      })),
      dependencies: outcome.prerequisites.map((item) => ({
        id: item.id,
        prerequisiteId: item.prerequisiteOutcomeId,
        title: item.prerequisiteOutcome.title,
        resolved:
          Boolean(item.overrideResolvedAt) ||
          item.prerequisiteOutcome.lifecycleStatus === 'ACCEPTED',
        overrideReason: item.overrideReason,
      })),
      submissions: submissions.map((submission) => ({
        id: submission.id,
        content: submission.content,
        note: submission.note,
        submitter: submission.submittedByMember,
        reviewStatus: submission.reviewStatus,
        createdAt: submission.createdAt.toISOString(),
        reviews: submission.reviews.map((review) => ({
          id: review.id,
          reviewer: review.reviewedByMember,
          note: review.reviewNote,
          criteria: CriteriaSnapshotSchema.parse(review.criteriaSnapshot),
          createdAt: review.createdAt.toISOString(),
        })),
      })),
      draft: draft
        ? {
            content: draft.content,
            note: draft.note,
            updatedAt: draft.updatedAt.toISOString(),
          }
        : null,
      canSubmit:
        outcome.lifecycleStatus !== 'ACCEPTED' &&
        !this.isLocked(outcome) &&
        outcome.members.some((item) => item.memberId === member.id),
      isLead: outcome.stage.project.leadMemberId === member.id,
      hasForReview: submissions.some(
        (item) => item.reviewStatus === 'FOR_REVIEW',
      ),
      activity: activity.map((item) => ({
        id: item.id,
        action: item.action,
        actor: item.actorMember?.fullName ?? null,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }

  private async mutate(
    member: Member,
    projectId: string,
    outcomeId: string,
    action: (
      db: Prisma.TransactionClient,
      outcome: Context,
    ) => Promise<unknown>,
  ) {
    await this.prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const outcome = await this.context(db, projectId, outcomeId);
      await action(db, outcome);
    });
    return this.getDelivery(member, projectId, outcomeId);
  }

  saveDraft(
    member: Member,
    projectId: string,
    outcomeId: string,
    input: OutputDraftInput,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireMember(outcome, member);
      this.requireOpen(outcome);
      const key = { outcomeId, memberId: member.id };
      const current = await db.outcomeOutputDraft.findUnique({
        where: { outcomeId_memberId: key },
      });
      if ((current?.updatedAt.toISOString() ?? null) !== input.updatedAt)
        throw new ConflictException(
          'Your saved draft changed in another window. Refresh before saving.',
        );
      await db.outcomeOutputDraft.upsert({
        where: { outcomeId_memberId: key },
        create: { ...key, content: input.content, note: input.note },
        update: { content: input.content, note: input.note },
      });
    });
  }

  submit(
    member: Member,
    projectId: string,
    outcomeId: string,
    input: SubmitOutputInput,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireMember(outcome, member);
      const key = {
        outcomeId,
        submittedByMemberId: member.id,
        requestId: input.requestId,
      };
      const existing = await db.outcomeSubmission.findUnique({
        where: { outcomeId_submittedByMemberId_requestId: key },
      });
      if (existing) {
        if (existing.content !== input.content || existing.note !== input.note)
          throw new ConflictException(
            'This submission request was already used for different content.',
          );
        return;
      }
      this.requireOpen(outcome);
      const draft = await db.outcomeOutputDraft.findUnique({
        where: { outcomeId_memberId: { outcomeId, memberId: member.id } },
      });
      if ((draft?.updatedAt.toISOString() ?? null) !== input.draftUpdatedAt)
        throw new ConflictException(
          'Your draft changed in another window. Refresh before submitting.',
        );
      const submission = await db.outcomeSubmission.create({
        data: { ...key, content: input.content, note: input.note },
      });
      await db.outcomeOutputDraft.deleteMany({
        where: { outcomeId, memberId: member.id },
      });
      await db.outcomeReviewDraft.updateMany({
        where: { outcomeId },
        data: { criterionIds: [] },
      });
      await db.activityLog.create({
        data: {
          projectId,
          outcomeId,
          actorMemberId: member.id,
          entityType: 'OutcomeSubmission',
          entityId: submission.id,
          action: 'SUBMISSION_CREATED',
          metadata: { content: input.content },
        },
      });
    });
  }

  private requireLead(outcome: Context, member: Member) {
    if (outcome.stage.project.leadMemberId !== member.id)
      throw new ForbiddenException(
        'Only the assigned Project Lead may review, accept, reopen, or resolve dependencies.',
      );
  }

  private requireVersion(outcome: Context, updatedAt: string) {
    if (outcome.updatedAt.toISOString() !== updatedAt)
      throw new ConflictException(
        'The Outcome changed. Refresh before making this decision.',
      );
  }

  private async requireHistory(
    db: Prisma.TransactionClient,
    outcomeId: string,
    ids: string[],
  ) {
    const submissions = await db.outcomeSubmission.findMany({
      where: { outcomeId },
      select: { id: true, reviewStatus: true },
    });
    if (!submissions.length)
      throw new ConflictException(
        'There are no shared submissions to review yet.',
      );
    if (
      submissions.length !== ids.length ||
      submissions.some((item) => !ids.includes(item.id))
    )
      throw new ConflictException(
        'The shared submission history changed. Refresh and review the new history.',
      );
    return submissions;
  }

  private snapshot(outcome: Context, ids: string[]) {
    if (
      ids.some(
        (id) => !outcome.acceptanceCriteria.some((item) => item.id === id),
      )
    )
      throw new ConflictException(
        'Acceptance criteria changed. Refresh the Outcome.',
      );
    return outcome.acceptanceCriteria.map((item) => ({
      id: item.id,
      description: item.description,
      verified: ids.includes(item.id),
    }));
  }

  private async record(
    db: Prisma.TransactionClient,
    member: Member,
    projectId: string,
    outcomeId: string,
    action: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    await db.activityLog.create({
      data: {
        actorMemberId: member.id,
        projectId,
        outcomeId,
        entityType: 'Outcome',
        entityId: outcomeId,
        action,
        metadata,
      },
    });
  }

  saveReviewDraft(
    member: Member,
    projectId: string,
    outcomeId: string,
    input: ReviewDraftInput,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      if (outcome.lifecycleStatus === 'ACCEPTED')
        throw new ConflictException(
          'Reopen the Outcome before reviewing new work.',
        );
      await this.requireHistory(db, outcomeId, input.submissionIds);
      this.snapshot(outcome, input.criterionIds);
      const key = { outcomeId, memberId: member.id };
      const existing = await db.outcomeReviewDraft.findUnique({
        where: { outcomeId_memberId: key },
      });
      if ((existing?.updatedAt.toISOString() ?? null) !== input.updatedAt)
        throw new ConflictException(
          'Review preparation changed. Refresh before saving.',
        );
      await db.outcomeReviewDraft.upsert({
        where: { outcomeId_memberId: key },
        create: { ...key, criterionIds: input.criterionIds, note: input.note },
        update: { criterionIds: input.criterionIds, note: input.note },
      });
    });
  }

  private async reviewPending(
    db: Prisma.TransactionClient,
    member: Member,
    ids: string[],
    note: string,
    criteria: Prisma.InputJsonValue,
  ) {
    if (!ids.length) return;
    await db.submissionReview.createMany({
      data: ids.map((submissionId) => ({
        submissionId,
        reviewedByMemberId: member.id,
        reviewNote: note,
        criteriaSnapshot: criteria,
      })),
    });
    await db.outcomeSubmission.updateMany({
      where: { id: { in: ids } },
      data: { reviewStatus: 'REVIEWED' },
    });
  }

  reviewSubmission(
    member: Member,
    projectId: string,
    outcomeId: string,
    submissionId: string,
    input: ReviewDecisionInput,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      this.requireVersion(outcome, input.outcomeUpdatedAt);
      if (outcome.lifecycleStatus === 'ACCEPTED')
        throw new ConflictException('This Outcome has already been accepted.');
      const submissions = await this.requireHistory(
        db,
        outcomeId,
        input.submissionIds,
      );
      const submission = submissions.find((item) => item.id === submissionId);
      if (!submission)
        throw new NotFoundException('Submission not found in this Outcome.');
      if (submission.reviewStatus === 'REVIEWED') return;
      await this.reviewPending(
        db,
        member,
        [submissionId],
        input.note,
        this.snapshot(outcome, input.criterionIds),
      );
      await this.record(
        db,
        member,
        projectId,
        outcomeId,
        'SUBMISSION_REVIEWED',
        { submissionId },
      );
    });
  }

  requestRevision(
    member: Member,
    projectId: string,
    outcomeId: string,
    input: ReviewDecisionInput,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      this.requireVersion(outcome, input.outcomeUpdatedAt);
      if (outcome.lifecycleStatus === 'ACCEPTED')
        throw new ConflictException(
          'Reopen the Outcome before requesting revision.',
        );
      if (!input.note.trim())
        throw new ConflictException('Explain what the team must revise.');
      const submissions = await this.requireHistory(
        db,
        outcomeId,
        input.submissionIds,
      );
      await db.outcomeRevisionRequest.create({
        data: {
          outcomeId,
          requestedByMemberId: member.id,
          message: input.note,
        },
      });
      await db.outcome.update({
        where: { id: outcomeId },
        data: { lifecycleStatus: 'NEEDS_REVISION' },
      });
      await this.reviewPending(
        db,
        member,
        submissions
          .filter((item) => item.reviewStatus === 'FOR_REVIEW')
          .map((item) => item.id),
        input.note,
        this.snapshot(outcome, input.criterionIds),
      );
      await this.record(
        db,
        member,
        projectId,
        outcomeId,
        'REVISION_REQUESTED',
        { message: input.note },
      );
    });
  }

  resolveRevision(
    member: Member,
    projectId: string,
    outcomeId: string,
    updatedAt: string,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      this.requireVersion(outcome, updatedAt);
      if (outcome.lifecycleStatus !== 'NEEDS_REVISION')
        throw new ConflictException('This Outcome has no revision to resolve.');
      await db.outcomeRevisionRequest.updateMany({
        where: { outcomeId, resolvedAt: null },
        data: { resolvedAt: new Date(), resolvedByMemberId: member.id },
      });
      await db.outcome.update({
        where: { id: outcomeId },
        data: { lifecycleStatus: 'OPEN' },
      });
      await this.record(db, member, projectId, outcomeId, 'REVISION_RESOLVED');
    });
  }

  accept(
    member: Member,
    projectId: string,
    outcomeId: string,
    input: ReviewDecisionInput,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      this.requireVersion(outcome, input.outcomeUpdatedAt);
      this.requireOpen(outcome);
      const submissions = await this.requireHistory(
        db,
        outcomeId,
        input.submissionIds,
      );
      const criteria = this.snapshot(outcome, input.criterionIds);
      if (criteria.some((item) => !item.verified))
        throw new ConflictException(
          'Verify every acceptance criterion against the combined submissions before accepting.',
        );
      const now = new Date();
      const feedback =
        input.note ||
        'The combined submissions satisfy the expected Outcome and all acceptance criteria.';
      const acceptance = await db.outcomeAcceptance.create({
        data: {
          outcomeId,
          acceptedByMemberId: member.id,
          acceptedAt: now,
          feedback,
          criteriaSnapshot: criteria,
          members: {
            create: outcome.members.map((item) => ({
              memberId: item.memberId,
            })),
          },
        },
      });
      await db.outcome.update({
        where: { id: outcomeId },
        data: { lifecycleStatus: 'ACCEPTED', acceptedAt: now },
      });
      await db.outcomeRevisionRequest.updateMany({
        where: { outcomeId, resolvedAt: null },
        data: { resolvedAt: now, resolvedByMemberId: member.id },
      });
      await this.reviewPending(
        db,
        member,
        submissions
          .filter((item) => item.reviewStatus === 'FOR_REVIEW')
          .map((item) => item.id),
        feedback,
        criteria,
      );
      await db.outcomeReviewDraft.deleteMany({ where: { outcomeId } });
      await this.record(db, member, projectId, outcomeId, 'OUTCOME_ACCEPTED', {
        acceptanceId: acceptance.id,
        creditedMembers: outcome.members.map((item) => item.memberId),
      });
    });
  }

  reopen(
    member: Member,
    projectId: string,
    outcomeId: string,
    updatedAt: string,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      this.requireVersion(outcome, updatedAt);
      if (outcome.lifecycleStatus !== 'ACCEPTED')
        throw new ConflictException(
          'Only an accepted Outcome can be reopened.',
        );
      const acceptance = await db.outcomeAcceptance.findFirst({
        where: { outcomeId, reopenedAt: null },
        orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }],
      });
      if (!acceptance)
        throw new ConflictException(
          'This Outcome has no acceptance record to reopen.',
        );
      await db.outcomeAcceptance.update({
        where: { id: acceptance.id },
        data: { reopenedAt: new Date(), reopenedByMemberId: member.id },
      });
      await db.outcome.update({
        where: { id: outcomeId },
        data: { lifecycleStatus: 'OPEN', acceptedAt: null },
      });
      await this.record(db, member, projectId, outcomeId, 'OUTCOME_REOPENED', {
        acceptanceId: acceptance.id,
      });
    });
  }

  overrideDependency(
    member: Member,
    projectId: string,
    outcomeId: string,
    dependencyId: string,
    reason: string,
  ) {
    return this.mutate(member, projectId, outcomeId, async (db, outcome) => {
      this.requireLead(outcome, member);
      const dependency = outcome.prerequisites.find(
        (item) => item.id === dependencyId,
      );
      if (!dependency)
        throw new NotFoundException('Dependency not found in this Outcome.');
      if (dependency.overrideResolvedAt) return;
      await db.outcomeDependency.update({
        where: { id: dependencyId },
        data: {
          overrideResolvedAt: new Date(),
          overrideResolvedByMemberId: member.id,
          overrideReason: reason,
        },
      });
      await this.record(
        db,
        member,
        projectId,
        outcomeId,
        'OUTCOME_DEPENDENCY_OVERRIDDEN',
        { dependencyId, reason },
      );
    });
  }
}
