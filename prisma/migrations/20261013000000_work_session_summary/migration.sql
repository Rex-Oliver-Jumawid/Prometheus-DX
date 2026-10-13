-- Existing historical sessions remain valid without a summary.
ALTER TABLE "work_sessions" ADD COLUMN IF NOT EXISTS "summary" VARCHAR(2000);
