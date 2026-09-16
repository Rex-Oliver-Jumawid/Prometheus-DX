ALTER TABLE "submission_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outcome_review_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outcome_revision_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outcome_acceptances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outcome_acceptance_members" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "submission_reviews", "outcome_review_drafts", "outcome_revision_requests", "outcome_acceptances", "outcome_acceptance_members" FROM anon, authenticated;

CREATE UNIQUE INDEX "one_current_outcome_acceptance" ON "outcome_acceptances" ("outcome_id") WHERE "reopened_at" IS NULL;
ALTER TABLE "outcome_acceptances" ADD CONSTRAINT "acceptance_reopening_consistent" CHECK ((reopened_at IS NULL) = (reopened_by_member_id IS NULL));
ALTER TABLE "outcome_revision_requests" ADD CONSTRAINT "revision_resolution_consistent" CHECK ((resolved_at IS NULL) = (resolved_by_member_id IS NULL));
ALTER TABLE "outcome_revision_requests" ADD CONSTRAINT "revision_feedback_not_blank" CHECK (length(btrim(message)) > 0);
