-- CreateEnum
CREATE TYPE "SubmissionReviewStatus" AS ENUM ('FOR_REVIEW', 'REVIEWED');

-- CreateTable
CREATE TABLE "outcome_output_drafts" (
    "outcome_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outcome_output_drafts_pkey" PRIMARY KEY ("outcome_id","member_id")
);

-- CreateTable
CREATE TABLE "outcome_submissions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "outcome_id" UUID NOT NULL,
    "submitted_by_member_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "review_status" "SubmissionReviewStatus" NOT NULL DEFAULT 'FOR_REVIEW',
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outcome_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_member_id" UUID,
    "project_id" UUID NOT NULL,
    "outcome_id" UUID,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outcome_output_drafts_member_id_idx" ON "outcome_output_drafts"("member_id");

-- CreateIndex
CREATE INDEX "outcome_submissions_outcome_id_created_at_idx" ON "outcome_submissions"("outcome_id", "created_at");

-- CreateIndex
CREATE INDEX "outcome_submissions_submitted_by_member_id_idx" ON "outcome_submissions"("submitted_by_member_id");

-- CreateIndex
CREATE INDEX "outcome_submissions_review_status_idx" ON "outcome_submissions"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "outcome_submissions_outcome_id_submitted_by_member_id_reque_key" ON "outcome_submissions"("outcome_id", "submitted_by_member_id", "request_id");

-- CreateIndex
CREATE INDEX "activity_logs_project_id_created_at_idx" ON "activity_logs"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_outcome_id_created_at_idx" ON "activity_logs"("outcome_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_logs_actor_member_id_idx" ON "activity_logs"("actor_member_id");

-- AddForeignKey
ALTER TABLE "outcome_output_drafts" ADD CONSTRAINT "outcome_output_drafts_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_output_drafts" ADD CONSTRAINT "outcome_output_drafts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_submissions" ADD CONSTRAINT "outcome_submissions_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_submissions" ADD CONSTRAINT "outcome_submissions_submitted_by_member_id_fkey" FOREIGN KEY ("submitted_by_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actor_member_id_fkey" FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_outcome_id_fkey" FOREIGN KEY ("outcome_id") REFERENCES "outcomes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
