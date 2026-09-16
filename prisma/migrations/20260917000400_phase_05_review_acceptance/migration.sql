-- CreateTable
CREATE TABLE "submission_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "submission_id" UUID NOT NULL,
    "reviewed_by_member_id" UUID NOT NULL,
    "review_note" TEXT NOT NULL,
    "criteria_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_revision_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outcome_id" UUID NOT NULL,
    "requested_by_member_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_member_id" UUID,

    CONSTRAINT "outcome_revision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_review_drafts" (
    "outcome_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "criterion_ids" UUID[],
    "note" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outcome_review_drafts_pkey" PRIMARY KEY ("outcome_id","member_id")
);

-- CreateTable
CREATE TABLE "outcome_acceptances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outcome_id" UUID NOT NULL,
    "accepted_by_member_id" UUID NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reopened_by_member_id" UUID,
    "reopened_at" TIMESTAMPTZ(6),
    "feedback" TEXT NOT NULL,
    "criteria_snapshot" JSONB NOT NULL,

    CONSTRAINT "outcome_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_acceptance_members" (
    "acceptance_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,

    CONSTRAINT "outcome_acceptance_members_pkey" PRIMARY KEY ("acceptance_id","member_id")
);

-- CreateIndex
CREATE INDEX "submission_reviews_submission_id_created_at_idx" ON "submission_reviews"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "submission_reviews_reviewed_by_member_id_idx" ON "submission_reviews"("reviewed_by_member_id");

-- CreateIndex
CREATE INDEX "outcome_revision_requests_outcome_id_created_at_idx" ON "outcome_revision_requests"("outcome_id", "created_at");

-- CreateIndex
CREATE INDEX "outcome_revision_requests_requested_by_member_id_idx" ON "outcome_revision_requests"("requested_by_member_id");

-- CreateIndex
CREATE INDEX "outcome_revision_requests_resolved_by_member_id_idx" ON "outcome_revision_requests"("resolved_by_member_id");

-- CreateIndex
CREATE INDEX "outcome_review_drafts_member_id_idx" ON "outcome_review_drafts"("member_id");

-- CreateIndex
CREATE INDEX "outcome_acceptances_outcome_id_accepted_at_idx" ON "outcome_acceptances"("outcome_id", "accepted_at");

-- CreateIndex
CREATE INDEX "outcome_acceptances_accepted_by_member_id_idx" ON "outcome_acceptances"("accepted_by_member_id");

-- CreateIndex
CREATE INDEX "outcome_acceptances_reopened_by_member_id_idx" ON "outcome_acceptances"("reopened_by_member_id");

-- CreateIndex
CREATE INDEX "outcome_acceptance_members_member_id_idx" ON "outcome_acceptance_members"("member_id");

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "outcome_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_reviews" ADD CONSTRAINT "submission_reviews_reviewed_by_member_id_fkey" FOREIGN KEY ("reviewed_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_revision_requests" ADD CONSTRAINT "outcome_revision_requests_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_revision_requests" ADD CONSTRAINT "outcome_revision_requests_requested_by_member_id_fkey" FOREIGN KEY ("requested_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_revision_requests" ADD CONSTRAINT "outcome_revision_requests_resolved_by_member_id_fkey" FOREIGN KEY ("resolved_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_review_drafts" ADD CONSTRAINT "outcome_review_drafts_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_review_drafts" ADD CONSTRAINT "outcome_review_drafts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_acceptances" ADD CONSTRAINT "outcome_acceptances_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_acceptances" ADD CONSTRAINT "outcome_acceptances_accepted_by_member_id_fkey" FOREIGN KEY ("accepted_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_acceptances" ADD CONSTRAINT "outcome_acceptances_reopened_by_member_id_fkey" FOREIGN KEY ("reopened_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_acceptance_members" ADD CONSTRAINT "outcome_acceptance_members_acceptance_id_fkey" FOREIGN KEY ("acceptance_id") REFERENCES "outcome_acceptances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_acceptance_members" ADD CONSTRAINT "outcome_acceptance_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
