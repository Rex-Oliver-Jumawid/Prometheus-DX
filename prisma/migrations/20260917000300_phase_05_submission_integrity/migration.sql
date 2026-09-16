ALTER TABLE "outcome_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outcome_output_drafts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "activity_logs" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "outcome_submissions", "outcome_output_drafts", "activity_logs" FROM anon, authenticated;
ALTER TABLE "outcome_submissions" ADD CONSTRAINT "submission_content_not_blank" CHECK (length(btrim(content)) > 0);
