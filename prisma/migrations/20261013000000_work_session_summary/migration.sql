-- Existing historical sessions remain valid without a summary.
ALTER TABLE "work_sessions" ADD COLUMN "summary" VARCHAR(2000);
